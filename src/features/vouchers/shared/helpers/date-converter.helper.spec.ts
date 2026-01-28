import {
  generateRecentDates,
  convertDateIdToString,
  DateOption,
} from './date-converter.helper';

// Mock the formatDateToDDMMYYYY utility
jest.mock('@/shared/common/utils', () => ({
  formatDateToDDMMYYYY: jest.fn((date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }),
  MONTH_NAMES: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
}));

describe('DateConverterHelper', () => {
  describe('generateRecentDates', () => {
    beforeEach(() => {
      // Mock current date to 2025-01-15
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should generate 4 date options (hoy, ayer, antier, otra)', () => {
      const options = generateRecentDates();

      expect(options).toHaveLength(4);
      expect(options[0].id).toBe('hoy');
      expect(options[1].id).toBe('fecha_1');
      expect(options[2].id).toBe('fecha_2');
      expect(options[3].id).toBe('otra');
    });

    it('should generate correct title for today', () => {
      const options = generateRecentDates();

      expect(options[0].title).toBe('Hoy 15');
      expect(options[0].description).toBe('15 de enero 2025');
    });

    it('should generate correct title for yesterday', () => {
      const options = generateRecentDates();

      expect(options[1].title).toBe('Ayer 14');
      expect(options[1].description).toBe('14 de enero 2025');
    });

    it('should generate correct title for day before yesterday', () => {
      const options = generateRecentDates();

      expect(options[2].title).toBe('Antier 13');
      expect(options[2].description).toBe('13 de enero 2025');
    });

    it('should include manual date entry option', () => {
      const options = generateRecentDates();

      expect(options[3].id).toBe('otra');
      expect(options[3].title).toBe('Otra fecha');
      expect(options[3].description).toBe('Escribir manualmente');
    });

    it('should handle month boundaries correctly', () => {
      // Test on first day of month
      jest.setSystemTime(new Date('2025-02-01T12:00:00Z'));
      const options = generateRecentDates();

      expect(options[0].description).toBe('1 de febrero 2025');
      expect(options[1].description).toBe('31 de enero 2025');
      expect(options[2].description).toBe('30 de enero 2025');
    });

    it('should handle year boundaries correctly', () => {
      // Test on first day of year
      jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const options = generateRecentDates();

      expect(options[0].description).toBe('1 de enero 2025');
      expect(options[1].description).toBe('31 de diciembre 2024');
      expect(options[2].description).toBe('30 de diciembre 2024');
    });

    it('should return all required properties for each option', () => {
      const options = generateRecentDates();

      options.forEach((option) => {
        expect(option).toHaveProperty('id');
        expect(option).toHaveProperty('title');
        expect(option).toHaveProperty('description');
        expect(typeof option.id).toBe('string');
        expect(typeof option.title).toBe('string');
        expect(typeof option.description).toBe('string');
      });
    });
  });

  describe('convertDateIdToString', () => {
    beforeEach(() => {
      // Mock current date to 2025-01-15
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should convert "hoy" to today\'s date', () => {
      const result = convertDateIdToString('hoy');

      expect(result).toBe('15/01/2025');
    });

    it('should convert "fecha_1" to yesterday\'s date', () => {
      const result = convertDateIdToString('fecha_1');

      expect(result).toBe('14/01/2025');
    });

    it('should convert "fecha_2" to day before yesterday', () => {
      const result = convertDateIdToString('fecha_2');

      expect(result).toBe('13/01/2025');
    });

    it('should return null for "otra" date id', () => {
      const result = convertDateIdToString('otra');

      expect(result).toBeNull();
    });

    it('should return null for invalid date id', () => {
      const result = convertDateIdToString('invalid');

      expect(result).toBeNull();
    });

    it('should return null for fecha_3 (not supported)', () => {
      const result = convertDateIdToString('fecha_3');

      expect(result).toBeNull();
    });

    it('should return null for fecha_0 (not supported)', () => {
      const result = convertDateIdToString('fecha_0');

      expect(result).toBeNull();
    });

    it('should return null for fecha_ without number', () => {
      const result = convertDateIdToString('fecha_');

      expect(result).toBeNull();
    });

    it('should return null for fecha_abc (invalid number)', () => {
      const result = convertDateIdToString('fecha_abc');

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = convertDateIdToString('');

      expect(result).toBeNull();
    });

    it('should handle month boundaries for fecha_1', () => {
      jest.setSystemTime(new Date('2025-02-01T12:00:00Z'));
      const result = convertDateIdToString('fecha_1');

      expect(result).toBe('31/01/2025');
    });

    it('should handle month boundaries for fecha_2', () => {
      jest.setSystemTime(new Date('2025-03-02T12:00:00Z'));
      const result = convertDateIdToString('fecha_2');

      expect(result).toBe('28/02/2025'); // Non-leap year
    });

    it('should handle year boundaries', () => {
      jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const result1 = convertDateIdToString('fecha_1');
      const result2 = convertDateIdToString('fecha_2');

      expect(result1).toBe('31/12/2024');
      expect(result2).toBe('30/12/2024');
    });

    it('should handle leap year February', () => {
      jest.setSystemTime(new Date('2024-03-02T12:00:00Z'));
      const result = convertDateIdToString('fecha_2');

      expect(result).toBe('29/02/2024'); // Leap year
    });
  });

  describe('DateOption interface', () => {
    it('should have correct structure', () => {
      const option: DateOption = {
        id: 'test',
        title: 'Test Title',
        description: 'Test Description',
      };

      expect(option.id).toBe('test');
      expect(option.title).toBe('Test Title');
      expect(option.description).toBe('Test Description');
    });
  });
});
