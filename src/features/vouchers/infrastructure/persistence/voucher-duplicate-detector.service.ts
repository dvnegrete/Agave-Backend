import { Injectable, Logger } from '@nestjs/common';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingVoucher?: {
    id: number;
    date: Date;
    amount: number;
    confirmation_code: string;
    confirmation_status: boolean;
  };
  message?: string;
}

/**
 * Servicio para detectar vouchers duplicados
 * Valida que no existan vouchers con la misma fecha, monto y número de casa
 */
@Injectable()
export class VoucherDuplicateDetectorService {
  private readonly logger = new Logger(VoucherDuplicateDetectorService.name);

  constructor(
    private readonly voucherRepository: VoucherRepository,
    private readonly houseRepository: HouseRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly recordRepository: RecordRepository,
  ) {}

  /**
   * Detecta si existe un voucher duplicado basado en:
   * 1. Fecha y monto (validación primaria)
   * 2. Número de casa (validación secundaria)
   *
   * @param date - Fecha combinada del voucher (fecha + hora)
   * @param amount - Monto del pago
   * @param numberHouse - Número de casa (1-66)
   * @returns DuplicateCheckResult con información del duplicado si existe
   */
  async detectDuplicate(
    date: Date,
    amount: number,
    numberHouse: number,
  ): Promise<DuplicateCheckResult> {
    try {
      // 1. Obtener todos los vouchers (buscaremos por fecha y monto)
      const allVouchers = await this.voucherRepository.findAll();

      if (!allVouchers || allVouchers.length === 0) {
        this.logger.log(
          `No hay vouchers previos. Permitiendo nuevo voucher: date=${date}, amount=${amount}, casa=${numberHouse}`,
        );
        return { isDuplicate: false };
      }

      // 2. Filtrar vouchers con misma fecha y monto (considerando variación de milisegundos)
      const vouchersWithSameDateAndAmount = allVouchers.filter((v) => {
        const voucherDate = new Date(v.date);
        const checkDate = new Date(date);

        // Comparar fecha y hora sin considerar milisegundos
        const isSameDateTime =
          voucherDate.getFullYear() === checkDate.getFullYear() &&
          voucherDate.getMonth() === checkDate.getMonth() &&
          voucherDate.getDate() === checkDate.getDate() &&
          voucherDate.getHours() === checkDate.getHours() &&
          voucherDate.getMinutes() === checkDate.getMinutes() &&
          voucherDate.getSeconds() === checkDate.getSeconds();

        const isSameAmount = Math.abs(v.amount - amount) < 0.01; // Comparación con tolerancia para floats

        return isSameDateTime && isSameAmount;
      });

      if (vouchersWithSameDateAndAmount.length === 0) {
        return { isDuplicate: false };
      }

      this.logger.log(
        `Encontrados ${vouchersWithSameDateAndAmount.length} vouchers con misma fecha/hora y monto. Validando número de casa...`,
      );

      // 3. Para cada voucher encontrado, buscar la casa asociada
      for (const voucher of vouchersWithSameDateAndAmount) {
        try {
          const house = await this.findHouseFromVoucher(voucher.id);

          if (house && house.number_house === numberHouse) {
            this.logger.warn(
              `⚠️  DUPLICADO DETECTADO: Voucher existente con misma fecha, monto y número de casa`,
            );
            this.logger.warn(
              `Detalles: ID=${voucher.id}, date=${voucher.date}, amount=${voucher.amount}, casa=${house.number_house}, confirmation_code=${voucher.confirmation_code}`,
            );

            return {
              isDuplicate: true,
              existingVoucher: {
                id: voucher.id,
                date: voucher.date,
                amount: voucher.amount,
                confirmation_code: voucher.confirmation_code,
                confirmation_status: voucher.confirmation_status,
              },
              message: `El Código de confirmación de ese registro es: ${voucher.confirmation_code}`,
            };
          }
        } catch (error) {
          this.logger.error(
            `Error al buscar casa para voucher ${voucher.id}: ${error.message}`,
          );
          // Continuar con el siguiente voucher
        }
      }
      return { isDuplicate: false };
    } catch (error) {
      this.logger.error(
        `Error en detectDuplicate: ${error.message}. Permitiendo voucher por seguridad.`,
      );
      // En caso de error, permitir el voucher para no bloquear transacciones legítimas
      return { isDuplicate: false };
    }
  }

  /**
   * Encuentra la casa asociada a un voucher a través de las relaciones
   * voucher → record → house_record → house
   */
  private async findHouseFromVoucher(voucherId: number): Promise<any | null> {
    try {
      // Buscar records que contengan este voucher
      const records = await this.recordRepository.findByVoucherId(voucherId);

      if (!records || records.length === 0) {
        return null;
      }

      // Buscar house_records asociados a estos records
      for (const record of records) {
        const houseRecords = await this.houseRecordRepository.findByRecordId(
          record.id,
        );

        if (houseRecords && houseRecords.length > 0) {
          // Obtener la primera casa asociada
          const houseRecord = houseRecords[0];
          const house = await this.houseRepository.findById(
            houseRecord.house_id,
          );

          if (house) {
            return house;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error en findHouseFromVoucher: ${error.message}`);
      return null;
    }
  }

}
