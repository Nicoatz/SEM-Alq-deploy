/**
 * Firma de contratos con DocuSign (US-07): pedir la URL de firma y el enlace temporal del garante.
 *
 * Qué hace: no registra firmas. Verifica quién es la persona y si le toca firmar, y le pide a
 * DocuSign la URL donde firma (firma embebida). Que la firma se completó lo avisa el webhook de
 * DocuSign (Paso 5 del plan): esa es la fuente de verdad, nunca el navegador.
 * Quién lo usa: `firma.controller.ts`.
 * Contra qué: el repositorio de contratos (ver `contrato.repository.ts`) y el cliente de DocuSign.
 *
 * NOTA: ni acá ni en la base se guarda la "conformidad" (`fecha_conformidad`) al pedir la URL de
 * firma. Es irreversible y, una vez registrada, impide editar el contrato (triggers de US-27):
 * una persona que abre la firma y se arrepiente dejaría al locador sin poder modificar el
 * contrato. La evidencia de la firma es la firma real, que registra el webhook.
 */
import type {
  ConsultaEnlaceGaranteResponse,
  EnlaceFirmaGaranteResponse,
  IniciarFirmaResponse,
  RechazarContratoResponse,
} from '../dtos';
import { DocusignError, leerConfigDocusign } from '../config/docusign';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import {
  ESTADO_CONTRATO,
  GaranteParaFirma,
  IContratoRepository,
  contratoRepository,
} from '../repositories/contrato.repository';
import { validarFirmar, validarRechazar } from './contrato-firma.validacion';
import { RolFirmante, clientUserIdDe } from './contrato-firmantes';
import {
  generarTokenGarante,
  hashearToken,
  tokenTieneFormato,
  vencimientoDelEnlace,
} from './contrato-token-garante';
import { IDocusignClient, docusignClient } from './docusign.client';

/** Un enlace que no sirve se responde siempre igual, sea cual sea el motivo (US-07, "Garantes"). */
const MENSAJE_ENLACE_INVALIDO = 'Este enlace no es válido o ya no está disponible.';

export class ContratoFirmaService {
  constructor(
    private readonly contratoRepo: IContratoRepository = contratoRepository,
    private readonly docusign: IDocusignClient = docusignClient,
    /** URL pública del front, de donde se arman los enlaces y las URL de retorno. */
    private readonly urlWeb: () => string = () => leerConfigDocusign().webUrl,
    private readonly ahora: () => Date = () => new Date()
  ) {}

  private throwError(message: string, statusCode: number, codigo?: string): never {
    const error = new Error(message) as Error & { statusCode: number; codigo?: string };
    error.statusCode = statusCode;
    if (codigo) error.codigo = codigo;
    throw error;
  }

  /** Errores de DocuSign: el detalle va al log y al usuario, un mensaje genérico (502). */
  private errorDeDocusign(error: unknown, accion: string): never {
    if (error instanceof DocusignError) {
      console.error(`[firma] DocuSign falló al ${accion}:`, error.message, error.detalle);
      this.throwError('No pudimos abrir la firma. Probá de nuevo en unos minutos.', 502);
    }
    throw error;
  }

  // ─── Locador y locatario ───

