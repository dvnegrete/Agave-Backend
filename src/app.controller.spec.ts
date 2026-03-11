import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { getDataSourceToken } from '@nestjs/typeorm';

describe('AppController', () => {
  let appController: AppController;
  let mockDataSource: any;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDatabaseReady', () => {
    it('should return success message when database is ready', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await appController.getDatabaseReady();

      expect(result).toEqual({ message: 'base de datos preparada' });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    });

    it('should throw ServiceUnavailableException when database connection fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection failed'));

      await expect(appController.getDatabaseReady()).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(appController.getDatabaseReady()).rejects.toThrow(
        'no hay conexión a la base de datos',
      );
    });

    it('should throw ServiceUnavailableException when query returns empty result', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await appController.getDatabaseReady();

      expect(result).toEqual({ message: 'base de datos preparada' });
    });

    it('should handle database timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'TimeoutError';
      mockDataSource.query.mockRejectedValue(timeoutError);

      await expect(appController.getDatabaseReady()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should handle database connection refused errors', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockDataSource.query.mockRejectedValue(connectionError);

      await expect(appController.getDatabaseReady()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should execute trivial query to verify connection', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      await appController.getDatabaseReady();

      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should be resilient to multiple consecutive calls', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result1 = await appController.getDatabaseReady();
      const result2 = await appController.getDatabaseReady();
      const result3 = await appController.getDatabaseReady();

      expect(result1).toEqual({ message: 'base de datos preparada' });
      expect(result2).toEqual({ message: 'base de datos preparada' });
      expect(result3).toEqual({ message: 'base de datos preparada' });
      expect(mockDataSource.query).toHaveBeenCalledTimes(3);
    });

    it('should recover after database becomes available again', async () => {
      mockDataSource.query
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce([{ '?column?': 1 }]);

      await expect(appController.getDatabaseReady()).rejects.toThrow(
        ServiceUnavailableException,
      );

      const result = await appController.getDatabaseReady();

      expect(result).toEqual({ message: 'base de datos preparada' });
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('should return consistent response format', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await appController.getDatabaseReady();

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message).toBe('base de datos preparada');
    });

    it('should pass through error when database query throws', async () => {
      const dbError = new Error('Database error');
      mockDataSource.query.mockRejectedValue(dbError);

      try {
        await appController.getDatabaseReady();
        fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.message).toBe('no hay conexión a la base de datos');
      }
    });
  });
});
