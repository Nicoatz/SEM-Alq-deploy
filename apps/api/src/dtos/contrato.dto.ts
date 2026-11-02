export type {
  Contrato as ContratoDTO,
  CreateContratoCondicionesPayload as CreateContratoCondicionesDTO
} from '@rentar/shared-types';

// ─── US-05: borrador del contrato ───

export type TipoClausula = 'fija' | 'editable' | 'propia';
export type PeriodicidadAjuste = 'trimestral' | 'semestral' | 'anual';

/** Garante: dato del contrato, no es usuario de la plataforma (US-05, paso 1). */
export interface GaranteRequest {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
}

/** Cláusula tal como se guarda: el back no tiene la plantilla, guarda lo que manda el cliente. */
export interface ClausulaRequest {
  clave: string;
  tipo: TipoClausula;
  titulo: string;
  texto: string;
  editada?: boolean;
}

/** Condiciones editables del paso 2. Solo viajan las que cambian. */
export interface CondicionesBorradorRequest {
  fecha_inicio_contrato?: string | null;
  duracion_meses?: number;
  monto_alquiler?: number;
  deposito?: number | null;
  dias_para_vencimiento?: number;
  /** `null` = "Sin ajuste". */
  indice_aumento?: number | null;
  frecuencia_ajuste?: PeriodicidadAjuste | null;
}

/**
 * `PATCH /contratos/:id`: guarda el borrador desde cualquier paso. Todas las claves son
 * opcionales y solo se toca lo que viene; `garantes` y `clausulas` reemplazan la lista completa.
 */
export interface GuardarBorradorRequest {
  paso?: number;
  condiciones?: CondicionesBorradorRequest;
  garantes?: GaranteRequest[];
  clausulas?: ClausulaRequest[];
}

export type EstadoContratoResponse = 'borrador' | 'pendiente_firma' | 'vigente' | 'finalizado';

export interface ParteContratoResponse {
  id: number;
  nombre: string;
  apellido: string;
  numero_documento: string;
  email: string;
  telefono: string | null;
}

export interface GaranteResponse extends GaranteRequest {
  id: number;
}

export interface ClausulaResponse extends ClausulaRequest {
  editada: boolean;
}

/**
 * El contrato en curso con todo lo que necesita el alta: `GET /contratos/:id` y la respuesta de
 * `PATCH /contratos/:id`. Las partes salen de `usuario`; el cliente no las manda.
 */
export interface ContratoBorradorResponse {
  id: number;
  codigo: string | null;
  estado: EstadoContratoResponse;
  id_solicitud: number | null;
  inmueble: {
    id: number;
    direccion: string;
    numero: number;
    piso: string | null;
    barrio: string;
    precio_publicado: number;
  };
  locador: ParteContratoResponse | null;
  locatario: ParteContratoResponse | null;
  /** Garantías que el locatario ofreció en su solicitud (solo referencia). */
  garantias_ofrecidas: string[];
  garantes: GaranteResponse[];
  condiciones: {
    fecha_inicio_contrato: string | null;
    /** La calcula la base a partir del inicio y la duración; no se envía. */
    fecha_fin_contrato: string | null;
    duracion_meses: number | null;
    monto_alquiler: number;
    deposito: number | null;
    dias_para_vencimiento: number | null;
    indice_aumento: number | null;
    frecuencia_ajuste: string | null;
    /** De la publicación; el paso 2 los muestra en solo lectura. */
    medios_pago: number[];
    dias_gracia: number | null;
    interes_por_dia: number | null;
  };
  clausulas: ClausulaResponse[];
  /** De 1 a 4, para retomar el borrador donde quedó. */
  ultimo_paso: number | null;
}