  /**
   * POST /contratos/:id/firmar · Pide la URL de firma de DocuSign para el locador o el locatario.
   *
   * - Sin sesión: 401. Inexistente, ajeno o (para el locatario) borrador: 404 con el mismo mensaje.
   * - Sin `acepta_condiciones: true`: 400.
   * - Que el contrato no esté pendiente de firma: 409 `CONTRATO_NO_PENDIENTE`; que la persona ya
   *   haya firmado: 409 `YA_FIRMO` (una parte no firma dos veces).
   * - Sobre no registrado o anulado: 409 `SOBRE_NO_DISPONIBLE`.
   */
  async iniciarFirma(user: AuthenticatedUser, idContrato: number, cuerpo: unknown): Promise<IniciarFirmaResponse> {
    if (!user?.id) {
      this.throwError('Debe iniciar sesión para firmar el contrato.', 401);
    }

    if (!Number.isInteger(idContrato) || idContrato < 1) {
      this.throwError('El identificador del contrato no es válido.', 400);
    }

    validarFirmar(cuerpo);

    const contrato = await this.contratoRepo.findParaFirma(idContrato, user.id);

    if (!contrato) {
      this.throwError('No encontramos este contrato.', 404);
    }

    const rol: RolFirmante = contrato.parte.tipo_firmante === 1 ? 'locador' : 'locatario';

    // Un borrador no se mostró nunca al locatario: para él es como si no existiera.
    if (contrato.estado === ESTADO_CONTRATO.BORRADOR && rol === 'locatario') {
      this.throwError('No encontramos este contrato.', 404);
    }

    if (contrato.estado !== ESTADO_CONTRATO.PENDIENTE_FIRMA) {
      this.throwError('El contrato no está pendiente de firma.', 409, 'CONTRATO_NO_PENDIENTE');
    }

    if (contrato.parte.estado_firma === 'firmado') {
      this.throwError('Ya firmaste este contrato.', 409, 'YA_FIRMO');
    }

    if (contrato.parte.estado_firma !== 'pendiente') {
      this.throwError('El contrato no está pendiente de firma.', 409, 'CONTRATO_NO_PENDIENTE');
    }

    if (!contrato.envelope_id || !contrato.parte.recipient_id) {
      this.throwError('El contrato todavía no tiene el sobre de firma listo.', 409, 'SOBRE_NO_DISPONIBLE');
    }

    // El locador vuelve a su detalle; el locatario, a Mi alquiler (US-07, "Acceso").
    const returnUrl =
      rol === 'locador'
        ? `${this.urlWeb()}/panel/contratos/${idContrato}`
        : `${this.urlWeb()}/panel/alquiler?contrato=${idContrato}`;

    return this.abrirVistaDeFirma({
      envelopeId: contrato.envelope_id,
      recipientId: contrato.parte.recipient_id,
      clientUserId: clientUserIdDe(rol, user.id),
      returnUrl,
    });
  }

