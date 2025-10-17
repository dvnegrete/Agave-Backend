import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { ConversationStateService } from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { VoucherDuplicateDetectorService } from '../infrastructure/persistence/voucher-duplicate-detector.service';
import { GcsCleanupService } from '@/shared/libs/google-cloud';
import { ConfirmationMessages, ErrorMessages } from '@/shared/content';
import {
  combineDateAndTime,
  parsePhoneNumberWithCountryCode,
} from '@/shared/common/utils';
import { generateUniqueConfirmationCode } from '../shared/helpers';
import { Role, Status } from '@/shared/database/entities/enums';

export interface ConfirmVoucherInput {
  phoneNumber: string;
}

export interface ConfirmVoucherOutput {
  success: boolean;
  confirmationCode?: string;
  error?: string;
}

/**
 * Use Case: Confirmar y registrar un voucher en la base de datos
 *
 * Responsabilidades:
 * - Validar que existan datos guardados para confirmación
 * - Combinar fecha y hora
 * - Generar código de confirmación único (con retry logic)
 * - Insertar voucher en base de datos
 * - Enviar mensaje de éxito al usuario
 * - Limpiar contexto de conversación
 */
@Injectable()
export class ConfirmVoucherUseCase {
  private readonly logger = new Logger(ConfirmVoucherUseCase.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly voucherRepository: VoucherRepository,
    private readonly recordRepository: RecordRepository,
    private readonly houseRepository: HouseRepository,
    private readonly userRepository: UserRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly conversationState: ConversationStateService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
    private readonly duplicateDetector: VoucherDuplicateDetectorService,
    private readonly gcsCleanupService: GcsCleanupService,
  ) {}

  async execute(input: ConfirmVoucherInput): Promise<ConfirmVoucherOutput> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const { phoneNumber } = input;

      // 1. Obtener datos guardados para confirmación
      const savedData =
        this.conversationState.getVoucherDataForConfirmation(phoneNumber);

