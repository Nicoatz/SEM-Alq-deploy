export type TipoReclamoNombreDTO =
  | 'pintura'
  | 'reparacion_inmueble'
  | 'reparacion_artefactos'
  | 'cobros'
  | 'otro';

export interface TipoReclamoDTO {
  id: number;
  nombre: TipoReclamoNombreDTO;
  descripcion: string;
}

export interface FotoReclamoPayloadDTO {
  url: string;
  peso_kb: number;
  formato: string;
  orden?: number;
}

export interface FotoReclamoDTO {
  id: number;
  id_reclamo: number;
  url: string;
  peso_kb: number;
  formato: string;
  orden: number;
}

export interface RegistrarReclamoRequest {
  id_inmueble: number;
  id_tipo_reclamo?: number;
  tipo_reclamo?: TipoReclamoNombreDTO;
  titulo?: string;
  mensaje: string;
  fotos?: FotoReclamoPayloadDTO[];
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
  tipo_reclamo: TipoReclamoDTO;
  estado: string;
  fotos: FotoReclamoDTO[];
  inmueble?: {
    id: number;
    direccion: string;
    numero: number;
    piso?: string | null;
    barrio: string;
    ciudad: string;
  } | null;
}
