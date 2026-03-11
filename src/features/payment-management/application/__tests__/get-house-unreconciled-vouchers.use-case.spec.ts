import { Test, TestingModule } from '@nestjs/testing';
import { GetHouseUnreconciledVouchersUseCase } from '../get-house-unreconciled-vouchers.use-case';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { House } from '@/shared/database/entities';

describe('GetHouseUnreconciledVouchersUseCase', () => {
  let useCase: GetHouseUnreconciledVouchersUseCase;
  let voucherRepository: jest.Mocked<VoucherRepository>;

  const mockHouse = {
    id: 42,
    number_house: 42,
    user_id: 'user123',
  } as House;

  const mockVouchers = [
    {
      id: 1,
      date: new Date('2025-01-20'),
      amount: 800,
      confirmation_status: false,
      confirmation_code: 'ABC123',
      created_at: new Date('2025-01-20T10:00:00'),
    },
    {
      id: 2,
      date: new Date('2025-01-15'),
      amount: 150,
      confirmation_status: false,
      confirmation_code: null,
      created_at: new Date('2025-01-15T14:00:00'),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetHouseUnreconciledVouchersUseCase,
        {
          provide: VoucherRepository,
          useValue: {
            findUnreconciledByHouseNumber: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetHouseUnreconciledVouchersUseCase>(
      GetHouseUnreconciledVouchersUseCase,
    );
    voucherRepository = module.get(VoucherRepository) as jest.Mocked<
      VoucherRepository
    >;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return unreconciled vouchers for a house', async () => {
      voucherRepository.findUnreconciledByHouseNumber.mockResolvedValue(
        mockVouchers as any,
      );

      const result = await useCase.execute(mockHouse);

      expect(
        voucherRepository.findUnreconciledByHouseNumber,
      ).toHaveBeenCalledWith(42);
      expect(result.total_count).toBe(2);
      expect(result.vouchers).toHaveLength(2);
      expect(result.vouchers[0].id).toBe(1);
      expect(result.vouchers[0].amount).toBe(800);
      expect(result.vouchers[1].id).toBe(2);
      expect(result.vouchers[1].amount).toBe(150);
    });

    it('should return empty result when no unreconciled vouchers exist', async () => {
      voucherRepository.findUnreconciledByHouseNumber.mockResolvedValue([]);

      const result = await useCase.execute(mockHouse);

      expect(result.total_count).toBe(0);
      expect(result.vouchers).toEqual([]);
    });

    it('should map voucher properties correctly', async () => {
      voucherRepository.findUnreconciledByHouseNumber.mockResolvedValue([
        mockVouchers[0],
      ] as any);

      const result = await useCase.execute(mockHouse);

      const voucher = result.vouchers[0];
      expect(voucher.id).toBe(1);
      expect(voucher.date).toEqual(mockVouchers[0].date);
      expect(voucher.amount).toBe(800);
      expect(voucher.confirmation_status).toBe(false);
      expect(voucher.confirmation_code).toBe('ABC123');
      expect(voucher.created_at).toEqual(mockVouchers[0].created_at);
    });

    it('should handle vouchers without confirmation code', async () => {
      voucherRepository.findUnreconciledByHouseNumber.mockResolvedValue([
        mockVouchers[1],
      ] as any);

      const result = await useCase.execute(mockHouse);

      expect(result.vouchers[0].confirmation_code).toBeNull();
    });

    it('should handle repository errors', async () => {
      voucherRepository.findUnreconciledByHouseNumber.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(useCase.execute(mockHouse)).rejects.toThrow('Database error');
    });
  });
});