      if (!savedData) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          ErrorMessages.sessionExpired,
        );
        this.conversationState.clearContext(phoneNumber);
        return { success: false, error: 'Session expired' };
      }

      // 2. Validar que el número de casa esté presente (obligatorio)
      if (!savedData.voucherData.casa) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          'Error: El número de casa es obligatorio. Por favor intenta nuevamente.',
        );
        this.conversationState.clearContext(phoneNumber);
        return { success: false, error: 'Missing house number' };
      }

      // 3. Combinar fecha y hora para el campo timestamp
      const dateTime = combineDateAndTime(
        savedData.voucherData.fecha_pago,
        savedData.voucherData.hora_transaccion,
      );

      // 4. VALIDACIÓN DE DUPLICADOS (antes de crear transacción)
      const amount = parseFloat(savedData.voucherData.monto);
      const duplicateCheck = await this.duplicateDetector.detectDuplicate(
        dateTime,
        amount,
        savedData.voucherData.casa,
      );

      if (duplicateCheck.isDuplicate) {
        this.logger.warn(
          `⚠️  Duplicado detectado. Rechazando voucher. ${duplicateCheck.message}`,
        );

        // Eliminar archivo GCS
        if (savedData.gcsFilename) {
          await this.cleanupGcsFile(savedData.gcsFilename);
        }

        // Enviar mensaje de rechazo
        await this.sendWhatsAppMessage(
          phoneNumber,
          `❌ Este comprobante ya fue registrado previamente. ${duplicateCheck.message}`,
        );

        // Limpiar contexto
        this.conversationState.clearContext(phoneNumber);

        return {
          success: false,
          error: `Duplicado detectado: ${duplicateCheck.message}`,
        };
      }

      // 5. Preparar datos del voucher
      const voucherData = {
        date: dateTime,
        authorization_number: savedData.voucherData.referencia || 'N/A',
        amount: amount,
        confirmation_status: false,
        url: savedData.gcsFilename,
      };

      // 5. Generar código único e insertar voucher (con retry logic)
      const result = await generateUniqueConfirmationCode(
        this.voucherRepository,
        voucherData,
      );

      if (!result.success) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          'Hubo un error al registrar tu pago. Por favor intenta nuevamente más tarde.',
        );
        this.conversationState.clearContext(phoneNumber);
        return { success: false, error: result.error };
      }

      // INICIO DE TRANSACCIÓN - Garantiza atomicidad de todas las operaciones
      await queryRunner.startTransaction();

      try {
        // 6. El voucher ya fue creado, obtenerlo por código de confirmación
        const voucher = await this.voucherRepository.findByConfirmationCode(
          result.code!,
        );

        if (!voucher) {
          throw new Error('Voucher no encontrado después de crearlo');
        }

        // 7. Buscar o crear Usuario por cel_phone
        const user = await this.findOrCreateUser(phoneNumber, queryRunner);

        // 8. Crear Record con voucher_id
        const record = await this.recordRepository.create(
          {
            vouchers_id: voucher.id,
            transaction_status_id: null,
            cta_extraordinary_fee_id: null,
            cta_maintence_id: null,
            cta_penalities_id: null,
            cta_water_id: null,
            cta_other_payments_id: null,
          },
          queryRunner,
        );

        // 9. Buscar o crear House y asociar con Record
        await this.findOrCreateHouseAssociation(
          savedData.voucherData.casa,
          user.id,
          record.id,
          queryRunner,
        );

        // COMMIT - Todo exitoso
        await queryRunner.commitTransaction();

        // 10. Enviar mensaje de éxito con el código de confirmación
        const confirmationData = {
          casa: savedData.voucherData.casa,
          monto: savedData.voucherData.monto,
          fecha_pago: savedData.voucherData.fecha_pago,
          referencia: savedData.voucherData.referencia,
          hora_transaccion: savedData.voucherData.hora_transaccion,
          confirmation_code: result.code!,
        };

        await this.sendWhatsAppMessage(
          phoneNumber,
          ConfirmationMessages.success(confirmationData),
        );

        // 11. Limpiar contexto
        this.conversationState.clearContext(phoneNumber);

        return { success: true, confirmationCode: result.code };
      } catch (transactionError) {
        // ROLLBACK - Algo falló en la transacción
        await queryRunner.rollbackTransaction();
        console.error(
          `Error en transacción de confirmación de voucher: ${transactionError.message}`,
        );
        throw transactionError;
      }
    } catch (error) {
      console.error(`Error confirmando voucher: ${error.message}`);
      await this.sendWhatsAppMessage(
        input.phoneNumber,
        'Hubo un error al registrar tu pago. Por favor intenta nuevamente más tarde.',
      );
      this.conversationState.clearContext(input.phoneNumber);
      return { success: false, error: error.message };
    } finally {
      // Liberar el QueryRunner
      await queryRunner.release();
    }
  }

  /**
   * Busca un usuario por cel_phone o lo crea si no existe
   */
  private async findOrCreateUser(
    phoneNumber: string,
    queryRunner: any,
  ): Promise<any> {
    try {
      // Parsear número de teléfono con código de país
      const celPhone = parsePhoneNumberWithCountryCode(phoneNumber);

      // Buscar usuario existente por número de teléfono
      let user = await this.userRepository.findByCelPhone(celPhone);

      if (!user) {
        // Usuario no existe, crear nuevo con UUID manual
        const uuid = uuidv4();
        console.log(
          `Creando nuevo usuario con UUID: ${uuid}, cel_phone: ${celPhone}`,
        );

        user = await this.userRepository.create(
          {
            id: uuid,
            cel_phone: celPhone,
            role: Role.TENANT,
            status: Status.ACTIVE,
          },
          queryRunner,
        );

        console.log(`Usuario creado exitosamente: ${user.id}`);
      } else {
        console.log(`Usuario existente encontrado: ${user.id}`);
      }

      return user;
    } catch (error) {
      console.error(`Error al buscar o crear usuario: ${error.message}`);
      throw new Error(`Error al procesar usuario: ${error.message}`);
    }
  }

  /**
   * Busca una casa por number_house o la crea si no existe,
   * luego crea la asociación con el record en la tabla house_records
   */
  private async findOrCreateHouseAssociation(
    numberHouse: number,
    userId: string,
    recordId: number,
    queryRunner: any,
  ): Promise<void> {
    try {
      // Buscar casa existente por número de casa
      let house = await this.houseRepository.findByNumberHouse(numberHouse);

      if (!house) {
        // Casa no existe, crear nueva
        console.log(`Creando nueva casa ${numberHouse} para usuario ${userId}`);

        house = await this.houseRepository.create(
          {
            number_house: numberHouse,
            user_id: userId,
          },
          queryRunner,
        );

        console.log(`Casa creada exitosamente: ${house.id}`);
      } else {
        console.log(
          `Casa existente encontrada: ${house.id} (number_house: ${numberHouse})`,
        );

        // Verificar si el propietario cambió
        if (house.user_id !== userId) {
          console.log(
            `Actualizando propietario de casa ${numberHouse}: ${house.user_id} → ${userId}`,
          );
          await queryRunner.manager.update(
            'houses',
            { id: house.id },
            { user_id: userId },
          );
        }
      }

      // Crear asociación en house_records
      console.log(
        `Creando asociación house_record: house_id=${house.id}, record_id=${recordId}`,
      );

      await this.houseRecordRepository.create(
        {
          house_id: house.id,
          record_id: recordId,
        },
        queryRunner,
      );

      console.log('Asociación house_record creada exitosamente');
    } catch (error) {
      console.error(
        `Error al buscar o crear asociación de casa: ${error.message}`,
      );
      throw new Error(`Error al procesar casa: ${error.message}`);
    }
  }

  /**
   * Limpia el archivo temporal detectado como duplicado
   * Delegado al servicio centralizado de limpieza
   */
  private async cleanupGcsFile(gcsFilename: string): Promise<void> {
    await this.gcsCleanupService.deleteTemporaryProcessingFile(
      gcsFilename,
      'duplicado-detectado',
    );
  }

  private async sendWhatsAppMessage(
    to: string,
    message: string,
  ): Promise<void> {
    await this.whatsappMessaging.sendTextMessage(to, message);
  }
}
