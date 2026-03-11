/**
 * Test aislado para la lógica de extracción de centavos
 * Este test no depende de servicios externos, solo prueba la lógica pura
 */

import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';

/**
 * Simula la regla de negocio para extraer el número de casa desde los centavos
 * Regla: .1 → 10, .2 → 20, .04 → 4, .05 → 5, etc.
 */
function extractCentavosLogic(montoStr: string): number | null {
  const parts = montoStr.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const centavosStr = parts[1];
  const maxCasas = MAX_HOUSE_NUMBER;
  const minCasas = MIN_HOUSE_NUMBER;

  // Normalizar: si tiene un solo dígito, multiplicar por 10
  const normalizedCentavos =
    centavosStr.length === 1
      ? parseInt(centavosStr, 10) * 10
      : parseInt(centavosStr, 10);

  if (
    isNaN(normalizedCentavos) ||
    normalizedCentavos === 0 ||
    normalizedCentavos > maxCasas
  ) {
    return null;
  }

  if (normalizedCentavos >= minCasas && normalizedCentavos <= maxCasas) {
    return normalizedCentavos;
  }

  return null;
}

describe('extractCentavosLogic - Nueva Regla de Negocio', () => {
  describe('Centavos con un dígito (multiplicados por 10)', () => {
    test('.1 debe convertirse a casa 10', () => {
      expect(extractCentavosLogic('1000.1')).toBe(10);
    });

    test('.2 debe convertirse a casa 20', () => {
      expect(extractCentavosLogic('1000.2')).toBe(20);
    });

    test('.3 debe convertirse a casa 30', () => {
      expect(extractCentavosLogic('1000.3')).toBe(30);
    });

    test('.4 debe convertirse a casa 40', () => {
      expect(extractCentavosLogic('1000.4')).toBe(40);
    });

    test('.5 debe convertirse a casa 50', () => {
      expect(extractCentavosLogic('1000.5')).toBe(50);
    });

    test('.6 debe convertirse a casa 60', () => {
      expect(extractCentavosLogic('1000.6')).toBe(60);
    });

    test('.7 debe convertirse a null (70 > 66 máximo)', () => {
      expect(extractCentavosLogic('1000.7')).toBeNull();
    });

    test('.9 debe convertirse a null (90 > 66 máximo)', () => {
      expect(extractCentavosLogic('1000.9')).toBeNull();
    });
  });

  describe('Centavos con dos dígitos (interpretados literalmente)', () => {
    test('.01 debe convertirse a casa 1', () => {
      expect(extractCentavosLogic('1000.01')).toBe(1);
    });

    test('.04 debe convertirse a casa 4', () => {
      expect(extractCentavosLogic('1000.04')).toBe(4);
    });

    test('.05 debe convertirse a casa 5', () => {
      expect(extractCentavosLogic('1000.05')).toBe(5);
    });

    test('.15 debe convertirse a casa 15', () => {
      expect(extractCentavosLogic('1000.15')).toBe(15);
    });

    test('.25 debe convertirse a casa 25', () => {
      expect(extractCentavosLogic('1000.25')).toBe(25);
    });

    test('.35 debe convertirse a casa 35', () => {
      expect(extractCentavosLogic('1000.35')).toBe(35);
    });

    test('.66 debe convertirse a casa 66 (máximo permitido)', () => {
      expect(extractCentavosLogic('1000.66')).toBe(66);
    });

    test('.67 debe convertirse a null (excede máximo 66)', () => {
      expect(extractCentavosLogic('1000.67')).toBeNull();
    });

    test('.99 debe convertirse a null (excede máximo 66)', () => {
      expect(extractCentavosLogic('1000.99')).toBeNull();
    });
  });

  describe('Casos especiales y valores inválidos', () => {
    test('.0 debe convertirse a null', () => {
      expect(extractCentavosLogic('1000.0')).toBeNull();
    });

    test('.00 debe convertirse a null', () => {
      expect(extractCentavosLogic('1000.00')).toBeNull();
    });

    test('sin punto decimal debe retornar null', () => {
      expect(extractCentavosLogic('1000')).toBeNull();
    });

    test('múltiples puntos decimales debe retornar null', () => {
      expect(extractCentavosLogic('1000.50.50')).toBeNull();
    });

    test('string vacío debe retornar null', () => {
      expect(extractCentavosLogic('')).toBeNull();
    });
  });

  describe('Casos extremos con tres dígitos', () => {
    test('.105 debe convertirse a null (105 > 66)', () => {
      expect(extractCentavosLogic('1000.105')).toBeNull();
    });

    test('.066 se interpreta como 66 (válido, aunque tiene 3 dígitos)', () => {
      expect(extractCentavosLogic('1000.066')).toBe(66);
    });

    test('.999 debe convertirse a null (999 > 66)', () => {
      expect(extractCentavosLogic('1000.999')).toBeNull();
    });
  });

  describe('Casos reales de pagos', () => {
    test('pago de 500.2 debe ser casa 20', () => {
      expect(extractCentavosLogic('500.2')).toBe(20);
    });

    test('pago de 1500.15 debe ser casa 15', () => {
      expect(extractCentavosLogic('1500.15')).toBe(15);
    });

    test('pago de 2000.03 debe ser casa 3', () => {
      expect(extractCentavosLogic('2000.03')).toBe(3);
    });

    test('pago de 100.1 debe ser casa 10', () => {
      expect(extractCentavosLogic('100.1')).toBe(10);
    });

    test('pago de 250.33 debe ser casa 33', () => {
      expect(extractCentavosLogic('250.33')).toBe(33);
    });

    test('pago de 75.4 debe ser casa 40', () => {
      expect(extractCentavosLogic('75.4')).toBe(40);
    });
  });

  describe('Diferencia clave: .1 vs .01', () => {
    test('.1 → 10 (un dígito multiplicado por 10)', () => {
      expect(extractCentavosLogic('1000.1')).toBe(10);
    });

    test('.01 → 1 (dos dígitos, interpretados literalmente)', () => {
      expect(extractCentavosLogic('1000.01')).toBe(1);
    });

    test('.4 → 40 (un dígito multiplicado por 10)', () => {
      expect(extractCentavosLogic('1000.4')).toBe(40);
    });

    test('.04 → 4 (dos dígitos, interpretados literalmente)', () => {
      expect(extractCentavosLogic('1000.04')).toBe(4);
    });

    test('.2 → 20 (un dígito multiplicado por 10)', () => {
      expect(extractCentavosLogic('1000.2')).toBe(20);
    });

    test('.02 → 2 (dos dígitos, interpretados literalmente)', () => {
      expect(extractCentavosLogic('1000.02')).toBe(2);
    });

    test('.3 → 30 (un dígito multiplicado por 10)', () => {
      expect(extractCentavosLogic('1000.3')).toBe(30);
    });

    test('.03 → 3 (dos dígitos, interpretados literalmente)', () => {
      expect(extractCentavosLogic('1000.03')).toBe(3);
    });
  });

  describe('Todos los casos válidos (1-66)', () => {
    for (let i = 1; i <= 6; i++) {
      test(`.${i} debe ser ${i * 10}`, () => {
        expect(extractCentavosLogic(`100.${i}`)).toBe(i * 10);
      });
    }

    for (let i = 1; i <= 66; i++) {
      test(`.${String(i).padStart(2, '0')} debe ser ${i}`, () => {
        expect(extractCentavosLogic(`100.${String(i).padStart(2, '0')}`)).toBe(
          i,
        );
      });
    }
  });
});
