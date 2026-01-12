import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { HouseRepository } from '../repositories/house.repository';
import { House } from '../entities/house.entity';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
  SYSTEM_USER_ID,
} from '../../config/business-rules.config';
import { Retry } from '../../decorators/retry.decorator';

/**
 * Opciones para el servicio EnsureHouseExists
 */
export interface EnsureHouseExistsOptions {
  /**
   * Si true, crea la casa si no existe. Si false, lanza error.
   * @default false (modo validación estricta)
   */
  createIfMissing?: boolean;

  /**
   * ID del usuario propietario para la nueva casa
   * Solo se usa si createIfMissing=true
   * @default SYSTEM_USER_ID
   */
  userId?: string;

  /**
   * QueryRunner para transacciones
   * Si se proporciona, usa la transacción del queryRunner
   * Si no se proporciona, realiza la operación en transacción implícita
   * @default undefined (sin transacción explícita)
   */
  queryRunner?: QueryRunner;
}

/**
 * Resultado de la operación EnsureHouseExists
 */
export interface EnsureHouseExistsResult {
  /** La casa encontrada o creada */
  house: House;
  /** true si la casa fue creada, false si ya existía */
  wasCreated: boolean;
}

/**
 * Servicio compartido para garantizar la existencia de una casa
 *
 * Centraliza la lógica de búsqueda/creación de casas usada por:
 * - BankReconciliation (crea si no existe)
 * - HistoricalRecords (crea si no existe)
 * - Vouchers (crea si no existe)
 *
 * @example
 * // Modo validación estricta: error si no existe
 * const result = await this.ensureHouseExistsService.execute(42, {
 *   createIfMissing: false,
 * });
 *
 * @example
 * // Modo creación automática: crea si no existe
 * const result = await this.ensureHouseExistsService.execute(42, {
 *   createIfMissing: true,
 *   userId: currentUserId,
 * });
 *
 * @example
 * // Dentro de una transacción
 * const result = await this.ensureHouseExistsService.execute(42, {
 *   createIfMissing: true,
 *   queryRunner: transactionQueryRunner,
 * });
 */
@Injectable()
export class EnsureHouseExistsService {
  private readonly logger = new Logger(EnsureHouseExistsService.name);

  constructor(private readonly houseRepository: HouseRepository) {}

  /**
   * Garantiza que una casa existe, opcionalmente creándola
   *
   * @param houseNumber - Número de casa (debe estar en rango 1-66)
   * @param options - Opciones de operación
   * @returns Objeto con la casa y flag indicando si fue creada
   * @throws Error si la casa no existe y createIfMissing=false
   * @throws Error si el número de casa está fuera del rango válido
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  })
  async execute(
    houseNumber: number,
    options: EnsureHouseExistsOptions = {},
  ): Promise<EnsureHouseExistsResult> {
    const {
      createIfMissing = false,
      userId = SYSTEM_USER_ID,
      queryRunner,
    } = options;

    // Validar rango de casa
    if (!this.isValidHouseNumber(houseNumber)) {
      throw new Error(
        `Número de casa inválido: ${houseNumber}. Rango válido: ${MIN_HOUSE_NUMBER}-${MAX_HOUSE_NUMBER}.`,
      );
    }

    // Buscar casa existente (within transaction if queryRunner provided)
    let house = await this.houseRepository.findByNumberHouse(
      houseNumber,
      queryRunner,
    );

    if (house) {
      this.logger.debug(`Casa ${houseNumber} ya existe (ID: ${house.id})`);
      return { house, wasCreated: false };
    }

    // Casa no existe
    if (!createIfMissing) {
      throw new Error(
        `Casa ${houseNumber} no existe en el sistema.`,
      );
    }

    // Crear casa
    this.logger.log(
      `Casa ${houseNumber} no existe, creando automáticamente (asignada a usuario ${userId})`,
    );

    house = await this.houseRepository.create(
      {
        number_house: houseNumber,
        user_id: userId,
      },
      queryRunner,
    );

    this.logger.log(
      `Casa ${houseNumber} creada exitosamente (ID: ${house.id}, propietario: ${userId})`,
    );

    return { house, wasCreated: true };
  }

  /**
   * Valida que un número de casa esté dentro del rango permitido
   * @private
   */
  private isValidHouseNumber(houseNumber: number | undefined | null): boolean {
    return (
      houseNumber !== undefined &&
      houseNumber !== null &&
      houseNumber >= MIN_HOUSE_NUMBER &&
      houseNumber <= MAX_HOUSE_NUMBER
    );
  }
}
