import { createHash, randomUUID } from 'crypto';

import type {
  AjusteCalendarioResponse,
  ContratoBorradorResponse,
  ContratoDetalleResponse,
  ContratoDTO,
  ContratoResumenResponse,
  ContratosInmuebleResponse,
  EnviarContratoResponse,
  EstadoContratoResponse,
  EstadoFirmaDetalleResponse,
  FirmanteDetalleResponse,
  IndiceContratoResponse,
  UrlSubidaPdfResponse,
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import {
  ESTADO_CONTRATO,
  FilaDetalleContrato,
  FilaFirma,
  FilaListadoContrato,
  IContratoRepository,
  contratoRepository,
} from '../repositories/contrato.repository';
import { DocusignError } from '../config/docusign';
import { calcularFechaProximoAjuste } from './alquiler-locatario.service';
import { hoyEnArgentina, validarGuardarBorrador } from './contrato-borrador.validacion';
import { validarContratoCompleto, validarEnviar } from './contrato-envio.validacion';
import { armarFirmantes, nombreFirmante } from './contrato-firmantes';
import { agregarHojaDeFirmas } from './contrato-hoja-firmas';
import { IDocusignClient, docusignClient } from './docusign.client';
import {
  MAX_PDF_BYTES,
  nuevaRutaPdf,
  validarArchivoPdf,
  validarRegistrarPdf,
} from './contrato-pdf.validacion';

const ESTADO_POR_ID: Record<number, EstadoContratoResponse> = {
  [ESTADO_CONTRATO.BORRADOR]: 'borrador',
  [ESTADO_CONTRATO.PENDIENTE_FIRMA]: 'pendiente_firma',
  [ESTADO_CONTRATO.VIGENTE]: 'vigente',
  [ESTADO_CONTRATO.FINALIZADO]: 'finalizado',
};

/** El índice del listado sale de la sigla de `tipo_indice.descripcion` ("ICL (Índice de…)"). */
function indiceDelListado(descripcion: string | null): IndiceContratoResponse {
  const sigla = descripcion?.trim().split(/[\s(]/)[0].toUpperCase();
  return sigla === 'ICL' || sigla === 'IPC' || sigla === 'CAC' ? sigla : 'sin_ajuste';
}

/**
 * Orden del historial de una propiedad: el más reciente primero, por fecha de inicio. Los que
 * todavía no tienen fecha (borradores) van arriba, porque son el contrato más nuevo. Las fechas ISO
 * `YYYY-MM-DD` se comparan como texto, sin zonas horarias.
 */
function masRecientePrimero(a: ContratoResumenResponse, b: ContratoResumenResponse): number {
  const inicioA = a.fecha_inicio_contrato;
  const inicioB = b.fecha_inicio_contrato;

  if (inicioA !== inicioB) {
    if (inicioA === null) return -1;
    if (inicioB === null) return 1;
    return inicioA < inicioB ? 1 : -1;
  }
  return b.id - a.id;
}

function resumenDeFila(fila: FilaListadoContrato): ContratoResumenResponse | null {
  const estado = ESTADO_POR_ID[fila.estado];
  // NOTA: un estado desconocido no se muestra (nunca la oferta, estado 1).
  if (!estado) return null;

  const indice = indiceDelListado(fila.indice);

  // Con ajuste, el monto actual es el del último ajuste aplicado; si no hubo, el inicial.
  const montoActual = fila.ultimo_ajuste?.monto_nuevo ?? fila.monto_alquiler;

  // NOTA: sin índice no hay ajuste; un finalizado ya no se ajusta. Si el próximo ajuste cae
  // después del fin del contrato, ya no quedan ajustes.
  let proximoAjuste: string | null = null;
  if (indice !== 'sin_ajuste' && estado !== 'finalizado') {
    proximoAjuste = calcularFechaProximoAjuste(
      fila.fecha_inicio_contrato,
      fila.ultimo_ajuste?.fecha_efectiva ?? null,
      fila.frecuencia_ajuste
    );
    if (proximoAjuste && fila.fecha_fin_contrato && proximoAjuste > fila.fecha_fin_contrato) {
      proximoAjuste = null;
    }
  }

  return {
    id: fila.id,
    codigo: fila.codigo,
    estado,
    locatario: fila.locatario,
    // NOTA: sin firmas en un borrador (no se envió a firmar) ni en un finalizado (va al detalle).
    firmas:
      estado === 'pendiente_firma' || estado === 'vigente'
        ? armarFirmas(
            estado,
            fila.partes.find(parte => parte.tipo_firmante === 1),
            fila.partes.find(parte => parte.tipo_firmante === 2),
            fila.garantes
          )
        : null,
    pdf: fila.pdf,
    monto_actual: montoActual,
    fecha_inicio_contrato: fila.fecha_inicio_contrato,
    fecha_fin_contrato: fila.fecha_fin_contrato,
    indice,
    proximo_ajuste: proximoAjuste,
    id_solicitud: fila.id_solicitud,
  };
}

const FIRMA_POR_ESTADO: Record<FilaFirma['estado_firma'], EstadoFirmaDetalleResponse> = {
  pendiente: 'pendiente',
  firmado: 'firmado',
  rechazado: 'rechazado',
  desconocido: 'sin_registro',
};

function firmanteDeFila(
  rol: FirmanteDetalleResponse['rol'],
  persona: { nombre: string; apellido: string } | null,
  firma: FilaFirma
): FirmanteDetalleResponse {
  return {
    rol,
    nombre: persona?.nombre ?? '',
    apellido: persona?.apellido ?? '',
    estado: FIRMA_POR_ESTADO[firma.estado_firma] ?? 'sin_registro',
    fecha_firma: firma.fecha_firma ?? null,
    fecha_rechazo: firma.fecha_rechazo ?? null,
    motivo_rechazo: firma.motivo_rechazo ?? null,
  };
}

/**
 * Las firmas de un contrato (US-42 y US-43): locador, locatario y garantes, con la fecha y hora de
 * cada firma. Lo comparten el detalle y el listado, así no se desfasan.
 *
 * - Sin evidencia de las firmas (contratos anteriores a RentAR) no se inventa nada: `registradas`
 *   queda en `false`.
 * - `faltan`: solo con el contrato pendiente de firma.
 * - `firmado_por_todos_el`: solo con el contrato vigente y todas las partes firmadas; es la fecha
 *   de la última firma.
 */
function armarFirmas(
  estado: EstadoContratoResponse,
  locador: { usuario: { nombre: string; apellido: string } | null } & FilaFirma | undefined,
  locatario: { usuario: { nombre: string; apellido: string } | null } & FilaFirma | undefined,
  garantes: ({ nombre: string; apellido: string } & FilaFirma)[]
): ContratoDetalleResponse['firmas'] {
  const firmantes: FirmanteDetalleResponse[] = [
    ...(locador ? [firmanteDeFila('locador', locador.usuario, locador)] : []),
    ...(locatario ? [firmanteDeFila('locatario', locatario.usuario, locatario)] : []),
    ...garantes.map(garante => firmanteDeFila('garante', garante, garante)),
  ];

  const registradas = firmantes.length > 0 && firmantes.every(firmante => firmante.estado !== 'sin_registro');
  const fechasFirma = firmantes.map(firmante => firmante.fecha_firma).filter((f): f is string => f !== null);
  const firmadoPorTodos =
    estado === 'vigente' && registradas && firmantes.every(firmante => firmante.estado === 'firmado')
      ? fechasFirma.reduce((ultima, fecha) => (new Date(fecha) > new Date(ultima) ? fecha : ultima))
      : null;

  return {
    registradas,
    faltan: estado === 'pendiente_firma' ? firmantes.filter(firmante => firmante.estado !== 'firmado').length : null,
    firmado_por_todos_el: firmadoPorTodos,
    firmantes,
  };
}

/**
 * US-42 · Calendario de ajustes: el inicio y cada fecha de ajuste hasta el fin del contrato.
 * Los ajustes ya aplicados traen su monto; los futuros quedan en `null` ("a definir"), porque
 * dependen del índice del día. `null` si el contrato es "Sin ajuste".
 */
function calendarioDeAjustes(fila: FilaDetalleContrato): AjusteCalendarioResponse[] | null {
  if (indiceDelListado(fila.indice?.descripcion ?? null) === 'sin_ajuste') return null;

  const calendario: AjusteCalendarioResponse[] = [];
  if (!fila.fecha_inicio_contrato) return calendario;

  calendario.push({ fecha: fila.fecha_inicio_contrato, tipo: 'inicio', monto: fila.monto_alquiler });

  // NOTA: el monto de un ajuste aplicado se une por fecha exacta con `ajuste_contrato.fecha_efectiva`.
  // Quien implemente la aplicación de ajustes debe guardar la misma fecha que calcula
  // `calcularFechaProximoAjuste`; si no, ese ajuste se vería como "a definir".
  const aplicados = new Map(fila.ajustes.map(ajuste => [ajuste.fecha_efectiva, ajuste.monto_nuevo]));
  let desde: string | null = null;
  // NOTA: tope de 600 iteraciones (50 años mensuales) por si la frecuencia o las fechas vienen mal.
  for (let i = 0; i < 600; i++) {
    const fecha = calcularFechaProximoAjuste(fila.fecha_inicio_contrato, desde, fila.frecuencia_ajuste);
    if (!fecha || fecha <= (desde ?? fila.fecha_inicio_contrato)) break;
    if (fila.fecha_fin_contrato && fecha > fila.fecha_fin_contrato) break;
    calendario.push({ fecha, tipo: 'ajuste', monto: aplicados.get(fecha) ?? null });
    desde = fecha;
  }

  return calendario;
}

export class ContratoService {
  constructor(
    private readonly contratoRepo: IContratoRepository = contratoRepository,
    private readonly docusign: IDocusignClient = docusignClient
  ) {}

  /**
   * Lanza un error con su status HTTP y, si lo tiene, el `codigo` que identifica el motivo (los
   * 409): el manejador de errores lo devuelve en el sobre para que el cliente no lea el texto.
   */
  private throwError(message: string, statusCode: number, codigo?: string): never {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    if (codigo) (error as any).codigo = codigo;
    throw error;
  }

  /** Sesión de locador e id válidos: lo que piden todas las operaciones sobre un contrato. */
  private validarAcceso(user: AuthenticatedUser, idContrato: number): void {
    if (!user?.id) {
      this.throwError('Debe iniciar sesión para gestionar contratos.', 401);
    }

    if (!user.roles.includes('locador')) {
      this.throwError('Se requiere el rol locador para gestionar contratos.', 403);
    }

    if (!Number.isInteger(idContrato) || idContrato < 1) {
      this.throwError('El identificador del contrato no es válido.', 400);
    }
  }

  /**
   * US-43 · Contratos de una propiedad del locador, sin la oferta (estado 1) y sin DNI ni
   * contacto. Orden: el más reciente primero (ver `masRecientePrimero`).
   *
   * Una propiedad inexistente, ajena o dada de baja es siempre 404: no se distingue.
   */
  async listarPorInmueble(user: AuthenticatedUser, idInmueble: number): Promise<ContratosInmuebleResponse> {
    if (!user?.id) {
      this.throwError('Debe iniciar sesión para consultar contratos.', 401);
    }

    if (!user.roles.includes('locador')) {
      this.throwError('Se requiere el rol locador para consultar contratos.', 403);
    }

    if (!Number.isInteger(idInmueble) || idInmueble < 1) {
      this.throwError('El identificador de la propiedad no es válido.', 400);
    }

    const listado = await this.contratoRepo.findListadoByInmuebleId(idInmueble, user.id);

    if (!listado) {
      this.throwError('No encontramos esta propiedad.', 404);
    }

    return {
      contratos: listado.contratos
        .map(resumenDeFila)
        .filter((resumen): resumen is ContratoResumenResponse => resumen !== null)
        .sort(masRecientePrimero),
      solicitud_para_contrato: listado.solicitud_para_contrato,
    };
  }

  /**
   * US-42 · Detalle del contrato del locador: partes, garantes, condiciones, calendario de
   * ajustes, firmas, PDF y acciones disponibles según el estado.
   *
   * - Inexistente o ajeno: 404 con el mismo mensaje, sin distinguir.
   * - Borrador: no tiene detalle, 409 `CONTRATO_BORRADOR`; el cliente retoma el alta (US-06) con
   *   `GET /contratos/:id`.
   * - Lo que no está registrado (contratos anteriores a RentAR) viaja en `null`, nunca inventado.
   */
  async obtenerDetalle(user: AuthenticatedUser, idContrato: number): Promise<ContratoDetalleResponse> {
    this.validarAcceso(user, idContrato);

    // Existencia, dueño y estado, antes de armar nada (el PDF firma una URL de Storage).
    const previo = await this.contratoRepo.findParaPdf(idContrato, user.id);

    if (!previo) {
      this.throwError('No encontramos este contrato.', 404);
    }

    if (previo.estado === ESTADO_CONTRATO.BORRADOR) {
      this.throwError('Un borrador no tiene detalle: retomalo desde el alta.', 409, 'CONTRATO_BORRADOR');
    }

    const fila = await this.contratoRepo.findDetalle(idContrato, user.id);
    const estado = fila ? ESTADO_POR_ID[fila.estado] : undefined;

    if (!fila || !estado || estado === 'borrador') {
      this.throwError('No encontramos este contrato.', 404);
    }

    const parteDe = (tipoFirmante: number) => fila.partes.find(parte => parte.tipo_firmante === tipoFirmante);
    const locador = parteDe(1);
    const locatario = parteDe(2);

    const pendiente = estado === 'pendiente_firma';

    const montoInicial = fila.monto_alquiler;
    const ultimoAjuste = fila.ajustes[fila.ajustes.length - 1];

    return {
      id: fila.id,
      codigo: fila.codigo,
      estado,
      id_solicitud: fila.id_solicitud,
      inmueble: fila.inmueble,
      locador: locador?.usuario ?? null,
      locatario: locatario?.usuario ?? null,
      garantes: fila.garantes.map(({ id, nombre, apellido, dni, email }) => ({ id, nombre, apellido, dni, email })),
      condiciones: {
        fecha_inicio_contrato: fila.fecha_inicio_contrato,
        fecha_fin_contrato: fila.fecha_fin_contrato,
        duracion_meses: fila.duracion_meses,
        monto_inicial: montoInicial,
        monto_actual: ultimoAjuste?.monto_nuevo ?? montoInicial,
        deposito: fila.deposito,
        dias_para_vencimiento: fila.dias_para_vencimiento,
        indice: fila.indice,
        frecuencia_ajuste: fila.frecuencia_ajuste,
        medios_pago: fila.medios_pago,
        dias_gracia: fila.dias_gracia,
        interes_por_dia: fila.interes_por_dia,
      },
      calendario_ajustes: calendarioDeAjustes(fila),
      firmas: armarFirmas(estado, locador, locatario, fila.garantes),
      pdf: fila.pdf,
      acciones: {
        // US-06: solo pendiente de firma y sin la firma del locatario. US-07: firmar, además,
        // si el locador no firmó.
        modificar: pendiente && locatario?.estado_firma !== 'firmado',
        firmar: pendiente && locador?.estado_firma === 'pendiente',
        // US-42: el PDF se descarga en cualquier estado (siempre que el contrato tenga archivo).
        descargar_pdf: fila.pdf !== null,
      },
    };
  }

  /**
   * US-05 · Consultar un contrato en curso del locador (para retomar el borrador).
   * Un contrato ajeno o inexistente es siempre 404: no se distingue.
   */
  async obtener(user: AuthenticatedUser, idContrato: number): Promise<ContratoBorradorResponse> {
    this.validarAcceso(user, idContrato);

    const contrato = await this.contratoRepo.findBorradorCompleto(idContrato, user.id);

    if (!contrato) {
      this.throwError('No encontramos este contrato.', 404);
    }

    return contrato;
  }

  /**
   * US-05 · Guardar el borrador desde cualquier paso. Un borrador puede estar incompleto: solo
   * se valida el formato de lo que llega; lo obligatorio se exige al enviar a firmar.
   * Devuelve el contrato completo, así el front no vuelve a pedirlo.
   */
  async guardar(
    user: AuthenticatedUser,
    idContrato: number,
    cuerpo: unknown
  ): Promise<ContratoBorradorResponse> {
    this.validarAcceso(user, idContrato);

    const datos = validarGuardarBorrador(cuerpo, hoyEnArgentina());
    const resultado = await this.contratoRepo.guardarBorrador(idContrato, user.id, datos);

    if (!resultado.success) {
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    return this.obtener(user, idContrato);
  }

  /**
   * US-06 · Modificar un contrato pendiente de firma: lo devuelve a borrador para poder editarlo
   * con `PATCH /contratos/:id`. Cancela el envío, borra las firmas registradas y conserva el
   * código CT-AAAA-NNNN. El cliente pide la confirmación al locador antes de llamar.
   *
   * - Ajeno o inexistente: 404 con el mismo mensaje.
   * - Vigente, finalizado, con la firma del locatario o ya en borrador: 409 con `codigo` y el
   *   motivo (CONTRATO_VIGENTE, CONTRATO_FINALIZADO, CONTRATO_FIRMADO_POR_LOCATARIO,
   *   CONTRATO_YA_EN_BORRADOR).
   */
  async reabrir(user: AuthenticatedUser, idContrato: number): Promise<ContratoBorradorResponse> {
    this.validarAcceso(user, idContrato);

    // El sobre de DocuSign hay que leerlo antes: la función SQL lo desvincula del contrato.
    const previo = await this.contratoRepo.findParaPdf(idContrato, user.id);

    const resultado = await this.contratoRepo.reabrirContrato(idContrato, user.id);

    if (!resultado.success) {
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    // US-07: el sobre anterior ya no vale. Se anula DESPUÉS de cambiar la base: si la anulación
    // falla, el contrato igual está en borrador y el sobre desvinculado, que el webhook ignora.
    // Hacerlo al revés dejaría un contrato pendiente de firma con un sobre que no se puede firmar.
    if (previo?.envelope_id) {
      try {
        await this.docusign.anularSobre(previo.envelope_id, 'El locador modificó el contrato.');
      } catch (error) {
        console.error(`[contrato] No se pudo anular el sobre ${previo.envelope_id} de DocuSign:`, error);
      }
    }

    return this.obtener(user, idContrato);
  }

  /**
   * US-05, paso 4 · Enviar a firmar. Pasa el borrador a "pendiente de firma", le asigna el código
   * CT-AAAA-NNNN y crea el sobre de DocuSign con un destinatario por firmante: locador, locatario
   * y garantes. No toca el inmueble: sigue publicado mientras se firma (decisión del PO).
   *
   * Orden y por qué:
   *   1. Validaciones y preparación (PDF + hoja de firmas) ANTES de cambiar nada.
   *   2. `enviar_contrato` (SQL): estado 4 y código, en una transacción.
   *   3. Sobre en DocuSign y `registrar_sobre_contrato` (SQL).
   *   Si el paso 3 falla, se anula el sobre (si llegó a crearse) y `revertir_envio_contrato`
   *   devuelve el contrato a borrador, sin dejar un código gastado. El locador puede reintentar.
   *
   * - Ajeno o inexistente: 404 con el mismo mensaje.
   * - No es un borrador: 409 `CONTRATO_NO_BORRADOR`.
   * - Incompleto o sin la casilla de revisión: 400 con el motivo.
   * - DocuSign caído o mal configurado: 502.
   */
  async enviar(
    user: AuthenticatedUser,
    idContrato: number,
    cuerpo: unknown,
    // TEMPORAL(webhook-url): ver `docusign-webhook-url.temporal.ts`.
    webhookUrl?: string | null
  ): Promise<EnviarContratoResponse> {
    this.validarAcceso(user, idContrato);
    validarEnviar(cuerpo);

    const contrato = await this.contratoRepo.findBorradorCompleto(idContrato, user.id);

    if (!contrato) {
      this.throwError('No encontramos este contrato.', 404);
    }

    if (contrato.estado !== 'borrador') {
      this.throwError('Solo se puede enviar a firmar un contrato en borrador.', 409, 'CONTRATO_NO_BORRADOR');
    }

    validarContratoCompleto(contrato, hoyEnArgentina());

    // El PDF cargado en el paso 3. `validarContratoCompleto` ya comprobó que existe.
    const registro = await this.contratoRepo.findParaPdf(idContrato, user.id);
    const descarga = registro?.pdf_storage_path
      ? await this.contratoRepo.descargarPdf(registro.pdf_storage_path)
      : ({ estado: 'no_encontrado' } as const);

    if (descarga.estado !== 'ok') {
      this.throwError('No encontramos el PDF del contrato. Volvé a cargarlo.', 400, 'FALTA_PDF');
    }

    const firmantes = armarFirmantes(contrato);
    const hoja = await agregarHojaDeFirmas(descarga.archivo, firmantes);

    const envio = await this.contratoRepo.enviarContrato(idContrato, user.id);

    if (!envio.success || !envio.contrato_codigo) {
      this.throwError(envio.message, envio.statusCode, envio.codigo);
    }

    let envelopeId: string | undefined;

    try {
      ({ envelopeId } = await this.docusign.crearSobre({
        pdf: hoja.pdf,
        nombreDocumento: `${envio.contrato_codigo}.pdf`,
        asunto: `Contrato de alquiler ${envio.contrato_codigo}`,
        ...(webhookUrl ? { webhookUrl } : {}), // TEMPORAL(webhook-url)
        firmantes: firmantes.map((firmante, indice) => ({
          recipientId: firmante.recipientId,
          clientUserId: firmante.clientUserId,
          nombre: nombreFirmante(firmante),
          email: firmante.email,
          posicionFirma: hoja.posiciones[indice],
        })),
      }));

      const registrado = await this.contratoRepo.registrarSobre(
        idContrato,
        envelopeId,
        firmantes.map(firmante => ({
          tipo: firmante.rol === 'garante' ? ('garante' as const) : ('usuario' as const),
          id: firmante.id,
          ...(firmante.rol === 'garante' ? {} : { tipo_firmante: firmante.rol === 'locador' ? 1 : 2 }),
          recipient_id: firmante.recipientId,
          client_user_id: firmante.clientUserId,
        }))
      );

      if (!registrado.success) {
        throw new Error(registrado.message);
      }
    } catch (error) {
      await this.deshacerEnvio(idContrato, user.id, envio.codigo_nuevo ?? false, envelopeId);

      if (error instanceof DocusignError) {
        // El detalle técnico va al log; al usuario no se le muestra.
        console.error('[contrato] DocuSign falló al enviar a firmar:', error.message, error.detalle);
        this.throwError('No pudimos enviar el contrato a firmar. Probá de nuevo en unos minutos.', 502);
      }

      throw error;
    }

    return { id: idContrato, codigo: envio.contrato_codigo, estado: 'pendiente_firma' };
  }

  /**
   * Limpieza cuando falla el envío a firmar: anula el sobre (si se creó) y devuelve el contrato a
   * borrador. Nunca lanza: si la limpieza también falla, se deja en el log y se sigue con el error
   * original, que es el que importa.
   */
  private async deshacerEnvio(
    idContrato: number,
    idLocador: number,
    quitarCodigo: boolean,
    envelopeId?: string
  ): Promise<void> {
    if (envelopeId) {
      try {
        await this.docusign.anularSobre(envelopeId, 'El envío a firmar no se pudo completar.');
      } catch (error) {
        console.error(`[contrato] No se pudo anular el sobre ${envelopeId} de DocuSign:`, error);
      }
    }

    try {
      await this.contratoRepo.revertirEnvio(idContrato, idLocador, quitarCodigo);
    } catch (error) {
      console.error(`[contrato] No se pudo revertir el envío del contrato ${idContrato}:`, error);
    }
  }

  /**
   * US-06 · Descartar un borrador (el cliente pide confirmación antes). Lo elimina y la solicitud
   * de origen vuelve a pendiente (el locador puede aceptarla de nuevo o elegir a otra). Solo
   * borradores: 409 si no.
   */
  async descartar(user: AuthenticatedUser, idContrato: number): Promise<void> {
    this.validarAcceso(user, idContrato);

    const resultado = await this.contratoRepo.descartarBorrador(idContrato, user.id);

    if (!resultado.success) {
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    // El PDF del borrador ya no tiene dónde mostrarse: se borra de Storage.
    if (resultado.pdf_anterior) {
      await this.contratoRepo.eliminarPdf(resultado.pdf_anterior);
    }
  }

  /** El contrato del locador, solo si existe, es suyo y sigue en borrador (si no, 404 o 409). */
  private async contratoEditableParaPdf(user: AuthenticatedUser, idContrato: number) {
    const contrato = await this.contratoRepo.findParaPdf(idContrato, user.id);

    if (!contrato) {
      this.throwError('No encontramos este contrato.', 404);
    }

    // US-05: un contrato enviado a firmar no se puede editar, tampoco su PDF.
    if (contrato.estado !== ESTADO_CONTRATO.BORRADOR) {
      this.throwError('Solo se puede modificar un contrato en borrador.', 409, 'CONTRATO_NO_EDITABLE');
    }

    return contrato;
  }

  /**
   * US-05, paso 3 · Primer paso de la carga del PDF: entrega una URL firmada para que el
   * navegador suba el archivo **directo a Storage**. No pasa por la API porque en Vercel las
   * funciones aceptan cuerpos de hasta 4,5 MB y la US permite PDFs de hasta 5 MB.
   * Cada pedido genera una ruta nueva: subir un PDF nunca pisa el que ya está registrado.
   */
  async urlSubidaPdf(user: AuthenticatedUser, idContrato: number): Promise<UrlSubidaPdfResponse> {
    this.validarAcceso(user, idContrato);
    await this.contratoEditableParaPdf(user, idContrato);

    const url = await this.contratoRepo.crearUrlSubidaPdf(nuevaRutaPdf(idContrato, randomUUID()));

    return { ...url, tamano_maximo_bytes: MAX_PDF_BYTES };
  }

  /**
   * US-05, paso 3 · Segundo paso: el front avisa que ya subió el archivo. La API lo descarga,
   * verifica que sea un PDF de hasta 5 MB (no confía en lo que declara el cliente), calcula su
   * hash y lo registra en el borrador. Si ya había un PDF, lo reemplaza y borra el anterior.
   */
  async registrarPdf(
    user: AuthenticatedUser,
    idContrato: number,
    cuerpo: unknown
  ): Promise<ContratoBorradorResponse> {
    this.validarAcceso(user, idContrato);

    const { path, nombre } = validarRegistrarPdf(cuerpo, idContrato);
    await this.contratoEditableParaPdf(user, idContrato);

    const descarga = await this.contratoRepo.descargarPdf(path);

    if (descarga.estado === 'no_encontrado') {
      this.throwError('No encontramos el archivo subido. Volvé a cargar el PDF.', 400);
    }

    // Un archivo que no cumple se borra de Storage: no queda suelto un PDF sin registrar.
    if (descarga.estado === 'demasiado_grande') {
      await this.contratoRepo.eliminarPdf(path);
      this.throwError('El contrato no puede superar los 5 MB.', 413);
    }

    try {
      validarArchivoPdf(descarga.archivo);
    } catch (error) {
      await this.contratoRepo.eliminarPdf(path);
      throw error;
    }

    const resultado = await this.contratoRepo.registrarPdf(idContrato, user.id, {
      path,
      nombre,
      sha256: createHash('sha256').update(descarga.archivo).digest('hex'),
      tamano: descarga.archivo.length,
    });

    if (!resultado.success) {
      // El contrato dejó de ser editable mientras tanto: el archivo recién subido sobra.
      await this.contratoRepo.eliminarPdf(path);
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    if (resultado.pdf_anterior && resultado.pdf_anterior !== path) {
      await this.contratoRepo.eliminarPdf(resultado.pdf_anterior);
    }

    return this.obtener(user, idContrato);
  }

  /**
   * US-05 · Iniciar contrato: crea el borrador desde una solicitud aceptada.
   *
   * La oferta de la propiedad no se modifica (ver docs/gestion_contrato.md): el borrador es una
   * fila nueva. Las reglas de negocio las valida la función SQL `iniciar_contrato`, que además
   * hace el alta en una sola transacción.
   */
  async iniciar(user: AuthenticatedUser, idSolicitud: number): Promise<ContratoDTO> {
    if (!user?.id) {
      this.throwError('Debe iniciar sesión para iniciar un contrato.', 401);
    }

    if (!user.roles.includes('locador')) {
      this.throwError('Se requiere el rol locador para iniciar un contrato.', 403);
    }

    if (!Number.isInteger(idSolicitud) || idSolicitud < 1) {
      this.throwError('El identificador de la solicitud no es válido.', 400);
    }

    const resultado = await this.contratoRepo.iniciarContrato(idSolicitud, user.id);

    if (!resultado.success || resultado.contrato_id === undefined) {
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    const contrato = await this.contratoRepo.findById(resultado.contrato_id);

    if (!contrato) {
      this.throwError('No se pudo recuperar el contrato creado.', 500);
    }

    return contrato;
  }
}

export const contratoService = new ContratoService();
