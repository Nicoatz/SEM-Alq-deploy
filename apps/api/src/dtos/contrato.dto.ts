export type {
  Contrato as ContratoDTO,
  CreateContratoCondicionesPayload as CreateContratoCondicionesDTO
} from '@rentar/shared-types';

// ─── US-05: borrador del contrato ───

export type PeriodicidadAjuste = 'trimestral' | 'semestral' | 'anual';

/** Garante: dato del contrato, no es usuario de la plataforma (US-05, paso 1). */
export interface GaranteRequest {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
}

/** Condiciones editables del paso 2. Solo viajan las que cambian. */
export interface CondicionesBorradorRequest {
  fecha_inicio_contrato?: string | null;
  /** `null` borra el valor: un borrador puede estar incompleto (se exige al enviar a firmar). */
  duracion_meses?: number | null;
  monto_alquiler?: number | null;
  deposito?: number | null;
  /** Plazo de pago en días (1 a 28), como lo usa US-27. No es el día del mes. */
  dias_para_vencimiento?: number | null;
  /** `null` = "Sin ajuste". */
  indice_aumento?: number | null;
  frecuencia_ajuste?: PeriodicidadAjuste | null;
}

/**
 * `PATCH /contratos/:id`: guarda el borrador desde cualquier paso. Todas las claves son
 * opcionales y solo se toca lo que viene; `garantes` reemplaza la lista completa. El PDF del
 * contrato (paso 3) no viaja acá: se sube con `POST /contratos/:id/pdf/url-subida` y se registra
 * con `PUT /contratos/:id/pdf`.
 */
export interface GuardarBorradorRequest {
  paso?: number;
  condiciones?: CondicionesBorradorRequest;
  garantes?: GaranteRequest[];
}

/** Respuesta de `POST /contratos/:id/pdf/url-subida`: datos para subir el PDF directo a Storage. */
export interface UrlSubidaPdfResponse {
  /** Ruta que hay que devolver al registrar el PDF. */
  path: string;
  /** Token de la subida (para `uploadToSignedUrl` de supabase-js). */
  token: string;
  /** URL firmada de subida (para un `PUT` directo, si no se usa supabase-js). */
  url_firmada: string;
  tamano_maximo_bytes: number;
}

/** Cuerpo de `PUT /contratos/:id/pdf`: avisa que el archivo ya se subió a la ruta indicada. */
export interface RegistrarPdfRequest {
  path: string;
  /** Nombre del archivo original, para mostrarlo en la pantalla de carga. */
  nombre: string;
}

/** El PDF del contrato cargado en el paso 3. */
export interface ContratoPdfResponse {
  nombre: string;
  tamano_bytes: number;
  subido_en: string;
  /** URL firmada de descarga (vence a los pocos minutos): para la vista previa del paso 4. */
  url: string;
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
    /** `null` si el borrador todavía no tiene monto. */
    monto_alquiler: number | null;
    deposito: number | null;
    /** Plazo de pago en días (1 a 28), como lo usa US-27. No es el día del mes. */
    dias_para_vencimiento: number | null;
    indice_aumento: number | null;
    frecuencia_ajuste: string | null;
    /** De la publicación; el paso 2 los muestra en solo lectura. */
    medios_pago: number[];
    dias_gracia: number | null;
    interes_por_dia: number | null;
  };
  /** El contrato en PDF (paso 3). `null` mientras no se cargó. */
  pdf: ContratoPdfResponse | null;
  /** De 1 a 4, para retomar el borrador donde quedó. */
  ultimo_paso: number | null;
}
