import { Test, TestingModule } from '@nestjs/testing';
import {
  VoucherGarbageCollectorService,
  CleanupMetrics,
} from './voucher-garbage-collector.service';
import { CloudStorageService, CloudStorageFile } from '@/shared/libs/google-cloud/storage/cloud-storage.service';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

describe('VoucherGarbageCollectorService', () => {
  let service: VoucherGarbageCollectorService;
  let cloudStorageService: CloudStorageService;
  let voucherRepository: VoucherRepository;

  beforeEach(async () => {
    // Mock CloudStorageService
    const mockCloudStorageService = {
      getAllFiles: jest.fn(),
      deleteFile: jest.fn(),
      deleteMultipleFiles: jest.fn(),
    };

    // Mock VoucherRepository
    const mockVoucherRepository = {
      isFileReferenced: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherGarbageCollectorService,
        {
          provide: CloudStorageService,
          useValue: mockCloudStorageService,
        },
        {
          provide: VoucherRepository,
          useValue: mockVoucherRepository,
        },
      ],
    }).compile();

    service = module.get<VoucherGarbageCollectorService>(
      VoucherGarbageCollectorService,
    );
    cloudStorageService = module.get<CloudStorageService>(CloudStorageService);
    voucherRepository = module.get<VoucherRepository>(VoucherRepository);
  });

  describe('parseTimestampFromFilename', () => {
    it('should parse valid filename with correct timestamp', () => {
      const filename = 'p-2024-01-15_14-30-45-abc123def.jpg';
      const result = (service as any).parseTimestampFromFilename(filename);

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January (0-indexed)
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(45);
    });

    it('should return null for filename without valid timestamp pattern', () => {
      const filename = 'invalid-filename.jpg';
      const result = (service as any).parseTimestampFromFilename(filename);

      expect(result).toBeNull();
    });

    it('should parse filename even with out-of-range values (JavaScript Date behavior)', () => {
      // JavaScript Date() will normalize out-of-range values
      // month 13 becomes month 0 of next year, etc.
      const filename = 'p-2024-13-45_25-75-99-uuid.jpg';
      const result = (service as any).parseTimestampFromFilename(filename);

      // parseTimestampFromFilename will match regex and create Date
      // Even though values are invalid, the regex matches
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle different UUID formats in filename', () => {
      const filename = 'p-2024-12-25_09-15-30-xyz789.pdf';
      const result = (service as any).parseTimestampFromFilename(filename);

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(25);
    });
  });

  describe('isFileOldEnough', () => {
    it('should return true for file older than 2 hours', () => {
      const twoHoursAndOneMinuteAgo = new Date(Date.now() - 121 * 60 * 1000);
      const result = (service as any).isFileOldEnough(twoHoursAndOneMinuteAgo);

      expect(result).toBe(true);
    });

    it('should return false for file younger than 2 hours', () => {
      const oneHourAgoMs = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
      const oneHourAgo = new Date(Date.now() - oneHourAgoMs);
      const result = (service as any).isFileOldEnough(oneHourAgo);

      expect(result).toBe(false);
    });

    it('should return false for file exactly 2 hours old', () => {
      const exactlyTwoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      );
      const result = (service as any).isFileOldEnough(exactlyTwoHoursAgo);

      // Should be false because we use > not >=
      expect(result).toBe(false);
    });

    it('should return true for file 3 hours old', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = (service as any).isFileOldEnough(threeHoursAgo);

      expect(result).toBe(true);
    });
  });

  describe('cleanup', () => {
    const createMockFile = (
      name: string,
      ageHours: number,
    ): CloudStorageFile => ({
      name,
      size: 1024,
      contentType: 'image/jpeg',
      created: new Date(Date.now() - ageHours * 60 * 60 * 1000),
      updated: new Date(Date.now() - ageHours * 60 * 60 * 1000),
      bucket: 'test-bucket',
      gcsUri: `gs://test-bucket/${name}`,
    });

    it('should delete orphaned files older than 2 hours', async () => {
      const mockFiles: CloudStorageFile[] = [
        createMockFile('p-2024-01-01_10-00-00-uuid1.jpg', 3),
      ];

      (cloudStorageService.getAllFiles as jest.Mock).mockResolvedValue(
        mockFiles,
      );
      (voucherRepository.isFileReferenced as jest.Mock).mockResolvedValue(false);
      (cloudStorageService.deleteFile as jest.Mock).mockResolvedValue(undefined);

      const metrics = await service.cleanup();

      expect(metrics.filesScanned).toBe(1);
      expect(metrics.orphanedFilesDetected).toBe(1);
      expect(metrics.filesDeleted).toBe(1);
      expect(cloudStorageService.deleteFile).toHaveBeenCalledWith(
        'p-2024-01-01_10-00-00-uuid1.jpg',
      );
    });

    it('should NOT delete files referenced in database', async () => {
      const mockFiles: CloudStorageFile[] = [
        createMockFile('p-2024-01-01_10-00-00-uuid1.jpg', 3),
      ];

      (cloudStorageService.getAllFiles as jest.Mock).mockResolvedValue(
        mockFiles,
      );
      (voucherRepository.isFileReferenced as jest.Mock).mockResolvedValue(true);

      const metrics = await service.cleanup();

      expect(metrics.filesScanned).toBe(1);
      expect(metrics.orphanedFilesDetected).toBe(0);
      expect(metrics.filesDeleted).toBe(0);
      expect(cloudStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should NOT delete files younger than 2 hours', async () => {
      // Create a file that's 1 hour old
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

      // Generate filename with timestamp from 1 hour ago
      const year = oneHourAgo.getFullYear();
      const month = String(oneHourAgo.getMonth() + 1).padStart(2, '0');
      const day = String(oneHourAgo.getDate()).padStart(2, '0');
      const hours = String(oneHourAgo.getHours()).padStart(2, '0');
      const minutes = String(oneHourAgo.getMinutes()).padStart(2, '0');
      const seconds = String(oneHourAgo.getSeconds()).padStart(2, '0');
      const filename = `p-${year}-${month}-${day}_${hours}-${minutes}-${seconds}-uuid1.jpg`;

      const mockFiles: CloudStorageFile[] = [
        {
          name: filename,
          size: 1024,
          contentType: 'image/jpeg',
          created: oneHourAgo,
          updated: oneHourAgo,
          bucket: 'test-bucket',
          gcsUri: `gs://test-bucket/${filename}`,
        },
      ];

      (cloudStorageService.getAllFiles as jest.Mock).mockResolvedValue(
        mockFiles,
      );
      (voucherRepository.isFileReferenced as jest.Mock).mockResolvedValue(false);

      const metrics = await service.cleanup();

      expect(metrics.filesScanned).toBe(1);
      expect(metrics.orphanedFilesDetected).toBe(0);
      expect(metrics.filesDeleted).toBe(0);
      expect(cloudStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle mixed files (some old, some new, some referenced)', async () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

      // Generate filenames with timestamps from their respective creation times
      const formatTimestamp = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
      };

      const file1Name = `p-${formatTimestamp(threeHoursAgo)}-uuid1.jpg`;
      const file2Name = `p-${formatTimestamp(oneHourAgo)}-uuid2.jpg`;
      const file3Name = `p-${formatTimestamp(threeHoursAgo)}-uuid3.jpg`;

      const mockFiles: CloudStorageFile[] = [
        {
          name: file1Name,
          size: 1024,
          contentType: 'image/jpeg',
          created: threeHoursAgo,
          updated: threeHoursAgo,
          bucket: 'test-bucket',
          gcsUri: `gs://test-bucket/${file1Name}`,
        }, // Old, orphaned → DELETE
        {
          name: file2Name,
          size: 1024,
          contentType: 'image/jpeg',
          created: oneHourAgo,
          updated: oneHourAgo,
          bucket: 'test-bucket',
          gcsUri: `gs://test-bucket/${file2Name}`,
        }, // Young → SKIP
        {
          name: file3Name,
          size: 1024,
          contentType: 'image/jpeg',
          created: threeHoursAgo,
          updated: threeHoursAgo,
          bucket: 'test-bucket',
          gcsUri: `gs://test-bucket/${file3Name}`,
        }, // Old, referenced → SKIP
      ];

      (cloudStorageService.getAllFiles as jest.Mock).mockResolvedValue(
        mockFiles,
      );

      // Mock repository responses
      (voucherRepository.isFileReferenced as jest.Mock).mockImplementation(
        (filename: string) => {
          if (filename.includes('uuid3')) return Promise.resolve(true);
          return Promise.resolve(false);
        },
      );

      (cloudStorageService.deleteFile as jest.Mock).mockResolvedValue(undefined);

      const metrics = await service.cleanup();

      expect(metrics.filesScanned).toBe(3);
      expect(metrics.orphanedFilesDetected).toBe(1);
      expect(metrics.filesDeleted).toBe(1);
      expect(cloudStorageService.deleteFile).toHaveBeenCalledTimes(1);
      expect(cloudStorageService.deleteFile).toHaveBeenCalledWith(file1Name);
    });

    it('should handle file deletion errors gracefully', async () => {
      const mockFiles: CloudStorageFile[] = [
        createMockFile('p-2024-01-01_10-00-00-uuid1.jpg', 3),
      ];

      (cloudStorageService.getAllFiles as jest.Mock).mockResolvedValue(
        mockFiles,
      );
      (voucherRepository.isFileReferenced as jest.Mock).mockResolvedValue(false);
      (cloudStorageService.deleteFile as jest.Mock).mockRejectedValue(
        new Error('GCS error'),
      );

      const metrics = await service.cleanup();

      expect(metrics.filesScanned).toBe(1);
      expect(metrics.orphanedFilesDetected).toBe(1);
      expect(metrics.filesDeleted).toBe(0);
      expect(metrics.filesFailed).toBe(1);
    });

    it('should handle empty bucket', async () => {
      (cloudStorageService.getAllFiles as jest.Mock).mockResolvedValue([]);

      const metrics = await service.cleanup();

      expect(metrics.filesScanned).toBe(0);
      expect(metrics.orphanedFilesDetected).toBe(0);
      expect(metrics.filesDeleted).toBe(0);
      expect(cloudStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should skip files with invalid timestamps', async () => {
      const mockFiles: CloudStorageFile[] = [
        {
          name: 'invalid-filename.jpg',
          size: 1024,
          contentType: 'image/jpeg',
          created: new Date(Date.now() - 3 * 60 * 60 * 1000),
          updated: new Date(Date.now() - 3 * 60 * 60 * 1000),
          bucket: 'test-bucket',
          gcsUri: 'gs://test-bucket/invalid-filename.jpg',
        },
      ];

      (cloudStorageService.getAllFiles as jest.Mock).mockResolvedValue(
        mockFiles,
      );

      const metrics = await service.cleanup();

      expect(metrics.filesScanned).toBe(1);
      expect(metrics.orphanedFilesDetected).toBe(0);
      expect(metrics.filesDeleted).toBe(0);
      expect(voucherRepository.isFileReferenced).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return stats with null lastCleanupAt initially', () => {
      const stats = service.getStats();

      expect(stats.lastCleanupAt).toBeNull();
      expect(stats.totalFilesCleaned).toBe(0);
      expect(stats.nextCleanupEstimate).toBeNull();
    });
  });
});
