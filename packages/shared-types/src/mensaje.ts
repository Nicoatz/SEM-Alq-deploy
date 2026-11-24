/**
 * Tipos de dominio para el módulo de Mensajería (US-24: Enviar mensajes).
 */

export type TipoTemaConversacion = 'general' | 'inmueble' | 'reclamo' | 'contrato';

export interface Conversacion {
  id: number;
  id_locador: number;
  id_locatario: number;
  iniciado_por: number;
  tipo_tema: TipoTemaConversacion;
  asunto: string;
  id_inmueble?: number | null;
  id_reclamo?: number | null;
  id_contrato?: number | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface Mensaje {
  id: number;
  id_conversacion: number;
  id_emisor: number;
  contenido: string;
  fecha_envio: string;
  eliminado: boolean;
  fecha_eliminacion?: string | null;
}

export interface ParticipanteConversacion {
  id: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  telefono?: string | null;
}

export interface ConversacionResumen {
  id: number;
  id_locador: number;
  id_locatario: number;
  iniciado_por: number;
  tipo_tema: TipoTemaConversacion;
  asunto: string;
  id_inmueble?: number | null;
  id_reclamo?: number | null;
  id_contrato?: number | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  otro_participante: ParticipanteConversacion;
  ultimo_mensaje?: {
    id: number;
    contenido: string;
    fecha_envio: string;
    id_emisor: number;
    eliminado: boolean;
  } | null;
  total_mensajes?: number;
}

export interface ConversacionDetalle extends ConversacionResumen {
  locador: ParticipanteConversacion;
  locatario: ParticipanteConversacion;
  inmueble?: {
    id: number;
    direccion: string;
    numero: number;
    piso?: string | null;
    barrio: string;
    ciudad: string;
  } | null;
}

export interface CrearConversacionPayload {
  id_destinatario: number;
  asunto: string;
  tipo_tema?: TipoTemaConversacion;
  id_inmueble?: number;
  id_reclamo?: number;
  id_contrato?: number;
  primer_mensaje?: string;
}

export interface EnviarMensajePayload {
  contenido: string;
}
