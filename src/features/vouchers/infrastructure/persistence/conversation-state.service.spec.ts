import {
  ConversationState,
  ConversationStateService,
} from './conversation-state.service';

describe('ConversationStateService', () => {
  let service: ConversationStateService;
  let setIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation((() => 1) as any);
    service = new ConversationStateService();
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should set and get context', () => {
    service.setContext('5512345678', ConversationState.WAITING_CONFIRMATION, {
      voucherData: {
        monto: '1000.00',
        fecha_pago: '2025-01-01',
        referencia: 'REF1',
        hora_transaccion: '10:00:00',
        casa: 10,
      },
    } as any);

    const context = service.getContext('5512345678');

    expect(context).not.toBeNull();
    expect(context?.state).toBe(ConversationState.WAITING_CONFIRMATION);
  });

  it('should return null and clear expired context', () => {
    service.setContext('5599999999', ConversationState.WAITING_HOUSE_NUMBER);
    const conversations = (service as any).conversations as Map<string, any>;
    const existing = conversations.get('5599999999');
    existing.lastMessageAt = new Date(Date.now() - 20 * 60 * 1000);

    const result = service.getContext('5599999999');

    expect(result).toBeNull();
    expect(conversations.has('5599999999')).toBe(false);
  });

  it('should validate confirmation and negation messages', () => {
    expect(service.isConfirmationMessage(' Sí ')).toBe(true);
    expect(service.isConfirmationMessage('confirmo')).toBe(true);
    expect(service.isNegationMessage('no')).toBe(true);
    expect(service.isNegationMessage('cancelar')).toBe(true);
    expect(service.isConfirmationMessage('tal vez')).toBe(false);
  });

  it('should extract valid house number and reject invalid values', () => {
    expect(service.extractHouseNumber('mi casa es 12')).toBe(12);
    expect(service.extractHouseNumber('casa 0')).toBeNull();
    expect(service.extractHouseNumber('casa 77')).toBeNull();
  });

  it('should identify missing required fields excluding referencia', () => {
    const missing = service.identifyMissingFields({
      monto: '',
      fecha_pago: '',
      referencia: '',
      hora_transaccion: '',
      casa: null,
    } as any);

    expect(missing).toEqual([
      'monto',
      'fecha_pago',
      'hora_transaccion',
      'casa',
    ]);
  });

  it('should remove missing fields and report completion', () => {
    service.setContext('5511001100', ConversationState.WAITING_MISSING_DATA, {
      missingFields: ['monto', 'casa'],
    });

    expect(service.areAllFieldsComplete('5511001100')).toBe(false);
    service.removeFromMissingFields('5511001100', 'monto');
    service.removeFromMissingFields('5511001100', 'casa');

    expect(service.areAllFieldsComplete('5511001100')).toBe(true);
  });
});
