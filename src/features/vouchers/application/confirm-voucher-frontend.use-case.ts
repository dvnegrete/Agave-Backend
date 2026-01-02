import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { VoucherDuplicateDetectorService } from '../infrastructure/persistence/voucher-duplicate-detector.service';
import { ConfirmVoucherFromFrontendDto } from '../dto/frontend-save-draft.dto';
import { ConfirmVoucherResponseDto } from '../dto/frontend-voucher-response.dto';
import { combineDateAndTime } from '@/shared/common/utils';
import { generateUniqueConfirmationCode } from '../shared/helpers';
import { Role, Status } from '@/shared/database/entities/enums';
import { VOUCHER_FRONTEND_MESSAGES } from '../shared/constants';

export interface ConfirmVoucherFrontendInput extends ConfirmVoucherFromFrontendDto {}

export interface ConfirmVoucherFrontendOutput extends ConfirmVoucherResponseDto {}

/**
 * Use Case: Confirmar y registrar un voucher desde el Frontend (HTTP)
 *
 * Responsabilidades (arquitectura STATELESS):
 * - Recibir datos completos del Frontend (monto, fecha, casa, gcsFilename, etc.)
 * - Validar que todos los datos sean válidos
 * - Detectar duplicados
 * - Generar código de confirmación único
 * - Crear el voucher y sus relaciones (User, Record, House, HouseRecord) en transacción ACID
 * - Retornar el código de confirmación al Frontend
 *
 * NOTA: Esta implementación es STATELESS - el Frontend retiene toda la información
 * y la envía con la confirmación final. No se requiere almacenamiento temporal.
 */
@Injectable()
export class ConfirmVoucherFrontendUseCase {
  private readonly logger = new Logger(ConfirmVoucherFrontendUseCase.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly voucherRepository: VoucherRepository,
    private readonly recordRepository: RecordRepository,
    private readonly houseRepository: HouseRepository,
    private readonly userRepository: UserRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly duplicateDetector: VoucherDuplicateDetectorService,
  ) {}

  async execute(
    input: ConfirmVoucherFrontendInput,
  ): Promise<ConfirmVoucherFrontendOutput> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const {
        monto,
        fecha_pago,
        hora_transaccion,
        casa,
        referencia,
        gcsFilename,
        userId,
      } = input;

      this.logger.debug(`
        Confirmando voucher Frontend: casa=${casa}, monto=${monto}`);

