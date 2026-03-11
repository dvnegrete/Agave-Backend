import { generateUniqueConfirmationCode } from './confirmation-code.helper';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

// Mock the generateConfirmationCode utility
jest.mock('@/shared/common/utils', () => ({
  generateConfirmationCode: jest.fn(),
}));

import { generateConfirmationCode } from '@/shared/common/utils';

describe('ConfirmationCodeHelper', () => {
  let mockVoucherRepository: jest.Mocked<VoucherRepository>;
  const mockGenerateCode = generateConfirmationCode as jest.MockedFunction<
    typeof generateConfirmationCode
  >;

  const createMockVoucher = (overrides: any = {}) => ({
    id: 1,
    date: new Date('2025-01-10'),
    authorization_number: null,
    confirmation_code: 'ABC123',
    amount: 500.15,
    confirmation_status: false,
    url: null,
    created_at: new Date(),
    updated_at: new Date(),
    transactionStatuses: [],
    records: [],
    ...overrides,
  });

  beforeEach(() => {
    mockVoucherRepository = {
      create: jest.fn(),
    } as any;

    jest.clearAllMocks();
  });

  describe('generateUniqueConfirmationCode', () => {
    it('should generate unique code and create voucher on first attempt', async () => {
      const voucherData = {
        amount: 500.15,
        date: new Date('2025-01-10'),
        record_id: 'rec123',
      };

      const mockCode = 'ABC123';
      const mockVoucher = createMockVoucher({
        ...voucherData,
        confirmation_code: mockCode,
      });

      mockGenerateCode.mockReturnValue(mockCode);
      mockVoucherRepository.create.mockResolvedValue(mockVoucher);

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
      );

      expect(result.success).toBe(true);
      expect(result.code).toBe(mockCode);
      expect(result.voucher).toEqual(mockVoucher);
      expect(result.error).toBeUndefined();

      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(1);
      expect(mockVoucherRepository.create).toHaveBeenCalledWith({
        ...voucherData,
        confirmation_code: mockCode,
      });
    });

    it('should retry on duplicate key error and succeed on second attempt', async () => {
      const voucherData = {
        amount: 500.15,
        date: new Date('2025-01-10'),
      };

      const firstCode = 'ABC123';
      const secondCode = 'DEF456';
      const mockVoucher = createMockVoucher({
        ...voucherData,
        confirmation_code: secondCode,
      });

      mockGenerateCode
        .mockReturnValueOnce(firstCode)
        .mockReturnValueOnce(secondCode);

      // First attempt fails with duplicate key error
      mockVoucherRepository.create
        .mockRejectedValueOnce({
          code: '23505',
          message: 'duplicate key value violates unique constraint',
        })
        .mockResolvedValueOnce(mockVoucher);

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
      );

      expect(result.success).toBe(true);
      expect(result.code).toBe(secondCode);
      expect(result.voucher).toEqual(mockVoucher);

      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should handle duplicate key error with "duplicate key" message', async () => {
      const voucherData = { amount: 500.15 };

      mockGenerateCode
        .mockReturnValueOnce('ABC123')
        .mockReturnValueOnce('DEF456');

      mockVoucherRepository.create
        .mockRejectedValueOnce({
          message: 'duplicate key error',
        })
        .mockResolvedValueOnce(
          createMockVoucher({
            ...voucherData,
            confirmation_code: 'DEF456',
          }),
        );

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
      );

      expect(result.success).toBe(true);
      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should handle duplicate key error with "unique constraint" message', async () => {
      const voucherData = { amount: 500.15 };

      mockGenerateCode
        .mockReturnValueOnce('ABC123')
        .mockReturnValueOnce('DEF456');

      mockVoucherRepository.create
        .mockRejectedValueOnce({
          message: 'unique constraint failed',
        })
        .mockResolvedValueOnce(
          createMockVoucher({
            ...voucherData,
            confirmation_code: 'DEF456',
          }),
        );

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
      );

      expect(result.success).toBe(true);
      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries with duplicate errors', async () => {
      const voucherData = { amount: 500.15 };
      const maxRetries = 3;

      mockGenerateCode.mockReturnValue('ABC123');

      mockVoucherRepository.create.mockRejectedValue({
        code: '23505',
        message: 'duplicate key',
      });

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
        maxRetries,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBeUndefined();
      expect(result.voucher).toBeUndefined();
      expect(result.error).toBe('No se pudo generar un código único');

      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(maxRetries);
    });

    it('should not retry on non-duplicate errors', async () => {
      const voucherData = { amount: 500.15 };

      mockGenerateCode.mockReturnValue('ABC123');

      mockVoucherRepository.create.mockRejectedValue({
        message: 'Connection timeout',
      });

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');

      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should handle error without message property', async () => {
      const voucherData = { amount: 500.15 };

      mockGenerateCode.mockReturnValue('ABC123');

      mockVoucherRepository.create.mockRejectedValue(new Error());

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al registrar voucher');

      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should use default maxRetries of 5 when not specified', async () => {
      const voucherData = { amount: 500.15 };

      mockGenerateCode.mockReturnValue('ABC123');

      mockVoucherRepository.create.mockRejectedValue({
        code: '23505',
      });

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
      );

      expect(result.success).toBe(false);
      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(5);
    });

    it('should handle multiple retries before success', async () => {
      const voucherData = { amount: 500.15 };

      mockGenerateCode
        .mockReturnValueOnce('ABC123')
        .mockReturnValueOnce('DEF456')
        .mockReturnValueOnce('GHI789');

      const mockVoucher = createMockVoucher({
        ...voucherData,
        confirmation_code: 'GHI789',
      });

      mockVoucherRepository.create
        .mockRejectedValueOnce({ code: '23505' })
        .mockRejectedValueOnce({ code: '23505' })
        .mockResolvedValueOnce(mockVoucher);

      const result = await generateUniqueConfirmationCode(
        mockVoucherRepository,
        voucherData,
      );

      expect(result.success).toBe(true);
      expect(result.code).toBe('GHI789');
      expect(mockVoucherRepository.create).toHaveBeenCalledTimes(3);
    });

    it('should pass voucher data correctly to repository', async () => {
      const voucherData = {
        amount: 750.25,
        date: new Date('2025-01-15'),
        record_id: 'rec456',
        reference: 'REF123',
      };

      const mockCode = 'XYZ789';
      mockGenerateCode.mockReturnValue(mockCode);
      mockVoucherRepository.create.mockResolvedValue(
        createMockVoucher({
          id: 2,
          ...voucherData,
          confirmation_code: mockCode,
        }),
      );

      await generateUniqueConfirmationCode(mockVoucherRepository, voucherData);

      expect(mockVoucherRepository.create).toHaveBeenCalledWith({
        ...voucherData,
        confirmation_code: mockCode,
      });
    });
  });
});
