import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ConfirmVoucherUseCase } from './confirm-voucher.use-case';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { ConversationStateService } from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { VoucherDuplicateDetectorService } from '../infrastructure/persistence/voucher-duplicate-detector.service';
import { GcsCleanupService } from '@/shared/libs/google-cloud';

describe('ConfirmVoucherUseCase - Amount Validation', () => {
  let useCase: ConfirmVoucherUseCase;
  let mockDataSource: any;
  let mockVoucherRepository: any;
  let mockRecordRepository: any;
  let mockHouseRepository: any;
  let mockUserRepository: any;
  let mockHouseRecordRepository: any;
  let mockConversationState: any;
  let mockWhatsappMessaging: any;
  let mockDuplicateDetector: any;
  let mockGcsCleanupService: any;
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

    // Mock DataSource
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    // Mock Repositories
    mockVoucherRepository = {
      create: jest.fn(),
      findByConfirmationCode: jest.fn(),
    };

    mockRecordRepository = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    };

    mockHouseRepository = {
      findByNumberHouse: jest.fn(),
      create: jest.fn(),
    };

    mockUserRepository = {
      findByCelPhone: jest.fn(),
      create: jest.fn(),
    };

    mockHouseRecordRepository = {
      create: jest.fn(),
    };

    // Mock Services
    mockConversationState = {
      getVoucherDataForConfirmation: jest.fn(),
      clearContext: jest.fn(),
    };

    mockWhatsappMessaging = {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
    };

    mockDuplicateDetector = {
      detectDuplicate: jest.fn().mockResolvedValue({ isDuplicate: false }),
    };

    mockGcsCleanupService = {
      deleteTemporaryProcessingFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmVoucherUseCase,
        { provide: DataSource, useValue: mockDataSource },
        { provide: VoucherRepository, useValue: mockVoucherRepository },
        { provide: RecordRepository, useValue: mockRecordRepository },
        { provide: HouseRepository, useValue: mockHouseRepository },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: HouseRecordRepository, useValue: mockHouseRecordRepository },
        { provide: ConversationStateService, useValue: mockConversationState },
        {
          provide: WhatsAppMessagingService,
          useValue: mockWhatsappMessaging,
        },
        {
          provide: VoucherDuplicateDetectorService,
          useValue: mockDuplicateDetector,
        },
        { provide: GcsCleanupService, useValue: mockGcsCleanupService },
      ],
    }).compile();

    useCase = module.get<ConfirmVoucherUseCase>(ConfirmVoucherUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Amount Validation - Invalid Cases', () => {
    const phoneNumber = '5212345678';

    it('should reject voucher with NaN amount (invalid string)', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: 'abc', // Causará NaN al parsear
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: 'test-file.jpg',
        originalFilename: 'original.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Monto inválido');
      expect(result.error).toContain('abc');

      // Verificar que NO se insertó en BD
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();

      // Verificar limpieza de archivo GCS
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).toHaveBeenCalledWith('test-file.jpg', expect.any(String));

      // Verificar mensaje al usuario
      expect(mockWhatsappMessaging.sendTextMessage).toHaveBeenCalledWith(
        phoneNumber,
        expect.stringContaining('monto extraído del comprobante es inválido'),
      );

      // Verificar limpieza de contexto
      expect(mockConversationState.clearContext).toHaveBeenCalledWith(
        phoneNumber,
      );
    });

    it('should reject voucher with empty string amount', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: '', // String vacío → NaN
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: 'test-file-2.jpg',
        originalFilename: 'original-2.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Monto inválido');
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).toHaveBeenCalledWith('test-file-2.jpg', expect.any(String));
    });

    it('should reject voucher with negative amount', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: '-100.50', // Monto negativo
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: 'test-file-3.jpg',
        originalFilename: 'original-3.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Monto inválido');
      expect(result.error).toContain('-100.50');
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).toHaveBeenCalledWith('test-file-3.jpg', expect.any(String));
    });

    it('should reject voucher with zero amount', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: '0.00', // Monto cero
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: 'test-file-4.jpg',
        originalFilename: 'original-4.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Monto inválido');
      expect(result.error).toContain('0.00');
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).toHaveBeenCalledWith('test-file-4.jpg', expect.any(String));
    });

    it('should reject voucher with Infinity amount', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: '1e308', // Muy grande → Infinity
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: 'test-file-5.jpg',
        originalFilename: 'original-5.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Monto inválido');
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).toHaveBeenCalledWith('test-file-5.jpg', expect.any(String));
    });

    it('should reject voucher when monto is null', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: null, // null → NaN
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: 'test-file-6.jpg',
        originalFilename: 'original-6.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Monto inválido');
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).toHaveBeenCalledWith('test-file-6.jpg', expect.any(String));
    });

    it('should reject voucher when monto is undefined', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: undefined, // undefined → NaN
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: 'test-file-7.jpg',
        originalFilename: 'original-7.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Monto inválido');
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).toHaveBeenCalledWith('test-file-7.jpg', expect.any(String));
    });

    it('should clean up GCS file even when gcsFilename is not provided', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: 'invalid',
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: undefined, // Sin archivo
        originalFilename: 'original.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      // No debe intentar eliminar archivo si no existe
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Amount Validation - Valid Cases', () => {
    const phoneNumber = '5212345678';

    it('should accept voucher with valid positive amount', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: '1000.15', // Válido
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: 15,
        },
        gcsFilename: 'valid-file.jpg',
        originalFilename: 'original-valid.jpg',
      });

      // Mock para que generateUniqueConfirmationCode funcione
      mockVoucherRepository.create.mockResolvedValue({
        id: 1,
        amount: 1000.15,
        date: new Date('2025-10-22T10:00:00'),
        authorization_number: '123',
        confirmation_status: false,
        confirmation_code: '202510-ABC12',
        url: 'valid-file.jpg',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      mockVoucherRepository.findByConfirmationCode.mockResolvedValue({
        id: 1,
        amount: 1000.15,
        confirmation_code: '202510-ABC12',
      } as any);

      mockUserRepository.findByCelPhone.mockResolvedValue({
        id: 'user-uuid-123',
        cel_phone: 5212345678,
      } as any);

      mockHouseRepository.findByNumberHouse.mockResolvedValue({
        id: 1,
        number_house: 15,
        user_id: 'user-uuid-123',
      } as any);

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(true);
      expect(result.confirmationCode).toBeDefined();

      // Verificar que SÍ se procesó correctamente
      expect(mockVoucherRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000.15,
        }),
      );

      // No debe limpiar archivo GCS (es un éxito)
      expect(
        mockGcsCleanupService.deleteTemporaryProcessingFile,
      ).not.toHaveBeenCalled();
    });

    it('should accept voucher with amount having decimals', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: '500.99', // Válido con decimales
          fecha_pago: '2025-10-22',
          referencia: '456',
          hora_transaccion: '14:30:00',
          casa: 20,
        },
        gcsFilename: 'valid-file-2.jpg',
        originalFilename: 'original-valid-2.jpg',
      });

      mockVoucherRepository.create.mockResolvedValue({
        id: 2,
        amount: 500.99,
        confirmation_code: '202510-DEF45',
      } as any);

      mockVoucherRepository.findByConfirmationCode.mockResolvedValue({
        id: 2,
        amount: 500.99,
        confirmation_code: '202510-DEF45',
      } as any);

      mockUserRepository.findByCelPhone.mockResolvedValue({
        id: 'user-uuid-456',
      } as any);

      mockHouseRepository.findByNumberHouse.mockResolvedValue({
        id: 2,
        number_house: 20,
      } as any);

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(true);
      expect(mockVoucherRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500.99,
        }),
      );
    });
  });

  describe('Edge Cases', () => {
    const phoneNumber = '5212345678';

    it('should handle session expired gracefully', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue(
        null,
      );

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session expired');
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();
    });

    it('should handle missing house number', async () => {
      // Arrange
      mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
        voucherData: {
          monto: '1000.15',
          fecha_pago: '2025-10-22',
          referencia: '123',
          hora_transaccion: '10:00:00',
          casa: null, // Sin casa
        },
        gcsFilename: 'test-no-house.jpg',
        originalFilename: 'original-no-house.jpg',
      });

      // Act
      const result = await useCase.execute({ phoneNumber });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing house number');
      expect(mockVoucherRepository.create).not.toHaveBeenCalled();
    });
  });
});