      // 1. Validar y parsear datos
      const amount = parseFloat(monto);
      if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
        throw new BadRequestException(
          VOUCHER_FRONTEND_MESSAGES.VALIDATION.AMOUNT.INVALID_WITH_VALUE(monto),
        );
      }

      // 2. Combinar fecha y hora
      const dateTime = combineDateAndTime(
        fecha_pago,
        hora_transaccion || VOUCHER_FRONTEND_MESSAGES.DEFAULTS.DEFAULT_TIME,
      );

      // 3. Detectar duplicados
      const duplicateCheck = await this.duplicateDetector.detectDuplicate(
        dateTime,
        amount,
        casa,
      );

      if (duplicateCheck.isDuplicate) {
        this.logger.warn(
          `⚠️  Duplicado detectado. Casa=${casa}, Monto=${amount}. ${duplicateCheck.message}`,
        );
        throw new ConflictException(
          VOUCHER_FRONTEND_MESSAGES.BUSINESS_ERRORS.DUPLICATE_VOUCHER(
            duplicateCheck.message,
          ),
        );
      }

      // 4. Generar código de confirmación único (con retry logic)
      const voucherData = {
        date: dateTime,
        authorization_number:
          referencia || VOUCHER_FRONTEND_MESSAGES.DEFAULTS.DEFAULT_REFERENCE,
        amount,
        confirmation_status: false,
        url: gcsFilename,
      };

      const generateResult = await generateUniqueConfirmationCode(
        this.voucherRepository,
        voucherData,
      );

      if (!generateResult.success) {
        throw new BadRequestException(
          VOUCHER_FRONTEND_MESSAGES.BUSINESS_ERRORS.CONFIRMATION_CODE_GENERATION_FAILED(
            generateResult.error,
          ),
        );
      }

      const confirmationCode = generateResult.code!;

      // 5. INICIAR TRANSACCIÓN - Garantiza atomicidad ACID
      await queryRunner.startTransaction();

      try {
        // 6. Obtener el voucher que fue creado por generateUniqueConfirmationCode
        const voucher =
          await this.voucherRepository.findByConfirmationCode(confirmationCode);

        if (!voucher) {
          throw new Error(
            VOUCHER_FRONTEND_MESSAGES.BUSINESS_ERRORS.VOUCHER_NOT_FOUND_AFTER_GENERATION,
          );
        }

        // 7. Crear o buscar Usuario (si userId está disponible)
        let userIdToUse: string | null = null;
        if (userId) {
          const user = await this.findOrCreateUser(userId, queryRunner);
          userIdToUse = user?.id || null;
        }

        // 8. Crear Record (vincula voucher con las cuentas)
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

        // 9. Crear o buscar Casa y su asociación con el Record
        await this.findOrCreateHouseAssociation(
          casa,
          userIdToUse,
          record.id,
          queryRunner,
        );

        // 10. COMMIT - Todo exitoso
        await queryRunner.commitTransaction();

        this.logger.debug(
          `Voucher confirmado exitosamente: id=${voucher.id}, code=${confirmationCode}, casa=${casa}`,
        );

        // 11. Construir respuesta
        return {
          success: true,
          confirmationCode,
          voucher: {
            id: voucher.id,
            amount,
            date: dateTime.toISOString(),
            casa,
            referencia: referencia || '',
            confirmation_status: voucher.confirmation_status,
          },
        };
      } catch (transactionError) {
        // ROLLBACK - Algo falló en la transacción
        await queryRunner.rollbackTransaction();
        this.logger.error(
          `Error en transacción de confirmación: ${transactionError.message}`,
        );
        throw transactionError;
      }
    } catch (error) {
      this.logger.error(`Error confirmando voucher Frontend: ${error.message}`);
      throw error;
    } finally {
      // Liberar el QueryRunner
      await queryRunner.release();
    }
  }

  /**
   * Busca un usuario por ID o lo crea si no existe
   * NOTA: cel_phone no se usa para usuarios creados vía Frontend
   */
  private async findOrCreateUser(
    userId: string | null,
    queryRunner: any,
  ): Promise<any | null> {
    if (!userId) {
      return null;
    }

    try {
      // Buscar usuario por ID
      let user = await this.userRepository.findById(userId);

      if (!user) {
        // Usuario no existe, crear nuevo
        // IMPORTANTE: cel_phone es requerido pero lo pasamos como 0 since no hay teléfono desde Frontend
        this.logger.debug(`Creando nuevo usuario con ID: ${userId}`);

        user = await this.userRepository.create(
          {
            id: userId,
            cel_phone: 0, // Placeholder - no tenemos teléfono desde Frontend
            role: Role.TENANT,
            status: Status.ACTIVE,
          },
          queryRunner,
        );

        this.logger.debug(`Usuario creado exitosamente: ${user.id}`);
      } else {
        this.logger.debug(`Usuario existente encontrado: ${user.id}`);
      }

      return user;
    } catch (error) {
      this.logger.error(`Error al buscar o crear usuario: ${error.message}`);
      throw new Error(
        VOUCHER_FRONTEND_MESSAGES.USER_ERRORS.PROCESSING_FAILED(error.message),
      );
    }
  }

  /**
   * Busca una casa por number_house o la crea si no existe,
   * luego crea la asociación con el record en la tabla house_records
   */
  private async findOrCreateHouseAssociation(
    numberHouse: number,
    userId: string | null | undefined,
    recordId: number,
    queryRunner: any,
  ): Promise<void> {
    try {
      // Buscar casa existente por número de casa
      let house = await this.houseRepository.findByNumberHouse(numberHouse);

      if (!house) {
        // Casa no existe, crear nueva
        // Si no tenemos userId, usar una string vacía (requerido en CreateHouseDto)
        const assignedUserId = userId || '';

        this.logger.debug(
          `Creando nueva casa ${numberHouse}` +
            (userId ? ` para usuario ${userId}` : ' (sin usuario asignado)'),
        );

        house = await this.houseRepository.create(
          {
            number_house: numberHouse,
            user_id: assignedUserId,
          },
          queryRunner,
        );

        this.logger.debug(`Casa creada exitosamente: ${house.id}`);
      } else {
        this.logger.debug(
          `Casa existente encontrada: ${house.id} (number_house: ${numberHouse})`,
        );

        // Verificar si el propietario cambió (solo si tenemos userId)
        if (userId && house.user_id !== userId) {
          this.logger.debug(
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
      this.logger.debug(
        `Creando asociación house_record: house_id=${house.id}, record_id=${recordId}`,
      );

      await this.houseRecordRepository.create(
        {
          house_id: house.id,
          record_id: recordId,
        },
        queryRunner,
      );

      this.logger.debug(`Asociación house_record creada exitosamente`);
    } catch (error) {
      this.logger.error(`Error al buscar o crear casa: ${error.message}`);
      throw new Error(
        VOUCHER_FRONTEND_MESSAGES.HOUSE_ERRORS.PROCESSING_FAILED(
          numberHouse,
          error.message,
        ),
      );
    }
  }
}
