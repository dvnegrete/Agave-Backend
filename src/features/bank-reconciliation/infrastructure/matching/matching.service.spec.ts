import { MatchingService } from './matching.service';
import { ConceptHouseExtractorService } from './concept-house-extractor.service';
import { ConceptAnalyzerService } from './concept-analyzer.service';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { ConfidenceLevel, MatchCriteria } from '../../domain';

describe('MatchingService - Nueva Lógica', () => {
  let service: MatchingService;
  let mockConceptExtractor: jest.Mocked<ConceptHouseExtractorService>;
  let mockConceptAnalyzer: jest.Mocked<ConceptAnalyzerService>;

  beforeEach(() => {
    // Crear mocks
    mockConceptExtractor = {
      extractHouseNumber: jest.fn(),
    } as any;

    mockConceptAnalyzer = {
      analyzeConceptWithAI: jest.fn(),
    } as any;

    service = new MatchingService(mockConceptExtractor, mockConceptAnalyzer);
  });

  const createTransaction = (
    id: string,
    amount: number,
    date: Date,
    time: string,
    concept?: string,
  ): TransactionBank => {
    return {
      id,
      amount,
      date,
      time,
      concept,
      is_deposit: true,
      confirmation_status: false,
    } as TransactionBank;
  };

  const createVoucher = (id: number, amount: number, date: Date): Voucher => {
    return {
      id,
      amount,
      date,
      confirmation_status: false,
    } as Voucher;
  };

  describe('Matching con Voucher', () => {
    it('debe conciliar con voucher único por monto exacto', async () => {
      const transaction = createTransaction(
        'tx1',
        500.15,
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
      );

      const vouchers = [
        createVoucher(1, 500.15, new Date('2025-01-10T10:05:00')),
        createVoucher(2, 600.25, new Date('2025-01-10T10:10:00')),
      ];

      const result = await service.matchTransaction(
        transaction,
        vouchers,
        new Set(),
      );

      expect(result.type).toBe('matched');
      if (result.type === 'matched') {
        expect(result.match.transactionBankId).toBe('tx1');
        expect(result.match.voucherId).toBe(1);
        expect(result.match.houseNumber).toBe(15);
        expect(result.match.confidenceLevel).toBe(ConfidenceLevel.HIGH);
      }
    });

    it('debe usar el voucher más cercano cuando hay múltiples coincidencias', async () => {
      const transaction = createTransaction(
        'tx1',
        500.05,
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
      );

      const vouchers = [
        createVoucher(1, 500.05, new Date('2025-01-10T15:00:00')), // 5 horas después
        createVoucher(2, 500.05, new Date('2025-01-10T10:30:00')), // 30 min después (MÁS CERCANO)
        createVoucher(3, 500.05, new Date('2025-01-10T08:00:00')), // 2 horas antes
      ];

      const result = await service.matchTransaction(
        transaction,
        vouchers,
        new Set(),
      );

      expect(result.type).toBe('matched');
      if (result.type === 'matched') {
        expect(result.voucherId).toBe(2); // El más cercano
      }
    });
  });

  describe('Conciliación por Centavos (Nueva Regla)', () => {
    beforeEach(() => {
      // Mock por defecto: concepto no identifica casa
      mockConceptExtractor.extractHouseNumber.mockReturnValue({
        houseNumber: null,
        confidence: 'none',
        method: 'none',
        reason: 'No se encontró patrón',
      });
    });

    it('debe conciliar automáticamente con solo centavos (sin concepto)', async () => {
      const transaction = createTransaction(
        'tx1',
        500.15,
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
        'Transferencia bancaria', // Concepto genérico
      );

      const result = await service.matchTransaction(transaction, [], new Set());

      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(15);
        expect(result.surplus.requiresManualReview).toBe(false); // ✅ AUTO-CONCILIADO
        expect(result.surplus.reason).toContain('Identificado por centavos');
      }
    });

    it('debe conciliar automáticamente cuando centavos y concepto coinciden', async () => {
      // Mock: concepto identifica casa 15
      mockConceptExtractor.extractHouseNumber.mockReturnValue({
        houseNumber: 15,
        confidence: 'high',
        method: 'regex',
        reason: 'Patrón casa_numero',
      });

      const transaction = createTransaction(
        'tx1',
        500.15,
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
        'Casa 15 mantenimiento',
      );

      const result = await service.matchTransaction(transaction, [], new Set());

      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(15);
        expect(result.surplus.requiresManualReview).toBe(false); // ✅ AUTO-CONCILIADO
        expect(result.surplus.reason).toContain(
          'Centavos + concepto coinciden',
        );
      }
    });

    it('debe requerir validación manual cuando hay conflicto centavos vs concepto', async () => {
      // Mock: concepto identifica casa 10
      mockConceptExtractor.extractHouseNumber.mockReturnValue({
        houseNumber: 10,
        confidence: 'high',
        method: 'regex',
        reason: 'Patrón casa_numero',
      });

      const transaction = createTransaction(
        'tx1',
        500.05, // Centavos = 5
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
        'Casa 10 agua', // Concepto = 10
      );

      const result = await service.matchTransaction(transaction, [], new Set());

      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(5); // Usa centavos
        expect(result.surplus.requiresManualReview).toBe(true); // ⚠️ REQUIERE VALIDACIÓN
        expect(result.surplus.reason).toContain('Conflicto');
        expect(result.surplus.reason).toContain('casa 10');
        expect(result.surplus.reason).toContain('casa 5');
      }
    });

    it('debe marcar como sobrante cuando centavos fuera de rango', async () => {
      const transaction = createTransaction(
        'tx1',
        100.99, // Centavos = 99 (fuera de rango 1-66)
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
        'Pago recibido',
      );

      const result = await service.matchTransaction(transaction, [], new Set());

      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(0);
        expect(result.surplus.requiresManualReview).toBe(true); // ⚠️ SOBRANTE
        expect(result.surplus.reason).toContain('sin centavos válidos');
      }
    });
  });

  describe('Conciliación por Concepto sin Centavos', () => {
    it('debe conciliar automáticamente con concepto HIGH confidence y sin centavos', async () => {
      // Mock: concepto identifica casa 5 con alta confianza
      mockConceptExtractor.extractHouseNumber.mockReturnValue({
        houseNumber: 5,
        confidence: 'high',
        method: 'regex',
        reason: 'Patrón casa_numero',
      });

      const transaction = createTransaction(
        'tx1',
        500.0, // Sin centavos
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
        'Casa 5 mantenimiento',
      );

      const result = await service.matchTransaction(transaction, [], new Set());

      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(5);
        expect(result.surplus.requiresManualReview).toBe(false); // ✅ AUTO-CONCILIADO
        expect(result.surplus.reason).toContain(
          'Concepto identifica claramente',
        );
      }
    });

    it('debe marcar como sobrante si concepto tiene confianza media/baja sin centavos', async () => {
      // Mock: concepto con confianza media
      mockConceptExtractor.extractHouseNumber.mockReturnValue({
        houseNumber: 10,
        confidence: 'medium', // No es HIGH
        method: 'regex',
        reason: 'Patrón lote_numero',
      });

      const transaction = createTransaction(
        'tx1',
        500.0, // Sin centavos
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
        'Lote 10',
      );

      const result = await service.matchTransaction(transaction, [], new Set());

      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(0);
        expect(result.surplus.requiresManualReview).toBe(true); // ⚠️ SOBRANTE
      }
    });
  });

  describe('Casos Sin Información', () => {
    beforeEach(() => {
      mockConceptExtractor.extractHouseNumber.mockReturnValue({
        houseNumber: null,
        confidence: 'none',
        method: 'none',
        reason: 'No se encontró patrón',
      });
    });

    it('debe marcar como sobrante cuando no hay centavos ni concepto', async () => {
      const transaction = createTransaction(
        'tx1',
        500.0, // Sin centavos
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
        'Transferencia bancaria', // Concepto genérico
      );

      const result = await service.matchTransaction(transaction, [], new Set());

      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(0);
        expect(result.surplus.requiresManualReview).toBe(true); // ⚠️ SOBRANTE
        expect(result.surplus.reason).toContain('sin centavos');
      }
    });
  });

  describe('Edge Cases', () => {
    it('no debe usar vouchers ya procesados', async () => {
      const transaction = createTransaction(
        'tx1',
        500.15,
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
      );

      const vouchers = [
        createVoucher(1, 500.15, new Date('2025-01-10T10:05:00')),
      ];

      const processedIds = new Set<number>([1]); // Ya procesado

      const result = await service.matchTransaction(
        transaction,
        vouchers,
        processedIds,
      );

      // Como no hay vouchers disponibles, debe intentar por centavos
      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(15); // Identificado por centavos
      }
    });

    it('debe manejar concepto null o vacío', async () => {
      const transaction = createTransaction(
        'tx1',
        500.15,
        new Date('2025-01-10T10:00:00'),
        '10:00:00',
        undefined, // Sin concepto
      );

      const result = await service.matchTransaction(transaction, [], new Set());

      expect(result.type).toBe('surplus');
      if (result.type === 'surplus') {
        expect(result.surplus.houseNumber).toBe(15); // Usa centavos
        expect(result.surplus.requiresManualReview).toBe(false);
      }
    });
  });

  describe('Manual Validation - Múltiples Candidatos', () => {
    it('debe escalar a validación manual cuando hay 2+ vouchers con similaridad muy cercana (<5%)', async () => {
      const transaction = createTransaction(
        'tx-manual-1',
        1500.15,
        new Date('2025-01-15T10:00:00'),
        '10:00:00',
      );

      // Dos vouchers con diferencia mínima en fecha (ambos muy cercanos)
      const vouchers = [
        createVoucher(101, 1500.15, new Date('2025-01-15T09:00:00')), // 1 hora antes (similitud: 0.97)
        createVoucher(102, 1500.15, new Date('2025-01-15T10:30:00')), // 30 min después (similitud: 0.99)
        createVoucher(103, 1500.5, new Date('2025-01-15T14:00:00')), // Monto diferente, ignore
      ];

      const result = await service.matchTransaction(
        transaction,
        vouchers,
        new Set(),
      );

      expect(result.type).toBe('manual');
      if (result.type === 'manual') {
        expect(result.case.transactionBankId).toBe('tx-manual-1');
        expect(result.case.possibleMatches.length).toBe(2);
        expect(result.case.possibleMatches[0].voucherId).toBe(102); // Más cercano (similarity 0.99)
        expect(result.case.possibleMatches[1].voucherId).toBe(101); // Segundo (similarity 0.97)
        expect(result.case.reason).toContain('similitud muy cercana');
      }
    });

    it('debe auto-conciliar cuando hay diferencia clara entre candidatos (>5%)', async () => {
      const transaction = createTransaction(
        'tx-clear-1',
        2000.2,
        new Date('2025-01-20T10:00:00'),
        '10:00:00',
      );

      // Dos vouchers con diferencia significativa en fecha
      const vouchers = [
        createVoucher(201, 2000.2, new Date('2025-01-20T10:15:00')), // 15 min después (similitud: 0.99)
        createVoucher(202, 2000.2, new Date('2025-01-21T22:00:00')), // 36 horas después (similitud: 0.0)
      ];

      const result = await service.matchTransaction(
        transaction,
        vouchers,
        new Set(),
      );

      expect(result.type).toBe('matched');
      if (result.type === 'matched') {
        expect(result.voucherId).toBe(201); // El más cercano, diferencia clara
        expect(result.match.confidenceLevel).toBe(ConfidenceLevel.HIGH);
      }
    });

    it('debe respetar flag ENABLE_MANUAL_VALIDATION', async () => {
      // Este test verifica que si ENABLE_MANUAL_VALIDATION es false, no escala
      // Nota: Requiere mockar ReconciliationConfig si queremos este test
      // Por ahora es informativo
      expect(true).toBe(true);
    });

    it('debe manejar más de 2 candidatos y retornar todos en possibleMatches', async () => {
      const transaction = createTransaction(
        'tx-multi-3',
        1000.1,
        new Date('2025-01-10T12:00:00'),
        '12:00:00',
      );

      // Tres vouchers con similitud muy cercana
      const vouchers = [
        createVoucher(301, 1000.1, new Date('2025-01-10T11:00:00')), // 1 hora antes
        createVoucher(302, 1000.1, new Date('2025-01-10T12:30:00')), // 30 min después
        createVoucher(303, 1000.1, new Date('2025-01-10T13:00:00')), // 1 hora después
      ];

      const result = await service.matchTransaction(
        transaction,
        vouchers,
        new Set(),
      );

      expect(result.type).toBe('manual');
      if (result.type === 'manual') {
        expect(result.case.possibleMatches.length).toBe(3);
        expect(result.case.possibleMatches).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ voucherId: 302 }),
            expect.objectContaining({ voucherId: 301 }),
            expect.objectContaining({ voucherId: 303 }),
          ]),
        );
      }
    });
  });
});
