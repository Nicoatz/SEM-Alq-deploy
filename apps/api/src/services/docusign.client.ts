/**
 * Cliente de la API REST de DocuSign (US-07, firma de contratos).
 *
 * Qué hace: crea el sobre (envelope) de un contrato con un destinatario por firmante, pide la URL
 * de firma embebida, anula el sobre, lee la IP de una firma y descarga el documento firmado.
 * Quién lo usa: los services de contrato (Pasos 3 a 7 del plan, `paso_paso_docusing.md`).
 * Contra qué: la API REST v2.1 de DocuSign, autenticada con JWT Grant (`config/docusign.ts`).
 *
 * NOTA: los services dependen de la interfaz `IDocusignClient`, no de esta clase, así los tests
 * usan un cliente falso y nunca llaman a DocuSign.
 */
import { DocusignConfig, DocusignError, invalidarTokenDocusign, leerConfigDocusign, obtenerTokenDocusign } from '../config/docusign';

// ─── Tipos ───

/** Dónde va el recuadro de firma en el PDF (coordenadas de DocuSign, en puntos desde arriba a la izquierda). */
export interface PosicionFirma {
  pagina: number;
  x: number;
  y: number;
}

/**
 * Un firmante del sobre: el locador, el locatario o un garante.
 * `clientUserId` es lo que habilita la firma embebida: tiene que repetirse al pedir la URL.
 */
export interface FirmanteSobre {
  /** Número del destinatario dentro del sobre ("1", "2", …); lo elegimos nosotros. */
  recipientId: string;
  clientUserId: string;
  nombre: string;
  email: string;
  posicionFirma: PosicionFirma;
}

export interface CrearSobreInput {
  pdf: Buffer;
  nombreDocumento: string;
  /** Asunto del sobre. Con firma embebida no se manda ningún mail, pero DocuSign lo exige. */
  asunto: string;
  firmantes: FirmanteSobre[];
  /**
   * TEMPORAL(webhook-url): URL del webhook para ESTE sobre. Si viene, manda sobre
   * `DOCUSIGN_WEBHOOK_URL`. Existe solo para probar en `develop` sin tocar las variables de Vercel;
   * se saca junto con `docusign-webhook-url.temporal.ts`.
   */
  webhookUrl?: string;
}

export interface VistaFirmaInput {
  envelopeId: string;
  firmante: Pick<FirmanteSobre, 'recipientId' | 'clientUserId' | 'nombre' | 'email'>;
  /** A dónde vuelve el usuario al terminar. DocuSign le agrega `?event=signing_complete`, `decline`, etc. */
  returnUrl: string;
}

/** Un firmante tal como lo informa DocuSign. */
export interface FirmanteEstadoDocusign {
  recipientId: string;
  nombre: string;
  /** `sent`, `delivered`, `completed`, `declined`, etc. */
  estado: string;
  /** Cuándo firmó (ISO 8601), solo si `completed`. */
  firmadoEn: string | null;
  /** Cuándo rechazó (ISO 8601) y por qué, solo si `declined`. */
  rechazadoEn: string | null;
  motivoRechazo: string | null;
}

/** El estado real de un sobre en DocuSign: la fuente de verdad de las firmas. */
export interface EstadoSobreDocusign {
  /** `sent`, `completed`, `declined`, `voided`, etc. */
  estado: string;
  firmantes: FirmanteEstadoDocusign[];
}

export interface IDocusignClient {
  /** Estado del sobre y de cada firmante, leído directo de DocuSign. */
  obtenerEstadoSobre(envelopeId: string): Promise<EstadoSobreDocusign>;
  /** Crea y envía el sobre. Devuelve su id. */
  crearSobre(datos: CrearSobreInput): Promise<{ envelopeId: string }>;
  /**
   * Nombre y mail con los que el destinatario está en el sobre, o `null` si no existe. La URL de
   * firma tiene que repetirlos exactos, y el mail de un usuario puede haber cambiado desde el envío.
   */
  obtenerDestinatario(envelopeId: string, recipientId: string): Promise<{ nombre: string; email: string } | null>;
  /** URL de firma de un destinatario: dura minutos y se usa una sola vez. Nunca se guarda. */
  crearVistaFirma(datos: VistaFirmaInput): Promise<{ url: string }>;
  /** Anula el sobre (rechazo o cancelación del envío). Un sobre anulado no se puede firmar. */
  anularSobre(envelopeId: string, motivo: string): Promise<void>;
  /** IP desde la que firmó `nombre`, o `null` si DocuSign no la informa. */
  obtenerIpDeFirma(envelopeId: string, nombre: string): Promise<string | null>;
  /** PDF final: documento firmado más el certificado de finalización. */
  descargarDocumentoFirmado(envelopeId: string): Promise<Buffer>;
}

