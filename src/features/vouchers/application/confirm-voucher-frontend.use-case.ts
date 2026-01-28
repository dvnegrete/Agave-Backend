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
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { EnsureHouseExistsService, SYSTEM_USER_ID } from '@/shared/database/services';
import { VoucherDuplicateDetectorService } from '../infrastructure/persistence/voucher-duplicate-detector.service';
import { ConfirmVoucherFromFrontendDto } from '../dto/frontend-save-draft.dto';
import { ConfirmVoucherResponseDto } from '../dto/frontend-voucher-response.dto';
import { combineDateAndTime } from '@/shared/common/utils';
import { generateUniqueConfirmationCode } from '../shared/helpers';
import { Role, Status, ValidationStatus } from '@/shared/database/entities/enums';
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
    private readonly transactionStatusRepository: TransactionStatusRepository,
    private readonly ensureHouseExistsService: EnsureHouseExistsService,
    private readonly duplicateDetector: VoucherDuplicateDetectorService,
  ) {}

  async execute(
    input: ConfirmVoucherFrontendInput,
  ): Promise<ConfirmVoucherFrontendOutput> {
    const {
      monto,
      fecha_pago,
      hora_transaccion,
      casa,
      referencia,
      gcsFilename,
      userId,
    } = input;


    // 1. Validar y parsear datos (ANTES de cualquier conexión BD)
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

    // 3. Detectar duplicados (usa su propia conexión BD)
    const duplicateCheck = await this.duplicateDetector.detectDuplicate(
      dateTime,
      amount,
      casa,
    );

    if (duplicateCheck.isDuplicate) {
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

    // 5. ✅ MEJOR PRÁCTICA: Usar transaction() en lugar de QueryRunner manual
    // Esto proporciona automáticamente ACID compliance, commit, y rollback
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        // 6. Obtener el voucher que fue creado por generateUniqueConfirmationCode
        // Usar la query directa del manager en lugar del repositorio
        const voucher = await manager.query(
          'SELECT id, confirmation_code, confirmation_status FROM vouchers WHERE confirmation_code = $1',
          [confirmationCode],
        );

        if (!voucher || voucher.length === 0) {
          throw new Error(
            VOUCHER_FRONTEND_MESSAGES.BUSINESS_ERRORS.VOUCHER_NOT_FOUND_AFTER_GENERATION,
          );
        }

        const voucherId = voucher[0].id;
        const confirmationStatus = voucher[0].confirmation_status;

        // 7. Crear o buscar Usuario (si userId está disponible)
        let userIdToUse: string | null = null;
        if (userId) {
          const user = await this.findOrCreateUserWithManager(userId, manager);
          userIdToUse = user?.id || null;
        }

        // 8. Crear Record (vincula voucher con las cuentas)
        const recordData = {
          vouchers_id: voucherId,
          transaction_status_id: null,
          cta_extraordinary_fee_id: null,
          cta_maintence_id: null,
          cta_penalities_id: null,
          cta_water_id: null,
          cta_other_payments_id: null,
        };
        const record = manager.create('Record', recordData);
        const savedRecord = await manager.save(record);

        // 9. Crear TransactionStatus para vincular el voucher con la casa
        const transactionStatusData = {
          vouchers_id: voucherId,
          identified_house_number: casa,
          validation_status: ValidationStatus.PENDING,
        };
        const transactionStatus = manager.create(
          'TransactionStatus',
          transactionStatusData,
        );
        const savedTransactionStatus = await manager.save(transactionStatus);

        // 10. Crear o buscar Casa y su asociación con el Record
        await this.findOrCreateHouseAssociationWithManager(
          casa,
          userIdToUse,
          (savedRecord as any).id,
          manager,
        );

        // Retornar los datos para la respuesta fuera de la transacción
        return {
          voucherId,
          confirmationCode,
          confirmationStatus,
        };
      });

      // 11. Construir respuesta
      return {
        success: true,
        confirmationCode: result.confirmationCode,
        voucher: {
          id: result.voucherId,
          amount,
          date: dateTime.toISOString(),
          casa,
          referencia: referencia || '',
          confirmation_status: result.confirmationStatus,
        },
      };
    } catch (error) {
      // ✅ transaction() automáticamente maneja rollback en caso de error
      // No es necesario llamar rollbackTransaction() manualmente
      this.logger.error(`Errorvoucher Frontend: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca un usuario por ID o lo crea si no existe
   * Versión para uso con QueryRunner (legacy)
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
        user = await this.userRepository.create(
          {
            id: userId,
            cel_phone: 0, // Placeholder - no tenemos teléfono desde Frontend
            role: Role.TENANT,
            status: Status.ACTIVE,
          },
          queryRunner,
        );
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
   * Busca un usuario por ID o lo crea si no existe
   * Versión para uso con EntityManager (transaction)
   * NOTA: cel_phone no se usa para usuarios creados vía Frontend
   */
  private async findOrCreateUserWithManager(
    userId: string | null,
    manager: any,
  ): Promise<any | null> {
    if (!userId) {
      return null;
    }

    try {
      // Buscar usuario por ID usando el manager
      let user = await manager.findOne('User', { where: { id: userId } });

      if (!user) {
        // Usuario no existe, crear nuevo
        user = manager.create('User', {
          id: userId,
          cel_phone: 0, // Placeholder - no tenemos teléfono desde Frontend
          role: Role.TENANT,
          status: Status.ACTIVE,
        });
        await manager.save(user);
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
   * Versión para uso con QueryRunner (legacy)
   */
  private async findOrCreateHouseAssociation(
    numberHouse: number,
    userId: string | null | undefined,
    recordId: number,
    queryRunner: any,
  ): Promise<void> {
    try {
      // Buscar casa existente por número de casa (within transaction if queryRunner provided)
      let house = await this.houseRepository.findByNumberHouse(
        numberHouse,
        queryRunner,
      );

      if (!house) {
        // Casa no existe, crear nueva
        // Si no tenemos userId, usar una string vacía (requerido en CreateHouseDto)
        const assignedUserId = userId || '';

        house = await this.houseRepository.create(
          {
            number_house: numberHouse,
            user_id: assignedUserId,
          },
          queryRunner,
        );
      } else {
        // Verificar si el propietario cambió (solo si tenemos userId)
        if (userId && house.user_id !== userId) {
          await queryRunner.manager.update(
            'houses',
            { id: house.id },
            { user_id: userId },
          );
        }
      }

      // Crear asociación en house_records
      await this.houseRecordRepository.create(
        {
          house_id: house.id,
          record_id: recordId,
        },
        queryRunner,
      );
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

  /**
   * Busca una casa por number_house o la crea si no existe,
   * luego crea la asociación con el record en la tabla house_records
   * Versión para uso con EntityManager (transaction)
   */
  private async findOrCreateHouseAssociationWithManager(
    numberHouse: number,
    userId: string | null | undefined,
    recordId: number,
    manager: any,
  ): Promise<void> {
    // ⚠️ WORKAROUND: EnsureHouseExistsService usa QueryRunner, pero este usa EntityManager
    // Opción temporal: usar manager.queryRunner si está disponible
    const queryRunner = manager.queryRunner || null;

    // Determinar userId efectivo (manejo de null/undefined)
    const effectiveUserId = userId || SYSTEM_USER_ID;

    // Delegar búsqueda/creación al servicio compartido
    const { house, wasCreated } = await this.ensureHouseExistsService.execute(
      numberHouse,
      {
        createIfMissing: true,
        userId: effectiveUserId,
        queryRunner,
      }
    );

    // Lógica específica: actualizar propietario si cambió (solo si userId está definido)
    if (!wasCreated && userId && house.user_id !== userId) {
      await manager.update('houses', { id: house.id }, { user_id: userId });
    }

    // Crear asociación en house_records
    await manager.insert('house_records', {
      house_id: house.id,
      record_id: recordId,
    });
  }
}
