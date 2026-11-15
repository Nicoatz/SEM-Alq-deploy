import { normalizeCobrosRelation } from '../../src/repositories/cobro-consulta.repository';

describe('normalizeCobrosRelation', () => {
  it('envuelve un embed objeto como lista', () => {
    const cobro = { id: 17, monto: 250000 };

    expect(normalizeCobrosRelation(cobro)).toEqual([cobro]);
  });

  it('conserva una lista y normaliza ausencia como lista vacía', () => {
    const cobros = [{ id: 17 }, { id: 18 }];

    expect(normalizeCobrosRelation(cobros)).toEqual(cobros);
    expect(normalizeCobrosRelation(null)).toEqual([]);
    expect(normalizeCobrosRelation(undefined)).toEqual([]);
  });
});