import {
  MessageIntent,
  WhatsAppMessageClassifierService,
} from './whatsapp-message-classifier.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { OpenAIService } from '@/shared/libs/openai/openai.service';

describe('WhatsAppMessageClassifierService', () => {
  let service: WhatsAppMessageClassifierService;
  let vertexAIService: jest.Mocked<VertexAIService>;
  let openAIService: jest.Mocked<OpenAIService>;

  beforeEach(() => {
    vertexAIService = {
      processTextWithPrompt: jest.fn(),
    } as any;

    openAIService = {
      processTextWithPrompt: jest.fn(),
    } as any;

    service = new WhatsAppMessageClassifierService(vertexAIService, openAIService);
  });

  it('should classify using Vertex AI and map payment_voucher intent', async () => {
    vertexAIService.processTextWithPrompt.mockResolvedValue({
      intent: 'payment_voucher',
      confidence: 0.95,
      response: 'Procesando comprobante',
    });

    const result = await service.classifyMessage('adjunto comprobante');

    expect(vertexAIService.processTextWithPrompt).toHaveBeenCalled();
    expect(openAIService.processTextWithPrompt).not.toHaveBeenCalled();
    expect(result).toEqual({
      intent: MessageIntent.PAYMENT_VOUCHER,
      confidence: 0.95,
      response: 'Procesando comprobante',
      requiresVoucherProcessing: true,
    });
  });

  it('should fallback to off_topic response on classifier error', async () => {
    vertexAIService.processTextWithPrompt.mockRejectedValue(new Error('boom'));

    const result = await service.classifyMessage('hola');

    expect(result.intent).toBe(MessageIntent.OFF_TOPIC);
    expect(result.confidence).toBe(0);
    expect(result.response).toContain('hubo un error');
  });

  it('should default unknown intent to off_topic', async () => {
    vertexAIService.processTextWithPrompt.mockResolvedValue({
      intent: 'something_else',
    });

    const result = await service.classifyMessage('mensaje');

    expect(result.intent).toBe(MessageIntent.OFF_TOPIC);
    expect(result.requiresVoucherProcessing).toBe(false);
  });
});
