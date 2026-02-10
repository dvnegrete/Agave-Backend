import { VoucherEntity, VoucherData } from './voucher.entity';

describe('VoucherEntity', () => {
  describe('fromData', () => {
    it('should create voucher entity from complete data', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: 15,
      };

      const voucher = VoucherEntity.fromData(voucherData);

      expect(voucher.monto).toBe('500.15');
      expect(voucher.fecha_pago).toBe('2025-01-10');
      expect(voucher.referencia).toBe('ABC123');
      expect(voucher.hora_transaccion).toBe('10:30:00');
      expect(voucher.casa).toBe(15);
      expect(voucher.gcsFilename).toBeUndefined();
      expect(voucher.originalFilename).toBeUndefined();
    });

    it('should create voucher entity with file information', () => {
      const voucherData: VoucherData = {
        monto: '1000.25',
        fecha_pago: '2025-01-15',
        referencia: 'REF456',
        hora_transaccion: '14:20:00',
        casa: 25,
      };

      const files = {
        gcsFilename: 'vouchers/2025/01/voucher-123.jpg',
        originalFilename: 'comprobante.jpg',
      };

      const voucher = VoucherEntity.fromData(voucherData, files);

      expect(voucher.gcsFilename).toBe('vouchers/2025/01/voucher-123.jpg');
      expect(voucher.originalFilename).toBe('comprobante.jpg');
    });

    it('should throw error when casa is null', () => {
      const voucherData: VoucherData = {
        monto: '500.00',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: null,
      };

      expect(() => VoucherEntity.fromData(voucherData)).toThrow(
        'El número de casa es requerido para crear un voucher',
      );
    });

    it('should create voucher without referencia', () => {
      const voucherData: VoucherData = {
        monto: '750.30',
        fecha_pago: '2025-01-20',
        referencia: '',
        hora_transaccion: '16:45:00',
        casa: 30,
      };

      const voucher = VoucherEntity.fromData(voucherData);

      expect(voucher.referencia).toBe('');
      expect(voucher.casa).toBe(30);
    });
  });

  describe('toConfirmationData', () => {
    it('should convert entity to confirmation data', () => {
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        15,
        'vouchers/file.jpg',
        'original.jpg',
        'CONF-12345',
      );

      const confirmationData = voucher.toConfirmationData();

      expect(confirmationData).toEqual({
        casa: 15,
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        confirmation_code: 'CONF-12345',
      });
    });

    it('should convert entity without confirmation code', () => {
      const voucher = new VoucherEntity(
        '1000.25',
        '2025-01-15',
        'REF456',
        '14:20:00',
        25,
      );

      const confirmationData = voucher.toConfirmationData();

      expect(confirmationData.confirmation_code).toBeUndefined();
      expect(confirmationData.casa).toBe(25);
    });
  });

  describe('isComplete', () => {
    it('should return true when all required fields are present', () => {
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        15,
      );

      expect(voucher.isComplete()).toBe(true);
    });

    it('should return true when referencia is empty (not required)', () => {
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        '',
        '10:30:00',
        15,
      );

      expect(voucher.isComplete()).toBe(true);
    });

    it('should return false when monto is empty', () => {
      const voucher = new VoucherEntity(
        '',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        15,
      );

      expect(voucher.isComplete()).toBe(false);
    });

    it('should return false when fecha_pago is empty', () => {
      const voucher = new VoucherEntity('500.15', '', 'ABC123', '10:30:00', 15);

      expect(voucher.isComplete()).toBe(false);
    });

    it('should return false when hora_transaccion is empty', () => {
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        'ABC123',
        '',
        15,
      );

      expect(voucher.isComplete()).toBe(false);
    });

    it('should return false when casa is 0', () => {
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        0,
      );

      expect(voucher.isComplete()).toBe(false);
    });
  });

  describe('hasHouseNumber', () => {
    it('should return true when casa is a positive number', () => {
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        15,
      );

      expect(voucher.hasHouseNumber()).toBe(true);
    });

    it('should return false when casa is 0', () => {
      const voucher = new VoucherEntity(
        '500.00',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        0,
      );

      expect(voucher.hasHouseNumber()).toBe(false);
    });

    it('should return false when casa is negative', () => {
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        -1,
      );

      expect(voucher.hasHouseNumber()).toBe(false);
    });

    it('should return true for maximum valid house number', () => {
      const voucher = new VoucherEntity(
        '500.66',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        66,
      );

      expect(voucher.hasHouseNumber()).toBe(true);
    });

    it('should return true for minimum valid house number', () => {
      const voucher = new VoucherEntity(
        '500.01',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        1,
      );

      expect(voucher.hasHouseNumber()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle large house numbers', () => {
      const voucher = new VoucherEntity(
        '500.99',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        99,
      );

      expect(voucher.casa).toBe(99);
      expect(voucher.hasHouseNumber()).toBe(true);
    });

    it('should handle amount without decimals', () => {
      const voucher = new VoucherEntity(
        '1000',
        '2025-01-10',
        'ABC123',
        '10:30:00',
        15,
      );

      expect(voucher.monto).toBe('1000');
      expect(voucher.isComplete()).toBe(true);
    });

    it('should handle time with seconds', () => {
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        'ABC123',
        '10:30:45',
        15,
      );

      expect(voucher.hora_transaccion).toBe('10:30:45');
    });

    it('should handle long referencia strings', () => {
      const longRef = 'A'.repeat(100);
      const voucher = new VoucherEntity(
        '500.15',
        '2025-01-10',
        longRef,
        '10:30:00',
        15,
      );

      expect(voucher.referencia).toBe(longRef);
      expect(voucher.referencia.length).toBe(100);
    });
  });
});
