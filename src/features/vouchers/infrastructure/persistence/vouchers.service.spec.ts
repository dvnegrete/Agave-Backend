import { Test, TestingModule } from '@nestjs/testing';
import { VouchersService } from './vouchers.service';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

describe('VouchersService', () => {
  let service: VouchersService;
  let voucherRepository: jest.Mocked<VoucherRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        {
          provide: VoucherRepository,
          useValue: {
            findAllWithHouse: jest.fn(),
            findByConfirmationStatusWithHouse: jest.fn(),
            findByDateRangeWithHouse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VouchersService>(VouchersService);
    voucherRepository = module.get(VoucherRepository);
  });

  it('should delegate getAllTransactions to repository', async () => {
    const expected = [{ id: 1 }];
    voucherRepository.findAllWithHouse.mockResolvedValue(expected as any);

    const result = await service.getAllTransactions();

    expect(voucherRepository.findAllWithHouse).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expected);
  });

  it('should delegate getTransactionsByStatus to repository', async () => {
    const expected = [{ id: 2 }];
    voucherRepository.findByConfirmationStatusWithHouse.mockResolvedValue(
      expected as any,
    );

    const result = await service.getTransactionsByStatus(true);

    expect(
      voucherRepository.findByConfirmationStatusWithHouse,
    ).toHaveBeenCalledWith(true);
    expect(result).toEqual(expected);
  });

  it('should delegate getTransactionsByDateRange to repository', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.000Z');
    const expected = [{ id: 3 }];
    voucherRepository.findByDateRangeWithHouse.mockResolvedValue(expected as any);

    const result = await service.getTransactionsByDateRange(start, end);

    expect(voucherRepository.findByDateRangeWithHouse).toHaveBeenCalledWith(
      start,
      end,
    );
    expect(result).toEqual(expected);
  });
});
