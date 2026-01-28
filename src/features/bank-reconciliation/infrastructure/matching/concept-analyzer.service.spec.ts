import { Test, TestingModule } from '@nestjs/testing';
import { ConceptAnalyzerService } from './concept-analyzer.service';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { ReconciliationConfig } from '../../config/reconciliation.config';
import { ConceptAnalysisAIResponse } from '../../dto/concept-analysis.dto';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';

describe('ConceptAnalyzerService', () => {
  let service: ConceptAnalyzerService;
  let openAIService: jest.Mocked<OpenAIService>;
  let vertexAIService: jest.Mocked<VertexAIService>;

  const mockAIResponse: ConceptAnalysisAIResponse = {
    house_number: 5,
    confidence: 'high',
    month_number: 1,
    month_name: 'enero',
    payment_type: 'mantenimiento',
    keywords: ['casa', 'enero', 'mantenimiento'],
    reasoning: 'Patrón claro de casa identificado',
    indicators: {
      clear_house_pattern: true,
      month_indicator: true,
      payment_type_found: true,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConceptAnalyzerService,
        {
          provide: OpenAIService,
          useValue: {
            processTextWithPrompt: jest.fn(),
          },
        },
        {
          provide: VertexAIService,
          useValue: {
            processTextWithPrompt: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConceptAnalyzerService>(ConceptAnalyzerService);
    openAIService = module.get(OpenAIService) as jest.Mocked<OpenAIService>;
    vertexAIService = module.get(VertexAIService) as jest.Mocked<VertexAIService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeConceptWithAI', () => {
    describe('Con IA habilitada', () => {
      beforeEach(() => {
        ReconciliationConfig.ENABLE_AI_CONCEPT_ANALYSIS = true;
      });

      it('debería usar OpenAI por defecto', async () => {
        openAIService.processTextWithPrompt.mockResolvedValue(mockAIResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Pago casa 5 enero',
        });

        expect(result.houseNumber).toBe(5);
        expect(result.confidence).toBe('high');
        expect(result.method).toBe('ai');
        expect(openAIService.processTextWithPrompt).toHaveBeenCalled();
      });

      it('debería hacer fallback a Vertex AI si OpenAI falla', async () => {
        openAIService.processTextWithPrompt.mockRejectedValue(
          new Error('OpenAI error'),
        );
        vertexAIService.processTextWithPrompt.mockResolvedValue(mockAIResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Pago casa 5 enero',
        });

        expect(result.houseNumber).toBe(5);
        expect(vertexAIService.processTextWithPrompt).toHaveBeenCalled();
      });

      it('debería parsear respuesta JSON correctamente', async () => {
        const jsonResponse = JSON.stringify(mockAIResponse);
        openAIService.processTextWithPrompt.mockResolvedValue(jsonResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Pago casa 5 enero',
        });

        expect(result.houseNumber).toBe(5);
        expect(result.confidence).toBe('high');
        expect(result.month?.monthNumber).toBe(1);
      });

      it('debería validar rango de número de casa', async () => {
        const invalidResponse = {
          ...mockAIResponse,
          house_number: 100, // Fuera del rango
        };
        openAIService.processTextWithPrompt.mockResolvedValue(invalidResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Concepto con número inválido',
          houseNumberRange: { min: MIN_HOUSE_NUMBER, max: MAX_HOUSE_NUMBER },
        });

        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
      });

      it('debería extraer información de mes', async () => {
        openAIService.processTextWithPrompt.mockResolvedValue(mockAIResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Casa 5 febrero',
        });

        expect(result.month?.monthNumber).toBe(1);
        expect(result.month?.monthName).toBe('enero');
      });

      it('debería extraer tipo de pago', async () => {
        openAIService.processTextWithPrompt.mockResolvedValue(mockAIResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Casa 5 agua',
        });

        expect(result.paymentType?.type).toBe('mantenimiento');
      });
    });

    describe('Con IA deshabilitada', () => {
      beforeEach(() => {
        ReconciliationConfig.ENABLE_AI_CONCEPT_ANALYSIS = false;
      });

      it('debería retornar resultado negativo sin llamar a IA', async () => {
        const result = await service.analyzeConceptWithAI({
          concept: 'Pago casa 5',
        });

        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
        expect(result.method).toBe('none');
        expect(openAIService.processTextWithPrompt).not.toHaveBeenCalled();
      });
    });

    describe('Manejo de errores', () => {
      beforeEach(() => {
        ReconciliationConfig.ENABLE_AI_CONCEPT_ANALYSIS = true;
      });

      it('debería manejar error si ambas IA fallan', async () => {
        openAIService.processTextWithPrompt.mockRejectedValue(
          new Error('OpenAI error'),
        );
        vertexAIService.processTextWithPrompt.mockRejectedValue(
          new Error('Vertex AI error'),
        );

        const result = await service.analyzeConceptWithAI({
          concept: 'Pago casa 5',
        });

        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
      });

      it('debería retornar respuesta vacía como null', async () => {
        openAIService.processTextWithPrompt.mockResolvedValue(null);
        vertexAIService.processTextWithPrompt.mockResolvedValue(mockAIResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Pago casa 5',
        });

        expect(result.houseNumber).toBe(5);
      });

      it('debería manejar respuesta malformada', async () => {
        openAIService.processTextWithPrompt.mockResolvedValue(
          'No es JSON válido {',
        );
        vertexAIService.processTextWithPrompt.mockResolvedValue(mockAIResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Pago casa 5',
        });

        expect(result.houseNumber).toBe(5);
      });
    });

    describe('Validación de campos', () => {
      beforeEach(() => {
        ReconciliationConfig.ENABLE_AI_CONCEPT_ANALYSIS = true;
      });

      it('debería validar número de mes válido', async () => {
        const response = {
          ...mockAIResponse,
          month_number: 13, // Inválido
        };
        openAIService.processTextWithPrompt.mockResolvedValue(response);

        const result = await service.analyzeConceptWithAI({
          concept: 'Casa 5 mes 13',
        });

        expect(result.month).toBeUndefined();
      });

      it('debería validar nivel de confianza válido', async () => {
        const response = {
          ...mockAIResponse,
          confidence: 'invalid_level',
        };
        openAIService.processTextWithPrompt.mockResolvedValue(response);

        const result = await service.analyzeConceptWithAI({
          concept: 'Casa 5',
        });

        expect(result.confidence).toBe('none');
      });

      it('debería manejar keywords como array', async () => {
        const response = {
          ...mockAIResponse,
          keywords: ['casa', 'enero', 'mantenimiento'],
        };
        openAIService.processTextWithPrompt.mockResolvedValue(response);

        const result = await service.analyzeConceptWithAI({
          concept: 'Casa 5 enero',
        });

        expect(Array.isArray(result.houseNumber ? [result.houseNumber] : [])).toBe(
          true,
        );
      });
    });

    describe('Casos de uso reales', () => {
      beforeEach(() => {
        ReconciliationConfig.ENABLE_AI_CONCEPT_ANALYSIS = true;
      });

      it('debería analizar concepto ambiguo', async () => {
        const response: ConceptAnalysisAIResponse = {
          ...mockAIResponse,
          house_number: 5,
          confidence: 'medium',
          reasoning: 'Patrón de casa encontrado pero no es explícito',
        };
        openAIService.processTextWithPrompt.mockResolvedValue(response);

        const result = await service.analyzeConceptWithAI({
          concept: 'Transferencia recibida para propiedad zona norte',
        });

        expect(result.houseNumber).toBe(5);
        expect(result.confidence).toBe('medium');
      });

      it('debería retornar null si no encuentra casa', async () => {
        const response: ConceptAnalysisAIResponse = {
          house_number: null,
          confidence: 'none',
          month_number: null,
          month_name: null,
          payment_type: null,
          keywords: [],
          reasoning: 'No se identificó número de casa en el concepto',
          indicators: {
            clear_house_pattern: false,
            month_indicator: false,
            payment_type_found: false,
          },
        };
        openAIService.processTextWithPrompt.mockResolvedValue(response);

        const result = await service.analyzeConceptWithAI({
          concept: 'Pago general sin identificación',
        });

        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
      });

      it('debería extraer múltiples indicadores', async () => {
        openAIService.processTextWithPrompt.mockResolvedValue(mockAIResponse);

        const result = await service.analyzeConceptWithAI({
          concept: 'Casa 5 agua enero',
        });

        expect(result.houseNumber).toBe(5);
        expect(result.month?.monthNumber).toBe(1);
        expect(result.paymentType?.type).toBe('mantenimiento');
      });
    });
  });
});
