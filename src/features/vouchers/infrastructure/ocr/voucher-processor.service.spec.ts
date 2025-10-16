import { Test, TestingModule } from '@nestjs/testing';
import { VoucherProcessorService, StructuredData } from './voucher-processor.service';
import { OcrService } from './ocr.service';
import { BadRequestException } from '@nestjs/common';

describe('VoucherProcessorService', () => {
  let service: VoucherProcessorService;
  let ocrService: OcrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherProcessorService,
        {
          provide: OcrService,
          useValue: {
            validateImageFormat: jest.fn(),
            extractTextFromImage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VoucherProcessorService>(VoucherProcessorService);
    ocrService = module.get<OcrService>(OcrService);
  });

  describe('extractCentavos() - Nueva regla de negocio', () => {
    /**
     * Pruebas para la nueva regla de negocio:
     * - .1 → casa 10, .2 → casa 20, .3 → casa 30, .4 → casa 40
     * - .01 → casa 1, .04 → casa 4, .05 → casa 5
     * - .0 o .00 → null
     * - Valores > 66 → null
     */

    describe('Centavos con un dígito (multiplicados por 10)', () => {
      it('debería convertir .1 a casa 10', () => {
        const data: StructuredData = {
          monto: '1000.1',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        // Acceder al método privado usando any
        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(10);
      });

      it('debería convertir .2 a casa 20', () => {
        const data: StructuredData = {
          monto: '1000.2',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(20);
      });

      it('debería convertir .3 a casa 30', () => {
        const data: StructuredData = {
          monto: '1000.3',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(30);
      });

      it('debería convertir .4 a casa 40', () => {
        const data: StructuredData = {
          monto: '1000.4',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(40);
      });

      it('debería convertir .5 a casa 50', () => {
        const data: StructuredData = {
          monto: '1000.5',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(50);
      });

      it('debería convertir .6 a casa 60', () => {
        const data: StructuredData = {
          monto: '1000.6',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(60);
      });

      it('debería convertir .7 a null (70 > 66 máximo)', () => {
        const data: StructuredData = {
          monto: '1000.7',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });
    });

    describe('Centavos con dos dígitos (interpretados literalmente)', () => {
      it('debería convertir .01 a casa 1', () => {
        const data: StructuredData = {
          monto: '1000.01',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(1);
      });

      it('debería convertir .04 a casa 4', () => {
        const data: StructuredData = {
          monto: '1000.04',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(4);
      });

      it('debería convertir .05 a casa 5', () => {
        const data: StructuredData = {
          monto: '1000.05',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(5);
      });

      it('debería convertir .15 a casa 15', () => {
        const data: StructuredData = {
          monto: '1000.15',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(15);
      });

      it('debería convertir .25 a casa 25', () => {
        const data: StructuredData = {
          monto: '1000.25',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(25);
      });

      it('debería convertir .66 a casa 66 (máximo permitido)', () => {
        const data: StructuredData = {
          monto: '1000.66',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(66);
      });

      it('debería convertir .67 a null (excede máximo 66)', () => {
        const data: StructuredData = {
          monto: '1000.67',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });

      it('debería convertir .99 a null (excede máximo 66)', () => {
        const data: StructuredData = {
          monto: '1000.99',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });
    });

    describe('Casos especiales y valores inválidos', () => {
      it('debería convertir .0 a null', () => {
        const data: StructuredData = {
          monto: '1000.0',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });

      it('debería convertir .00 a null', () => {
        const data: StructuredData = {
          monto: '1000.00',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });

      it('debería retornar null cuando no hay punto decimal', () => {
        const data: StructuredData = {
          monto: '1000',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });

      it('debería retornar null cuando monto es null', () => {
        const data: StructuredData = {
          monto: null as any,
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });

      it('debería retornar null cuando monto es undefined', () => {
        const data: StructuredData = {
          monto: undefined as any,
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });

      it('debería retornar null cuando monto es vacío', () => {
        const data: StructuredData = {
          monto: '',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });
    });

    describe('Casos extremos con tres dígitos', () => {
      it('debería convertir .105 a null (105 > 66)', () => {
        const data: StructuredData = {
          monto: '1000.105',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });

      it('debería convertir .999 a null (999 > 66)', () => {
        const data: StructuredData = {
          monto: '1000.999',
          fecha_pago: '2023-10-27',
          referencia: 'REF-001',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBeNull();
      });
    });

    describe('Casos reales de pagos', () => {
      it('caso real: pago de 500.2 debe ser casa 20', () => {
        const data: StructuredData = {
          monto: '500.2',
          fecha_pago: '2023-10-27',
          referencia: 'SIMULATED-REF-123',
          hora_transaccion: '14:30:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(20);
      });

      it('caso real: pago de 1500.15 debe ser casa 15', () => {
        const data: StructuredData = {
          monto: '1500.15',
          fecha_pago: '2023-10-27',
          referencia: 'REAL-REF-456',
          hora_transaccion: '10:45:30',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(15);
      });

      it('caso real: pago de 2000.03 debe ser casa 3', () => {
        const data: StructuredData = {
          monto: '2000.03',
          fecha_pago: '2023-10-27',
          referencia: 'REAL-REF-789',
          hora_transaccion: '16:20:00',
        };

        const result = (service as any).extractCentavos(data);

        expect(result.casa).toBe(3);
      });
    });
  });

  describe('generateConfirmationCode()', () => {
    it('debería generar un código con formato YYYYMM-XXXXX', () => {
      const code = service.generateConfirmationCode();

      // Verificar formato: YYYYMM-XXXXX
      expect(code).toMatch(/^\d{6}-[A-Z0-9]{5}$/);
    });

    it('debería generar códigos únicos', () => {
      const code1 = service.generateConfirmationCode();
      const code2 = service.generateConfirmationCode();

      expect(code1).not.toBe(code2);
    });
  });

  describe('processVoucher()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('debería procesar un voucher exitosamente', async () => {
      const mockBuffer = Buffer.from('test');
      const mockStructuredData: StructuredData = {
        monto: '1000.25',
        fecha_pago: '2023-10-27',
        referencia: 'REF-123',
        hora_transaccion: '14:30:00',
      };

      (ocrService.validateImageFormat as jest.Mock).mockResolvedValue(
        undefined,
      );
      (ocrService.extractTextFromImage as jest.Mock).mockResolvedValue({
        structuredData: mockStructuredData,
        originalFilename: 'test.jpg',
        gcsFilename: 'gcs-test-123.jpg',
      });

      const result = await service.processVoucher(
        mockBuffer,
        'test.jpg',
        'es',
        '+1234567890',
      );

      expect(result.success).toBe(true);
      expect(result.structuredData.casa).toBe(25);
      expect(result.originalFilename).toBe('test.jpg');
      expect(result.gcsFilename).toBe('gcs-test-123.jpg');
      expect(result.phoneNumber).toBe('+1234567890');
    });

    it('debería lanzar BadRequestException si ocurre un error en OCR', async () => {
      const mockBuffer = Buffer.from('test');

      (ocrService.validateImageFormat as jest.Mock).mockRejectedValue(
        new Error('Invalid file format'),
      );

      await expect(
        service.processVoucher(mockBuffer, 'test.jpg', 'es'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
