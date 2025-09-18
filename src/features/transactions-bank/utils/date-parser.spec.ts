import { parseContextualDate } from './date-parser';

describe('parseContextualDate', () => {
  describe('File type specific behavior for ambiguous dates', () => {
    const ambiguousDate = '02/01/2025'; // Could be Feb 1st or Jan 2nd

    it('should default to MM/DD for CSV files', () => {
      const result = parseContextualDate(ambiguousDate, 'MM/DD');
      expect(result.toISOString().split('T')[0]).toBe('2025-02-01'); // Feb 1st (MM/DD)
    });

    it('should default to DD/MM for XLSX files', () => {
      const result = parseContextualDate(ambiguousDate, 'DD/MM');
      expect(result.toISOString().split('T')[0]).toBe('2025-01-02'); // Jan 2nd (DD/MM)
    });
  });

  describe('Auto-detection based on day > 12', () => {
    it('should auto-detect DD/MM when first number > 12', () => {
      const csvResult = parseContextualDate('15/01/2025', 'MM/DD');
      const xlsxResult = parseContextualDate('15/01/2025', 'DD/MM');

      // Both should give same result when auto-detection is clear
      expect(csvResult.toISOString().split('T')[0]).toBe('2025-01-15');
      expect(xlsxResult.toISOString().split('T')[0]).toBe('2025-01-15');
    });

    it('should auto-detect MM/DD when second number > 12', () => {
      const csvResult = parseContextualDate('01/15/2025', 'MM/DD');
      const xlsxResult = parseContextualDate('01/15/2025', 'DD/MM');

      // Both should give same result when auto-detection is clear
      expect(csvResult.toISOString().split('T')[0]).toBe('2025-01-15');
      expect(xlsxResult.toISOString().split('T')[0]).toBe('2025-01-15');
    });
  });

  describe('Spanish month format support', () => {
    it('should handle Spanish month names correctly', () => {
      const testCases = [
        { input: '31/jul/25', expected: '2025-07-31' },
        { input: '01/ene/25', expected: '2025-01-01' },
        { input: '28/feb/25', expected: '2025-02-28' },
        { input: '31/dic/24', expected: '2024-12-31' },
      ];

      testCases.forEach(({ input, expected }) => {
        const csvResult = parseContextualDate(input, 'MM/DD');
        const xlsxResult = parseContextualDate(input, 'DD/MM');

        // Spanish format should work the same regardless of preference
        expect(csvResult.toISOString().split('T')[0]).toBe(expected);
        expect(xlsxResult.toISOString().split('T')[0]).toBe(expected);
      });
    });
  });

  describe('ISO format support', () => {
    it('should handle ISO format correctly', () => {
      const isoDate = '2025-01-15';
      const csvResult = parseContextualDate(isoDate, 'MM/DD');
      const xlsxResult = parseContextualDate(isoDate, 'DD/MM');

      // ISO format should work the same regardless of preference
      expect(csvResult.toISOString().split('T')[0]).toBe('2025-01-15');
      expect(xlsxResult.toISOString().split('T')[0]).toBe('2025-01-15');
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid dates', () => {
      expect(() => parseContextualDate('invalid-date', 'MM/DD')).toThrow(
        'Formato de fecha inválido',
      );
      expect(() => parseContextualDate('32/01/2025', 'MM/DD')).toThrow(
        'Formato de fecha inválido',
      );
      expect(() => parseContextualDate('29/02/2025', 'DD/MM')).toThrow(
        'Formato de fecha inválido',
      ); // 2025 is not a leap year
    });

    it('should throw error for empty dates', () => {
      expect(() => parseContextualDate('', 'MM/DD')).toThrow('Fecha requerida');
    });
  });
});
