import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CtaPenalties } from '@/shared/database/entities';
import { IPeriodConfigRepository } from '../interfaces';

@Injectable()
export class GeneratePenaltyUseCase {
  private readonly logger = new Logger(GeneratePenaltyUseCase.name);

  constructor(
    @InjectRepository(CtaPenalties)
    private readonly penaltiesRepository: Repository<CtaPenalties>,
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
  ) {}

  /**
   * Genera penalidad para una casa en un periodo, si no existe ya.
   * Retorna null si ya existía o si no aplica.
   */
  async execute(
    houseId: number,
    periodId: number,
    periodStartDate: Date,
  ): Promise<CtaPenalties | null> {
    // Verificar si ya existe penalidad para esta casa+periodo
    const existing = await this.penaltiesRepository.findOne({
      where: { house_id: houseId, period_id: periodId },
    });

    if (existing) {
      return null;
    }

    // Obtener config activa para la fecha del periodo
    const config =
      await this.periodConfigRepository.findActiveForDate(periodStartDate);

    const penaltyAmount = config?.late_payment_penalty_amount ?? 100;

    try {
      const penalty = this.penaltiesRepository.create({
        house_id: houseId,
        period_id: periodId,
        amount: penaltyAmount,
        description: `Penalidad por pago tardio - Periodo ${periodId}`,
      });

      const saved = await this.penaltiesRepository.save(penalty);
      this.logger.log(
        `Penalidad generada: casa ${houseId}, periodo ${periodId}, monto $${penaltyAmount}`,
      );
      return saved;
    } catch (error) {
      // Unique index previene duplicados en race conditions
      if (error instanceof Error && error.message.includes('duplicate key')) {
        this.logger.warn(
          `Penalidad duplicada detectada para casa ${houseId}, periodo ${periodId}`,
        );
        return null;
      }
      throw error;
    }
  }
}
