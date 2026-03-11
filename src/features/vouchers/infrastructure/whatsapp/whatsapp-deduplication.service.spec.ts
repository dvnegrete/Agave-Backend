import { WhatsAppDeduplicationService } from './whatsapp-deduplication.service';

describe('WhatsAppDeduplicationService', () => {
  let service: WhatsAppDeduplicationService;
  let setIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation((() => 1) as any);
    service = new WhatsAppDeduplicationService();
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should mark messages and detect duplicates', () => {
    expect(service.isDuplicate('msg-1')).toBe(false);

    service.markAsProcessed('msg-1');

    expect(service.isDuplicate('msg-1')).toBe(true);
  });

  it('should ignore empty message ids', () => {
    service.markAsProcessed('');
    expect(service.isDuplicate('')).toBe(false);
    expect(service.getStats().totalProcessed).toBe(0);
  });

  it('should cleanup old messages', () => {
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const map = (service as any).processedMessages as Map<string, number>;
    map.set('old', now - 25 * 60 * 60 * 1000);
    map.set('new', now - 1 * 60 * 60 * 1000);

    (service as any).cleanup();

    expect(service.isDuplicate('old')).toBe(false);
    expect(service.isDuplicate('new')).toBe(true);
  });

  it('should return stats with oldest and newest timestamps', () => {
    const map = (service as any).processedMessages as Map<string, number>;
    map.set('a', 100);
    map.set('b', 200);

    const stats = service.getStats();

    expect(stats.totalProcessed).toBe(2);
    expect(stats.oldestTimestamp).toBe(100);
    expect(stats.newestTimestamp).toBe(200);
  });
});
