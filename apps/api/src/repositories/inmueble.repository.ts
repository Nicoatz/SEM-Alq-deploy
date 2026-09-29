import {
  InmuebleDTO,
  FotoInmuebleDTO,
  CreateFotoDTO,
  InmuebleXTagDTO,
  TagInmuebleDTO,
  FiltrosMisAlquileresDTO
} from '../dtos';
import { lookupRepository } from './lookup.repository';

export interface IInmuebleRepository {
  findAll(): Promise<InmuebleDTO[]>;
  findById(id: number): Promise<InmuebleDTO | null>;
  findByLocadorId(locadorId: number, filtros?: FiltrosMisAlquileresDTO): Promise<InmuebleDTO[]>;
  findBarriosByLocadorId(locadorId: number): Promise<string[]>;
  create(data: Omit<InmuebleDTO, 'id' | 'created_at'>): Promise<InmuebleDTO>;
  delete(id: number): Promise<boolean>;
  addFotos(idInmueble: number, fotos: CreateFotoDTO[]): Promise<FotoInmuebleDTO[]>;
  getFotosByInmuebleId(idInmueble: number): Promise<FotoInmuebleDTO[]>;
  addTags(idInmueble: number, tagIds: number[]): Promise<void>;
  getTagsByInmuebleId(idInmueble: number): Promise<TagInmuebleDTO[]>;
  poseeReclamosNoResueltos(idInmueble: number): Promise<boolean>;
}

export class InmuebleRepository implements IInmuebleRepository {
  private nextId = 10;
  private nextFotoId = 10;
  private nextTagRelId = 10;

  private inmuebles: InmuebleDTO[] = [
    {
      id: 1,
      id_locador: 1, // Carlos
      tipo: 1, // Departamento
      descripcion: 'Hermoso departamento luminoso con balcón',
      provincia: 'Córdoba',
      ciudad: 'Córdoba',
      barrio: 'Alberdi',
      direccion: 'Av. Colón',
      numero: 1550,
      piso: '4B',
      m2_totales: 70,
      m2_cubiertos: 65,
      ambientes: 3,
      dormitorios: 2,
      banos: 1,
      antiguedad: 5,
      precio_publicado: 360000.0,
      estado_alquiler: 'publicado',
      fecha_disponible: null,
      servicios: 4,
      created_at: new Date('2026-09-01T09:00:00Z')
    },
    {
      id: 2,
      id_locador: 1, // Carlos
      tipo: 1, // Departamento
      descripcion: 'Departamento en Nueva Córdoba',
      provincia: 'Córdoba',
      ciudad: 'Córdoba',
      barrio: 'Nueva Córdoba',
      direccion: 'Bv. Chacabuco',
      numero: 720,
      piso: '2A',
      m2_totales: 52,
      m2_cubiertos: 48,
      ambientes: 2,
      dormitorios: 1,
      banos: 1,
      antiguedad: 3,
      precio_publicado: 290000.0,
      estado_alquiler: 'alquilado',
      fecha_disponible: '2028-03-01',
      servicios: 1,
      created_at: new Date('2026-02-10T10:00:00Z')
    }
  ];

  private fotos: FotoInmuebleDTO[] = [
    { id: 1, id_inmueble: 1, url: 'https://rentar.com/fotos/1-frente.jpg', es_principal: true, peso_kb: 180, formato: 'jpg', orden: 1 },
    { id: 2, id_inmueble: 1, url: 'https://rentar.com/fotos/1-living.jpg', es_principal: false, peso_kb: 210, formato: 'jpg', orden: 2 },
    { id: 3, id_inmueble: 1, url: 'https://rentar.com/fotos/1-dormitorio.png', es_principal: false, peso_kb: 320, formato: 'png', orden: 3 },
    { id: 4, id_inmueble: 2, url: 'https://rentar.com/fotos/2-portada.jpg', es_principal: true, peso_kb: 195, formato: 'jpg', orden: 1 },
    { id: 5, id_inmueble: 2, url: 'https://rentar.com/fotos/2-comedor.jpg', es_principal: false, peso_kb: 250, formato: 'jpg', orden: 2 },
    { id: 6, id_inmueble: 2, url: 'https://rentar.com/fotos/2-cocina.png', es_principal: false, peso_kb: 280, formato: 'png', orden: 3 }
  ];

  private inmuebleXTags: InmuebleXTagDTO[] = [
    { id: 1, id_inmueble: 1, id_tag: 1 }, // Acepta mascotas
    { id: 2, id_inmueble: 1, id_tag: 4 }, // Balcón
    { id: 3, id_inmueble: 2, id_tag: 2 }  // Con cochera
  ];

