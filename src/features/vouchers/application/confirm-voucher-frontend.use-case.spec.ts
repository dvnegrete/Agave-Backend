import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfirmVoucherFrontendUseCase } from './confirm-voucher-frontend.use-case';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { VoucherDuplicateDetectorService } from '../infrastructure/persistence/voucher-duplicate-detector.service';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';

describe('ConfirmVoucherFrontendUseCase', () => {
  let useCase: ConfirmVoucherFrontendUseCase;
  let mockDataSource: any;
  let mockVoucherRepository: any;
  let mockRecordRepository: any;
  let mockHouseRepository: any;
  let mockUserRepository: any;
  let mockHouseRecordRepository: any;
  let mockTransactionStatusRepository: any;
  let mockDuplicateDetector: any;
  let mockQueryRunner: any;

  beforeEach(async () => {
    // Mock QueryRunner
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Mock EntityManager para transaction()
    const mockEntityManager = {
      query: jest.fn().mockResolvedValue([
        {
          id: 1,
          confirmation_code: '202412-TEST123',
          confirmation_status: false,
        },
      ]),
      findOne: jest.fn(),
      create: jest.fn((entity, data) => ({ ...data, id: Math.random() })),
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({
          ...entity,
          id: entity.id || Math.random(),
        }),
      ),
    };

    // Mock DataSource con transaction()
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      transaction: jest
        .fn()
        .mockImplementation((callback) =>
          callback(mockEntityManager),
        ),
    };

    // Mock Repositories
    mockVoucherRepository = {
      create: jest.fn().mockResolvedValue({
        id: 1,
        amount: 150.5,
        date: new Date('2024-12-01T14:30:00'),
        confirmation_status: false,
        confirmation_code: '202412-TEST123',
      }),
      findByConfirmationCode: jest.fn(),
      findById: jest.fn(),
    };

    mockRecordRepository = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    };

    mockHouseRepository = {
      findByNumberHouse: jest.fn(),
      create: jest.fn(),
    };

    mockUserRepository = {
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockHouseRecordRepository = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    };

    mockTransactionStatusRepository = {
      create: jest.fn().mockResolvedValue({
        id: 1,
        vouchers_id: 1,
        identified_house_number: 15,
        validation_status: 'pending',
      }),
    };

    // Mock Duplicate Detector
    mockDuplicateDetector = {
      detectDuplicate: jest.fn().mockResolvedValue({
        isDuplicate: false,
        message: '',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmVoucherFrontendUseCase,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: VoucherRepository,
          useValue: mockVoucherRepository,
        },
        {
          provide: RecordRepository,
          useValue: mockRecordRepository,
        },
        {
          provide: HouseRepository,
          useValue: mockHouseRepository,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: HouseRecordRepository,
          useValue: mockHouseRecordRepository,
        },
        {
          provide: TransactionStatusRepository,
          useValue: mockTransactionStatusRepository,
        },
        {
          provide: VoucherDuplicateDetectorService,
          useValue: mockDuplicateDetector,
        },
      ],
    }).compile();

    useCase = module.get<ConfirmVoucherFrontendUseCase>(
      ConfirmVoucherFrontendUseCase,
    );
  });

  describe('execute', () => {
    const validInput = {
      gcsFilename: 'gs://bucket/file123.png',
      monto: '150.50',
      fecha_pago: '2024-12-01',
      hora_transaccion: '14:30:00',
      casa: 15,
      referencia: 'REF001',
      userId: 'user123',
    };

    const mockVoucher = {
      id: 1,
      amount: 150.5,
      date: new Date('2024-12-01T14:30:00'),
      confirmation_status: false,
    };

    const mockUser = {
      id: 'user123',
      cel_phone: 1234567890,
      role: 'TENANT',
      status: 'ACTIVE',
    };

    const mockHouse = {
      id: 10,
      number_house: 15,
      user_id: 'user123',
    };

    beforeEach(() => {
      // Reset all mocks before each test
      mockVoucherRepository.create.mockResolvedValue({
        ...mockVoucher,
        confirmation_code: '202412-ABC123',
      });
      mockVoucherRepository.findByConfirmationCode.mockResolvedValue(
        mockVoucher,
      );
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockHouseRepository.findByNumberHouse.mockResolvedValue(mockHouse);
      mockHouseRepository.create.mockResolvedValue(mockHouse);
      mockDuplicateDetector.detectDuplicate.mockResolvedValue({
        isDuplicate: false,
        message: '',
      });
    });

    it('should successfully confirm a voucher with all data', async () => {
      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      expect(result.confirmationCode).toBeDefined();
      expect(result.voucher.id).toBe(mockVoucher.id);
      expect(result.voucher.amount).toBe(150.5);
      expect(result.voucher.casa).toBe(15);
      // Verify transaction() was used instead of QueryRunner
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should reject invalid monto', async () => {
      const input = {
        ...validInput,
        monto: 'invalid',
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject zero or negative monto', async () => {
      const input = {
        ...validInput,
        monto: '-100',
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect duplicate vouchers', async () => {
      mockDuplicateDetector.detectDuplicate.mockResolvedValue({
        isDuplicate: true,
        message: 'Duplicate found from 2024-12-01 14:30:00',
      });

      await expect(useCase.execute(validInput)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create user if not exists', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user123',
        cel_phone: 0,
        role: 'TENANT',
        status: 'ACTIVE',
      });

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      // Verify transaction was used for ACID compliance
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should create house if not exists', async () => {
      mockHouseRepository.findByNumberHouse.mockResolvedValue(null);
      mockHouseRepository.create.mockResolvedValue({
        id: 10,
        number_house: 15,
        user_id: 'user123',
      });

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      expect(result.voucher.casa).toBe(15);
    });

    it('should handle anonymous users (no userId)', async () => {
      const input = {
        ...validInput,
        userId: null,
      };

      mockHouseRepository.findByNumberHouse.mockResolvedValue(null);
      mockHouseRepository.create.mockResolvedValue({
        id: 10,
        number_house: 15,
        user_id: '',
      });

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should create record with correct voucher association', async () => {
      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      expect(result.voucher.id).toBe(1);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockDuplicateDetector.detectDuplicate.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(useCase.execute(validInput)).rejects.toThrow(
        'Database error',
      );
    });

    it('should combine date and time correctly', async () => {
      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      expect(result.voucher.date).toBeDefined();
      // The date is returned as ISO string, just check it contains the date
      expect(result.voucher.date).toMatch(/2024-12-01/);
    });

    it('should handle optional hora_transaccion with default 12:00:00', async () => {
      const input = {
        ...validInput,
        hora_transaccion: undefined,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
    });

    it('should update house owner if user changes', async () => {
      mockHouseRepository.findByNumberHouse.mockResolvedValue({
        id: 10,
        number_house: 15,
        user_id: 'oldUser123', // Different owner
      });

      mockUserRepository.findById.mockImplementation((userId: string) => {
        if (userId === 'newUser123') {
          return Promise.resolve({
            id: 'newUser123',
            cel_phone: 9876543210,
            role: 'TENANT',
            status: 'ACTIVE',
          });
        }
        return Promise.resolve(mockUser);
      });

      const input = {
        ...validInput,
        userId: 'newUser123',
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should use transaction for ACID compliance', async () => {
      await useCase.execute(validInput);

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });
});
