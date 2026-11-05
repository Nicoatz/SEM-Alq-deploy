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

// ─── US-43: contratos de una propiedad del locador ───

/** Índice de ajuste del contrato en el listado; `sin_ajuste` cuando no tiene índice. */
export type IndiceContratoResponse = 'sin_ajuste' | 'ICL' | 'IPC' | 'CAC';

/**
 * Una fila de `GET /inmuebles/:id/contratos` (US-43). Sin DNI ni datos de contacto del locatario
 * ni de los garantes: solo el nombre del locatario. No trae la propiedad: ya es la de la ruta.
 */
export interface ContratoResumenResponse {
  id: number;
  /** `null` en los borradores: el código se asigna al enviar a firmar. */
  codigo: string | null;
  estado: EstadoContratoResponse;
  /** `null` si el contrato todavía no tiene locatario cargado. */
  locatario: { nombre: string; apellido: string } | null;
  /** Último ajuste aplicado o, si no hubo, el monto inicial. `null` en un borrador sin monto. */
  monto_actual: number | null;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
  indice: IndiceContratoResponse;
  /** `null` si no hay ajuste (sin índice, finalizado, sin fecha de inicio o ya no quedan). */
  proximo_ajuste: string | null;
  /** Solicitud de origen; `null` en los contratos anteriores a US-05. */
  id_solicitud: number | null;
  /**
   * Las firmas, igual que en el detalle (US-42): con el contrato pendiente de firma, quién firmó
   * (con fecha y hora) y quién falta; con el vigente, `firmado_por_todos_el`. `null` en un borrador
   * (todavía no se envió a firmar) y en un finalizado (para eso está el detalle).
   */
  firmas: ContratoDetalleResponse['firmas'] | null;
  /**
   * El PDF, con URL firmada que vence a los 5 minutos, igual que en el detalle. Solo en los
   * pendientes de firma y vigentes que tienen archivo; `null` en un borrador (no se descarga), en
   * un finalizado (se descarga desde el detalle) y si no hay archivo.
   */
  pdf: ContratoPdfResponse | null;
}

/**
 * `GET /inmuebles/:id/contratos` (US-43): los contratos de la propiedad y, para la propiedad sin
 * contrato actual, desde qué solicitud se puede iniciar uno.
 */
export interface ContratosInmuebleResponse {
  /** Más reciente primero. Sin la oferta (estado 1). */
  contratos: ContratoResumenResponse[];
  /**
   * Id de la solicitud aceptada de la propiedad que todavía no originó un contrato. Con un id, el
   * cliente ofrece "Iniciar contrato" (`POST /contratos` con ese `id_solicitud`); con `null`, el
   * acceso a las solicitudes de la propiedad. `null` también si la propiedad ya tiene un contrato
   * en curso (borrador, pendiente de firma o vigente).
   */
  solicitud_para_contrato: number | null;
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
  /**
   * US-06: `true` si la fecha de inicio guardada quedó en el pasado (hoy en Córdoba). Hay que
   * pedir una nueva antes de volver a enviar a firmar.
   */
  fecha_inicio_vencida: boolean;
}

// ─── US-06: modificar contrato ───

// ─── US-42: detalle del contrato del locador ───

/**
 * Estado de la firma de un firmante. `sin_registro` es un contrato anterior a RentAR: no hay
 * evidencia de si firmó, y el cliente no debe inventarlo (US-42, "Firmas").
 */
export type EstadoFirmaDetalleResponse = 'pendiente' | 'firmado' | 'rechazado' | 'sin_registro';

export interface FirmanteDetalleResponse {
  rol: 'locador' | 'locatario' | 'garante';
  nombre: string;
  apellido: string;
  estado: EstadoFirmaDetalleResponse;
  /** Fecha y hora de la firma (ISO 8601). `null` si no firmó. */
  fecha_firma: string | null;
  /** Fecha y hora del rechazo (ISO 8601). `null` si no rechazó. */
  fecha_rechazo: string | null;
  motivo_rechazo: string | null;
}

/** Una fecha del calendario de ajustes: el inicio del contrato o un ajuste. */
export interface AjusteCalendarioResponse {
  /** `YYYY-MM-DD`. */
  fecha: string;
  tipo: 'inicio' | 'ajuste';
  /** Monto vigente desde esa fecha. `null` = "a definir" (ajuste futuro, todavía sin aplicar). */
  monto: number | null;
}

/**
 * `GET /contratos/:id/detalle` (US-42): el contrato de un locador, ya armado para la pantalla.
 * Los datos que no están registrados (contratos anteriores a RentAR) vienen en `null`; el cliente
 * los muestra como "Sin dato". Un borrador no tiene detalle (responde 409, ver la ruta).
 */
export interface ContratoDetalleResponse {
  id: number;
  codigo: string | null;
  estado: Exclude<EstadoContratoResponse, 'borrador'>;
  /** Solicitud de origen; `null` en los contratos anteriores a RentAR. */
  id_solicitud: number | null;
  inmueble: {
    id: number;
    direccion: string;
    numero: number;
    piso: string | null;
    barrio: string;
    ciudad: string | null;
  };
  locador: ParteContratoResponse | null;
  locatario: ParteContratoResponse | null;
  /** Garantes: nombre, apellido, DNI y correo (sin teléfono). */
  garantes: GaranteResponse[];
  condiciones: {
    fecha_inicio_contrato: string | null;
    fecha_fin_contrato: string | null;
    duracion_meses: number | null;
    monto_inicial: number | null;
    /** Último ajuste aplicado o, si no hubo, el monto inicial. */
    monto_actual: number | null;
    deposito: number | null;
    dias_para_vencimiento: number | null;
    /** `null` = "Sin ajuste". */
    indice: { id: number; descripcion: string } | null;
    frecuencia_ajuste: string | null;
    /** Condiciones de cobro de la propiedad. */
    medios_pago: { id: number; nombre: string }[];
    dias_gracia: number | null;
    interes_por_dia: number | null;
  };
  /** `null` si el contrato es "Sin ajuste": no se muestra el calendario. */
  calendario_ajustes: AjusteCalendarioResponse[] | null;
  firmas: {
    /** `false` si no hay registro de las firmas (contrato anterior a RentAR). */
    registradas: boolean;
    /** Firmas que faltan; solo con el contrato pendiente de firma, si no `null`. */
    faltan: number | null;
    /** Con el contrato vigente: cuándo firmó la última parte (ISO 8601). Si no, `null`. */
    firmado_por_todos_el: string | null;
    firmantes: FirmanteDetalleResponse[];
  };
  /** El contrato en PDF, con URL firmada (vence a los 5 minutos). `null` si no hay archivo. */
  pdf: ContratoPdfResponse | null;
  /** Acciones disponibles según el estado (US-06, US-07). */
  acciones: { modificar: boolean; firmar: boolean; descargar_pdf: boolean };
}