// ─── Eventos de auditoría ───

interface EventoAuditoria {
  eventFields?: { name?: string; value?: string }[];
}

/**
 * Saca de los eventos de auditoría de un sobre la IP de la última firma de `nombre`.
 *
 * NOTA: los nombres de los campos (`Action`, `UserName`, `ClientIPAddress`) son los que se
 * esperan de la API de auditoría de DocuSign, pero **no se verificaron contra el sandbox**:
 * confirmarlos en el Paso 5 y ajustar acá si difieren. Está separada en una función pura para que
 * ese ajuste no toque nada más. Devuelve `null` si no encuentra la firma o no trae IP.
 */
export function extraerIpDeFirma(eventos: EventoAuditoria[], nombre: string): string | null {
  const normalizar = (texto: string | undefined) => (texto ?? '').trim().toLowerCase();
  let ip: string | null = null;

  for (const evento of eventos) {
    const campos = new Map((evento.eventFields ?? []).map(campo => [normalizar(campo.name), campo.value ?? '']));

    const esFirma = normalizar(campos.get('action')) === 'signed';
    const esDelFirmante = normalizar(campos.get('username')) === normalizar(nombre);
    const ipDelEvento = campos.get('clientipaddress') || campos.get('ipaddress') || null;

    // Si hay varias firmas del mismo nombre, queda la última.
    if (esFirma && esDelFirmante && ipDelEvento) ip = ipDelEvento;
  }

  return ip;
}

// ─── Implementación ───

