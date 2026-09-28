import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeleteVoucherUseCase } from './delete-voucher.use-case';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { GcsCleanupService } from '@/shared/libs/google-cloud';

describe('DeleteVoucherUseCase', () => {
  let useCase: DeleteVoucherUseCase;
  let mockVoucherRepository: any;
  let mockGcsCleanupService: any;

  beforeEach(async () => {
    mockVoucherRepository = {
      findById: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    mockGcsCleanupService = {
      deleteFile: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteVoucherUseCase,
        { provide: VoucherRepository, useValue: mockVoucherRepository },
        { provide: GcsCleanupService, useValue: mockGcsCleanupService },
      ],
    }).compile();

    useCase = module.get<DeleteVoucherUseCase>(DeleteVoucherUseCase);
  });

  it('should throw NotFoundException if voucher does not exist', async () => {
    mockVoucherRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(1)).rejects.toThrow(NotFoundException);
    expect(mockVoucherRepository.delete).not.toHaveBeenCalled();
    expect(mockGcsCleanupService.deleteFile).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException if voucher is already reconciled', async () => {
    mockVoucherRepository.findById.mockResolvedValue({
      id: 1,
      confirmation_status: true,
      url: 'p-2024-01-01_file.jpg',
    });

    await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
    expect(mockVoucherRepository.delete).not.toHaveBeenCalled();
    expect(mockGcsCleanupService.deleteFile).not.toHaveBeenCalled();
  });

  it('should delete voucher and its file in GCS', async () => {
    mockVoucherRepository.findById.mockResolvedValue({
      id: 1,
      confirmation_status: false,
      url: 'p-2024-01-01_file.jpg',
    });

    const result = await useCase.execute(1);

    expect(result).toEqual({ deleted: true, id: 1 });
    expect(mockVoucherRepository.delete).toHaveBeenCalledWith(1);
    expect(mockGcsCleanupService.deleteFile).toHaveBeenCalledWith(
      'p-2024-01-01_file.jpg',
      expect.objectContaining({ fileType: 'permanente', blocking: false }),
    );
  });

  it('should delete voucher without calling GCS when it has no url', async () => {
    mockVoucherRepository.findById.mockResolvedValue({
      id: 2,
      confirmation_status: false,
      url: null,
    });

    const result = await useCase.execute(2);

    expect(result).toEqual({ deleted: true, id: 2 });
    expect(mockVoucherRepository.delete).toHaveBeenCalledWith(2);
    expect(mockGcsCleanupService.deleteFile).not.toHaveBeenCalled();
  });
});
