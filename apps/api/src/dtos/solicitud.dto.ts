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
  ingresos_aprox: number | null;
  cantidad_personas: number;
  posee_mascotas: boolean;
  detalles_mascotas?: string | null;
  acepta_condiciones: boolean;
  fecha_creacion: string;
  fecha_respuesta?: string | null;
  fecha_actualizacion: string;
}

export interface CrearSolicitudRequest {
  id_inmueble: number;
  mensaje?: string | null;
  telefono: string;
  email: string;
  ocupacion: 'sin_informar' | 'relacion_dependencia' | 'monotributista' | 'autonoma' | 'estudiante' | 'jubilada';
  ingresos: number | null;
  convivientes: number;
  mascotas: boolean;
  detalle_mascotas: string | null;
  garantias: ('propietaria' | 'caucion' | 'otra')[];
  acepta_condiciones: true;
}

export interface SolicitudResponse {
  id: number;
  estado: string;
  mensaje: string | null;
  fecha_creacion: string;
  fecha_respuesta: string | null;
  inmueble: {
    id: number;
    direccion: string;
    numero: number;
    piso?: string | null;
    barrio: string;
    foto_principal: string | null;
  };
  postulante: {
    id: number;
    nombre: string;
    apellido?: string | null;
    dni?: string | null;
    telefono?: string | null;
    email?: string | null;
  };
  legajo: {
    ocupacion: 'sin_informar' | 'relacion_dependencia' | 'monotributista' | 'autonoma' | 'estudiante' | 'jubilada';
    ingresos: number | null;
    convivientes: number;
    mascotas: boolean;
    detalle_mascotas: string | null;
    garantias: ('propietaria' | 'caucion' | 'otra')[];
  } | null;
}

export interface SolicitudPreparacionResponse {
  usuario: {
    id: number;
    nombre: string;
    apellido?: string | null;
    dni?: string | null;
    telefono?: string | null;
    email: string;
  };
  situaciones_ocupacionales: Array<{
    id: number;
    codigo: 'sin_informar' | 'relacion_dependencia' | 'monotributista' | 'autonoma' | 'estudiante' | 'jubilada';
    nombre: string;
  }>;
  garantias: Array<{
    id: number;
    codigo: 'propietaria' | 'caucion' | 'otra';
    nombre: string;
  }>;
  garantias_exigidas: number[];
  valores_iniciales: {
    telefono: string;
    email: string;
    ocupacion: 'sin_informar';
    ingresos: null;
    convivientes: 1;
    mascotas: false;
    detalle_mascotas: null;
    garantias: [];
    acepto: false;
  };
}
