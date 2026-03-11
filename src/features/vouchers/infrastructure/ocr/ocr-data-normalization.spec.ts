/**
 * Test para verificar la normalización de datos de OpenAI y Vertex AI
 * Simula los diferentes tipos de datos que pueden retornar ambos servicios
 */

/**
 * Simula la normalización de datos retornados por OpenAI o Vertex AI
 */
function normalizeStructuredData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const toSafeString = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return String(value).trim();
  };

  return {
    monto: toSafeString(data.monto),
    fecha_pago: toSafeString(data.fecha_pago),
    referencia: toSafeString(data.referencia),
    hora_transaccion: toSafeString(data.hora_transaccion),
    faltan_datos: data.faltan_datos === true || data.faltan_datos === 'true',
    pregunta: toSafeString(data.pregunta),
    // Preservar otros campos que podrían estar presentes
    ...Object.keys(data)
      .filter(
        (key) =>
          ![
            'monto',
            'fecha_pago',
            'referencia',
            'hora_transaccion',
            'faltan_datos',
            'pregunta',
          ].includes(key),
      )
      .reduce((acc, key) => {
        acc[key] = data[key];
        return acc;
      }, {} as any),
  };
}

describe('OCR Data Normalization - Compatibilidad OpenAI + Vertex AI', () => {
  describe('Datos retornados por OpenAI (con números)', () => {
    it('debe convertir monto numérico a string', () => {
      const data = {
        monto: 123.45, // OpenAI retorna número
        fecha_pago: '2023-10-27',
        referencia: 'REF-123',
        hora_transaccion: '14:30:00',
        faltan_datos: false,
      };

      const normalized = normalizeStructuredData(data);

      expect(normalized.monto).toBe('123.45');
      expect(typeof normalized.monto).toBe('string');
    });

    it('debe convertir múltiples campos numéricos a strings', () => {
      const data = {
        monto: 500.5, // número
        fecha_pago: 2023, // podrías tener esto como número
        referencia: 'REF-456',
        hora_transaccion: 143000, // podría ser número
        faltan_datos: false,
      };

      const normalized = normalizeStructuredData(data);

      expect(normalized.monto).toBe('500.5');
      expect(typeof normalized.monto).toBe('string');
      expect(typeof normalized.hora_transaccion).toBe('string');
    });

    it('debe manejar null y undefined en campos string', () => {
      const data = {
        monto: null,
        fecha_pago: undefined,
        referencia: 'REF-789',
        hora_transaccion: '10:00:00',
        faltan_datos: false,
      };

      const normalized = normalizeStructuredData(data);

      expect(normalized.monto).toBe('');
      expect(normalized.fecha_pago).toBe('');
      expect(normalized.referencia).toBe('REF-789');
    });
  });

  describe('Datos retornados por Vertex AI (formato consistente)', () => {
    it('debe manejar strings correctamente de Vertex AI', () => {
      const data = {
        monto: '1500.25',
        fecha_pago: '2023-11-15',
        referencia: 'VERTEX-REF-001',
        hora_transaccion: '09:45:30',
        faltan_datos: false,
      };

      const normalized = normalizeStructuredData(data);

      expect(normalized.monto).toBe('1500.25');
      expect(normalized.fecha_pago).toBe('2023-11-15');
      expect(typeof normalized.monto).toBe('string');
    });

    it('debe manejar array retornado por Vertex (si ocurre)', () => {
      // Vertex a veces retorna un array [{}] en lugar de {}
      const data = [
        {
          monto: '2000.75',
          fecha_pago: '2023-12-01',
          referencia: 'VERTEX-ARRAY',
          hora_transaccion: '16:20:00',
          faltan_datos: false,
        },
      ];

      // Extraer primer elemento
      const singleData = Array.isArray(data) ? data[0] : data;
      const normalized = normalizeStructuredData(singleData);

      expect(normalized.monto).toBe('2000.75');
      expect(typeof normalized.monto).toBe('string');
    });
  });

  describe('Compatibilidad con extractCentavos()', () => {
    it('monto normalizado debe funcionar con extractCentavos', () => {
      const data = {
        monto: 1000.2, // número de OpenAI
        fecha_pago: '2023-10-27',
        referencia: 'REF-TEST',
        hora_transaccion: '14:30:00',
        faltan_datos: false,
      };

      const normalized = normalizeStructuredData(data);

      // Simular extractCentavos
      const parts = normalized.monto.split('.');
      expect(parts.length).toBe(2);
      expect(parts[0]).toBe('1000');
      expect(parts[1]).toBe('2');

      // Verificar que .trim() no falla
      expect(() => normalized.monto.trim()).not.toThrow();
    });

    it('monto con centavos debe preservar precisión', () => {
      const data = {
        monto: 500.04, // debe ser "500.04" no "500.4"
        fecha_pago: '2023-10-27',
        referencia: 'REF-TEST',
        hora_transaccion: '14:30:00',
        faltan_datos: false,
      };

      const normalized = normalizeStructuredData(data);

      // Aquí preservamos el número tal cual se ingresó
      // Si OpenAI retorna 500.04, String() lo convierte a "500.04"
      expect(normalized.monto).toBe('500.04');

      // Verificar que funciona con split
      const parts = normalized.monto.split('.');
      expect(parts[1]).toBe('04');
    });
  });

  describe('Casos extremos y combinados', () => {
    it('debe manejar faltan_datos como booleano o string', () => {
      const data1 = { ...getDummyData(), faltan_datos: true };
      const data2 = { ...getDummyData(), faltan_datos: 'true' };
      const data3 = { ...getDummyData(), faltan_datos: false };

      const normalized1 = normalizeStructuredData(data1);
      const normalized2 = normalizeStructuredData(data2);
      const normalized3 = normalizeStructuredData(data3);

      expect(normalized1.faltan_datos).toBe(true);
      expect(normalized2.faltan_datos).toBe(true);
      expect(normalized3.faltan_datos).toBe(false);
    });

    it('debe preservar campos adicionales de OpenAI/Vertex', () => {
      const data = {
        ...getDummyData(),
        extra_campo: 'valor-adicional',
        otro_campo: 123,
      };

      const normalized = normalizeStructuredData(data);

      expect(normalized.extra_campo).toBe('valor-adicional');
      expect(normalized.otro_campo).toBe(123);
    });

    it('debe manejar espacios en blanco alrededor de strings', () => {
      const data = {
        monto: '  1000.5  ',
        fecha_pago: '  2023-10-27  ',
        referencia: '  REF-123  ',
        hora_transaccion: '  14:30:00  ',
        faltan_datos: false,
      };

      const normalized = normalizeStructuredData(data);

      expect(normalized.monto).toBe('1000.5');
      expect(normalized.fecha_pago).toBe('2023-10-27');
      expect(normalized.monto).not.toContain(' ');
    });
  });

  describe('Validación completa del flujo', () => {
    it('flujo OpenAI: JSON.parse() números → normalización → validación', () => {
      // Simular lo que hace OpenAI
      const jsonResponse = `{
        "monto": 1500.15,
        "fecha_pago": "2023-10-27",
        "referencia": "OPENAI-REF",
        "hora_transaccion": "14:30:00",
        "faltan_datos": false
      }`;

      const parsed = JSON.parse(jsonResponse);
      const normalized = normalizeStructuredData(parsed);

      // Ahora debe ser seguro para validación
      expect(typeof normalized.monto).toBe('string');
      expect(() => normalized.monto.trim()).not.toThrow();

      // Debe funcionar con split para extractCentavos
      const parts = normalized.monto.split('.');
      expect(parseInt(parts[1], 10)).toBe(15);
    });

    it('flujo Vertex: JSON.parse() → normalización → validación', () => {
      const jsonResponse = `{
        "monto": "2000.33",
        "fecha_pago": "2023-10-27",
        "referencia": "VERTEX-REF",
        "hora_transaccion": "10:45:00",
        "faltan_datos": false
      }`;

      const parsed = JSON.parse(jsonResponse);
      const normalized = normalizeStructuredData(parsed);

      expect(typeof normalized.monto).toBe('string');
      expect(() => normalized.monto.trim()).not.toThrow();

      const parts = normalized.monto.split('.');
      expect(parseInt(parts[1], 10)).toBe(33);
    });
  });
});

// Helper para dummy data
function getDummyData() {
  return {
    monto: '100.1',
    fecha_pago: '2023-10-27',
    referencia: 'REF-000',
    hora_transaccion: '12:00:00',
    faltan_datos: false,
  };
}
