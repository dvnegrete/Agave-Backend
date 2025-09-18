import { resolveBankStatementModel } from './model-resolver';
import { SantanderXlsxModel } from './santander-xlsx.model';
import { GenericCsvModel } from './generic-csv.model';

describe('model-resolver', () => {
  it('debe resolver por nombre explícito del modelo', () => {
    const model = resolveBankStatementModel('SantanderXlsx');
    expect(model).toBe(SantanderXlsxModel);
  });

  it('debe resolver GenericCsv por nombre explícito', () => {
    const model = resolveBankStatementModel('GenericCsv');
    expect(model).toBe(GenericCsvModel);
  });

  it('debe resolver por bankName y extensión para XLSX', () => {
    const model = resolveBankStatementModel(undefined, {
      bankName: 'Santander México',
      fileExtension: 'xlsx',
    });
    expect(model).toBe(SantanderXlsxModel);
  });

  it('debe usar GenericCsv para archivos CSV', () => {
    const model = resolveBankStatementModel(undefined, {
      bankName: 'Banco Desconocido',
      fileExtension: 'csv',
    });
    expect(model).toBe(GenericCsvModel);
  });

  it('debe usar fallback (SantanderXlsx) para extensiones no-CSV', () => {
    const model = resolveBankStatementModel(undefined, {
      bankName: 'Banco Desconocido',
      fileExtension: 'xlsx',
    });
    expect(model).toBe(SantanderXlsxModel);
  });
});
