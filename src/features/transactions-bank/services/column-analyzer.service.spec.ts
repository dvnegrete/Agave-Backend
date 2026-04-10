import { Test, TestingModule } from '@nestjs/testing';
import { ColumnAnalyzerService } from './column-analyzer.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { ColumnMapping } from '../interfaces/column-mapping.interface';

const GENERIC_CSV_HEADERS = [
  'FECHA',
  'HORA',
  'SUCURSAL',
  'CONCEPTO',
  'RETIRO',
  'DEPÓSITO',
  'SALDO',
  'REFERENCIA',
];
const SANTANDER_XLSX_HEADERS = [
  'FECHA',
  'HORA',
  'CONCEPTO',
  'RETIRO',
  'DEPOSITO',
  'MONEDA',
];
const SAMPLE_ROWS = [
  [
    '03/16/2026',
    '14:56:51',
    '7465',
    'Pago Mtto casa 7',
    '',
    '800.07',
    '51126.39',
    '002490195',
  ],
  [
    '03/06/2026',
    '16:43:27',
    '7465',
    'cuota extra casa 8',
    '',
    '800.08',
    '61704.92',
    '007253445',
  ],
];

const VALID_GENERIC_MAPPING: ColumnMapping = {
  fechaIndex: 0,
  horaIndex: 1,
  conceptoIndex: 3,
  retiroIndex: 4,
  depositoIndex: 5,
  saldoIndex: 6,
  referenciaIndex: 7,
  expectedColumnCount: 8,
  trailingColumnsAfterDeposito: 2,
};

const VALID_SANTANDER_MAPPING: ColumnMapping = {
  fechaIndex: 0,
  horaIndex: 1,
  conceptoIndex: 2,
  retiroIndex: 3,
  depositoIndex: 4,
  saldoIndex: -1,
  referenciaIndex: -1,
  expectedColumnCount: 6,
  trailingColumnsAfterDeposito: 1,
};

describe('ColumnAnalyzerService', () => {
  let service: ColumnAnalyzerService;
  let vertexAIService: jest.Mocked<VertexAIService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColumnAnalyzerService,
        {
          provide: VertexAIService,
          useValue: { processTextWithPrompt: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ColumnAnalyzerService);
    vertexAIService = module.get(VertexAIService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('analyzeColumns — happy paths', () => {
    it('retorna ColumnMapping válido para layout GenericCsv', async () => {
      vertexAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        confidence: 'high',
        reasoning: 'test',
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toEqual(VALID_GENERIC_MAPPING);
    });

    it('retorna ColumnMapping válido para layout SantanderXlsx', async () => {
      vertexAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_SANTANDER_MAPPING,
        confidence: 'high',
        reasoning: 'test',
      });

      const result = await service.analyzeColumns(SANTANDER_XLSX_HEADERS, []);

      expect(result).toEqual(VALID_SANTANDER_MAPPING);
    });

    it('acepta saldoIndex y referenciaIndex ausentes en la respuesta (usa -1 como default)', async () => {
      const { saldoIndex, referenciaIndex, ...withoutOptionals } =
        VALID_GENERIC_MAPPING;
      vertexAIService.processTextWithPrompt.mockResolvedValue({
        ...withoutOptionals,
        confidence: 'medium',
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result?.saldoIndex).toBe(-1);
      expect(result?.referenciaIndex).toBe(-1);
    });
  });

  describe('analyzeColumns — fallos → retorna null', () => {
    it('retorna null cuando VertexAI lanza error', async () => {
      vertexAIService.processTextWithPrompt.mockRejectedValue(
        new Error('El servicio de Vertex AI no está configurado.'),
      );

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('retorna null cuando la respuesta es null', async () => {
      vertexAIService.processTextWithPrompt.mockResolvedValue(null);

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('retorna null cuando falta un campo requerido (conceptoIndex)', async () => {
      const { conceptoIndex, ...withoutConcepto } = VALID_GENERIC_MAPPING;
      vertexAIService.processTextWithPrompt.mockResolvedValue(withoutConcepto);

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('retorna null cuando conceptoIndex es -1', async () => {
      vertexAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        conceptoIndex: -1,
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('retorna null cuando depositoIndex es -1', async () => {
      vertexAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        depositoIndex: -1,
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('retorna null cuando un índice está fuera del rango del encabezado real', async () => {
      vertexAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        fechaIndex: 99, // header solo tiene 8 columnas (índices 0-7)
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('retorna null cuando un campo requerido no es número', async () => {
      vertexAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        retiroIndex: 'cuatro', // debería ser number
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });
  });

  describe('analyzeColumns — no propaga excepciones', () => {
    it('no lanza cuando VertexAI falla — el caller puede continuar con fallback', async () => {
      vertexAIService.processTextWithPrompt.mockRejectedValue(
        new Error('timeout'),
      );

      await expect(
        service.analyzeColumns(GENERIC_CSV_HEADERS, SAMPLE_ROWS),
      ).resolves.toBeNull();
    });
  });
});
