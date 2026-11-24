/**
 * Tipos de dominio para el módulo de Reclamos (US-14 Registrar reclamo, US-15 Consultar reclamos).
 */

export type TipoReclamoNombre =
  | 'pintura'
  | 'reparacion_inmueble'
  | 'reparacion_artefactos'
  | 'cobros'
  | 'otro';

export interface TipoReclamo {
  id: number;
  nombre: TipoReclamoNombre;
  descripcion: string;
}

export interface FotoReclamo {
  id: number;
  id_reclamo: number;
  url: string;
  peso_kb: number;
  formato: string;
  orden: number;
}

export interface FotoReclamoPayload {
  url: string;
  peso_kb: number;
  formato: string;
  orden?: number;
}

export interface RegistrarReclamoPayload {
  id_inmueble: number;
  id_tipo_reclamo?: number;
  tipo_reclamo?: TipoReclamoNombre;
  titulo?: string;
  mensaje: string;
  fotos?: FotoReclamoPayload[];
}

export interface ParticipanteReclamo {
  id: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  telefono?: string | null;
}

export interface InmuebleReclamo {
  id: number;
  direccion: string;
  numero: number;
  piso?: string | null;
  barrio: string;
  ciudad: string;
  foto_principal?: string | null;
}

export interface ReclamoResponse {
  id: number;
  id_inmueble: number;
  id_locatario: number;
  id_contrato: number;
  id_tipo_reclamo: number;
  id_estado_reclamo: number;
  titulo: string;
  descripcion: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  tipo_reclamo: TipoReclamo;
  estado: string;
  fotos: FotoReclamo[];
  inmueble: InmuebleReclamo;
  locador: ParticipanteReclamo;
  locatario: ParticipanteReclamo;
}

export type ReclamoRegistrado = ReclamoResponse;

export interface FiltrosReclamosPayload {
  rol?: 'locador' | 'locatario';
  estado?: string;
  id_inmueble?: number;
}
