import { Test, TestingModule } from '@nestjs/testing';
import { ColumnAnalyzerService } from './column-analyzer.service';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
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
  let openAIService: jest.Mocked<OpenAIService>;
  let vertexAIService: jest.Mocked<VertexAIService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColumnAnalyzerService,
        {
          provide: OpenAIService,
          useValue: { processTextWithPrompt: jest.fn() },
        },
        {
          provide: VertexAIService,
          useValue: { processTextWithPrompt: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ColumnAnalyzerService);
    openAIService = module.get(OpenAIService);
    vertexAIService = module.get(VertexAIService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('analyzeColumns — OpenAI primario', () => {
    it('retorna ColumnMapping válido para layout GenericCsv via OpenAI', async () => {
      openAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        confidence: 'high',
        reasoning: 'test',
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toEqual(VALID_GENERIC_MAPPING);
      expect(openAIService.processTextWithPrompt).toHaveBeenCalledTimes(1);
      expect(vertexAIService.processTextWithPrompt).not.toHaveBeenCalled();
    });

    it('retorna ColumnMapping válido para layout SantanderXlsx via OpenAI', async () => {
      openAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_SANTANDER_MAPPING,
        confidence: 'high',
        reasoning: 'test',
      });

      const result = await service.analyzeColumns(SANTANDER_XLSX_HEADERS, []);

      expect(result).toEqual(VALID_SANTANDER_MAPPING);
    });

    it('acepta saldoIndex y referenciaIndex ausentes (usa -1 como default)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { saldoIndex, referenciaIndex, ...withoutOptionals } = VALID_GENERIC_MAPPING;
      openAIService.processTextWithPrompt.mockResolvedValue({
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

  describe('analyzeColumns — fallback a Vertex AI', () => {
    it('usa Vertex AI cuando OpenAI falla', async () => {
      openAIService.processTextWithPrompt.mockRejectedValue(
        new Error('OpenAI timeout'),
      );
      vertexAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        confidence: 'high',
        reasoning: 'fallback test',
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toEqual(VALID_GENERIC_MAPPING);
      expect(vertexAIService.processTextWithPrompt).toHaveBeenCalledTimes(1);
    });

    it('retorna null cuando ambos proveedores fallan', async () => {
      openAIService.processTextWithPrompt.mockRejectedValue(
        new Error('OpenAI error'),
      );
      vertexAIService.processTextWithPrompt.mockRejectedValue(
        new Error('VertexAI error'),
      );

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('no propaga excepciones cuando ambos fallan', async () => {
      openAIService.processTextWithPrompt.mockRejectedValue(
        new Error('OpenAI down'),
      );
      vertexAIService.processTextWithPrompt.mockRejectedValue(
        new Error('VertexAI down'),
      );

      await expect(
        service.analyzeColumns(GENERIC_CSV_HEADERS, SAMPLE_ROWS),
      ).resolves.toBeNull();
    });
  });

  describe('analyzeColumns — validación de respuesta', () => {
    it('retorna null cuando la respuesta de OpenAI es null (y VertexAI también)', async () => {
      openAIService.processTextWithPrompt.mockResolvedValue(null);
      vertexAIService.processTextWithPrompt.mockResolvedValue(null);

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('retorna null cuando falta un campo requerido (conceptoIndex)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { conceptoIndex, ...withoutConcepto } = VALID_GENERIC_MAPPING;
      openAIService.processTextWithPrompt.mockResolvedValue(withoutConcepto);

      const result = await service.analyzeColumns(GENERIC_CSV_HEADERS, SAMPLE_ROWS);

      expect(result).toBeNull();
    });

    it('retorna null cuando conceptoIndex es -1', async () => {
      openAIService.processTextWithPrompt.mockResolvedValue({
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
      openAIService.processTextWithPrompt.mockResolvedValue({
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
      openAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        fechaIndex: 99,
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('retorna null cuando un campo requerido no es número', async () => {
      openAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        retiroIndex: 'cuatro',
      });

      const result = await service.analyzeColumns(
        GENERIC_CSV_HEADERS,
        SAMPLE_ROWS,
      );

      expect(result).toBeNull();
    });

    it('calcula trailingColumnsAfterDeposito = expectedColumnCount - depositoIndex - 1 (no depende de la IA)', async () => {
      // La IA retorna trailingColumnsAfterDeposito = 0 (valor incorrecto que causó el bug en producción).
      // El servicio lo ignora y lo calcula: 8 - 5 - 1 = 2
      openAIService.processTextWithPrompt.mockResolvedValue({
        ...VALID_GENERIC_MAPPING,
        trailingColumnsAfterDeposito: 0,
        confidence: 'high',
        reasoning: 'test',
      });

      const result = await service.analyzeColumns(GENERIC_CSV_HEADERS, SAMPLE_ROWS);

      expect(result?.trailingColumnsAfterDeposito).toBe(2);
    });
  });
});
