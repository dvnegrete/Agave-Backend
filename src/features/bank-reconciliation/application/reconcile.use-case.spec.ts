import { Test, TestingModule } from '@nestjs/testing';
import { ReconcileUseCase } from './reconcile.use-case';
import { MatchingService } from '../infrastructure/matching/matching.service';
import { ReconciliationPersistenceService } from '../infrastructure/persistence/reconciliation-persistence.service';
import { ReconciliationDataService } from '../infrastructure/persistence/reconciliation-data.service';
import { MatchSuggestionsService } from '../infrastructure/persistence/match-suggestions.service';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import {
  ReconciliationMatch,
  SurplusTransaction,
  ManualValidationCase,
  ConfidenceLevel,
  MatchCriteria,
} from '../domain';

describe('ReconcileUseCase', () => {
  let useCase: ReconcileUseCase;
  let dataService: jest.Mocked<ReconciliationDataService>;
  let matchingService: jest.Mocked<MatchingService>;
  let persistenceService: jest.Mocked<ReconciliationPersistenceService>;

  beforeEach(async () => {
    const mockDataService = {
      getPendingTransactions: jest.fn(),
      getPendingVouchers: jest.fn(),
    };

    const mockMatchingService = {
      matchTransaction: jest.fn(),
    };

    const mockPersistenceService = {
      persistReconciliation: jest.fn(),
      persistSurplus: jest.fn().mockResolvedValue(undefined),
      persistManualValidationCase: jest.fn().mockResolvedValue(undefined),
    };

    const mockMatchSuggestionsService = {
      findMatchSuggestions: jest.fn().mockResolvedValue({ suggestions: [] }),
      applyMatchSuggestion: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconcileUseCase,
        {
          provide: ReconciliationDataService,
          useValue: mockDataService,
        },
        {
          provide: MatchingService,
          useValue: mockMatchingService,
        },
        {
          provide: ReconciliationPersistenceService,
          useValue: mockPersistenceService,
        },
        {
          provide: MatchSuggestionsService,
          useValue: mockMatchSuggestionsService,
        },
      ],
    }).compile();

    useCase = module.get<ReconcileUseCase>(ReconcileUseCase);
    dataService = module.get(ReconciliationDataService);
    matchingService = module.get(MatchingService);
    persistenceService = module.get(ReconciliationPersistenceService);
  });

  const createMockTransaction = (
    id: string,
    amount: number,
  ): TransactionBank => {
    return {
      id,
      amount,
      date: new Date('2025-01-10'),
      time: '10:00:00',
      is_deposit: true,
      confirmation_status: false,
    } as TransactionBank;
  };

  const createMockVoucher = (id: number, amount: number): Voucher => {
    return {
      id,
      amount,
      date: new Date('2025-01-10T10:00:00'),
      confirmation_status: false,
    } as Voucher;
  };

  describe('execute', () => {
    it('should successfully reconcile matched transactions', async () => {
      const mockTransactions = [
        createMockTransaction('tx1', 500.15),
        createMockTransaction('tx2', 600.25),
      ];

      const mockVouchers = [
        createMockVoucher(1, 500.15),
        createMockVoucher(2, 600.25),
      ];

      const mockMatch1 = ReconciliationMatch.create({
        transaction: mockTransactions[0],
        voucher: mockVouchers[0],
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.HIGH,
        dateDifferenceHours: 0.1,
      });

      const mockMatch2 = ReconciliationMatch.create({
        transaction: mockTransactions[1],
        voucher: mockVouchers[1],
        houseNumber: 25,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.HIGH,
        dateDifferenceHours: 0.2,
      });

      dataService.getPendingTransactions.mockResolvedValue(mockTransactions);
      dataService.getPendingVouchers.mockResolvedValue(mockVouchers);

      matchingService.matchTransaction
        .mockResolvedValueOnce({
          type: 'matched',
          match: mockMatch1,
          voucherId: 1,
          voucher: mockVouchers[0],
        })
        .mockResolvedValueOnce({
          type: 'matched',
          match: mockMatch2,
          voucherId: 2,
          voucher: mockVouchers[1],
        });

      persistenceService.persistReconciliation.mockResolvedValue(undefined);

      const result = await useCase.execute({});

      expect(dataService.getPendingTransactions).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
      expect(dataService.getPendingVouchers).toHaveBeenCalledWith(
        undefined,
        undefined,
      );

      expect(matchingService.matchTransaction).toHaveBeenCalledTimes(2);
      expect(persistenceService.persistReconciliation).toHaveBeenCalledTimes(2);
      expect(persistenceService.persistReconciliation).toHaveBeenNthCalledWith(
        1,
        'tx1',
        mockVouchers[0], // Ahora pasa el objeto voucher completo
        15,
      );
      expect(persistenceService.persistReconciliation).toHaveBeenNthCalledWith(
        2,
        'tx2',
        mockVouchers[1], // Ahora pasa el objeto voucher completo
        25,
      );

      expect(result.conciliados).toHaveLength(2);
      expect(result.unclaimedDeposits).toHaveLength(0);
      expect(result.unfundedVouchers).toHaveLength(0);
      expect(result.manualValidationRequired).toHaveLength(0);

      expect(result.summary.totalProcessed).toBe(2);
      expect(result.summary.conciliados).toBe(2);
      expect(result.summary.getSuccessRate()).toBe(100);
    });

    it('should handle surplus transactions', async () => {
      const mockTransactions = [createMockTransaction('tx1', 500.15)];
      const mockVouchers: Voucher[] = [];

      const mockSurplus = SurplusTransaction.fromTransaction(
        mockTransactions[0],
        'No voucher found, house 15 identified by cents',
        true,
        15, // houseNumber
      );

      dataService.getPendingTransactions.mockResolvedValue(mockTransactions);
      dataService.getPendingVouchers.mockResolvedValue(mockVouchers);

      matchingService.matchTransaction.mockResolvedValue({
        type: 'surplus',
        surplus: mockSurplus,
      });

      const result = await useCase.execute({});

      expect(result.conciliados).toHaveLength(0);
      expect(result.unfundedVouchers).toHaveLength(0);
      expect(result.unclaimedDeposits).toHaveLength(1);
      expect(result.unclaimedDeposits[0].transactionBankId).toBe('tx1');
      expect(result.unclaimedDeposits[0].houseNumber).toBe(15);

      expect(result.summary.unclaimedDeposits).toBe(1);
      expect(result.summary.getSuccessRate()).toBe(0);
    });

    it('should handle pending vouchers without matches', async () => {
      const mockTransactions: TransactionBank[] = [];
      const mockVouchers = [createMockVoucher(1, 500.15)];

      dataService.getPendingTransactions.mockResolvedValue(mockTransactions);
      dataService.getPendingVouchers.mockResolvedValue(mockVouchers);

      const result = await useCase.execute({});

      expect(result.conciliados).toHaveLength(0);
      expect(result.unfundedVouchers).toHaveLength(1);
      expect(result.unfundedVouchers[0].voucherId).toBe(1);
      expect(result.unfundedVouchers[0].reason).toBe(
        'No matching bank transaction found',
      );

      expect(result.summary.unfundedVouchers).toBe(1);
    });

    it('should handle manual validation cases', async () => {
      const mockTransaction = createMockTransaction('tx1', 500.15);
      const mockVouchers = [
        createMockVoucher(1, 500.15),
        createMockVoucher(2, 500.15),
      ];

      const mockManualCase = ManualValidationCase.create({
        transaction: mockTransaction,
        possibleMatches: [
          {
            voucher: mockVouchers[0],
            dateDifferenceHours: 1,
            similarityScore: 0.9,
          },
          {
            voucher: mockVouchers[1],
            dateDifferenceHours: 2,
            similarityScore: 0.85,
          },
        ],
        reason: 'Multiple vouchers with same amount',
      });

      dataService.getPendingTransactions.mockResolvedValue([mockTransaction]);
      dataService.getPendingVouchers.mockResolvedValue(mockVouchers);

      matchingService.matchTransaction.mockResolvedValue({
        type: 'manual',
        case: mockManualCase,
      });

      const result = await useCase.execute({});

      expect(result.manualValidationRequired).toHaveLength(1);
      expect(result.manualValidationRequired[0].transactionBankId).toBe('tx1');
      expect(result.manualValidationRequired[0].possibleMatches).toHaveLength(
        2,
      );

      expect(result.summary.requiresManualValidation).toBe(1);
      expect(result.summary.hasManualReview()).toBe(true);
    });

    it('should handle persistence errors by creating surplus', async () => {
      const mockTransactions = [createMockTransaction('tx1', 500.15)];
      const mockVouchers = [createMockVoucher(1, 500.15)];

      const mockMatch = ReconciliationMatch.create({
        transaction: mockTransactions[0],
        voucher: mockVouchers[0],
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.HIGH,
      });

      dataService.getPendingTransactions.mockResolvedValue(mockTransactions);
      dataService.getPendingVouchers.mockResolvedValue(mockVouchers);

      matchingService.matchTransaction.mockResolvedValue({
        type: 'matched',
        match: mockMatch,
        voucherId: 1,
        voucher: mockVouchers[0],
      });

      persistenceService.persistReconciliation.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await useCase.execute({});

      expect(result.conciliados).toHaveLength(0); // Not added due to error
      expect(result.unclaimedDeposits).toHaveLength(1); // Converted to surplus
      expect(result.unclaimedDeposits[0].reason).toContain(
        'Error durante persistencia',
      );
    });

    it('should pass date range to data service', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      dataService.getPendingTransactions.mockResolvedValue([]);
      dataService.getPendingVouchers.mockResolvedValue([]);

      await useCase.execute({ startDate, endDate });

      expect(dataService.getPendingTransactions).toHaveBeenCalledWith(
        expect.objectContaining(startDate),
        expect.objectContaining(endDate),
      );
      expect(dataService.getPendingVouchers).toHaveBeenCalledWith(
        expect.objectContaining(startDate),
        expect.objectContaining(endDate),
      );
    });

    it('should not process already matched vouchers', async () => {
      const mockTransactions = [
        createMockTransaction('tx1', 500.15),
        createMockTransaction('tx2', 500.15), // Same amount
      ];

      const mockVouchers = [createMockVoucher(1, 500.15)]; // Only one voucher

      const mockMatch = ReconciliationMatch.create({
        transaction: mockTransactions[0],
        voucher: mockVouchers[0],
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.HIGH,
      });

      const mockSurplus = SurplusTransaction.fromTransaction(
        mockTransactions[1],
        'No voucher found, house 15 identified by cents',
        true,
        15,
      );

      dataService.getPendingTransactions.mockResolvedValue(mockTransactions);
      dataService.getPendingVouchers.mockResolvedValue(mockVouchers);

      matchingService.matchTransaction
        .mockResolvedValueOnce({
          type: 'matched',
          match: mockMatch,
          voucherId: 1,
          voucher: mockVouchers[0],
        })
        .mockResolvedValueOnce({
          type: 'surplus',
          surplus: mockSurplus,
        });

      persistenceService.persistReconciliation.mockResolvedValue(undefined);

      const result = await useCase.execute({});

      expect(result.conciliados).toHaveLength(1);
      expect(result.unclaimedDeposits).toHaveLength(1);

      // Verify processedVoucherIds was maintained correctly
      const secondCall = matchingService.matchTransaction.mock.calls[1];
      const processedIds = secondCall[2];
      expect(processedIds.has(1)).toBe(true); // Voucher 1 should be marked as processed
    });

    it('should handle mixed results correctly', async () => {
      const mockTransactions = [
        createMockTransaction('tx1', 500.15), // Will be matched
        createMockTransaction('tx2', 600.25), // Will be surplus
        createMockTransaction('tx3', 700.35), // Will require manual validation
      ];

      const mockVouchers = [
        createMockVoucher(1, 500.15),
        createMockVoucher(2, 700.35),
        createMockVoucher(3, 700.35), // Duplicate amount for manual validation
        createMockVoucher(4, 800.45), // No transaction match
      ];

      const mockMatch = ReconciliationMatch.create({
        transaction: mockTransactions[0],
        voucher: mockVouchers[0],
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.HIGH,
      });

      const mockSurplus = SurplusTransaction.fromTransaction(
        mockTransactions[1],
        'No voucher found, house 25 identified by cents',
        true,
        25,
      );

      const mockManualCase = ManualValidationCase.create({
        transaction: mockTransactions[2],
        possibleMatches: [
          {
            voucher: mockVouchers[1],
            dateDifferenceHours: 1,
            similarityScore: 0.9,
          },
          {
            voucher: mockVouchers[2],
            dateDifferenceHours: 2,
            similarityScore: 0.85,
          },
        ],
        reason: 'Multiple vouchers with same amount',
      });

      dataService.getPendingTransactions.mockResolvedValue(mockTransactions);
      dataService.getPendingVouchers.mockResolvedValue(mockVouchers);

      matchingService.matchTransaction
        .mockResolvedValueOnce({
          type: 'matched',
          match: mockMatch,
          voucherId: 1,
          voucher: mockVouchers[0],
        })
        .mockResolvedValueOnce({ type: 'surplus', surplus: mockSurplus })
        .mockResolvedValueOnce({ type: 'manual', case: mockManualCase });

      persistenceService.persistReconciliation.mockResolvedValue(undefined);

      const result = await useCase.execute({});

      expect(result.conciliados).toHaveLength(1);
      expect(result.unclaimedDeposits).toHaveLength(1);
      expect(result.manualValidationRequired).toHaveLength(1);
      expect(result.unfundedVouchers).toHaveLength(1); // Only voucher 4, not matched

      expect(result.summary.totalProcessed).toBe(3);
      expect(result.summary.conciliados).toBe(1);
      expect(result.summary.unclaimedDeposits).toBe(1);
      expect(result.summary.unfundedVouchers).toBe(1);
      expect(result.summary.requiresManualValidation).toBe(1);
      expect(result.summary.getSuccessRate()).toBe(33); // 1/3 * 100 = 33.33... → rounded to 33
    });

    it('should handle empty transactions and vouchers', async () => {
      dataService.getPendingTransactions.mockResolvedValue([]);
      dataService.getPendingVouchers.mockResolvedValue([]);

      const result = await useCase.execute({});

      expect(result.conciliados).toHaveLength(0);
      expect(result.unclaimedDeposits).toHaveLength(0);
      expect(result.unfundedVouchers).toHaveLength(0);
      expect(result.manualValidationRequired).toHaveLength(0);

      expect(result.summary.totalProcessed).toBe(0);
      expect(result.summary.getSuccessRate()).toBe(0);
    });

    it('should persist surplus transactions to database', async () => {
      const mockTransaction = createMockTransaction('tx1', 1500.0);
      dataService.getPendingTransactions.mockResolvedValue([mockTransaction]);
      dataService.getPendingVouchers.mockResolvedValue([]);

      // Mock surplus result (requires manual review)
      matchingService.matchTransaction.mockResolvedValue({
        type: 'surplus',
        surplus: SurplusTransaction.fromTransaction(
          mockTransaction,
          'Sin información suficiente para conciliar (sin centavos válidos ni concepto claro)',
          true,
          undefined,
        ),
      });

      await useCase.execute({ startDate: new Date(), endDate: new Date() });

      // Verificar que se llamó persistSurplus
      expect(persistenceService.persistSurplus).toHaveBeenCalledWith(
        mockTransaction.id,
        expect.objectContaining({
          transactionBankId: mockTransaction.id,
          requiresManualReview: true,
          reason: expect.stringContaining('Sin información suficiente'),
        }),
      );

      // Verificar que está en sobrantes
      expect(persistenceService.persistSurplus).toHaveBeenCalledTimes(1);
    });

    it('should persist manual validation cases to database', async () => {
      const mockTransaction = createMockTransaction('tx1', 1500.0);
      const mockVoucher1 = createMockVoucher(1, 1500.0);
      const mockVoucher2 = createMockVoucher(2, 1500.0);

      dataService.getPendingTransactions.mockResolvedValue([mockTransaction]);
      dataService.getPendingVouchers.mockResolvedValue([
        mockVoucher1,
        mockVoucher2,
      ]);

      // Mock manual validation result
      matchingService.matchTransaction.mockResolvedValue({
        type: 'manual',
        case: ManualValidationCase.create({
          transaction: mockTransaction,
          possibleMatches: [
            {
              voucher: mockVoucher1,
              dateDifferenceHours: 2,
              similarityScore: 0.85,
            },
            {
              voucher: mockVoucher2,
              dateDifferenceHours: 3,
              similarityScore: 0.82,
            },
          ],
          reason: 'Múltiples vouchers candidatos con alta similitud',
        }),
      });

      await useCase.execute({ startDate: new Date(), endDate: new Date() });

      // Verificar que se llamó persistManualValidationCase
      expect(
        persistenceService.persistManualValidationCase,
      ).toHaveBeenCalledWith(
        mockTransaction.id,
        expect.objectContaining({
          transactionBankId: mockTransaction.id,
          possibleMatches: expect.arrayContaining([
            expect.objectContaining({ voucherId: 1, similarity: 0.85 }),
            expect.objectContaining({ voucherId: 2, similarity: 0.82 }),
          ]),
          reason: expect.stringContaining('Múltiples vouchers candidatos'),
        }),
      );

      // Verificar que está en manualValidationRequired
      expect(
        persistenceService.persistManualValidationCase,
      ).toHaveBeenCalledTimes(1);
    });

    it('should continue processing even if persistSurplus fails', async () => {
      const mockTransaction = createMockTransaction('tx1', 1500.0);
      dataService.getPendingTransactions.mockResolvedValue([mockTransaction]);
      dataService.getPendingVouchers.mockResolvedValue([]);

      // Mock surplus result
      matchingService.matchTransaction.mockResolvedValue({
        type: 'surplus',
        surplus: SurplusTransaction.fromTransaction(
          mockTransaction,
          'Sin información suficiente',
          true,
          undefined,
        ),
      });

      // Mock persistSurplus to fail
      persistenceService.persistSurplus.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await useCase.execute({
        startDate: new Date(),
        endDate: new Date(),
      });

      // El depósito no reclamado debe estar en el response aunque falló la persistencia
      expect(result.unclaimedDeposits.length).toBe(1);
      expect(result.unclaimedDeposits[0].transactionBankId).toBe(mockTransaction.id);
    });

    it('should continue processing even if persistManualValidationCase fails', async () => {
      const mockTransaction = createMockTransaction('tx1', 1500.0);
      const mockVoucher1 = createMockVoucher(1, 1500.0);

      dataService.getPendingTransactions.mockResolvedValue([mockTransaction]);
      dataService.getPendingVouchers.mockResolvedValue([mockVoucher1]);

      // Mock manual validation result
      matchingService.matchTransaction.mockResolvedValue({
        type: 'manual',
        case: ManualValidationCase.create({
          transaction: mockTransaction,
          possibleMatches: [
            {
              voucher: mockVoucher1,
              dateDifferenceHours: 2,
              similarityScore: 0.85,
            },
          ],
          reason: 'Múltiples candidatos',
        }),
      });

      // Mock persistManualValidationCase to fail
      persistenceService.persistManualValidationCase.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await useCase.execute({
        startDate: new Date(),
        endDate: new Date(),
      });

      // El caso manual debe estar en el response aunque falló la persistencia
      expect(result.manualValidationRequired.length).toBe(1);
      expect(result.manualValidationRequired[0].transactionBankId).toBe(
        mockTransaction.id,
      );
    });
  });
});
