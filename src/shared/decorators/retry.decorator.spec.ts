import { Retry } from './retry.decorator';
import { Logger } from '@nestjs/common';

// ===== Clases de Prueba (Definidas fuera de los tests) =====

// Clase para primer intento exitoso
class TestClassSuccess {
  logger: any;

  @Retry({ maxAttempts: 3, delayMs: 100 })
  async testMethod() {
    return 'success';
  }
}

// Clase para reintento con éxito
class TestClassRetrySuccess {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 100 })
  async testMethod() {
    this.attempts++;
    if (this.attempts < 3) {
      throw new Error('Connection refused');
    }
    return 'success';
  }
}

// Clase para ECONNRESET
class TestClassEConnReset {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    if (this.attempts === 1) {
      const error: any = new Error('read ECONNRESET');
      error.code = 'ECONNRESET';
      throw error;
    }
    return 'success';
  }
}

// Clase para TypeORM error
class TestClassTypeOrmError {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    if (this.attempts === 1) {
      const error: any = new Error('connection timeout');
      error.originalError = {
        message: 'connect ECONNRESET',
        code: 'ECONNRESET',
      };
      throw error;
    }
    return 'success';
  }
}

// Clase para "too many connections"
class TestClassTooManyConnections {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    if (this.attempts === 1) {
      throw new Error('Database error: too many connections');
    }
    return 'success';
  }
}

// Clase para duplicate key (no retryable)
class TestClassDuplicateKey {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    throw new Error('duplicate key value violates unique constraint');
  }
}

// Clase para syntax error (no retryable)
class TestClassSyntaxError {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    throw new Error('SQL syntax error');
  }
}

// Clase para permission error (no retryable)
class TestClassPermissionDenied {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    throw new Error('Permission denied for user');
  }
}

// Clase para undefined table (no retryable)
class TestClassUndefinedTable {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    throw new Error('relation "users" does not exist');
  }
}

// Clase para max attempts
class TestClassMaxAttempts {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    throw new Error('connection timeout');
  }
}

// Clase para custom maxAttempts
class TestClassCustomMaxAttempts {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 5, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    throw new Error('connection timeout');
  }
}

// Clase para exponential backoff
class TestClassExponentialBackoff {
  logger: any;
  attempts = 0;

  @Retry({
    maxAttempts: 3,
    delayMs: 100,
    backoffMultiplier: 2,
  })
  async testMethod() {
    this.attempts++;
    if (this.attempts < 3) {
      throw new Error('connection timeout');
    }
    return 'success';
  }
}

// Clase para custom retryable errors
class TestClassCustomRetryable {
  logger: any;
  attempts = 0;

  @Retry({
    maxAttempts: 3,
    delayMs: 10,
    retryableErrors: (error) => {
      const msg = (error as any)?.message || '';
      return msg.includes('CUSTOM_RETRYABLE');
    },
  })
  async testMethod() {
    this.attempts++;
    if (this.attempts === 1) {
      throw new Error('CUSTOM_RETRYABLE_ERROR');
    }
    return 'success';
  }
}

// Clase para custom non-retryable
class TestClassCustomNonRetryable {
  logger: any;
  attempts = 0;

  @Retry({
    maxAttempts: 3,
    delayMs: 10,
    retryableErrors: (error) => {
      const msg = (error as any)?.message || '';
      return msg.includes('CUSTOM_RETRYABLE');
    },
  })
  async testMethod() {
    this.attempts++;
    throw new Error('OTHER_ERROR');
  }
}

// Clase para logging
class TestClassLogging {
  logger: any;
  attempts = 0;

  @Retry({ maxAttempts: 3, delayMs: 10 })
  async testMethod() {
    this.attempts++;
    if (this.attempts < 2) {
      throw new Error('connection timeout');
    }
    return 'success';
  }
}

// Clase para logging final failure
class TestClassLoggingFailure {
  logger: any;

  @Retry({ maxAttempts: 2, delayMs: 10 })
  async testMethod() {
    throw new Error('connection timeout');
  }
}

