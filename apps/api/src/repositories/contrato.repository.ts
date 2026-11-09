import {
  ContratoBorradorResponse,
  ContratoDTO,
  ContratoPdfResponse,
  EstadoContratoResponse,
  GaranteResponse,
  GuardarBorradorRequest,
  MedioPagoDTO,
  ParteContratoResponse,
  UsuarioDTO,
} from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';
import { hoyEnArgentina } from '../services/contrato-borrador.validacion';
import { createHash, randomUUID } from 'crypto';

import { BUCKET_CONTRATOS_PDF, MAX_PDF_BYTES, nuevaRutaPdfFirmado } from '../services/contrato-pdf.validacion';

/** Cuánto dura la URL firmada para ver el PDF en la vista previa del paso 4. */
const SEGUNDOS_URL_PDF = 300;

/**
 * Ids de `estado_contrato`. Ver docs/gestion_contrato.md (sección 2).
 */
export const ESTADO_CONTRATO = {
  DISPONIBLE: 1,
  VIGENTE: 2,
  FINALIZADO: 3,
  PENDIENTE_FIRMA: 4,
  BORRADOR: 5,
} as const;

/** Estados del contrato "en curso": el que se negocia, se firma o está vigente. */
const ESTADOS_EN_CURSO: number[] = [
  ESTADO_CONTRATO.VIGENTE,
  ESTADO_CONTRATO.PENDIENTE_FIRMA,
  ESTADO_CONTRATO.BORRADOR,
];

/**
 * Respuesta de la función SQL `iniciar_contrato`: cada regla de negocio trae su status HTTP y, en
 * los 409, un `codigo` que identifica el motivo (ver `registrar_contrato_front.md`, sección 6).
 */
export interface IniciarContratoResultado {
  success: boolean;
  statusCode: number;
  message: string;
  codigo?: string;
  contrato_id?: number;
}

/** Respuesta de la función SQL `guardar_borrador_contrato`. */
export interface GuardarBorradorResultado {
  success: boolean;
  statusCode: number;
  message: string;
  codigo?: string;
}

/** Respuesta de la función SQL `registrar_pdf_contrato`. */
export interface RegistrarPdfResultado {
  success: boolean;
  statusCode: number;
  message: string;
  codigo?: string;
  /** Ruta del PDF que reemplaza este registro, para borrarlo de Storage. */
  pdf_anterior?: string | null;
}

/** Respuesta de las funciones SQL `reabrir_contrato` y `descartar_borrador_contrato` (US-06). */
export interface ModificarContratoResultado {
  success: boolean;
  statusCode: number;
  message: string;
  codigo?: string;
  /** Solo al descartar: ruta del PDF del borrador, para borrarlo de Storage. */
  pdf_anterior?: string | null;
}

/** Respuesta de la función SQL `enviar_contrato` (US-05, enviar a firmar). */
export interface EnviarContratoResultado {
  success: boolean;
  statusCode: number;
  message: string;
  /** Motivo de un error (409 y 400), para que el cliente no lea el texto. */
  codigo?: string;
  /** CT-AAAA-NNNN asignado (o conservado, si el contrato se reabrió antes). */
  contrato_codigo?: string;
  /** `true` si el código se asignó en este envío: solo entonces se borra al revertir. */
  codigo_nuevo?: boolean;
}

/** Destinatario de DocuSign de un firmante, para guardar junto con el sobre. */
export interface DestinatarioSobre {
  tipo: 'usuario' | 'garante';
  /** `usuario.id` o `garante.id`. */
  id: number;
  /** 1 = locador, 2 = locatario. Solo para `tipo: 'usuario'`. */
  tipo_firmante?: number;
  recipient_id: string;
  client_user_id: string;
}

/** Respuesta de las funciones SQL `registrar_sobre_contrato` y `revertir_envio_contrato`. */
export interface SobreContratoResultado {
  success: boolean;
  statusCode: number;
  message: string;
  codigo?: string;
}

/** Lo que hace falta para darle la firma a un usuario (locador o locatario) de un contrato. */
export interface ContratoParaFirma {
  id: number;
  estado: number;
  envelope_id: string | null;
  /** La fila del usuario en `contrato_x_usuario`. */
  parte: {
    /** 1 = locador, 2 = locatario. */
    tipo_firmante: number;
    estado_firma: string;
    recipient_id: string | null;
  };
}

/** Lo que hace falta para darle la firma a un garante que abrió su enlace. */
export interface GaranteParaFirma {
  id: number;
  id_contrato: number;
  nombre: string;
  apellido: string;
  estado_firma: string;
  recipient_id: string | null;
  token_vence_en: string | null;
  contrato: {
    estado: number;
    codigo: string | null;
    envelope_id: string | null;
    direccion: string;
    numero: number;
    piso: string | null;
    barrio: string;
  };
}

/** Respuesta de las funciones SQL del webhook de DocuSign (firma, rechazo y cierre del contrato). */
export interface FirmaResultado {
  success: boolean;
  statusCode: number;
  message: string;
  codigo?: string;
  id_contrato?: number;
  /** `registrar_firma_contrato`: el aviso estaba repetido y la firma ya constaba. */
  ya_registrada?: boolean;
  /** `completar_contrato`: el contrato ya estaba vigente. */
  ya_completado?: boolean;
}

/** El contrato dueño de un sobre de DocuSign, con lo que necesita el webhook. */
export interface ContratoPorSobre {
  id: number;
  estado: number;
  /** Hash del PDF cargado: es el documento cuyo contenido aceptó cada firmante. */
  pdf_sha256: string | null;
  /** El PDF firmado, una vez que el contrato quedó vigente y se descargó de DocuSign. */
  pdf_firmado_storage_path: string | null;
}


/** Un firmante del contrato, identificado por su destinatario de DocuSign. */
export interface FirmanteRegistrado {
  recipient_id: string;
  estado_firma: string;
}

/** Un aviso de DocuSign registrado para auditoría e idempotencia. */
export interface EventoDocusign {
  event_key: string;
  envelope_id: string;
  tipo: string;
  payload: unknown;
}

/** Datos del PDF que valida la API antes de registrarlo en el contrato. */
export interface DatosPdf {
  path: string;
  sha256: string;
  nombre: string;
  tamano: number;
}

/** Lo mínimo del contrato para decidir si se puede cargar un PDF. */
export interface ContratoParaPdf {
  estado: number | null;
  pdf_storage_path: string | null;
  /** Sobre de DocuSign del contrato (pendiente de firma), para anularlo al modificarlo. */
  envelope_id: string | null;
}

/** Resultado de descargar el PDF subido para validarlo. */
export type ArchivoDescargado =
  | { estado: 'ok'; archivo: Buffer }
  | { estado: 'no_encontrado' }
  | { estado: 'demasiado_grande' };