export class DocusignClient implements IDocusignClient {
  constructor(
    private readonly obtenerConfig: () => DocusignConfig = leerConfigDocusign,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  /**
   * Llamada a la API REST con el token vigente. Si DocuSign responde 401 (token vencido o
   * revocado) descarta el token y reintenta una sola vez.
   */
  private async pedir(ruta: string, init: RequestInit = {}, reintentar = true): Promise<Response> {
    const config = this.obtenerConfig();
    const token = await obtenerTokenDocusign(config, this.fetchFn);

    const respuesta = await this.fetchFn(`${config.baseUrl}/v2.1/accounts/${config.accountId}${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
    });

    if (respuesta.status === 401 && reintentar) {
      invalidarTokenDocusign();
      return this.pedir(ruta, init, false);
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => null);
      throw new DocusignError(`DocuSign respondió ${respuesta.status} en ${init.method ?? 'GET'} ${ruta}.`, 502, detalle);
    }

    return respuesta;
  }

  private pedirJson(ruta: string, metodo: string, cuerpo: unknown): Promise<Response> {
    return this.pedir(ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  }

  async obtenerEstadoSobre(envelopeId: string): Promise<EstadoSobreDocusign> {
    const [sobre, destinatarios] = await Promise.all([
      this.pedir(`/envelopes/${envelopeId}`).then(r => r.json() as Promise<{ status?: string }>),
      this.pedir(`/envelopes/${envelopeId}/recipients`).then(
        r =>
          r.json() as Promise<{
            signers?: {
              recipientId?: string;
              name?: string;
              status?: string;
              signedDateTime?: string;
              declinedDateTime?: string;
              declinedReason?: string;
            }[];
          }>
      ),
    ]);

    return {
      estado: sobre.status ?? 'desconocido',
      firmantes: (destinatarios.signers ?? []).map(firmante => ({
        recipientId: firmante.recipientId ?? '',
        nombre: firmante.name ?? '',
        estado: firmante.status ?? 'desconocido',
        firmadoEn: firmante.signedDateTime ?? null,
        rechazadoEn: firmante.declinedDateTime ?? null,
        motivoRechazo: firmante.declinedReason ?? null,
      })),
    };
  }

  /**
   * Aviso a nuestra API cuando alguien firma o rechaza, o el sobre termina. Va dentro de cada
   * sobre (no hace falta configurar nada en el panel de DocuSign). El aviso es solo un disparador:
   * la API vuelve a preguntarle a DocuSign qué pasó (`obtenerEstadoSobre`).
   *
   * NOTA: la forma de este bloque sigue la API de DocuSign pero no se probó contra el sandbox con
   * una firma real: verificarlo en la prueba con túnel público.
   */
  private notificacionDeEventos(url: string) {
    return {
      url,
      loggingEnabled: 'true',
      // DocuSign reintenta hasta recibir un 200.
      requireAcknowledgment: 'true',
      useSoapInterface: 'false',
      includeTimeZone: 'true',
      // Sin esto DocuSign NO firma el aviso del sobre (aunque haya una clave HMAC cargada en el panel)
      // y `webhook.controller` lo rechaza con 401. Con la clave de Connect activa, agrega las cabeceras
      // `X-DocuSign-Signature-N`.
      includeHMAC: 'true',
      envelopeEvents: [
        { envelopeEventStatusCode: 'completed' },
        { envelopeEventStatusCode: 'declined' },
        { envelopeEventStatusCode: 'voided' },
      ],
      recipientEvents: [{ recipientEventStatusCode: 'Completed' }, { recipientEventStatusCode: 'Declined' }],
      eventData: { version: 'restv2.1', format: 'json', includeData: ['recipients'] },
    };
  }

  async crearSobre({
    pdf,
    nombreDocumento,
    asunto,
    firmantes,
    webhookUrl: webhookUrlDelEnvio,
  }: CrearSobreInput): Promise<{ envelopeId: string }> {
    // TEMPORAL(webhook-url): la del envío (si hay) gana sobre la variable de entorno.
    const webhookUrl = webhookUrlDelEnvio ?? this.obtenerConfig().webhookUrl;

    if (!webhookUrl) {
      console.warn('[docusign] Falta DOCUSIGN_WEBHOOK_URL: el sobre se crea pero DocuSign no avisará las firmas.');
    }

    const respuesta = await this.pedirJson('/envelopes', 'POST', {
      emailSubject: asunto,
      ...(webhookUrl ? { eventNotification: this.notificacionDeEventos(webhookUrl) } : {}),
      // `sent` crea el sobre y lo deja listo para firmar en un solo paso.
      status: 'sent',
      documents: [
        { documentId: '1', name: nombreDocumento, fileExtension: 'pdf', documentBase64: pdf.toString('base64') },
      ],
      recipients: {
        signers: firmantes.map(firmante => ({
          recipientId: firmante.recipientId,
          clientUserId: firmante.clientUserId,
          name: firmante.nombre,
          email: firmante.email,
          // NOTA: todos con el mismo orden: firman en paralelo, sin importar quién va primero.
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                documentId: '1',
                pageNumber: String(firmante.posicionFirma.pagina),
                xPosition: String(firmante.posicionFirma.x),
                yPosition: String(firmante.posicionFirma.y),
              },
            ],
          },
        })),
      },
    });

    const { envelopeId } = (await respuesta.json()) as { envelopeId?: string };

    if (!envelopeId) {
      throw new DocusignError('DocuSign no devolvió el id del sobre.');
    }

    return { envelopeId };
  }

  async obtenerDestinatario(
    envelopeId: string,
    recipientId: string
  ): Promise<{ nombre: string; email: string } | null> {
    const respuesta = await this.pedir(`/envelopes/${envelopeId}/recipients`);
    const { signers } = (await respuesta.json()) as {
      signers?: { recipientId?: string; name?: string; email?: string }[];
    };

    const destinatario = (signers ?? []).find(firmante => firmante.recipientId === recipientId);

    return destinatario?.name && destinatario.email
      ? { nombre: destinatario.name, email: destinatario.email }
      : null;
  }

  async crearVistaFirma({ envelopeId, firmante, returnUrl }: VistaFirmaInput): Promise<{ url: string }> {
    const respuesta = await this.pedirJson(`/envelopes/${envelopeId}/views/recipient`, 'POST', {
      returnUrl,
      // La identidad ya la validó RentAR (sesión o token del garante).
      authenticationMethod: 'none',
      // NOTA: DocuSign exige que email, nombre y clientUserId coincidan con los del sobre.
      email: firmante.email,
      userName: firmante.nombre,
      clientUserId: firmante.clientUserId,
      recipientId: firmante.recipientId,
    });

    const { url } = (await respuesta.json()) as { url?: string };

    if (!url) {
      throw new DocusignError('DocuSign no devolvió la URL de firma.');
    }

    return { url };
  }

  async anularSobre(envelopeId: string, motivo: string): Promise<void> {
    await this.pedirJson(`/envelopes/${envelopeId}`, 'PUT', { status: 'voided', voidedReason: motivo });
  }

  async obtenerIpDeFirma(envelopeId: string, nombre: string): Promise<string | null> {
    const respuesta = await this.pedir(`/envelopes/${envelopeId}/audit_events`);
    const { auditEvents } = (await respuesta.json()) as { auditEvents?: EventoAuditoria[] };

    return extraerIpDeFirma(auditEvents ?? [], nombre);
  }

  async descargarDocumentoFirmado(envelopeId: string): Promise<Buffer> {
    // NOTA: `certificate=true` agrega el certificado de finalización al PDF combinado.
    // Verificar en el sandbox que el parámetro funciona así (Paso 7).
    const respuesta = await this.pedir(`/envelopes/${envelopeId}/documents/combined?certificate=true`, {
      headers: { Accept: 'application/pdf' },
    });

    return Buffer.from(await respuesta.arrayBuffer());
  }
}

export const docusignClient: IDocusignClient = new DocusignClient();
