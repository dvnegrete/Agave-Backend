import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { PeriodDomain } from '../domain';
import { CreatePeriodDto } from '../dto';
import { IPeriodRepository, IPeriodConfigRepository } from '../interfaces';
import { SeedHousePeriodChargesService } from '@/features/payment-management/infrastructure/services';

/**
 * Caso de uso: Crear un período manualmente
 * Permite crear períodos de forma explícita con validaciones
 */
@Injectable()
export class CreatePeriodUseCase {
  constructor(
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
    private readonly seedChargesService: SeedHousePeriodChargesService,
  ) {}

  async execute(dto: CreatePeriodDto): Promise<PeriodDomain> {
    // 1. Validar que no exista ya un período para ese año/mes
    const exists = await this.periodRepository.exists(dto.year, dto.month);
    if (exists) {
      throw new ConflictException(
        `Ya existe un período para ${dto.month}/${dto.year}`,
      );
    }

    // 2. Buscar configuración activa para esa fecha
    const periodDate = new Date(dto.year, dto.month - 1, 1);
    const activeConfig =
      await this.periodConfigRepository.findActiveForDate(periodDate);

    // 3. Crear el período
    const period = await this.periodRepository.create(
      dto.year,
      dto.month,
      activeConfig?.id,
    );

    // 4. Seed de cargos esperados para todas las casas
    await this.seedChargesService.seedChargesForPeriod(period.id);

    // TODO: Notificar a sistema de conciliación bancaria

    return PeriodDomain.create({
      id: period.id,
      year: period.year,
      month: period.month,
      startDate: period.start_date,
      endDate: period.end_date,
      periodConfigId: period.period_config_id,
    });
  }
}