  async findAll(): Promise<InmuebleDTO[]> {
    return this.inmuebles.map(i => ({ ...i }));
  }

  async findById(id: number): Promise<InmuebleDTO | null> {
    const inm = this.inmuebles.find(i => i.id === id);
    return inm ? { ...inm } : null;
  }

  async findByLocadorId(locadorId: number, filtros?: FiltrosMisAlquileresDTO): Promise<InmuebleDTO[]> {
    return this.inmuebles
      .filter(i => {
        if (i.id_locador !== locadorId) return false;
        if (filtros?.barrio && i.barrio !== filtros.barrio) return false;
        if (filtros?.tipo !== undefined && i.tipo !== filtros.tipo) return false;
        if (filtros?.estado && i.estado_alquiler !== filtros.estado) return false;
        return true;
      })
      .map(i => ({ ...i }));
  }

  async findBarriosByLocadorId(locadorId: number): Promise<string[]> {
    return [...new Set(
      this.inmuebles
        .filter(inmueble => inmueble.id_locador === locadorId)
        .map(inmueble => inmueble.barrio)
    )].sort((a, b) => a.localeCompare(b));
  }

  async create(data: Omit<InmuebleDTO, 'id' | 'created_at'>): Promise<InmuebleDTO> {
    const nuevoId = ++this.nextId;
    const nuevoInmueble: InmuebleDTO = {
      ...data,
      id: nuevoId,
      created_at: new Date()
    };
    this.inmuebles.push(nuevoInmueble);
    return { ...nuevoInmueble };
  }

  async update(id: number, data: Partial<InmuebleDTO>): Promise<InmuebleDTO | null> {
    const index = this.inmuebles.findIndex(i => i.id === id);
    if (index === -1) return null;
    this.inmuebles[index] = { ...this.inmuebles[index], ...data };
    return { ...this.inmuebles[index] };
  }

  async delete(id: number): Promise<boolean> {
    const index = this.inmuebles.findIndex(i => i.id === id);
    if (index === -1) return false;
    this.inmuebles.splice(index, 1);
    this.fotos = this.fotos.filter(f => f.id_inmueble !== id);
    this.inmuebleXTags = this.inmuebleXTags.filter(t => t.id_inmueble !== id);
    return true;
  }

  /**
   * Agrega fotos al inmueble aplicando la regla de foto principal y orden
   */
  async addFotos(idInmueble: number, fotos: CreateFotoDTO[]): Promise<FotoInmuebleDTO[]> {
    // Si ninguna foto viene con es_principal: true, la primera (fotos[0]) es principal por defecto
    const tienePrincipal = fotos.some(f => f.es_principal === true);

    const creadas: FotoInmuebleDTO[] = [];
    fotos.forEach((f, idx) => {
      const esPrincipal = tienePrincipal ? Boolean(f.es_principal) : (idx === 0);
      const nuevaFoto: FotoInmuebleDTO = {
        id: ++this.nextFotoId,
        id_inmueble: idInmueble,
        url: f.url,
        es_principal: esPrincipal,
        peso_kb: f.peso_kb,
        formato: f.formato.toLowerCase(),
        orden: idx + 1
      };
      this.fotos.push(nuevaFoto);
      creadas.push({ ...nuevaFoto });
    });

    return creadas;
  }

  async getFotosByInmuebleId(idInmueble: number): Promise<FotoInmuebleDTO[]> {
    return this.fotos
      .filter(f => f.id_inmueble === idInmueble)
      .sort((a, b) => a.orden - b.orden)
      .map(f => ({ ...f }));
  }

  async addTags(idInmueble: number, tagIds: number[]): Promise<void> {
    for (const tagId of tagIds) {
      this.inmuebleXTags.push({
        id: ++this.nextTagRelId,
        id_inmueble: idInmueble,
        id_tag: tagId
      });
    }
  }

  async getTagsByInmuebleId(idInmueble: number): Promise<TagInmuebleDTO[]> {
    const rels = this.inmuebleXTags.filter(r => r.id_inmueble === idInmueble);
    const resultado: TagInmuebleDTO[] = [];
    for (const r of rels) {
      const tag = await lookupRepository.getTagById(r.id_tag);
      if (tag) resultado.push(tag);
    }
    return resultado;
  }

  async poseeReclamosNoResueltos(_idInmueble: number): Promise<boolean> {
    return false;
  }
}

export const inmuebleRepository = new InmuebleRepository();