/** Datos para subir un PDF directo a Storage. */
export interface UrlSubidaPdf {
  path: string;
  token: string;
  url_firmada: string;
}

const ESTADO_POR_ID: Record<number, EstadoContratoResponse> = {
  [ESTADO_CONTRATO.BORRADOR]: 'borrador',
  [ESTADO_CONTRATO.PENDIENTE_FIRMA]: 'pendiente_firma',
  [ESTADO_CONTRATO.VIGENTE]: 'vigente',
  [ESTADO_CONTRATO.FINALIZADO]: 'finalizado',
};

/**
 * Lo que hace falta de una fila de `contrato` para armar su PDF: el original y, si el contrato ya
 * es vigente, el firmado. Los campos del firmado vienen de la migración 20261107 (US-07).
 */
type FilaConPdf = Pick<ContratoDTO, 'pdf_storage_path' | 'pdf_nombre_original' | 'pdf_tamano_bytes' | 'pdf_subido_en'> & {
  estado?: number | null;
  codigo?: string | null;
  pdf_firmado_storage_path?: string | null;
  pdf_firmado_tamano_bytes?: number | null;
  pdf_firmado_en?: string | null;
};

/** Fila de `contrato` con su inmueble, tal como la devuelve PostgREST. */
interface FilaContratoConInmueble extends ContratoDTO {
  inmueble: {
    id: number;
    id_locador: number;
    direccion: string;
    numero: number;
    piso: string | null;
    barrio: string;
    precio_publicado: number;
  } | null;
}

interface FilaParte {
  tipo_firmante: number;
  usuario: ParteContratoResponse | null;
}

/**
 * Una fila del listado de contratos de una propiedad (US-43): el contrato con su locatario (solo
 * nombre y apellido) y el último ajuste aplicado. Nunca trae DNI ni contacto.
 */
export interface FilaListadoContrato {
  id: number;
  codigo: string | null;
  estado: number;
  id_solicitud: number | null;
  monto_alquiler: number | null;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
  frecuencia_ajuste: string | null;
  /** Descripción de `tipo_indice` (ej. "ICL (Índice de Contratos de Locación)"); `null` = sin ajuste. */
  indice: string | null;
  locatario: { nombre: string; apellido: string } | null;
  /** Locador y locatario con su firma. `tipo_firmante`: 1 = locador, 2 = locatario. Sin DNI ni contacto. */
  partes: ({ tipo_firmante: number; usuario: { nombre: string; apellido: string } | null } & FilaFirma)[];
  /** Garantes con su firma: solo nombre y apellido, nunca DNI ni correo. */
  garantes: ({ nombre: string; apellido: string } & FilaFirma)[];
  /** Solo en pendientes de firma y vigentes con archivo (ver `ContratoResumenResponse.pdf`). */
  pdf: ContratoPdfResponse | null;
  /** Fecha y monto del último ajuste aplicado; `null` si no hubo ninguno. */
  ultimo_ajuste: { fecha_efectiva: string; monto_nuevo: number } | null;
}

/** Firma de una parte tal como está en la base (`contrato_x_usuario` o `garante`). */
export interface FilaFirma {
  estado_firma: 'pendiente' | 'firmado' | 'rechazado' | 'desconocido';
  fecha_firma: string | null;
  fecha_rechazo: string | null;
  motivo_rechazo: string | null;
}

/**
 * Todo lo que necesita el detalle del contrato (US-42), sin armar: el service lo convierte en la
 * respuesta. El PDF ya trae su URL firmada.
 */
export interface FilaDetalleContrato {
  id: number;
  codigo: string | null;
  estado: number;
  id_solicitud: number | null;
  monto_alquiler: number | null;
  deposito: number | null;
  duracion_meses: number | null;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
  dias_para_vencimiento: number | null;
  frecuencia_ajuste: string | null;
  dias_gracia: number | null;
  interes_por_dia: number | null;
  indice: { id: number; descripcion: string } | null;
  inmueble: {
    id: number;
    direccion: string;
    numero: number;
    piso: string | null;
    barrio: string;
    ciudad: string | null;
  };
  /** `tipo_firmante`: 1 = locador, 2 = locatario. */
  partes: ({ tipo_firmante: number; usuario: ParteContratoResponse | null } & FilaFirma)[];
  garantes: (GaranteResponse & FilaFirma)[];
  medios_pago: { id: number; nombre: string }[];
  /** Ajustes ya aplicados, del más antiguo al más nuevo. */
  ajustes: { fecha_efectiva: string; monto_nuevo: number }[];
  pdf: ContratoPdfResponse | null;
}

/** Lo que devuelve el listado de contratos de una propiedad (US-43). */
export interface ListadoContratosInmueble {
  contratos: FilaListadoContrato[];
  /**
   * La solicitud aceptada de la propiedad que todavía no originó un contrato y desde la que se
   * puede iniciar uno. `null` si no hay, o si la propiedad ya tiene un contrato en curso (porque
   * `iniciar_contrato` lo rechazaría).
   *
   * NOTA: solo se acepta una solicitud por propiedad (ver `existeOtraAceptadaEnCurso`). Si datos
   * anteriores a esa regla tuvieran varias, se devuelve la más antigua.
   */
  solicitud_para_contrato: number | null;
}

const numeroONull = (valor: unknown): number | null =>
  valor === null || valor === undefined ? null : Number(valor);

