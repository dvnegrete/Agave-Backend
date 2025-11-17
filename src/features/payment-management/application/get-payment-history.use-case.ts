import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { House } from '@/shared/database/entities';
import {
  PaymentHistoryResponseDTO,
  PaymentHistoryItemDTO,
} from '../dto/payment-history.dto';
import { IRecordAllocationRepository } from '../interfaces';

/**
 * Use case para obtener historial de pagos de una casa
 */
@Injectable()
export class GetPaymentHistoryUseCase {
  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
  ) {}

  /**
   * Ejecuta la búsqueda de historial de pagos
   */
  async execute(
    houseId: number,
    house: House,
  ): Promise<PaymentHistoryResponseDTO> {
    // Obtener todas las asignaciones de la casa
    const allocations =
      await this.recordAllocationRepository.findByHouseId(houseId);

    if (allocations.length === 0) {
      return {
        house_id: houseId,
        house_number: house.number_house,
        total_payments: 0,
        total_paid: 0,
        total_expected: 0,
        payments: [],
      };
    }

    // Convertir a DTOs
    const paymentItems = allocations.map((a) =>
      this.toPaymentHistoryItem(a),
    );

    // Calcular totales
    const totalPaid = paymentItems.reduce(
      (sum, item) => sum + item.allocated_amount,
      0,
    );
    const totalExpected = paymentItems.reduce(
      (sum, item) => sum + item.expected_amount,
      0,
    );

    return {
      house_id: houseId,
      house_number: house.number_house,
      total_payments: paymentItems.length,
      total_paid: totalPaid,
      total_expected: totalExpected,
      payments: paymentItems,
    };
  }

  /**
   * Obtiene historial de pagos por período específico
   */
  async executeByPeriod(
    houseId: number,
    periodId: number,
    house: House,
  ): Promise<PaymentHistoryResponseDTO> {
    const allocations =
      await this.recordAllocationRepository.findByHouseAndPeriod(
        houseId,
        periodId,
      );

    if (allocations.length === 0) {
      return {
        house_id: houseId,
        house_number: house.number_house,
        total_payments: 0,
        total_paid: 0,
        total_expected: 0,
        payments: [],
      };
    }

    const paymentItems = allocations.map((a) =>
      this.toPaymentHistoryItem(a),
    );

    const totalPaid = paymentItems.reduce(
      (sum, item) => sum + item.allocated_amount,
      0,
    );
    const totalExpected = paymentItems.reduce(
      (sum, item) => sum + item.expected_amount,
      0,
    );

    return {
      house_id: houseId,
      house_number: house.number_house,
      total_payments: paymentItems.length,
      total_paid: totalPaid,
      total_expected: totalExpected,
      payments: paymentItems,
    };
  }

  /**
   * Convierte RecordAllocation a PaymentHistoryItem
   */
  private toPaymentHistoryItem(allocation: any): PaymentHistoryItemDTO {
    return {
      id: allocation.id,
      record_id: allocation.record_id,
      period_year: allocation.period?.year,
      period_month: allocation.period?.month,
      payment_date: allocation.created_at,
      concept_type: allocation.concept_type,
      allocated_amount: allocation.allocated_amount,
      expected_amount: allocation.expected_amount,
      payment_status: allocation.payment_status,
      difference: allocation.allocated_amount - allocation.expected_amount,
    };
  }
}
