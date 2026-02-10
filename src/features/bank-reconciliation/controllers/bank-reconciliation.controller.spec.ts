import { Test, TestingModule } from '@nestjs/testing';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { ReconcileUseCase } from '../application/reconcile.use-case';
import { ManualValidationService } from '../infrastructure/persistence/manual-validation.service';
import {
  ApproveManualCaseDto,
  RejectManualCaseDto,
  ManualValidationCasesPageDto,
  ManualValidationStatsDto,
} from '../dto';
import { ValidationStatus } from '@/shared/database/entities/enums';

describe('BankReconciliationController - Manual Validation Endpoints', () => {
  let controller: BankReconciliationController;
  let manualValidationService: jest.Mocked<ManualValidationService>;
  let reconcileUseCase: jest.Mocked<ReconcileUseCase>;

  beforeEach(async () => {
    // Crear mocks
    const manualValidationServiceMock = {
      getPendingManualCases: jest.fn(),
      approveManualCase: jest.fn(),
      rejectManualCase: jest.fn(),
      getManualValidationStats: jest.fn(),
    };

    const reconcileUseCaseMock = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BankReconciliationController],
      providers: [
        {
          provide: ManualValidationService,
          useValue: manualValidationServiceMock,
        },
        {
          provide: ReconcileUseCase,
          useValue: reconcileUseCaseMock,
        },
      ],
    }).compile();

    controller = module.get<BankReconciliationController>(
      BankReconciliationController,
    );
    manualValidationService = module.get(ManualValidationService);
    reconcileUseCase = module.get(ReconcileUseCase);
  });

  describe('GET /manual-validation/pending', () => {
    it('debe retornar lista paginada de casos pendientes', async () => {
      const mockResponse: ManualValidationCasesPageDto = {
        totalCount: 10,
        page: 1,
        limit: 20,
        totalPages: 1,
        items: [
          {
            transactionBankId: 'TX-001',
            transactionAmount: 1500.15,
            transactionDate: new Date('2025-01-15T10:00:00Z'),
            transactionConcept: 'Pago residencia',
            possibleMatches: [
              {
                voucherId: 101,
                voucherAmount: 1500.15,
                voucherDate: new Date('2025-01-15T09:00:00Z'),
                houseNumber: 15,
                similarity: 0.99,
                dateDifferenceHours: 1,
              },
            ],
            reason: 'Múltiples candidatos',
            createdAt: new Date(),
            status: 'pending',
          },
        ],
      };

      manualValidationService.getPendingManualCases.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.getPendingManualCases({
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(mockResponse);
      expect(
        manualValidationService.getPendingManualCases,
      ).toHaveBeenCalledWith(undefined, undefined, undefined, 1, 20, undefined);
    });

    it('debe aplicar filtros correctamente', async () => {
      const mockResponse: ManualValidationCasesPageDto = {
        totalCount: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        items: [],
      };

      manualValidationService.getPendingManualCases.mockResolvedValue(
        mockResponse,
      );

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await controller.getPendingManualCases({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        houseNumber: 15,
        page: 2,
        limit: 10,
        sortBy: 'similarity',
      });

      expect(
        manualValidationService.getPendingManualCases,
      ).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        15,
        2,
        10,
        'similarity',
      );
    });

    it('debe manejar valores default para paginación', async () => {
      const mockResponse: ManualValidationCasesPageDto = {
        totalCount: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        items: [],
      };

      manualValidationService.getPendingManualCases.mockResolvedValue(
        mockResponse,
      );

      await controller.getPendingManualCases({});

      expect(
        manualValidationService.getPendingManualCases,
      ).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('POST /manual-validation/:transactionId/approve', () => {
    it('debe aprobar un caso manual eligiendo un voucher', async () => {
      const transactionId = 'TX-001';
      const dto: ApproveManualCaseDto = {
        voucherId: 101,
        approverNotes: 'Voucher correcto',
      };
      const mockRequest = {
        user: { id: 'user-123' },
      };

      manualValidationService.approveManualCase.mockResolvedValue({
        message: 'Caso aprobado exitosamente',
        reconciliation: {
          transactionBankId: transactionId,
          voucherId: 101,
          status: ValidationStatus.CONFIRMED,
        },
        approvedAt: new Date(),
      });

      const result = await controller.approveManualCase(
        transactionId,
        dto,
        mockRequest as any,
      );

      expect(result.message).toBe('Caso aprobado exitosamente');
      expect(manualValidationService.approveManualCase).toHaveBeenCalledWith(
        transactionId,
        101,
        'user-123',
        'Voucher correcto',
      );
    });

    it('debe usar userId system si no hay autenticación', async () => {
      const transactionId = 'TX-002';
      const dto: ApproveManualCaseDto = { voucherId: 102 };
      const mockRequest = {}; // Sin user

      manualValidationService.approveManualCase.mockResolvedValue({
        message: 'Caso aprobado exitosamente',
        reconciliation: {
          transactionBankId: transactionId,
          voucherId: 102,
          status: ValidationStatus.CONFIRMED,
        },
        approvedAt: new Date(),
      });

      await controller.approveManualCase(
        transactionId,
        dto,
        mockRequest as any,
      );

      expect(manualValidationService.approveManualCase).toHaveBeenCalledWith(
        transactionId,
        102,
        'system',
        undefined,
      );
    });

    it('debe lanzar error si voucher no es candidato válido', async () => {
      const transactionId = 'TX-003';
      const dto: ApproveManualCaseDto = { voucherId: 999 };
      const mockRequest = { user: { id: 'user-123' } };

      const error = new Error('Voucher 999 no es un candidato válido');
      manualValidationService.approveManualCase.mockRejectedValue(error);

      await expect(
        controller.approveManualCase(transactionId, dto, mockRequest as any),
      ).rejects.toThrow('Voucher 999 no es un candidato válido');
    });
  });

  describe('POST /manual-validation/:transactionId/reject', () => {
    it('debe rechazar un caso manual', async () => {
      const transactionId = 'TX-004';
      const dto: RejectManualCaseDto = {
        rejectionReason: 'Ningún voucher coincide',
        notes: 'Contactar residente',
      };
      const mockRequest = { user: { id: 'user-456' } };

      manualValidationService.rejectManualCase.mockResolvedValue({
        message: 'Caso rechazado exitosamente',
        transactionBankId: transactionId,
        newStatus: ValidationStatus.NOT_FOUND,
        rejectedAt: new Date(),
      });

      const result = await controller.rejectManualCase(
        transactionId,
        dto,
        mockRequest as any,
      );

      expect(result.message).toBe('Caso rechazado exitosamente');
      expect(manualValidationService.rejectManualCase).toHaveBeenCalledWith(
        transactionId,
        'user-456',
        'Ningún voucher coincide',
        'Contactar residente',
      );
    });

    it('debe rechazar sin notas opcionales', async () => {
      const transactionId = 'TX-005';
      const dto: RejectManualCaseDto = {
        rejectionReason: 'Sin información suficiente',
      };
      const mockRequest = { user: { id: 'user-789' } };

      manualValidationService.rejectManualCase.mockResolvedValue({
        message: 'Caso rechazado exitosamente',
        transactionBankId: transactionId,
        newStatus: ValidationStatus.NOT_FOUND,
        rejectedAt: new Date(),
      });

      await controller.rejectManualCase(transactionId, dto, mockRequest as any);

      expect(manualValidationService.rejectManualCase).toHaveBeenCalledWith(
        transactionId,
        'user-789',
        'Sin información suficiente',
        undefined,
      );
    });

    it('debe lanzar error si caso no existe', async () => {
      const transactionId = 'TX-INVALID';
      const dto: RejectManualCaseDto = { rejectionReason: 'Test' };
      const mockRequest = { user: { id: 'user-123' } };

      const error = new Error(
        'Caso de validación manual no encontrado para transacción TX-INVALID',
      );
      manualValidationService.rejectManualCase.mockRejectedValue(error);

      await expect(
        controller.rejectManualCase(transactionId, dto, mockRequest as any),
      ).rejects.toThrow('Caso de validación manual no encontrado');
    });
  });

  describe('GET /manual-validation/stats', () => {
    it('debe retornar estadísticas de validación manual', async () => {
      const mockStats: ManualValidationStatsDto = {
        totalPending: 15,
        totalApproved: 127,
        totalRejected: 8,
        pendingLast24Hours: 3,
        approvalRate: 0.94,
        avgApprovalTimeMinutes: 125,
        distributionByHouseRange: {
          '1-10': 5,
          '11-20': 4,
          '21-30': 2,
          '31-40': 2,
          '41-66': 2,
        },
      };

      manualValidationService.getManualValidationStats.mockResolvedValue(
        mockStats,
      );

      const result = await controller.getManualValidationStats();

      expect(result).toEqual(mockStats);
      expect(result.totalPending).toBe(15);
      expect(result.approvalRate).toBe(0.94);
      expect(
        manualValidationService.getManualValidationStats,
      ).toHaveBeenCalled();
    });

    it('debe manejar valores iniciales (sin casos)', async () => {
      const mockStats: ManualValidationStatsDto = {
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        pendingLast24Hours: 0,
        approvalRate: 0,
        avgApprovalTimeMinutes: 0,
        distributionByHouseRange: {},
      };

      manualValidationService.getManualValidationStats.mockResolvedValue(
        mockStats,
      );

      const result = await controller.getManualValidationStats();

      expect(result.totalPending).toBe(0);
      expect(result.approvalRate).toBe(0);
    });
  });
});
