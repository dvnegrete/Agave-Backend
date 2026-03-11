import { Test, TestingModule } from '@nestjs/testing';
import { QueryRunner } from 'typeorm';
import { CtaRecordCreatorService } from '../cta-record-creator.service';
import { CtaMaintenanceRepository } from '@/shared/database/repositories/cta-maintenance.repository';
import { CtaWaterRepository } from '@/shared/database/repositories/cta-water.repository';
import { CtaPenaltiesRepository } from '@/shared/database/repositories/cta-penalties.repository';
import { CtaExtraordinaryFeeRepository } from '@/shared/database/repositories/cta-extraordinary-fee.repository';
import { HistoricalRecordRow } from '../../../domain/historical-record-row.entity';

describe('CtaRecordCreatorService', () => {
  let service: CtaRecordCreatorService;
  let ctaMaintenanceRepository: jest.Mocked<CtaMaintenanceRepository>;
  let ctaWaterRepository: jest.Mocked<CtaWaterRepository>;
  let ctaPenaltiesRepository: jest.Mocked<CtaPenaltiesRepository>;
  let ctaExtraordinaryFeeRepository: jest.Mocked<CtaExtraordinaryFeeRepository>;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  const periodId = 1;

  beforeEach(async () => {
    mockQueryRunner = {
      manager: {},
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CtaRecordCreatorService,
        {
          provide: CtaMaintenanceRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: CtaWaterRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: CtaPenaltiesRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: CtaExtraordinaryFeeRepository,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CtaRecordCreatorService>(CtaRecordCreatorService);
    ctaMaintenanceRepository = module.get(
      CtaMaintenanceRepository,
    ) as jest.Mocked<CtaMaintenanceRepository>;
    ctaWaterRepository = module.get(CtaWaterRepository) as jest.Mocked<
      CtaWaterRepository
    >;
    ctaPenaltiesRepository = module.get(CtaPenaltiesRepository) as jest.Mocked<
      CtaPenaltiesRepository
    >;
    ctaExtraordinaryFeeRepository = module.get(
      CtaExtraordinaryFeeRepository,
    ) as jest.Mocked<CtaExtraordinaryFeeRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCtaRecords', () => {
    it('should create all cta_* records when all amounts are present', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago completo',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 50,
        agua: 550,
        rowNumber: 2,
      });

      ctaExtraordinaryFeeRepository.create.mockResolvedValue({
        id: 1,
        amount: 100,
      } as any);
      ctaMaintenanceRepository.create.mockResolvedValue({
        id: 2,
        amount: 800,
      } as any);
      ctaPenaltiesRepository.create.mockResolvedValue({
        id: 3,
        amount: 50,
      } as any);
      ctaWaterRepository.create.mockResolvedValue({ id: 4, amount: 550 } as any);

      const result = await service.createCtaRecords(
        row,
        periodId,
        mockQueryRunner,
      );

      expect(result).toEqual({
        cta_extraordinary_fee_id: 1,
        cta_maintenance_id: 2,
        cta_penalties_id: 3,
        cta_water_id: 4,
      });
      expect(ctaExtraordinaryFeeRepository.create).toHaveBeenCalledWith(
        { amount: 100, period_id: periodId },
        mockQueryRunner,
      );
      expect(ctaMaintenanceRepository.create).toHaveBeenCalledWith(
        { amount: 800, period_id: periodId },
        mockQueryRunner,
      );
      expect(ctaPenaltiesRepository.create).toHaveBeenCalledWith(
        { amount: 50, period_id: periodId, description: 'Pago completo' },
        mockQueryRunner,
      );
      expect(ctaWaterRepository.create).toHaveBeenCalledWith(
        { amount: 550, period_id: periodId },
        mockQueryRunner,
      );
    });

    it('should create only maintenance record when only maintenance is present', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Solo mantenimiento',
        deposito: 800.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      ctaMaintenanceRepository.create.mockResolvedValue({
        id: 2,
        amount: 800,
      } as any);

      const result = await service.createCtaRecords(
        row,
        periodId,
        mockQueryRunner,
      );

      expect(result).toEqual({
        cta_maintenance_id: 2,
      });
      expect(ctaMaintenanceRepository.create).toHaveBeenCalledTimes(1);
      expect(ctaExtraordinaryFeeRepository.create).not.toHaveBeenCalled();
      expect(ctaPenaltiesRepository.create).not.toHaveBeenCalled();
      expect(ctaWaterRepository.create).not.toHaveBeenCalled();
    });

    it('should return empty object when all amounts are zero', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Sin conceptos',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const result = await service.createCtaRecords(
        row,
        periodId,
        mockQueryRunner,
      );

      expect(result).toEqual({});
      expect(ctaExtraordinaryFeeRepository.create).not.toHaveBeenCalled();
      expect(ctaMaintenanceRepository.create).not.toHaveBeenCalled();
      expect(ctaPenaltiesRepository.create).not.toHaveBeenCalled();
      expect(ctaWaterRepository.create).not.toHaveBeenCalled();
    });

    it('should create only water and maintenance records', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Agua y mantenimiento',
        deposito: 1350.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 550,
        rowNumber: 2,
      });

      ctaMaintenanceRepository.create.mockResolvedValue({
        id: 2,
        amount: 800,
      } as any);
      ctaWaterRepository.create.mockResolvedValue({ id: 4, amount: 550 } as any);

      const result = await service.createCtaRecords(
        row,
        periodId,
        mockQueryRunner,
      );

      expect(result).toEqual({
        cta_maintenance_id: 2,
        cta_water_id: 4,
      });
      expect(ctaMaintenanceRepository.create).toHaveBeenCalledTimes(1);
      expect(ctaWaterRepository.create).toHaveBeenCalledTimes(1);
      expect(ctaExtraordinaryFeeRepository.create).not.toHaveBeenCalled();
      expect(ctaPenaltiesRepository.create).not.toHaveBeenCalled();
    });

    it('should handle penalties with custom description', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Penalización por pago tardío',
        deposito: 50.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 50,
        agua: 0,
        rowNumber: 2,
      });

      ctaPenaltiesRepository.create.mockResolvedValue({
        id: 3,
        amount: 50,
      } as any);

      const result = await service.createCtaRecords(
        row,
        periodId,
        mockQueryRunner,
      );

      expect(result.cta_penalties_id).toBe(3);
      expect(ctaPenaltiesRepository.create).toHaveBeenCalledWith(
        {
          amount: 50,
          period_id: periodId,
          description: 'Penalización por pago tardío',
        },
        mockQueryRunner,
      );
    });

    it('should handle penalties with null concepto', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: null as any,
        deposito: 50.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 50,
        agua: 0,
        rowNumber: 2,
      });

      ctaPenaltiesRepository.create.mockResolvedValue({
        id: 3,
        amount: 50,
      } as any);

      const result = await service.createCtaRecords(
        row,
        periodId,
        mockQueryRunner,
      );

      expect(ctaPenaltiesRepository.create).toHaveBeenCalledWith(
        {
          amount: 50,
          period_id: periodId,
          description: 'Registro histórico',
        },
        mockQueryRunner,
      );
    });

    it('should throw error if repository creation fails', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 800.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const error = new Error('Database error');
      ctaMaintenanceRepository.create.mockRejectedValue(error);

      await expect(
        service.createCtaRecords(row, periodId, mockQueryRunner),
      ).rejects.toThrow('Database error');
    });

    it('should create extraordinary_fee record when only cuotaExtra is present', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Cuota extraordinaria',
        deposito: 200.0,
        casa: 42,
        cuotaExtra: 200,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      ctaExtraordinaryFeeRepository.create.mockResolvedValue({
        id: 1,
        amount: 200,
      } as any);

      const result = await service.createCtaRecords(
        row,
        periodId,
        mockQueryRunner,
      );

      expect(result).toEqual({
        cta_extraordinary_fee_id: 1,
      });
      expect(ctaExtraordinaryFeeRepository.create).toHaveBeenCalledWith(
        { amount: 200, period_id: periodId },
        mockQueryRunner,
      );
    });
  });
});
