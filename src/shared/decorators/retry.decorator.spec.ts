import { Retry } from './retry.decorator';
import { Logger } from '@nestjs/common';

describe('Retry Decorator', () => {
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    } as any;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('successful execution', () => {
    it('should execute method successfully on first attempt', async () => {
      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 100 })
        async testMethod() {
          return 'success';
        }
      };

      const instance = new testClass();
      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should succeed after retries on transient error', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 100 })
        async testMethod() {
          attempts++;
          if (attempts < 3) {
            throw new Error('Connection refused');
          }
          return 'success';
        }
      };

      const instance = new testClass();
      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('transient error detection', () => {
    it('should retry on ECONNRESET error', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts === 1) {
            const error: any = new Error('read ECONNRESET');
            error.code = 'ECONNRESET';
            throw error;
          }
          return 'success';
        }
      };

      const instance = new testClass();
      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should retry on nested TypeORM error', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts === 1) {
            const error: any = new Error('Query error');
            error.originalError = {
              message: 'connect ECONNRESET',
              code: 'ECONNRESET',
            };
            throw error;
          }
          return 'success';
        }
      };

      const instance = new testClass();
      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should retry on "too many connections" error', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts === 1) {
            throw new Error('Database error: too many connections');
          }
          return 'success';
        }
      };

      const instance = new testClass();
      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('non-retryable errors', () => {
    it('should not retry on duplicate key error', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('duplicate key value violates unique constraint');
        }
      };

      const instance = new testClass();

      await expect(instance.testMethod()).rejects.toThrow('duplicate key');
      expect(attempts).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Non-retryable error'),
      );
    });

    it('should not retry on syntax error', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('SQL syntax error');
        }
      };

      const instance = new testClass();

      await expect(instance.testMethod()).rejects.toThrow('SQL syntax error');
      expect(attempts).toBe(1);
    });

    it('should not retry on permission denied error', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('Permission denied for user');
        }
      };

      const instance = new testClass();

      await expect(instance.testMethod()).rejects.toThrow('Permission denied');
      expect(attempts).toBe(1);
    });

    it('should not retry on undefined table error', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('relation "users" does not exist');
        }
      };

      const instance = new testClass();

      await expect(instance.testMethod()).rejects.toThrow();
      expect(attempts).toBe(1);
    });
  });

  describe('max attempts', () => {
    it('should fail after max attempts reached', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('connection timeout');
        }
      };

      const instance = new testClass();

      await expect(instance.testMethod()).rejects.toThrow('connection timeout');
      expect(attempts).toBe(3);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed after 3 attempts'),
      );
    });

    it('should respect custom maxAttempts', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 5, delayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('connection timeout');
        }
      };

      const instance = new testClass();

      await expect(instance.testMethod()).rejects.toThrow();
      expect(attempts).toBe(5);
    });
  });

  describe('exponential backoff', () => {
    it('should apply exponential backoff multiplier', async () => {
      let attempts = 0;
      const delays: number[] = [];

      const originalSetTimeout = jest.fn((callback: () => void) => {
        delays.push(100);
        callback();
      });

      jest.spyOn(global, 'setTimeout').mockImplementation(originalSetTimeout as any);

      const testClass = class {
        logger = mockLogger;

        @Retry({
          maxAttempts: 3,
          delayMs: 100,
          backoffMultiplier: 2,
        })
        async testMethod() {
          attempts++;
          if (attempts < 3) {
            throw new Error('timeout');
          }
          return 'success';
        }
      };

      const instance = new testClass();
      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  describe('custom retry conditions', () => {
    it('should respect custom retryableErrors predicate', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({
          maxAttempts: 3,
          delayMs: 10,
          retryableErrors: (error) => {
            const msg = (error as any)?.message || '';
            return msg.includes('CUSTOM_RETRYABLE');
          },
        })
        async testMethod() {
          attempts++;
          if (attempts === 1) {
            throw new Error('CUSTOM_RETRYABLE_ERROR');
          }
          return 'success';
        }
      };

      const instance = new testClass();
      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should not retry when custom predicate returns false', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({
          maxAttempts: 3,
          delayMs: 10,
          retryableErrors: (error) => {
            const msg = (error as any)?.message || '';
            return msg.includes('CUSTOM_RETRYABLE');
          },
        })
        async testMethod() {
          attempts++;
          throw new Error('OTHER_ERROR');
        }
      };

      const instance = new testClass();

      await expect(instance.testMethod()).rejects.toThrow('OTHER_ERROR');
      expect(attempts).toBe(1);
    });
  });

  describe('logging', () => {
    it('should log retry attempts', async () => {
      let attempts = 0;

      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 3, delayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('connection timeout');
          }
          return 'success';
        }
      };

      const instance = new testClass();
      await instance.testMethod();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Transient error on attempt 1'),
      );
    });

    it('should log final failure', async () => {
      const testClass = class {
        logger = mockLogger;

        @Retry({ maxAttempts: 2, delayMs: 10 })
        async testMethod() {
          throw new Error('connection timeout');
        }
      };

      const instance = new testClass();

      await expect(instance.testMethod()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed after 2 attempts'),
      );
    });
  });
});
