import type {
  CrearSolicitudRequest as SharedCrearSolicitudRequest,
  EstadoSolicitud as SharedEstadoSolicitud,
  SituacionOcupacional as SharedSituacionOcupacional,
  Solicitud as SharedSolicitud,
  SolicitudResponse as SharedSolicitudResponse,
  TipoGarantia as SharedTipoGarantia
} from '@rentar/shared-types';

export type EstadoSolicitudDTO = SharedEstadoSolicitud;
export type SituacionOcupacionalDTO = SharedSituacionOcupacional;
export type TipoGarantiaDTO = SharedTipoGarantia;
export type SolicitudDTO = SharedSolicitud;
export type CrearSolicitudRequest = SharedCrearSolicitudRequest;
export type SolicitudResponse = SharedSolicitudResponse;