export interface IContratoRepository {
  findById(id: number): Promise<ContratoDTO | null>;
  findOfertaByInmuebleId(inmuebleId: number): Promise<ContratoDTO | null>;
  findEnCursoByInmuebleId(inmuebleId: number): Promise<ContratoDTO | null>;
  iniciarContrato(idSolicitud: number, idLocador: number): Promise<IniciarContratoResultado>;
  guardarBorrador(
    idContrato: number,
    idLocador: number,
    data: GuardarBorradorRequest
  ): Promise<GuardarBorradorResultado>;
  findBorradorCompleto(idContrato: number, idLocador: number): Promise<ContratoBorradorResponse | null>;
  reabrirContrato(idContrato: number, idLocador: number): Promise<ModificarContratoResultado>;
  descartarBorrador(idContrato: number, idLocador: number): Promise<ModificarContratoResultado>;
  enviarContrato(idContrato: number, idLocador: number): Promise<EnviarContratoResultado>;
  registrarSobre(
    idContrato: number,
    envelopeId: string,
    destinatarios: DestinatarioSobre[]
  ): Promise<SobreContratoResultado>;
  revertirEnvio(idContrato: number, idLocador: number, quitarCodigo: boolean): Promise<SobreContratoResultado>;
  findContratoPorSobre(envelopeId: string): Promise<ContratoPorSobre | null>;
  guardarPdfFirmado(idContrato: number, archivo: Buffer): Promise<string | null>;
  listarFirmantes(idContrato: number): Promise<FirmanteRegistrado[]>;
  registrarFirma(
    envelopeId: string,
    recipientId: string,
    fechaFirma: string,
    ip: string,
    hash: string
  ): Promise<FirmaResultado>;
  registrarRechazo(envelopeId: string): Promise<FirmaResultado>;
  completarContrato(envelopeId: string): Promise<FirmaResultado>;
  registrarEvento(evento: EventoDocusign): Promise<{ id: number; yaProcesado: boolean }>;
  marcarEventoProcesado(id: number): Promise<void>;
  findParaFirma(idContrato: number, idUsuario: number): Promise<ContratoParaFirma | null>;
  findGarantePorTokenHash(tokenHash: string): Promise<GaranteParaFirma | null>;
  generarEnlaceGarante(
    idContrato: number,
    idGarante: number,
    idLocador: number,
    tokenHash: string,
    venceEn: string
  ): Promise<SobreContratoResultado>;
  findListadoByInmuebleId(idInmueble: number, idLocador: number): Promise<ListadoContratosInmueble | null>;
  findDetalle(idContrato: number, idLocador: number): Promise<FilaDetalleContrato | null>;
  findParaPdf(idContrato: number, idLocador: number): Promise<ContratoParaPdf | null>;
  crearUrlSubidaPdf(path: string): Promise<UrlSubidaPdf>;
  descargarPdf(path: string): Promise<ArchivoDescargado>;
  eliminarPdf(path: string): Promise<void>;
  registrarPdf(idContrato: number, idLocador: number, datos: DatosPdf): Promise<RegistrarPdfResultado>;
  create(data: Omit<ContratoDTO, 'id'>, mediosPagoIds: number[]): Promise<ContratoDTO>;
  getMediosPagoByContratoId(contratoId: number): Promise<MedioPagoDTO[]>;
  getLocatarioByContratoId(contratoId: number): Promise<UsuarioDTO | null>;
  delete(id: number): Promise<boolean>;
  tieneContratoQueBloqueaEdicion(usuarioId: number): Promise<boolean>;
  findContratoQueBloqueaEdicion(usuarioId: number): Promise<ContratoBloqueanteDTO | null>;
}

/** Contrato que impide cambiar nombre, apellido y DNI de un usuario (US-21). */
export interface ContratoBloqueanteDTO {
  codigo: string | null;
  estado: 'vigente' | 'pendiente_firma';
}

