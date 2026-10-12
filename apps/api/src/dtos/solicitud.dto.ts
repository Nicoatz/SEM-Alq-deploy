export interface EstadoSolicitudDTO {
  id: number;
  nombre: string;
  mensaje?: string | null;
}

export interface SituacionOcupacionalDTO {
  id: number;
  nombre: string;
}

export interface TipoGarantiaDTO {
  id: number;
  nombre: string;
}

export interface SolicitudDTO {
  id: number;
  id_inmueble: number;
  id_locador: number;
  id_locatario: number;
  id_estado_solicitud: number;
  id_situacion_ocupacional: number;
  mensaje?: string | null;
  telefono: string;
  email: string;
  ingresos_aprox: number;
  cantidad_personas: number;
  posee_mascotas: boolean;
  detalles_mascotas?: string | null;
  acepta_condiciones: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CrearSolicitudRequest {
  id_inmueble: number;
  mensaje?: string;
  telefono: string;
  email: string;
  id_situacion_ocupacional: number;
  ingresos_aprox: number;
  cantidad_personas: number;
  posee_mascotas: boolean;
  detalles_mascotas?: string;
  garantias: number[];
  acepta_condiciones: boolean;
}

export interface SolicitudResponse extends SolicitudDTO {
  estado_solicitud: EstadoSolicitudDTO;
  situacion_ocupacional: SituacionOcupacionalDTO;
  garantias: TipoGarantiaDTO[];
}
