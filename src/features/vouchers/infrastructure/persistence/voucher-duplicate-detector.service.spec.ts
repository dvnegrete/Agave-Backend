import { Test, TestingModule } from '@nestjs/testing';
import { VoucherDuplicateDetectorService } from './voucher-duplicate-detector.service';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';

describe('VoucherDuplicateDetectorService', () => {
  let service: VoucherDuplicateDetectorService;
  let voucherRepository: jest.Mocked<VoucherRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherDuplicateDetectorService,
        {
          provide: VoucherRepository,
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: HouseRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: HouseRecordRepository,
          useValue: {
            findByRecordId: jest.fn(),
          },
        },
        {
          provide: RecordRepository,
          useValue: {
            findByVoucherId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(VoucherDuplicateDetectorService);
    voucherRepository = module.get(VoucherRepository);
  });

  it('should return not duplicate when there are no vouchers', async () => {
    voucherRepository.findAll.mockResolvedValue([] as any);

    const result = await service.detectDuplicate(
      new Date('2025-01-01T10:30:00.000Z'),
      500,
      12,
    );

    expect(result).toEqual({ isDuplicate: false });
  });

  it('should detect duplicate when date, amount and house match', async () => {
    const date = new Date('2025-01-01T10:30:45.000Z');
    voucherRepository.findAll.mockResolvedValue([
      {
        id: 55,
        date,
        amount: 1000,
        confirmation_code: 'ABC123',
        confirmation_status: true,
      },
    ] as any);

    jest
      .spyOn(service as any, 'findHouseFromVoucher')
      .mockResolvedValue({ number_house: 20 });

    const result = await service.detectDuplicate(date, 1000, 20);

    expect(result.isDuplicate).toBe(true);
    expect(result.existingVoucher?.id).toBe(55);
    expect(result.message).toContain('ABC123');
  });

  it('should return not duplicate on repository error (safe fallback)', async () => {
    voucherRepository.findAll.mockRejectedValue(new Error('db down'));

    const result = await service.detectDuplicate(new Date(), 10, 1);

    expect(result).toEqual({ isDuplicate: false });
  });
});