export class ContratoRepository implements IContratoRepository {
  async findById(id: number): Promise<ContratoDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('contrato').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as ContratoDTO | null;
  }

  /**
   * Oferta del inmueble (estado 1, "disponible"): las condiciones comerciales de la publicación.
   * Es la única fila que alimenta el listado y el detalle públicos.
   *
   * NOTA: un inmueble tiene a lo sumo una oferta activa (índice único parcial
   * uq_contrato_una_oferta_por_inmueble), por eso alcanza con maybeSingle().
   */
  async findOfertaByInmuebleId(inmuebleId: number): Promise<ContratoDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato')
      .select('*')
      .eq('id_inmueble', inmuebleId)
      .eq('estado', ESTADO_CONTRATO.DISPONIBLE)
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;
    return data as ContratoDTO | null;
  }

  /**
   * Contrato en curso del inmueble: borrador, pendiente de firma o vigente. Es el que se
   * negocia y se firma; nunca alimenta la publicación.
   *
   * NOTA: a lo sumo uno por inmueble (índice único parcial uq_contrato_uno_en_curso_por_inmueble).
   * Los finalizados (estado 3) son historial y no se devuelven.
   */
  async findEnCursoByInmuebleId(inmuebleId: number): Promise<ContratoDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato')
      .select('*')
      .eq('id_inmueble', inmuebleId)
      .in('estado', ESTADOS_EN_CURSO)
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;
    return data as ContratoDTO | null;
  }

  

  /**
   * Crea el borrador del contrato desde una solicitud aceptada (US-05).
   * Las reglas (solicitud aceptada y propia, un solo contrato por solicitud, propiedad sin
   * contrato en curso) se validan en la función SQL, dentro de la misma transacción que el alta.
   */
  async iniciarContrato(idSolicitud: number, idLocador: number): Promise<IniciarContratoResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('iniciar_contrato', {
      p_id_solicitud: idSolicitud,
      p_id_locador: idLocador,
    });
    if (error) throw error;
    return data as IniciarContratoResultado;
  }

  /**
   * Guarda el borrador (US-05, desde cualquier paso) en una transacción. Las reglas que
   * necesitan la base (dueño, estado, garantes distintos de las partes) las aplica la función
   * SQL `guardar_borrador_contrato`.
   */
  async guardarBorrador(
    idContrato: number,
    idLocador: number,
    data: GuardarBorradorRequest
  ): Promise<GuardarBorradorResultado> {
    const { data: resultado, error } = await getSupabaseAdmin().rpc('guardar_borrador_contrato', {
      p_id_contrato: idContrato,
      p_id_locador: idLocador,
      p_data: data,
    });
    if (error) throw error;
    return resultado as GuardarBorradorResultado;
  }

  /**
   * El contrato en curso del locador con todo lo que necesita el alta (partes, garantes,
   * condiciones, PDF y garantías ofrecidas). `null` si no existe o no es de su propiedad:
   * no se distingue, para no revelar que existe. La oferta (estado 1) tampoco se devuelve.
   */
  async findBorradorCompleto(
    idContrato: number,
    idLocador: number
  ): Promise<ContratoBorradorResponse | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('contrato')
      .select(
        '*, inmueble:inmueble!contrato_id_inmueble_fkey(id, id_locador, direccion, numero, piso, barrio, precio_publicado)'
      )
      .eq('id', idContrato)
      .neq('estado', ESTADO_CONTRATO.DISPONIBLE)
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;

    const fila = data as unknown as FilaContratoConInmueble | null;
    if (!fila?.inmueble || fila.inmueble.id_locador !== idLocador) return null;

    const [partes, garantes, medios, garantias, pdf] = await Promise.all([
      supabase
        .from('contrato_x_usuario')
        .select('tipo_firmante, usuario(id, nombre, apellido, numero_documento, email, telefono)')
        .eq('id_contrato', idContrato),
      supabase
        .from('garante')
        .select('id, nombre, apellido, dni, email')
        .eq('id_contrato', idContrato)
        .order('id'),
      supabase.from('medio_pago_x_contrato').select('id_medio_pago').eq('id_contrato', idContrato),
      fila.id_solicitud
        ? supabase
            .from('solicitud_x_garantia')
            .select('tipo_garantia(nombre)')
            .eq('id_solicitud', fila.id_solicitud)
        : Promise.resolve({ data: [], error: null }),
      this.armarPdf(fila),
    ]);
    for (const consulta of [partes, garantes, medios, garantias]) {
      if (consulta.error) throw consulta.error;
    }

    const filasPartes = (partes.data ?? []) as unknown as FilaParte[];
    const parteDe = (tipoFirmante: number): ParteContratoResponse | null =>
      filasPartes.find(parte => parte.tipo_firmante === tipoFirmante)?.usuario ?? null;

    return {
      id: fila.id,
      codigo: fila.codigo ?? null,
      estado: ESTADO_POR_ID[fila.estado ?? 0] ?? 'borrador',
      id_solicitud: fila.id_solicitud ?? null,
      inmueble: {
        id: fila.inmueble.id,
        direccion: fila.inmueble.direccion,
        numero: fila.inmueble.numero,
        piso: fila.inmueble.piso,
        barrio: fila.inmueble.barrio,
        precio_publicado: Number(fila.inmueble.precio_publicado),
      },
      locador: parteDe(1),
      locatario: parteDe(2),
      garantias_ofrecidas: ((garantias.data ?? []) as unknown as { tipo_garantia: { nombre: string } | null }[])
        .map(fila => fila.tipo_garantia?.nombre)
        .filter((nombre): nombre is string => Boolean(nombre)),
      garantes: (garantes.data ?? []) as GaranteResponse[],
      condiciones: {
        fecha_inicio_contrato: fila.fecha_inicio_contrato ?? null,
        fecha_fin_contrato: fila.fecha_fin_contrato ?? null,
        duracion_meses: fila.duracion_meses ?? null,
        monto_alquiler: numeroONull(fila.monto_alquiler),
        deposito: numeroONull(fila.deposito),
        dias_para_vencimiento: fila.dias_para_vencimiento ?? null,
        indice_aumento: fila.indice_aumento ?? null,
        frecuencia_ajuste: fila.frecuencia_ajuste ?? null,
        medios_pago: ((medios.data ?? []) as { id_medio_pago: number }[]).map(medio => medio.id_medio_pago),
        dias_gracia: fila.dias_gracia ?? null,
        interes_por_dia: numeroONull(fila.interes_por_dia),
      },
      pdf,
      ultimo_paso: fila.ultimo_paso_borrador ?? null,
      fecha_inicio_vencida: Boolean(fila.fecha_inicio_contrato && fila.fecha_inicio_contrato < hoyEnArgentina()),
    };
  }

  /**
   * US-06: vuelve a borrador un contrato pendiente de firma sin la firma del locatario. Borra las
   * firmas, conserva el código todo en una transacción. Las
   * reglas (dueño, estado, firma del locatario) las valida la función SQL `reabrir_contrato`.
   */
  async reabrirContrato(idContrato: number, idLocador: number): Promise<ModificarContratoResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('reabrir_contrato', {
      p_id_contrato: idContrato,
      p_id_locador: idLocador,
    });
    if (error) throw error;
    return data as ModificarContratoResultado;
  }

  /**
   * US-06: descarta un borrador y devuelve la solicitud de origen a pendiente. Dueño y estado los valida la
   * función SQL `descartar_borrador_contrato`.
   */
  async descartarBorrador(idContrato: number, idLocador: number): Promise<ModificarContratoResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('descartar_borrador_contrato', {
      p_id_contrato: idContrato,
      p_id_locador: idLocador,
    });
    if (error) throw error;
    return data as ModificarContratoResultado;
  }

  /**
   * US-05, paso 4: pasa un borrador a pendiente de firma y le asigna el código CT-AAAA-NNNN. Dueño,
   * estado y datos obligatorios los valida la función SQL `enviar_contrato`, en una transacción.
   * El sobre de DocuSign se crea después (`registrarSobre`).
   */
  async enviarContrato(idContrato: number, idLocador: number): Promise<EnviarContratoResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('enviar_contrato', {
      p_id_contrato: idContrato,
      p_id_locador: idLocador,
    });
    if (error) throw error;
    return data as EnviarContratoResultado;
  }

  /** US-07: guarda el id del sobre de DocuSign y el destinatario de cada firmante (una transacción). */
  async registrarSobre(
    idContrato: number,
    envelopeId: string,
    destinatarios: DestinatarioSobre[]
  ): Promise<SobreContratoResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('registrar_sobre_contrato', {
      p_id_contrato: idContrato,
      p_envelope_id: envelopeId,
      p_destinatarios: destinatarios,
    });
    if (error) throw error;
    return data as SobreContratoResultado;
  }

  /**
   * Deshace `enviarContrato` cuando DocuSign falla: vuelve a borrador y limpia el sobre. Con
   * `quitarCodigo`, borra el código asignado en ese envío para no dejar huecos en la numeración.
   */
  async revertirEnvio(idContrato: number, idLocador: number, quitarCodigo: boolean): Promise<SobreContratoResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('revertir_envio_contrato', {
      p_id_contrato: idContrato,
      p_id_locador: idLocador,
      p_quitar_codigo: quitarCodigo,
    });
    if (error) throw error;
    return data as SobreContratoResultado;
  }

  /** US-07: el contrato dueño de un sobre de DocuSign, o `null` si ninguno lo tiene registrado. */
  async findContratoPorSobre(envelopeId: string): Promise<ContratoPorSobre | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato')
      .select('id, estado, pdf_sha256, pdf_firmado_storage_path')
      .eq('docusign_envelope_id', envelopeId)
      .maybeSingle();
    if (error) throw error;
    return data
      ? {
          id: data.id,
          estado: data.estado,
          pdf_sha256: data.pdf_sha256 ?? null,
          pdf_firmado_storage_path: data.pdf_firmado_storage_path ?? null,
        }
      : null;
  }

  /**
   * US-07: guarda en Storage el PDF firmado que devolvió DocuSign (con su certificado de
   * finalización) y lo registra en el contrato con su hash, tamaño y fecha. Devuelve la ruta.
   * Si ya había uno registrado no lo pisa (la firma es definitiva). Si falla el registro, borra
   * el archivo recién subido para no dejar un PDF suelto.
   */
  async guardarPdfFirmado(idContrato: number, archivo: Buffer): Promise<string | null> {
    const supabase = getSupabaseAdmin();
    const ruta = nuevaRutaPdfFirmado(idContrato, randomUUID());

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_CONTRATOS_PDF)
      .upload(ruta, archivo, { contentType: 'application/pdf', upsert: false });
    if (errorSubida) throw errorSubida;

    const { data, error } = await supabase
      .from('contrato')
      .update({
        pdf_firmado_storage_path: ruta,
        pdf_firmado_sha256: createHash('sha256').update(archivo).digest('hex'),
        pdf_firmado_tamano_bytes: archivo.length,
        pdf_firmado_en: new Date().toISOString(),
      })
      .eq('id', idContrato)
      .is('pdf_firmado_storage_path', null)
      .select('id');

    if (error || !data?.length) {
      await this.eliminarPdf(ruta);
      if (error) throw error;
      // Otro aviso ganó la carrera y ya guardó el PDF firmado: este archivo sobra.
      return null;
    }

    return ruta;
  }

  /** US-07: locador, locatario y garantes del contrato con su destinatario y estado de firma. */
  async listarFirmantes(idContrato: number): Promise<FirmanteRegistrado[]> {
    const supabase = getSupabaseAdmin();

    const [partes, garantes] = await Promise.all([
      supabase
        .from('contrato_x_usuario')
        .select('docusign_recipient_id, estado_firma')
        .eq('id_contrato', idContrato)
        .in('tipo_firmante', [1, 2]),
      supabase.from('garante').select('docusign_recipient_id, estado_firma').eq('id_contrato', idContrato),
    ]);
    if (partes.error) throw partes.error;
    if (garantes.error) throw garantes.error;

    return [...(partes.data ?? []), ...(garantes.data ?? [])]
      .filter(fila => fila.docusign_recipient_id)
      .map(fila => ({ recipient_id: fila.docusign_recipient_id as string, estado_firma: fila.estado_firma as string }));
  }

  /**
   * US-07: registra la firma de un destinatario (fecha, IP y hash del documento). Idempotente: la
   * función SQL `registrar_firma_contrato` ignora un aviso repetido.
   */
  async registrarFirma(
    envelopeId: string,
    recipientId: string,
    fechaFirma: string,
    ip: string,
    hash: string
  ): Promise<FirmaResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('registrar_firma_contrato', {
      p_envelope_id: envelopeId,
      p_recipient_id: recipientId,
      p_fecha_firma: fechaFirma,
      p_ip: ip,
      p_hash: hash,
    });
    if (error) throw error;
    return data as FirmaResultado;
  }

  /** US-07: el contrato vuelve a borrador y se borran las firmas (`registrar_rechazo_contrato`). */
  async registrarRechazo(envelopeId: string): Promise<FirmaResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('registrar_rechazo_contrato', {
      p_envelope_id: envelopeId,
    });
    if (error) throw error;
    return data as FirmaResultado;
  }

  /**
   * US-07: pasa el contrato a vigente, deja la propiedad alquilada y rechaza las solicitudes
   * pendientes, todo en una transacción (`completar_contrato`).
   */
  async completarContrato(envelopeId: string): Promise<FirmaResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('completar_contrato', {
      p_envelope_id: envelopeId,
    });
    if (error) throw error;
    return data as FirmaResultado;
  }

  /**
   * Guarda un aviso de DocuSign (auditoría e idempotencia). Si ya estaba, devuelve el existente y
   * si ya se había procesado: DocuSign reintenta y un aviso repetido no se vuelve a procesar.
   */
  async registrarEvento(evento: EventoDocusign): Promise<{ id: number; yaProcesado: boolean }> {
    const supabase = getSupabaseAdmin();

    const buscar = async () => {
      const { data, error } = await supabase
        .from('docusign_evento')
        .select('id, procesado_en')
        .eq('event_key', evento.event_key)
        .maybeSingle();
      if (error) throw error;
      return data ? { id: data.id as number, yaProcesado: data.procesado_en !== null } : null;
    };

    const existente = await buscar();
    if (existente) return existente;

    const { data, error } = await supabase.from('docusign_evento').insert(evento).select('id').single();

    // Dos avisos iguales a la vez: el segundo choca con el índice único y lee el que ganó.
    if (error?.code === '23505') {
      const ganador = await buscar();
      if (ganador) return ganador;
    }
    if (error) throw error;

    return { id: data.id as number, yaProcesado: false };
  }

  /** Marca un aviso como procesado: DocuSign puede repetirlo y no se vuelve a procesar. */
  async marcarEventoProcesado(id: number): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('docusign_evento')
      .update({ procesado_en: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  /**
   * US-07: el contrato y la fila del usuario como firmante (locador o locatario). `null` si el
   * contrato no existe, es la oferta, está dado de baja o el usuario no es parte de él: no se
   * distingue, para no revelar que existe.
   */
  async findParaFirma(idContrato: number, idUsuario: number): Promise<ContratoParaFirma | null> {
    const supabase = getSupabaseAdmin();

    const { data: contrato, error: errorContrato } = await supabase
      .from('contrato')
      .select('id, estado, docusign_envelope_id')
      .eq('id', idContrato)
      .neq('estado', ESTADO_CONTRATO.DISPONIBLE)
      .eq('activo', true)
      .maybeSingle();
    if (errorContrato) throw errorContrato;
    if (!contrato) return null;

    const { data: parte, error: errorParte } = await supabase
      .from('contrato_x_usuario')
      .select('tipo_firmante, estado_firma, docusign_recipient_id')
      .eq('id_contrato', idContrato)
      .eq('id_usuario', idUsuario)
      // NOTA: solo locador (1) y locatario (2). Los garantes viven en `garante` y no tienen sesión.
      .in('tipo_firmante', [1, 2])
      .maybeSingle();
    if (errorParte) throw errorParte;
    if (!parte) return null;

    return {
      id: contrato.id,
      estado: contrato.estado,
      envelope_id: contrato.docusign_envelope_id ?? null,
      parte: {
        tipo_firmante: parte.tipo_firmante,
        estado_firma: parte.estado_firma,
        recipient_id: parte.docusign_recipient_id ?? null,
      },
    };
  }

  /**
   * US-07: el garante dueño de un enlace de firma, buscado por el hash de su token (nunca se
   * guarda el token). Devuelve el vencimiento para que el servicio decida; `null` si no existe.
   */
  async findGarantePorTokenHash(tokenHash: string): Promise<GaranteParaFirma | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('garante')
      .select(
        'id, id_contrato, nombre, apellido, estado_firma, docusign_recipient_id, token_vence_en, ' +
          'contrato:contrato!garante_id_contrato_fkey(estado, activo, codigo, docusign_envelope_id, ' +
          'inmueble:inmueble!contrato_id_inmueble_fkey(direccion, numero, piso, barrio))'
      )
      .eq('token_firma_hash', tokenHash)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const fila = data as unknown as {
      id: number;
      id_contrato: number;
      nombre: string;
      apellido: string;
      estado_firma: string;
      docusign_recipient_id: string | null;
      token_vence_en: string | null;
      contrato: {
        estado: number;
        activo: boolean;
        codigo: string | null;
        docusign_envelope_id: string | null;
        inmueble: { direccion: string; numero: number; piso: string | null; barrio: string } | null;
      } | null;
    };

    // Un contrato dado de baja o sin propiedad no tiene nada que firmar.
    if (!fila.contrato?.activo || !fila.contrato.inmueble) return null;

    return {
      id: fila.id,
      id_contrato: fila.id_contrato,
      nombre: fila.nombre,
      apellido: fila.apellido,
      estado_firma: fila.estado_firma,
      recipient_id: fila.docusign_recipient_id ?? null,
      token_vence_en: fila.token_vence_en ?? null,
      contrato: {
        estado: fila.contrato.estado,
        codigo: fila.contrato.codigo ?? null,
        envelope_id: fila.contrato.docusign_envelope_id ?? null,
        ...fila.contrato.inmueble,
      },
    };
  }

  /**
   * US-07: guarda el hash del enlace de firma de un garante, con su vencimiento. Dueño, estado y
   * garante los valida la función SQL `generar_enlace_garante`; un enlace nuevo pisa el anterior.
   */
  async generarEnlaceGarante(
    idContrato: number,
    idGarante: number,
    idLocador: number,
    tokenHash: string,
    venceEn: string
  ): Promise<SobreContratoResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('generar_enlace_garante', {
      p_id_contrato: idContrato,
      p_id_garante: idGarante,
      p_id_locador: idLocador,
      p_token_hash: tokenHash,
      p_vence_en: venceEn,
    });
    if (error) throw error;
    return data as SobreContratoResultado;
  }

  /**
   * Los contratos de una propiedad del locador (US-43): borrador, pendiente de firma, vigente y
   * finalizado. La oferta (estado 1) es la publicación, no un contrato, y no se devuelve. Solo se
   * piden nombre y apellido del locatario: el DNI y el contacto no salen de acá.
   *
   * Devuelve `null` si la propiedad no existe, no es del locador o está dada de baja (`activo =
   * false`): no se distingue, para no revelar que existe.
   */
  async findListadoByInmuebleId(
    idInmueble: number,
    idLocador: number
  ): Promise<ListadoContratosInmueble | null> {
    const supabase = getSupabaseAdmin();

    const { data: inmueble, error: errorInmueble } = await supabase
      .from('inmueble')
      .select('id')
      .eq('id', idInmueble)
      .eq('id_locador', idLocador)
      .eq('activo', true)
      .maybeSingle();
    if (errorInmueble) throw errorInmueble;
    if (!inmueble) return null;

    const { data, error } = await supabase
      .from('contrato')
      .select(
        `id, codigo, estado, id_solicitud, monto_alquiler, fecha_inicio_contrato, fecha_fin_contrato,
         frecuencia_ajuste, pdf_storage_path, pdf_nombre_original, pdf_tamano_bytes, pdf_subido_en,
         pdf_firmado_storage_path, pdf_firmado_tamano_bytes, pdf_firmado_en,
         indice:tipo_indice(descripcion),
         partes:contrato_x_usuario(tipo_firmante, estado_firma, fecha_firma, fecha_rechazo, motivo_rechazo, usuario(nombre, apellido))`
      )
      .eq('id_inmueble', idInmueble)
      .neq('estado', ESTADO_CONTRATO.DISPONIBLE)
      .eq('activo', true);
    if (error) throw error;

    const filas = (data ?? []) as unknown as (Omit<
      FilaListadoContrato,
      'indice' | 'locatario' | 'ultimo_ajuste' | 'partes' | 'garantes' | 'pdf'
    > &
      FilaConPdf & {
        indice: { descripcion: string } | { descripcion: string }[] | null;
        partes: FilaListadoContrato['partes'] | null;
      })[];

    // Mismas reglas que la función SQL `iniciar_contrato`: solicitud aceptada (estado 2) de la
    // propiedad, que no haya originado un contrato, y sin otro contrato en curso (borrador,
    // pendiente de firma o vigente). La oferta (estado 1) no cuenta como contrato en curso.
    const hayContratoEnCurso = filas.some(fila => ESTADOS_EN_CURSO.includes(fila.estado));
    let solicitudParaContrato: number | null = null;

    if (!hayContratoEnCurso) {
      const { data: aceptadas, error: errorSolicitudes } = await supabase
        .from('solicitud')
        .select('id')
        .eq('id_inmueble', idInmueble)
        .eq('id_locador', idLocador)
        .eq('id_estado_solicitud', 2)
        .order('fecha_creacion', { ascending: true })
        .order('id', { ascending: true });
      if (errorSolicitudes) throw errorSolicitudes;

      const conContrato = new Set(filas.map(fila => fila.id_solicitud));
      solicitudParaContrato =
        ((aceptadas ?? []) as { id: number }[])
          .map(solicitud => solicitud.id)
          .find(id => !conContrato.has(id)) ?? null;
    }

    if (filas.length === 0) return { contratos: [], solicitud_para_contrato: solicitudParaContrato };

    const idsContrato = filas.map(fila => fila.id);

    // El último ajuste de cada contrato (el de fecha efectiva más reciente) y los garantes con su
    // firma. De los garantes solo nombre y apellido: nunca DNI ni correo.
    const [{ data: ajustes, error: errorAjustes }, { data: garantes, error: errorGarantes }] = await Promise.all([
      supabase
        .from('ajuste_contrato')
        .select('id_contrato, fecha_efectiva, monto_nuevo')
        .in('id_contrato', idsContrato)
        .order('fecha_efectiva', { ascending: false })
        .order('id', { ascending: false }),
      supabase
        .from('garante')
        .select('id_contrato, nombre, apellido, estado_firma, fecha_firma, fecha_rechazo, motivo_rechazo')
        .in('id_contrato', idsContrato)
        .order('id'),
    ]);
    if (errorAjustes) throw errorAjustes;
    if (errorGarantes) throw errorGarantes;

    const garantesPorContrato = new Map<number, FilaListadoContrato['garantes']>();
    for (const { id_contrato, ...garante } of (garantes ?? []) as ({ id_contrato: number } & FilaListadoContrato['garantes'][number])[]) {
      garantesPorContrato.set(id_contrato, [...(garantesPorContrato.get(id_contrato) ?? []), garante]);
    }

    const ultimoAjustePorContrato = new Map<number, { fecha_efectiva: string; monto_nuevo: number }>();
    for (const ajuste of (ajustes ?? []) as { id_contrato: number; fecha_efectiva: string; monto_nuevo: number }[]) {
      if (!ultimoAjustePorContrato.has(ajuste.id_contrato)) {
        ultimoAjustePorContrato.set(ajuste.id_contrato, {
          fecha_efectiva: ajuste.fecha_efectiva,
          monto_nuevo: Number(ajuste.monto_nuevo),
        });
      }
    }

    const contratos = await Promise.all(
      filas.map(async fila => {
        const indice = Array.isArray(fila.indice) ? fila.indice[0] : fila.indice;
        const partes = fila.partes ?? [];
        const locatario = partes.find(parte => parte.tipo_firmante === 2)?.usuario ?? null;

        // NOTA: el PDF solo se firma para los pendientes de firma y vigentes (los que el listado
        // ofrece descargar): no se piden URLs a Storage por los borradores ni por el historial.
        const ofreceDescarga =
          fila.estado === ESTADO_CONTRATO.PENDIENTE_FIRMA || fila.estado === ESTADO_CONTRATO.VIGENTE;

        return {
          id: fila.id,
          codigo: fila.codigo ?? null,
          estado: fila.estado,
          id_solicitud: fila.id_solicitud ?? null,
          monto_alquiler: numeroONull(fila.monto_alquiler),
          fecha_inicio_contrato: fila.fecha_inicio_contrato ?? null,
          fecha_fin_contrato: fila.fecha_fin_contrato ?? null,
          frecuencia_ajuste: fila.frecuencia_ajuste ?? null,
          indice: indice?.descripcion ?? null,
          locatario: locatario ? { nombre: locatario.nombre, apellido: locatario.apellido } : null,
          partes,
          garantes: garantesPorContrato.get(fila.id) ?? [],
          pdf: ofreceDescarga ? await this.armarPdf(fila) : null,
          ultimo_ajuste: ultimoAjustePorContrato.get(fila.id) ?? null,
        };
      })
    );

    return { contratos, solicitud_para_contrato: solicitudParaContrato };
  }

  /**
   * El contrato del locador con todo lo que muestra su detalle (US-42): partes con su firma,
   * garantes, condiciones, ajustes aplicados y PDF. `null` si no existe o no es de su propiedad:
   * no se distingue, para no revelar que existe. La oferta (estado 1) tampoco se devuelve.
   */
  async findDetalle(idContrato: number, idLocador: number): Promise<FilaDetalleContrato | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('contrato')
      .select(
        `*, indice:tipo_indice(id, descripcion),
         inmueble:inmueble!contrato_id_inmueble_fkey(id, id_locador, direccion, numero, piso, barrio, ciudad)`
      )
      .eq('id', idContrato)
      .neq('estado', ESTADO_CONTRATO.DISPONIBLE)
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;

    const fila = data as unknown as
      | (ContratoDTO & {
          indice: { id: number; descripcion: string } | { id: number; descripcion: string }[] | null;
          inmueble: (FilaDetalleContrato['inmueble'] & { id_locador: number }) | null;
        })
      | null;
    if (!fila?.inmueble || fila.inmueble.id_locador !== idLocador) return null;

    const [partes, garantes, medios, ajustes, pdf] = await Promise.all([
      supabase
        .from('contrato_x_usuario')
        .select(
          `tipo_firmante, estado_firma, fecha_firma, fecha_rechazo, motivo_rechazo,
           usuario(id, nombre, apellido, numero_documento, email, telefono)`
        )
        .eq('id_contrato', idContrato),
      supabase
        .from('garante')
        .select('id, nombre, apellido, dni, email, estado_firma, fecha_firma, fecha_rechazo, motivo_rechazo')
        .eq('id_contrato', idContrato)
        .order('id'),
      supabase.from('medio_pago_x_contrato').select('medio_pago(id, nombre)').eq('id_contrato', idContrato),
      supabase
        .from('ajuste_contrato')
        .select('fecha_efectiva, monto_nuevo')
        .eq('id_contrato', idContrato)
        .order('fecha_efectiva', { ascending: true }),
      this.armarPdf(fila as unknown as FilaContratoConInmueble),
    ]);
    for (const consulta of [partes, garantes, medios, ajustes]) {
      if (consulta.error) throw consulta.error;
    }

    const indice = Array.isArray(fila.indice) ? fila.indice[0] : fila.indice;
    const { id_locador: _idLocador, ...inmueble } = fila.inmueble;

    return {
      id: fila.id,
      codigo: fila.codigo ?? null,
      estado: fila.estado ?? 0,
      id_solicitud: fila.id_solicitud ?? null,
      monto_alquiler: numeroONull(fila.monto_alquiler),
      deposito: numeroONull(fila.deposito),
      duracion_meses: fila.duracion_meses ?? null,
      fecha_inicio_contrato: fila.fecha_inicio_contrato ?? null,
      fecha_fin_contrato: fila.fecha_fin_contrato ?? null,
      dias_para_vencimiento: fila.dias_para_vencimiento ?? null,
      frecuencia_ajuste: fila.frecuencia_ajuste ?? null,
      dias_gracia: fila.dias_gracia ?? null,
      interes_por_dia: numeroONull(fila.interes_por_dia),
      indice: indice ?? null,
      inmueble,
      partes: (partes.data ?? []) as unknown as FilaDetalleContrato['partes'],
      garantes: (garantes.data ?? []) as unknown as FilaDetalleContrato['garantes'],
      medios_pago: ((medios.data ?? []) as unknown as { medio_pago: { id: number; nombre: string } | null }[])
        .map(medio => medio.medio_pago)
        .filter((medio): medio is { id: number; nombre: string } => medio !== null),
      ajustes: ((ajustes.data ?? []) as { fecha_efectiva: string; monto_nuevo: number }[]).map(ajuste => ({
        fecha_efectiva: ajuste.fecha_efectiva,
        monto_nuevo: Number(ajuste.monto_nuevo),
      })),
      pdf,
    };
  }

  /** El PDF cargado en el contrato, con una URL firmada para la vista previa (`null` si no hay). */
  private async armarPdf(fila: FilaConPdf): Promise<ContratoPdfResponse | null> {
    // US-07: con el contrato vigente (o finalizado) el documento que se descarga es el FIRMADO, con
    // el certificado de finalización de DocuSign. Si todavía no se guardó (falló la descarga y
    // DocuSign reintenta), mientras tanto se ofrece el original.
    const esFirmado =
      (fila.estado === ESTADO_CONTRATO.VIGENTE || fila.estado === ESTADO_CONTRATO.FINALIZADO) &&
      Boolean(fila.pdf_firmado_storage_path);
    const ruta = esFirmado ? fila.pdf_firmado_storage_path : fila.pdf_storage_path;

    if (!ruta) return null;

    const { data, error } = await getSupabaseAdmin()
      .storage.from(BUCKET_CONTRATOS_PDF)
      .createSignedUrl(ruta, SEGUNDOS_URL_PDF);
    if (error || !data) throw error ?? new Error('No se pudo firmar la URL del PDF.');

    if (esFirmado) {
      return {
        nombre: `${fila.codigo ?? 'contrato'}-firmado.pdf`,
        tamano_bytes: Number(fila.pdf_firmado_tamano_bytes ?? 0),
        subido_en: fila.pdf_firmado_en ?? '',
        url: data.signedUrl,
      };
    }

    return {
      nombre: fila.pdf_nombre_original ?? 'contrato.pdf',
      tamano_bytes: Number(fila.pdf_tamano_bytes ?? 0),
      subido_en: fila.pdf_subido_en ?? '',
      url: data.signedUrl,
    };
  }

  /**
   * Lo mínimo del contrato del locador para decidir si se puede cargar un PDF: su estado y el
   * PDF que tiene. `null` si no existe o no es de su propiedad (no se distingue).
   */
  async findParaPdf(idContrato: number, idLocador: number): Promise<ContratoParaPdf | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato')
      .select(
        'estado, pdf_storage_path, docusign_envelope_id, inmueble:inmueble!contrato_id_inmueble_fkey(id_locador)'
      )
      .eq('id', idContrato)
      .neq('estado', ESTADO_CONTRATO.DISPONIBLE)
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;

    const fila = data as unknown as {
      estado: number | null;
      pdf_storage_path: string | null;
      docusign_envelope_id: string | null;
      inmueble: { id_locador: number } | null;
    } | null;
    if (!fila?.inmueble || fila.inmueble.id_locador !== idLocador) return null;
    return {
      estado: fila.estado,
      pdf_storage_path: fila.pdf_storage_path,
      envelope_id: fila.docusign_envelope_id ?? null,
    };
  }

  /** URL firmada para que el navegador suba el PDF directo al bucket (no pasa por la API). */
  async crearUrlSubidaPdf(path: string): Promise<UrlSubidaPdf> {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(BUCKET_CONTRATOS_PDF)
      .createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error('No se pudo crear la URL de subida.');
    return { path: data.path, token: data.token, url_firmada: data.signedUrl };
  }

  /**
   * Descarga el archivo subido para validarlo. Si pesa más del tope no lo pasa a memoria: el
   * bucket ya limita el tamaño, pero la API no debe confiar en eso.
   */
  async descargarPdf(path: string): Promise<ArchivoDescargado> {
    const { data, error } = await getSupabaseAdmin().storage.from(BUCKET_CONTRATOS_PDF).download(path);
    if (error || !data) return { estado: 'no_encontrado' };
    if (data.size > MAX_PDF_BYTES) return { estado: 'demasiado_grande' };
    return { estado: 'ok', archivo: Buffer.from(await data.arrayBuffer()) };
  }

  /** Borra un PDF de Storage. Nunca falla: un archivo suelto no debe romper el guardado. */
  async eliminarPdf(path: string): Promise<void> {
    try {
      await getSupabaseAdmin().storage.from(BUCKET_CONTRATOS_PDF).remove([path]);
    } catch (error) {
      console.error(`[contrato] No se pudo borrar el PDF ${path} de Storage:`, error);
    }
  }

  /**
   * Registra el PDF en el borrador (US-05, paso 3). El dueño y el estado (solo borrador) los
   * valida la función SQL `registrar_pdf_contrato`, en la misma transacción que el cambio.
   */
  async registrarPdf(
    idContrato: number,
    idLocador: number,
    datos: DatosPdf
  ): Promise<RegistrarPdfResultado> {
    const { data, error } = await getSupabaseAdmin().rpc('registrar_pdf_contrato', {
      p_id_contrato: idContrato,
      p_id_locador: idLocador,
      p_path: datos.path,
      p_sha256: datos.sha256,
      p_nombre: datos.nombre,
      p_tamano: datos.tamano,
    });
    if (error) throw error;
    return data as RegistrarPdfResultado;
  }

  async create(
    data: Omit<ContratoDTO, 'id'>,
    mediosPagoIds: number[]
  ): Promise<ContratoDTO> {
    const supabase = getSupabaseAdmin();
    const { data: contrato, error } = await supabase.from('contrato').insert(data).select('*').single();
    if (error || !contrato) throw error ?? new Error('No se pudo crear el contrato.');

    const relaciones = mediosPagoIds.map(id_medio_pago => ({ id_contrato: contrato.id, id_medio_pago }));
    const { error: mediosError } = await supabase.from('medio_pago_x_contrato').insert(relaciones);
    if (mediosError) {
      await this.delete(contrato.id);
      throw mediosError;
    }
    return contrato as ContratoDTO;
  }

  async getMediosPagoByContratoId(contratoId: number): Promise<MedioPagoDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('medio_pago_x_contrato')
      .select('medio_pago(id, nombre, descripcion)')
      .eq('id_contrato', contratoId);
    if (error) throw error;
    return (data ?? []).map((row: any) => row.medio_pago).filter(Boolean) as MedioPagoDTO[];
  }

  async getLocatarioByContratoId(contratoId: number): Promise<UsuarioDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato_x_usuario')
      .select('usuario(id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento)')
      .eq('id_contrato', contratoId)
      .eq('tipo_firmante', 2)
      .limit(1);

    if (error) throw error;

    // NOTA: limit(1) en vez de maybeSingle() para no fallar si hubiera más de un locatario principal.
    const relacion = (data as unknown as { usuario: UsuarioDTO | null }[] | null)?.[0];
    return relacion?.usuario ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const { error, count } = await getSupabaseAdmin()
      .from('contrato')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async tieneContratoQueBloqueaEdicion(usuarioId: number): Promise<boolean> {
    return (await this.findContratoQueBloqueaEdicion(usuarioId)) !== null;
  }

  /**
   * US-21: el contrato vigente (2) o pendiente de firma (4) del que el usuario es parte, como
   * locador o locatario. Si hay más de uno se informa el más reciente. `null` = puede editar
   * su identidad.
   */
  async findContratoQueBloqueaEdicion(usuarioId: number): Promise<ContratoBloqueanteDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato_x_usuario')
      .select('id, contrato!inner(id, codigo, estado)')
      .eq('id_usuario', usuarioId)
      .in('contrato.estado', [ESTADO_CONTRATO.VIGENTE, ESTADO_CONTRATO.PENDIENTE_FIRMA])
      .order('id', { ascending: false })
      .limit(1);

    if (error) throw error;

    const fila = (data ?? [])[0] as unknown as
      | { contrato: { codigo: string | null; estado: number } | { codigo: string | null; estado: number }[] }
      | undefined;
    if (!fila) return null;

    // PostgREST puede devolver el contrato embebido como objeto o como arreglo de uno.
    const contrato = Array.isArray(fila.contrato) ? fila.contrato[0] : fila.contrato;
    if (!contrato) return null;

    return {
      codigo: contrato.codigo,
      estado: contrato.estado === ESTADO_CONTRATO.VIGENTE ? 'vigente' : 'pendiente_firma',
    };
  }
}

export const contratoRepository = new ContratoRepository();
