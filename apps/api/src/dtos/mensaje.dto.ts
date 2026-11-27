export type TipoTemaConversacionDTO = 'general' | 'inmueble' | 'reclamo' | 'contrato';

export interface CrearConversacionRequest {
  id_destinatario: number;
  asunto: string;
  tipo_tema?: TipoTemaConversacionDTO;
  id_inmueble?: number;
  id_reclamo?: number;
  id_contrato?: number;
  primer_mensaje?: string;
}

export interface EnviarMensajeRequest {
  contenido: string;
}

export interface ParticipanteConversacionDTO {
  id: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  telefono?: string | null;
}

export interface MensajeDTO {
  id: number;
  id_conversacion: number;
  id_emisor: number;
  contenido: string;
  fecha_envio: string;
  eliminado: boolean;
  fecha_eliminacion?: string | null;
}

export interface MensajeResponse extends MensajeDTO {
  es_propio: boolean;
  emisor?: ParticipanteConversacionDTO;
}

export interface InmuebleConversacionDTO {
  id: number;
  direccion: string;
  numero: number;
  piso?: string | null;
  barrio: string;
  ciudad: string;
  foto_principal: string | null;
}

export interface ConversacionDTO {
  id: number;
  id_locador: number;
  id_locatario: number;
  iniciado_por: number;
  tipo_tema: TipoTemaConversacionDTO;
  asunto: string;
  id_inmueble?: number | null;
  id_reclamo?: number | null;
  id_contrato?: number | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface ConversacionResponse extends ConversacionDTO {
  otro_participante: ParticipanteConversacionDTO;
  inmueble?: InmuebleConversacionDTO | null;
  ultimo_mensaje?: {
    id: number;
    contenido: string;
    fecha_envio: string;
    id_emisor: number;
    eliminado: boolean;
  } | null;
  total_mensajes?: number;
}

export interface ConversacionDetalleResponse extends ConversacionResponse {
  locador: ParticipanteConversacionDTO;
  locatario: ParticipanteConversacionDTO;
  inmueble?: {
    id: number;
    direccion: string;
    numero: number;
    piso?: string | null;
    barrio: string;
    ciudad: string;
    foto_principal: string | null;
  } | null;
}