  /**
   * POST /contratos/:id/rechazar · El locador o el locatario rechazan la firma (US-07). El contrato
   * vuelve a "borrador", se borran las firmas y se anula el sobre de DocuSign. Después el locador
   * puede modificarlo y volver a enviarlo: se crea un sobre nuevo y firman todos otra vez.
   *
   * - Sin sesión 401. Inexistente, ajeno o (para el locatario) borrador: 404 con el mismo mensaje.
   * - Motivo de más de 300 caracteres: 400 `MOTIVO_MUY_LARGO`.
   * - No pendiente de firma: 409 `CONTRATO_NO_PENDIENTE`. Quien ya firmó no puede rechazar: 409
   *   `YA_FIRMO`.
   * - Los garantes no rechazan: no tienen sesión ni ruta para esto.
   *
   * NOTA: primero se cambia la base y después se anula el sobre. Si la anulación falla, el contrato
   * ya está en borrador y el sobre queda desvinculado: el webhook lo ignora. Hacerlo al revés
   * dejaría un contrato pendiente de firma con un sobre anulado, que no se puede firmar.
   */
  async rechazar(user: AuthenticatedUser, idContrato: number, cuerpo: unknown): Promise<RechazarContratoResponse> {
    if (!user?.id) {
      this.throwError('Debe iniciar sesión para rechazar la firma.', 401);
    }

    if (!Number.isInteger(idContrato) || idContrato < 1) {
      this.throwError('El identificador del contrato no es válido.', 400);
    }

    const motivo = validarRechazar(cuerpo);

    const contrato = await this.contratoRepo.findParaFirma(idContrato, user.id);

    if (!contrato) {
      this.throwError('No encontramos este contrato.', 404);
    }

    const rol: RolFirmante = contrato.parte.tipo_firmante === 1 ? 'locador' : 'locatario';

    // Un borrador no se mostró nunca al locatario: para él es como si no existiera.
    if (contrato.estado === ESTADO_CONTRATO.BORRADOR && rol === 'locatario') {
      this.throwError('No encontramos este contrato.', 404);
    }

    if (contrato.estado !== ESTADO_CONTRATO.PENDIENTE_FIRMA) {
      this.throwError('El contrato no está pendiente de firma.', 409, 'CONTRATO_NO_PENDIENTE');
    }

    if (contrato.parte.estado_firma === 'firmado') {
      this.throwError('Ya firmaste este contrato: no podés rechazarlo.', 409, 'YA_FIRMO');
    }

    if (!contrato.envelope_id) {
      this.throwError('El contrato todavía no tiene el sobre de firma listo.', 409, 'SOBRE_NO_DISPONIBLE');
    }

    const resultado = await this.contratoRepo.registrarRechazo(contrato.envelope_id);

    if (!resultado.success) {
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    await this.dejarConstanciaDelRechazo(contrato.envelope_id, idContrato, user.id, rol, motivo);
    await this.anularSobre(contrato.envelope_id, 'La firma fue rechazada.');

    return { id: idContrato, estado: 'borrador' };
  }

  /**
   * El motivo del rechazo no se guarda en el contrato (vuelve a borrador y se limpia): queda en el
   * registro de avisos, para auditar. Si falla, el rechazo igual vale: solo se deja en el log.
   */
  private async dejarConstanciaDelRechazo(
    envelopeId: string,
    idContrato: number,
    idUsuario: number,
    rol: RolFirmante,
    motivo: string | null
  ): Promise<void> {
    try {
      const evento = await this.contratoRepo.registrarEvento({
        event_key: `rechazo-en-app|${envelopeId}|${this.ahora().toISOString()}`,
        envelope_id: envelopeId,
        tipo: 'rechazo-en-app',
        payload: { id_contrato: idContrato, id_usuario: idUsuario, rol, motivo },
      });
      await this.contratoRepo.marcarEventoProcesado(evento.id);
    } catch (error) {
      console.error(`[firma] No se pudo dejar constancia del rechazo del contrato ${idContrato}:`, error);
    }
  }

  /** Anula el sobre en DocuSign. Nunca lanza: si falla, el sobre queda desvinculado y se ignora. */
  private async anularSobre(envelopeId: string, motivo: string): Promise<void> {
    try {
      await this.docusign.anularSobre(envelopeId, motivo);
    } catch (error) {
      console.error(`[firma] No se pudo anular el sobre ${envelopeId} de DocuSign:`, error);
    }
  }

  // ─── Garantes ───

  /**
   * POST /contratos/:id/garantes/:idGarante/enlace-firma · El locador genera el enlace de firma de
   * un garante. Devuelve la URL una sola vez; en la base queda solo el hash. Pedir otro enlace
   * invalida el anterior. Solo con el contrato pendiente de firma y el garante sin firmar.
   */
  async generarEnlaceGarante(
    user: AuthenticatedUser,
    idContrato: number,
    idGarante: number
  ): Promise<EnlaceFirmaGaranteResponse> {
    if (!user?.id) {
      this.throwError('Debe iniciar sesión para gestionar contratos.', 401);
    }

    if (!user.roles.includes('locador')) {
      this.throwError('Se requiere el rol locador para gestionar contratos.', 403);
    }

    if (!Number.isInteger(idContrato) || idContrato < 1 || !Number.isInteger(idGarante) || idGarante < 1) {
      this.throwError('El identificador no es válido.', 400);
    }

    const { token, hash } = generarTokenGarante();
    const venceEn = vencimientoDelEnlace(this.ahora());

    const resultado = await this.contratoRepo.generarEnlaceGarante(
      idContrato,
      idGarante,
      user.id,
      hash,
      venceEn.toISOString()
    );

    if (!resultado.success) {
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    return { url: `${this.urlWeb()}/firma-garante/${token}`, vence_en: venceEn.toISOString() };
  }

  /**
   * El garante dueño del token, solo si el enlace sirve. Cualquier motivo por el que no sirva
   * (inexistente, vencido, ya usado, contrato que dejó de estar pendiente) es el mismo 404.
   */
  private async garanteDelEnlace(token: unknown): Promise<{ garante: GaranteParaFirma; token: string }> {
    if (!tokenTieneFormato(token)) {
      this.throwError(MENSAJE_ENLACE_INVALIDO, 404);
    }

    const garante = await this.contratoRepo.findGarantePorTokenHash(hashearToken(token));

    const vencido = !garante?.token_vence_en || new Date(garante.token_vence_en) <= this.ahora();

    if (
      !garante ||
      vencido ||
      garante.contrato.estado !== ESTADO_CONTRATO.PENDIENTE_FIRMA ||
      garante.estado_firma !== 'pendiente' ||
      !garante.recipient_id ||
      !garante.contrato.envelope_id
    ) {
      this.throwError(MENSAJE_ENLACE_INVALIDO, 404);
    }

    return { garante, token };
  }

  /**
   * GET /firma-garante/:token · Público. Lo mínimo para que el garante sepa qué va a firmar:
   * su nombre, la propiedad y el código del contrato. Nunca DNI, montos ni datos de las partes.
   */
  async consultarEnlaceGarante(token: unknown): Promise<ConsultaEnlaceGaranteResponse> {
    const { garante } = await this.garanteDelEnlace(token);
    const { contrato } = garante;

    return {
      garante: { nombre: garante.nombre, apellido: garante.apellido },
      contrato: {
        codigo: contrato.codigo,
        propiedad: `${contrato.direccion} ${contrato.numero}${contrato.piso ? `, piso ${contrato.piso}` : ''}, ${contrato.barrio}`,
      },
      vence_en: garante.token_vence_en,
    };
  }

  /**
   * POST /firma-garante/:token/firmar · Público. Pide la URL de firma de DocuSign para el garante.
   * Sin `acepta_condiciones: true`: 400. El enlace se invalida cuando el garante firma (lo hace el
   * webhook), así que mientras no firme puede volver a abrirlo.
   */
  async iniciarFirmaGarante(token: unknown, cuerpo: unknown): Promise<IniciarFirmaResponse> {
    const { garante, token: tokenValido } = await this.garanteDelEnlace(token);

    validarFirmar(cuerpo);

    return this.abrirVistaDeFirma({
      envelopeId: garante.contrato.envelope_id!,
      recipientId: garante.recipient_id!,
      clientUserId: clientUserIdDe('garante', garante.id),
      // NOTA: tras firmar, el token deja de servir; el front debe mirar `event=signing_complete`
      // que agrega DocuSign antes de volver a validar el enlace.
      returnUrl: `${this.urlWeb()}/firma-garante/${tokenValido}`,
    });
  }

  // ─── DocuSign ───

  /**
   * Pide la URL de firma. Nombre y mail se leen del propio sobre y no de la base: DocuSign exige
   * que coincidan exactos con los del envío, y el mail de un usuario pudo cambiar desde entonces.
   */
  private async abrirVistaDeFirma(datos: {
    envelopeId: string;
    recipientId: string;
    clientUserId: string;
    returnUrl: string;
  }): Promise<IniciarFirmaResponse> {
    try {
      const destinatario = await this.docusign.obtenerDestinatario(datos.envelopeId, datos.recipientId);

      if (!destinatario) {
        this.throwError('El contrato todavía no tiene el sobre de firma listo.', 409, 'SOBRE_NO_DISPONIBLE');
      }

      return await this.docusign.crearVistaFirma({
        envelopeId: datos.envelopeId,
        firmante: {
          recipientId: datos.recipientId,
          clientUserId: datos.clientUserId,
          nombre: destinatario.nombre,
          email: destinatario.email,
        },
        returnUrl: datos.returnUrl,
      });
    } catch (error) {
      return this.errorDeDocusign(error, 'crear la vista de firma');
    }
  }
}

export const contratoFirmaService = new ContratoFirmaService();
