import { Test, TestingModule } from '@nestjs/testing';
import { ConceptHouseExtractorService } from './concept-house-extractor.service';
import { ReconciliationConfig } from '../../config/reconciliation.config';

describe('ConceptHouseExtractorService', () => {
  let service: ConceptHouseExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConceptHouseExtractorService],
    }).compile();

    service = module.get<ConceptHouseExtractorService>(
      ConceptHouseExtractorService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractHouseNumber', () => {
    describe('Patrones explícitos con "casa"', () => {
      it('debería extraer "Casa 5"', () => {
        const result = service.extractHouseNumber('Pago Casa 5 mantenimiento');
        expect(result.houseNumber).toBe(5);
        expect(result.confidence).toBe('high');
        expect(result.method).toBe('regex');
      });

      it('debería extraer "Casa #50"', () => {
        const result = service.extractHouseNumber('Transferencia Casa #50');
        expect(result.houseNumber).toBe(50);
        expect(result.confidence).toBe('high');
      });

      it('debería extraer "Casa-1"', () => {
        const result = service.extractHouseNumber('Pago Casa-1 agua');
        expect(result.houseNumber).toBe(1);
        expect(result.confidence).toBe('high');
      });

      it('debería ser case-insensitive', () => {
        const result = service.extractHouseNumber('Pago CASA 64 cuota');
        expect(result.houseNumber).toBe(64);
        expect(result.confidence).toBe('high');
      });
    });

    describe('Abreviaturas con "c"', () => {
      it('debería extraer "c5"', () => {
        const result = service.extractHouseNumber('Pago c5 enero');
        expect(result.houseNumber).toBe(5);
        expect(result.confidence).toBe('high');
      });

      it('debería extraer "c50"', () => {
        const result = service.extractHouseNumber('Transferencia c50 febrero');
        expect(result.houseNumber).toBe(50);
        expect(result.confidence).toBe('high');
      });

      it('debería extraer "c-1"', () => {
        const result = service.extractHouseNumber('Pago c-1 marzo');
        expect(result.houseNumber).toBe(1);
        expect(result.confidence).toBe('high');
      });

      it('debería extraer "c 64"', () => {
        const result = service.extractHouseNumber('Cuota c 64');
        expect(result.houseNumber).toBe(64);
        expect(result.confidence).toBe('high');
      });
    });

    describe('Abreviaturas con "cs"', () => {
      it('debería extraer "cs02"', () => {
        const result = service.extractHouseNumber('Pago cs02 abril');
        expect(result.houseNumber).toBe(2);
        expect(result.confidence).toBe('medium');
      });

      it('debería extraer "cs-10"', () => {
        const result = service.extractHouseNumber('Administración cs-10');
        expect(result.houseNumber).toBe(10);
        expect(result.confidence).toBe('medium');
      });
    });

    describe('Apartamentos', () => {
      it('debería extraer "apto 5"', () => {
        const result = service.extractHouseNumber('Pago apto 5');
        expect(result.houseNumber).toBe(5);
        expect(result.confidence).toBe('high');
      });

      it('debería extraer "apt #15"', () => {
        const result = service.extractHouseNumber('Cuota apt #15');
        expect(result.houseNumber).toBe(15);
        expect(result.confidence).toBe('high');
      });

      it('debería extraer "apart. 22"', () => {
        const result = service.extractHouseNumber('Pago apart. 22 mayo');
        expect(result.houseNumber).toBe(22);
        expect(result.confidence).toBe('high');
      });
    });

    describe('Información adicional - Meses', () => {
      it('debería extraer mes "enero"', () => {
        const result = service.extractHouseNumber('Pago casa 5 enero');
        expect(result.month?.monthNumber).toBe(1);
        expect(result.month?.monthName).toBe('Enero');
      });

      it('debería extraer mes "febrero"', () => {
        const result = service.extractHouseNumber('c50 febrero cuota');
        expect(result.month?.monthNumber).toBe(2);
        expect(result.month?.monthName).toBe('Febrero');
      });

      it('debería extraer número de mes "03"', () => {
        const result = service.extractHouseNumber('Casa 1 mes 03');
        expect(result.month?.monthNumber).toBe(3);
      });

      it('no debería extraer mes inválido', () => {
        const result = service.extractHouseNumber('Pago casa 5 mes 13');
        expect(result.month).toBeUndefined();
      });
    });

    describe('Información adicional - Tipo de pago', () => {
      it('debería identificar "mantenimiento"', () => {
        const result = service.extractHouseNumber('Casa 5 mantenimiento enero');
        expect(result.paymentType?.type).toBe('mantenimiento');
      });

      it('debería identificar "agua"', () => {
        const result = service.extractHouseNumber('c50 pago agua');
        expect(result.paymentType?.type).toBe('agua');
      });

      it('debería identificar "luz"', () => {
        const result = service.extractHouseNumber('Apto 10 pago luz');
        expect(result.paymentType?.type).toBe('luz');
      });

      it('debería identificar "cuota"', () => {
        const result = service.extractHouseNumber('Casa 1 cuota enero');
        expect(result.paymentType?.type).toBe('cuota');
      });

      it('debería identificar "administración"', () => {
        const result = service.extractHouseNumber('Pago administración c25');
        expect(result.paymentType?.type).toBe('administración');
      });

      it('debería identificar "condominio"', () => {
        const result = service.extractHouseNumber('Casa 5 pago condominio');
        expect(result.paymentType?.type).toBe('condominio');
      });
    });

    describe('Casos sin coincidencia clara', () => {
      it('debería retornar null para concepto vacío', () => {
        const result = service.extractHouseNumber('');
        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
      });

      it('debería retornar null para concepto con solo espacios', () => {
        const result = service.extractHouseNumber('   ');
        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
      });

      it('debería retornar null para concepto sin número de casa', () => {
        const result = service.extractHouseNumber(
          'Transferencia bancaria general',
        );
        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
      });

      it('debería rechazar números fuera de rango válido', () => {
        const result = service.extractHouseNumber('Casa 100 pago');
        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
      });

      it('debería rechazar número 0', () => {
        const result = service.extractHouseNumber('Casa 0 pago');
        expect(result.houseNumber).toBeNull();
        expect(result.confidence).toBe('none');
      });
    });

    describe('Casos complejos', () => {
      it('debería extraer la primera coincidencia válida', () => {
        const result = service.extractHouseNumber(
          'Pago casa 5 y casa 10 mantenimiento',
        );
        expect(result.houseNumber).toBe(5);
      });

      it('debería preservar información incluso sin mes', () => {
        const result = service.extractHouseNumber(
          'Apto 15 sin información de mes',
        );
        expect(result.houseNumber).toBe(15);
        expect(result.month).toBeUndefined();
      });

      it('debería manejar conceptos con caracteres especiales', () => {
        const result = service.extractHouseNumber('Pago...CASA-5...!!');
        expect(result.houseNumber).toBe(5);
        expect(result.confidence).toBe('high');
      });

      it('debería extraer casa con múltiples indicadores', () => {
        const result = service.extractHouseNumber('Casa 5 enero mantenimiento');
        expect(result.houseNumber).toBe(5);
        expect(result.month?.monthNumber).toBe(1);
        expect(result.paymentType?.type).toBe('mantenimiento');
      });
    });
  });

  describe('isValidHouseNumber', () => {
    it('debería validar número válido', () => {
      expect(service.isValidHouseNumber(5)).toBe(true);
      expect(service.isValidHouseNumber(1)).toBe(true);
      expect(service.isValidHouseNumber(66)).toBe(true);
    });

    it('debería rechazar número 0', () => {
      expect(service.isValidHouseNumber(0)).toBe(false);
    });

    it('debería rechazar número negativo', () => {
      expect(service.isValidHouseNumber(-5)).toBe(false);
    });

    it('debería rechazar número mayor al máximo', () => {
      expect(service.isValidHouseNumber(67)).toBe(false);
      expect(service.isValidHouseNumber(100)).toBe(false);
    });
  });

  describe('isConfidenceAboveOrEqual', () => {
    it('high debería ser >= high', () => {
      expect(service.isConfidenceAboveOrEqual('high', 'high')).toBe(true);
    });

    it('high debería ser >= medium', () => {
      expect(service.isConfidenceAboveOrEqual('high', 'medium')).toBe(true);
    });

    it('medium debería ser < high', () => {
      expect(service.isConfidenceAboveOrEqual('medium', 'high')).toBe(false);
    });

    it('medium debería ser >= medium', () => {
      expect(service.isConfidenceAboveOrEqual('medium', 'medium')).toBe(true);
    });

    it('low debería ser < medium', () => {
      expect(service.isConfidenceAboveOrEqual('low', 'medium')).toBe(false);
    });

    it('none debería ser la menor confianza', () => {
      expect(service.isConfidenceAboveOrEqual('none', 'low')).toBe(false);
    });
  });

  describe('getMinimumConfidenceLevel', () => {
    it('debería retornar el nivel mínimo configurado', () => {
      const minLevel = service.getMinimumConfidenceLevel();
      expect(['high', 'medium', 'low']).toContain(minLevel);
    });

    it('debería coincidir con ReconciliationConfig', () => {
      const configLevel = ReconciliationConfig.CONCEPT_MATCHING_MIN_CONFIDENCE;
      const serviceLevel = service.getMinimumConfidenceLevel();
      expect(serviceLevel).toBe(configLevel);
    });
  });
});
