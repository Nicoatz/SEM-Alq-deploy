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
import { BUCKET_CONTRATOS_PDF, MAX_PDF_BYTES } from '../services/contrato-pdf.validacion';

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
    };
  }

  /** El PDF cargado en el contrato, con una URL firmada para la vista previa (`null` si no hay). */
  private async armarPdf(fila: FilaContratoConInmueble): Promise<ContratoPdfResponse | null> {
    if (!fila.pdf_storage_path) return null;

    const { data, error } = await getSupabaseAdmin()
      .storage.from(BUCKET_CONTRATOS_PDF)
      .createSignedUrl(fila.pdf_storage_path, SEGUNDOS_URL_PDF);
    if (error || !data) throw error ?? new Error('No se pudo firmar la URL del PDF.');

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
      .select('estado, pdf_storage_path, inmueble:inmueble!contrato_id_inmueble_fkey(id_locador)')
      .eq('id', idContrato)
      .neq('estado', ESTADO_CONTRATO.DISPONIBLE)
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;

    const fila = data as unknown as (ContratoParaPdf & { inmueble: { id_locador: number } | null }) | null;
    if (!fila?.inmueble || fila.inmueble.id_locador !== idLocador) return null;
    return { estado: fila.estado, pdf_storage_path: fila.pdf_storage_path };
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

  async tieneContratoQueBloqueaEdicion(
    usuarioId: number
  ): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato_x_usuario')
      .select('id, contrato!inner(estado)')
      .eq('id_usuario', usuarioId)
      .in('contrato.estado', [2, 4])
      .limit(1);
  
    if (error) throw error;
  
    return (data ?? []).length > 0;
  }
  
}

export const contratoRepository = new ContratoRepository();
