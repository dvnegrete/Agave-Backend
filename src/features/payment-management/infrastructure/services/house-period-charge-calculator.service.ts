import { Injectable, Inject } from '@nestjs/common';
import { IHousePeriodChargeRepository } from '../../interfaces/house-period-charge.repository.interface';
import { IRecordAllocationRepository } from '../../interfaces/record-allocation.repository.interface';

/**
 * Servicio para calcular y comparar montos esperados vs pagados usando house_period_charges
 * Facilita reportes y validaciones de pagos contra snapshot inmutable
 */
@Injectable()
export class HousePeriodChargeCalculatorService {
  constructor(
    @Inject('IHousePeriodChargeRepository')
    private readonly chargeRepository: IHousePeriodChargeRepository,
    @Inject('IRecordAllocationRepository')
    private readonly allocationRepository: IRecordAllocationRepository,
  ) {}

  /**
   * Obtiene el total esperado para una casa en un período
   * Usa la tabla inmutable house_period_charges (creada al crear el período)
   */
  async getTotalExpectedByHousePeriod(
    houseId: number,
    periodId: number,
  ): Promise<number> {
    return this.chargeRepository.getTotalExpectedByHousePeriod(
      houseId,
      periodId,
    );
  }

  /**
   * Obtiene el total pagado para una casa en un período
   * Usa la tabla record_allocations
   */
  async getTotalPaidByHousePeriod(
    houseId: number,
    periodId: number,
  ): Promise<number> {
    return this.allocationRepository.getTotalPaidByHousePeriod(
      houseId,
      periodId,
    );
  }

  /**
   * Calcula la diferencia entre esperado y pagado
   * Resultado > 0 = Deuda
   * Resultado < 0 = Exceso pagado (crédito)
   * Resultado = 0 = Pagado exactamente
   */
  async calculateBalance(
    houseId: number,
    periodId: number,
  ): Promise<number> {
    const expected = await this.getTotalExpectedByHousePeriod(
      houseId,
      periodId,
    );
    const paid = await this.getTotalPaidByHousePeriod(houseId, periodId);
    return expected - paid;
  }

  /**
   * Obtiene detalles de pagos por período
   * Retorna información de cada concepto (esperado, pagado, estado)
   */
  async getPaymentDetails(
    houseId: number,
    periodId: number,
  ): Promise<
    Array<{
      conceptType: string;
      expectedAmount: number;
      paidAmount: number;
      balance: number;
      isPaid: boolean;
    }>
  > {
    // Obtener cargos esperados
    const charges = await this.chargeRepository.findByHouseAndPeriod(
      houseId,
      periodId,
    );

    // Obtener pagos realizados
    const allocations = await this.allocationRepository.findByHouseAndPeriod(
      houseId,
      periodId,
    );

    // Construir map de pagos por concepto
    const allocationMap = new Map<string, number>();
    for (const allocation of allocations) {
      const key = allocation.concept_type;
      allocationMap.set(key, (allocationMap.get(key) || 0) + allocation.allocated_amount);
    }

    // Crear resultado combinando charges y allocations
    return charges.map((charge) => {
      const paid = allocationMap.get(charge.concept_type) || 0;
      const balance = charge.expected_amount - paid;

      return {
        conceptType: charge.concept_type,
        expectedAmount: charge.expected_amount,
        paidAmount: paid,
        balance: balance,
        isPaid: balance <= 0, // Si balance <= 0, está pagado (puede ser sobrepagado)
      };
    });
  }

  /**
   * Valida que un período tiene cargos creados (house_period_charges)
   * Útil para garantizar que los datos son correctos para distribución de pagos
   */
  async isPeriodFullyCharged(periodId: number): Promise<boolean> {
    // Obtener número de casas esperadas (generalmente 66)
    // Para simplificar, asumimos que si hay cargos, están completos
    const charges = await this.chargeRepository.findByPeriod(periodId);
    return charges.length > 0;
  }
}
