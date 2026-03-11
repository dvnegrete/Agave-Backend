import { HistoricalRecordRow } from '../historical-record-row.entity';

describe('HistoricalRecordRow', () => {
  describe('create', () => {
    it('should create instance with all properties', () => {
      const params = {
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago mensual',
        deposito: 1500.42,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 50,
        agua: 550,
        rowNumber: 2,
      };

      const row = HistoricalRecordRow.create(params);

      expect(row.fecha).toEqual(params.fecha);
      expect(row.hora).toBe(params.hora);
      expect(row.concepto).toBe(params.concepto);
      expect(row.deposito).toBe(params.deposito);
      expect(row.casa).toBe(params.casa);
      expect(row.cuotaExtra).toBe(params.cuotaExtra);
      expect(row.mantto).toBe(params.mantto);
      expect(row.penalizacion).toBe(params.penalizacion);
      expect(row.agua).toBe(params.agua);
      expect(row.rowNumber).toBe(params.rowNumber);
    });
  });

  describe('getIdentifiedHouseNumber', () => {
    it('should return casa when casa > 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1500.42,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 700,
        rowNumber: 2,
      });

      expect(row.getIdentifiedHouseNumber()).toBe(42);
    });

    it('should extract house number from deposit cents when casa = 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1542.42,
        casa: 0,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      expect(row.getIdentifiedHouseNumber()).toBe(42);
    });

    it('should handle deposit with 0 cents', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1500.0,
        casa: 0,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      expect(row.getIdentifiedHouseNumber()).toBe(0);
    });
  });

  describe('getSumCtaAmounts', () => {
    it('should sum all cta_* amounts', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 50,
        agua: 550,
        rowNumber: 2,
      });

      expect(row.getSumCtaAmounts()).toBe(1500);
    });

    it('should return 0 when all amounts are 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      expect(row.getSumCtaAmounts()).toBe(0);
    });

    it('should sum partial amounts', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1350.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 550,
        rowNumber: 2,
      });

      expect(row.getSumCtaAmounts()).toBe(1350);
    });
  });

  describe('isValidAmountDistribution', () => {
    it('should validate when casa > 0 and floor(deposito) equals sum(cta_*)', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1500.99,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 50,
        agua: 550,
        rowNumber: 2,
      });

      expect(row.isValidAmountDistribution()).toBe(true);
    });

    it('should validate when casa > 0 and sum(cta_*) = 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago sin conceptos',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      expect(row.isValidAmountDistribution()).toBe(true);
    });

    it('should validate when casa = 0 and sum(cta_*) = 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago sin identificar',
        deposito: 1500.0,
        casa: 0,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      expect(row.isValidAmountDistribution()).toBe(true);
    });

    it('should invalidate when casa = 0 and sum(cta_*) > 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago inválido',
        deposito: 1500.0,
        casa: 0,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 700,
        rowNumber: 2,
      });

      expect(row.isValidAmountDistribution()).toBe(false);
    });

    it('should invalidate when casa > 0 and amounts do not match', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago inválido',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 0,
        agua: 500,
        rowNumber: 2,
      });

      expect(row.isValidAmountDistribution()).toBe(false);
    });
  });

  describe('isIdentifiedPayment', () => {
    it('should return true when casa > 0', () => {
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

      expect(row.isIdentifiedPayment()).toBe(true);
    });

    it('should return false when casa = 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 800.0,
        casa: 0,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      expect(row.isIdentifiedPayment()).toBe(false);
    });
  });

  describe('getPeriodInfo', () => {
    it('should extract year and month from fecha', () => {
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

      const periodInfo = row.getPeriodInfo();

      expect(periodInfo.year).toBe(2025);
      expect(periodInfo.month).toBe(1);
    });

    it('should handle December correctly', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2024-12-25'),
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

      const periodInfo = row.getPeriodInfo();

      expect(periodInfo.year).toBe(2024);
      expect(periodInfo.month).toBe(12);
    });
  });

  describe('getActiveCtaTypes', () => {
    it('should return all cta types when all amounts > 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 50,
        agua: 550,
        rowNumber: 2,
      });

      const activeTypes = row.getActiveCtaTypes();

      expect(activeTypes).toHaveLength(4);
      expect(activeTypes).toContainEqual({
        type: 'extraordinary_fee',
        amount: 100,
      });
      expect(activeTypes).toContainEqual({ type: 'maintenance', amount: 800 });
      expect(activeTypes).toContainEqual({ type: 'penalties', amount: 50 });
      expect(activeTypes).toContainEqual({ type: 'water', amount: 550 });
    });

    it('should return empty array when all amounts = 0', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 800.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const activeTypes = row.getActiveCtaTypes();

      expect(activeTypes).toHaveLength(0);
    });

    it('should return only active types', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1350.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 550,
        rowNumber: 2,
      });

      const activeTypes = row.getActiveCtaTypes();

      expect(activeTypes).toHaveLength(2);
      expect(activeTypes).toContainEqual({ type: 'maintenance', amount: 800 });
      expect(activeTypes).toContainEqual({ type: 'water', amount: 550 });
    });
  });

  describe('validate', () => {
    it('should validate correct row', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago mensual',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 50,
        agua: 550,
        rowNumber: 2,
      });

      const validation = row.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should invalidate negative deposito', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: -100,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const validation = row.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('DEPOSITO must be positive');
    });

    it('should invalidate zero deposito', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const validation = row.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('DEPOSITO must be positive');
    });

    it('should invalidate negative casa', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 800.0,
        casa: -5,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const validation = row.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('Casa cannot be negative');
    });

    it('should invalidate empty concepto', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: '',
        deposito: 800.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const validation = row.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('CONCEPTO cannot be empty');
    });

    it('should invalidate amount distribution mismatch for identified payment', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 0,
        agua: 500,
        rowNumber: 2,
      });

      const validation = row.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('Amount distribution error');
    });

    it('should invalidate unidentified payment with cta_* amounts', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 1500.0,
        casa: 0,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 700,
        rowNumber: 2,
      });

      const validation = row.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('Casa is 0 (unidentified)');
    });

    it('should accumulate multiple validation errors', () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: '',
        deposito: -100,
        casa: -5,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const validation = row.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(1);
    });
  });
});
