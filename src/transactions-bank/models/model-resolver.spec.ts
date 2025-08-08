import { resolveBankStatementModel } from './model-resolver';
import { SantanderXlsxModel } from './santander-xlsx.model';

describe('model-resolver', () => {
  it('debe resolver por nombre explícito del modelo', () => {
    const model = resolveBankStatementModel('SantanderXlsx');
    expect(model).toBe(SantanderXlsxModel);
  });

  it('debe resolver por bankName y extensión', () => {
    const model = resolveBankStatementModel(undefined, { bankName: 'Santander México', fileExtension: 'xlsx' });
    expect(model).toBe(SantanderXlsxModel);
  });

  it('debe usar fallback (SantanderXlsx) cuando no hay coincidencia', () => {
    const model = resolveBankStatementModel(undefined, { bankName: 'Banco Desconocido', fileExtension: 'csv' });
    expect(model).toBe(SantanderXlsxModel);
  });
});


