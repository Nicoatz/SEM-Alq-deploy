export interface PublicacionDisponibleDTO {
  id: number;
  id_inmueble: number;
  titulo: string;
  precio: number;
  activa: boolean;
  created_at?: Date | string;

  inmueble: {
    id: number;
    tipo: number;
    direccion: string;
    numero: number;
    piso?: string | null;
    ciudad: string;
    ambientes: number;
    dormitorios: number;
    banos: number;
    m2: number;
    descripcion?: string | null;
    tags?: number | null;
    servicios?: number | null;
  };
}

export * from './api-response.dto';
export * from './usuario.dto';
export * from './catalogos.dto';
export * from './foto-inmueble.dto';
export * from './contrato.dto';
export * from './inmueble.dto';
