import type { CreateFotoDTO, FotoInmuebleDTO } from './foto-inmueble.dto';
import type { CreateContratoCondicionesDTO } from './contrato.dto';
import type {
  CreateInmuebleCompletoPayload,
  EstadoAlquiler as SharedEstadoAlquiler,
  Inmueble as SharedInmueble,
  InmuebleXTag as SharedInmuebleXTag,
  MisAlquileresItem
} from '@rentar/shared-types';

export type EstadoAlquiler = SharedEstadoAlquiler;
export type InmuebleDTO = SharedInmueble;
export type InmuebleXTagDTO = SharedInmuebleXTag;

export interface InmuebleDetalleDTO {
  id: number;

  tipo: {
    id: number;
    descripcion: string;
  };

  direccion: string;
  numero: number;
  piso?: string | null;
  ciudad: string;
  barrio: string;
  provincia: string;

  ambientes: number;
  dormitorios: number;
  banos: number;

  m2_totales: number;
  m2_cubiertos: number;

  descripcion?: string | null;

  precio: number | null;
  expensas: number | null;

  indice_ajuste: {
    id: number;
    descripcion: string;
  } | null;

  fecha_disponible?: string | null;

  tags: {
    id: number;
    descripcion: string;
  }[];

  servicio: {
    id: number;
    nombre: string;
    descripcion?: string | null;
  } | null;

  fotos: {
    id: number;
    url: string;
    es_principal: boolean;
    orden: number;
  }[];
}

export interface CreateInmuebleDTO {
  tipo: number;
  descripcion?: string | null;
  provincia?: string;
  ciudad: string;
  barrio?: string;
  direccion: string;
  numero: number;
  piso?: string | null;
  m2?: number;
  m2_totales?: number;
  m2_cubiertos?: number;
  ambientes: number;
  dormitorios: number;
  banos: number;
  antiguedad?: number | null;
  precio_publicado?: number;
  estado_alquiler?: EstadoAlquiler;
  fecha_disponible?: string | null;
  servicios?: number | null;
  id_locador?: number;
  tags?: number | number[];
}

export interface UpdateInmuebleDTO {
  tipo?: number;
  descripcion?: string | null;
  provincia?: string;
  ciudad?: string;
  barrio?: string;
  direccion?: string;
  numero?: number;
  piso?: string | null;
  m2_totales?: number;
  m2_cubiertos?: number;
  ambientes?: number;
  dormitorios?: number;
  banos?: number;
  antiguedad?: number | null;
  precio_publicado?: number;
  fecha_disponible?: string | null;
  servicios?: number | null;

  // Colecciones completas para reemplazar las existentes
  fotos?: CreateFotoDTO[];
  tags?: number[];
}

export type CreateInmuebleCompletoDTO = CreateInmuebleCompletoPayload;
export type MisAlquileresDTO = MisAlquileresItem;
export type { Reclamo as ReclamoDTO } from '@rentar/shared-types';

export interface FiltrosMisAlquileresDTO {
  barrio?: string;
  tipo?: number;
  estado?: EstadoAlquiler;
  reclamos?: boolean;
}

export interface FiltrosInmueblesDisponiblesDTO {
  barrio?: string;
  precioMin?: number;
  precioMax?: number;
  tipo?: number;
  dormitorios?: number;
  ambientes?: number;
  superficieMin?: number;
  superficieMax?: number;
  tags?: number[];
  indiceAjuste?: number;

  page?: number;
  limit?: number;

  orden?: 'precio' | 'dormitorios' | 'm2';
  direccion?: 'asc' | 'desc';
}

export interface InmuebleDisponibleDTO {
  id: number;

  tipo: {
    id: number;
    descripcion: string;
  };

  direccion: string;
  numero: number;
  piso?: string | null;
  ciudad: string;
  barrio: string;
  provincia: string;

  ambientes: number;
  dormitorios: number;
  banos: number;

  m2_totales: number;
  m2_cubiertos: number;

  descripcion?: string | null;

  precio: number;
  expensas: number;

  indice_ajuste: {
    id: number;
    descripcion: string;
  } | null;

  fecha_disponible?: string | null;

  tags: {
    id: number;
    descripcion: string;
  }[];

  foto_principal: string | null;
}

export interface InmueblesDisponiblesResultadoDTO {
  items: InmuebleDisponibleDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