// ===== Tests =====

describe('Retry Decorator', () => {
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful execution', () => {
    it('should execute method successfully on first attempt', async () => {
      const instance = new TestClassSuccess();
      instance.logger = mockLogger;

      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should succeed after retries on transient error', async () => {
      const instance = new TestClassRetrySuccess();
      instance.logger = mockLogger;

      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(instance.attempts).toBe(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    }, 15000);
  });

  describe('transient error detection', () => {
    it('should retry on ECONNRESET error', async () => {
      const instance = new TestClassEConnReset();
      instance.logger = mockLogger;

      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(instance.attempts).toBe(2);
    });

    it('should retry on nested TypeORM error', async () => {
      const instance = new TestClassTypeOrmError();
      instance.logger = mockLogger;

      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(instance.attempts).toBe(2);
    });

    it('should retry on "too many connections" error', async () => {
      const instance = new TestClassTooManyConnections();
      instance.logger = mockLogger;

      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(instance.attempts).toBe(2);
    });
  });

  describe('non-retryable errors', () => {
    it('should not retry on duplicate key error', async () => {
      const instance = new TestClassDuplicateKey();
      instance.logger = mockLogger;

      await expect(instance.testMethod()).rejects.toThrow('duplicate key');
      expect(instance.attempts).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Non-retryable error'),
      );
    });

    it('should not retry on syntax error', async () => {
      const instance = new TestClassSyntaxError();
      instance.logger = mockLogger;

      await expect(instance.testMethod()).rejects.toThrow('SQL syntax error');
      expect(instance.attempts).toBe(1);
    });

    it('should not retry on permission denied error', async () => {
      const instance = new TestClassPermissionDenied();
      instance.logger = mockLogger;

      await expect(instance.testMethod()).rejects.toThrow('Permission denied');
      expect(instance.attempts).toBe(1);
    });

    it('should not retry on undefined table error', async () => {
      const instance = new TestClassUndefinedTable();
      instance.logger = mockLogger;

      await expect(instance.testMethod()).rejects.toThrow();
      expect(instance.attempts).toBe(1);
    });
  });

  describe('max attempts', () => {
    it('should fail after max attempts reached', async () => {
      const instance = new TestClassMaxAttempts();
      instance.logger = mockLogger;

      await expect(instance.testMethod()).rejects.toThrow('connection timeout');
      expect(instance.attempts).toBe(3);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed after 3 attempts'),
      );
    });

    it('should respect custom maxAttempts', async () => {
      const instance = new TestClassCustomMaxAttempts();
      instance.logger = mockLogger;

      await expect(instance.testMethod()).rejects.toThrow();
      expect(instance.attempts).toBe(5);
    }, 30000);
  });

  describe('exponential backoff', () => {
    it('should apply exponential backoff multiplier', async () => {
      const instance = new TestClassExponentialBackoff();
      instance.logger = mockLogger;

      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(instance.attempts).toBe(3);
    }, 30000);
  });

  describe('custom retry conditions', () => {
    it('should respect custom retryableErrors predicate', async () => {
      const instance = new TestClassCustomRetryable();
      instance.logger = mockLogger;

      const result = await instance.testMethod();

      expect(result).toBe('success');
      expect(instance.attempts).toBe(2);
    }, 15000);

    it('should not retry when custom predicate returns false', async () => {
      const instance = new TestClassCustomNonRetryable();
      instance.logger = mockLogger;

      await expect(instance.testMethod()).rejects.toThrow('OTHER_ERROR');
      expect(instance.attempts).toBe(1);
    });
  });

  describe('logging', () => {
    it('should log retry attempts', async () => {
      const instance = new TestClassLogging();
      instance.logger = mockLogger;

      await instance.testMethod();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Transient error on attempt 1'),
      );
    }, 15000);

    it('should log final failure', async () => {
      const instance = new TestClassLoggingFailure();
      instance.logger = mockLogger;

      await expect(instance.testMethod()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed after 2 attempts'),
      );
    }, 15000);
  });
});
