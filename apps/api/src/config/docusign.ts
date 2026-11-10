/**
 * Configuración y autenticación contra DocuSign (US-07, firma de contratos).
 *
 * Qué hace: lee las variables de entorno de DocuSign y obtiene el token de acceso con el flujo
 * JWT Grant (integración de servidor): la API firma un JWT con su clave privada RSA y lo cambia
 * por un token. Ningún usuario de RentAR necesita cuenta de DocuSign.
 * Quién lo usa: `services/docusign.client.ts`.
 * Contra qué: sandbox (cuenta demo) por defecto; producción cambiando `DOCUSIGN_OAUTH_HOST` y
 * `DOCUSIGN_BASE_URL` (ver `.env.example`).
 *
 * NOTA: el JWT se firma con `crypto` de Node y no con `jose`: `jose` es solo ESM en este proyecto
 * y se carga con `import()` dinámico; para un RS256 estándar no vale la pena esa complicación.
 */
import { createPrivateKey, createSign } from 'crypto';

// ─── Errores ───

/**
 * Error de la integración con DocuSign. Lleva `statusCode` como el resto de los errores de la API
 * (lo lee `error.middleware`). 500 = configuración incompleta; 502 = DocuSign falló o rechazó.
 */
export class DocusignError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 502,
    /** Detalle técnico de DocuSign (para el log, nunca para el usuario). */
    readonly detalle?: unknown
  ) {
    super(message);
    this.name = 'DocusignError';
  }
}

// ─── Configuración ───

export interface DocusignConfig {
  integrationKey: string;
  /** GUID del usuario de DocuSign que se impersona (el que "envía" los sobres). */
  userId: string;
  accountId: string;
  /** Clave privada RSA en PEM (PKCS#1 o PKCS#8). */
  privateKey: string;
  /** Host de OAuth, sin protocolo. Sandbox: `account-d.docusign.com`. */
  oauthHost: string;
  /** URL base de la API REST. Sandbox: `https://demo.docusign.net/restapi`. */
  baseUrl: string;
  /** Clave HMAC de DocuSign Connect, para verificar el webhook (Paso 5). Puede faltar hasta entonces. */
  connectHmacKey: string | null;
  /** URL pública del front: a ella vuelve el usuario después de firmar (`returnUrl`). */
  webUrl: string;
  /**
   * URL pública a la que DocuSign avisa de las firmas (`/api/v1/webhooks/docusign` de esta API).
   * Si falta, los sobres se crean igual pero DocuSign no avisa: ninguna firma llega a registrarse.
   */
  webhookUrl: string | null;
}

const VARIABLES_OBLIGATORIAS = [
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_USER_ID',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_PRIVATE_KEY',
] as const;

/**
 * Lee y valida la configuración. Se llama recién al usar DocuSign (no al arrancar la API), así el
 * resto de la API funciona aunque falten estas variables.
 */
export function leerConfigDocusign(env: NodeJS.ProcessEnv = process.env): DocusignConfig {
  const faltan = VARIABLES_OBLIGATORIAS.filter(nombre => !env[nombre]?.trim());

  if (faltan.length > 0) {
    throw new DocusignError(`Falta la configuración de DocuSign: ${faltan.join(', ')}.`, 500);
  }

  return {
    integrationKey: env.DOCUSIGN_INTEGRATION_KEY!.trim(),
    userId: env.DOCUSIGN_USER_ID!.trim(),
    accountId: env.DOCUSIGN_ACCOUNT_ID!.trim(),
    // En una variable de entorno de una sola línea, los saltos de línea del PEM se escriben "\n".
    privateKey: env.DOCUSIGN_PRIVATE_KEY!.replace(/\\n/g, '\n').trim(),
    oauthHost: (env.DOCUSIGN_OAUTH_HOST?.trim() || 'account-d.docusign.com').replace(/^https?:\/\//, ''),
    baseUrl: (env.DOCUSIGN_BASE_URL?.trim() || 'https://demo.docusign.net/restapi').replace(/\/+$/, ''),
    connectHmacKey: env.DOCUSIGN_CONNECT_HMAC_KEY?.trim() || null,
    webUrl: (env.WEB_URL?.trim() || 'http://localhost:3001').replace(/\/+$/, ''),
    webhookUrl: env.DOCUSIGN_WEBHOOK_URL?.trim() || null,
  };
}

// ─── JWT Grant ───

/** Vida del JWT de aserción: DocuSign acepta hasta 1 hora. */
const SEGUNDOS_VIDA_ASERCION = 3600;

const base64Url = (datos: Buffer | string): string => Buffer.from(datos).toString('base64url');

/**
 * Arma y firma (RS256) el JWT que se cambia por un token de acceso.
 * `ahoraSegundos` se recibe por parámetro para poder probarlo con un reloj fijo.
 */
export function firmarAsercionJwt(config: DocusignConfig, ahoraSegundos: number): string {
  const encabezado = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = base64Url(
    JSON.stringify({
      iss: config.integrationKey,
      sub: config.userId,
      aud: config.oauthHost,
      iat: ahoraSegundos,
      exp: ahoraSegundos + SEGUNDOS_VIDA_ASERCION,
      scope: 'signature impersonation',
    })
  );

  const firmante = createSign('RSA-SHA256');
  firmante.update(`${encabezado}.${cuerpo}`);
  const firma = firmante.sign(createPrivateKey(config.privateKey));

  return `${encabezado}.${cuerpo}.${base64Url(firma)}`;
}

// ─── Token de acceso (con caché) ───

/** Se renueva con este margen de anticipación, para no usar un token a punto de vencer. */
const MARGEN_RENOVACION_MS = 5 * 60 * 1000;

interface TokenEnCache {
  valor: string;
  venceEn: number;
}

let tokenEnCache: TokenEnCache | null = null;
/** Si varias solicitudes piden token a la vez, comparten un solo pedido a DocuSign. */
let pedidoEnCurso: Promise<string> | null = null;

/** Descarta el token guardado (por ejemplo, si DocuSign respondió 401). */
export function invalidarTokenDocusign(): void {
  tokenEnCache = null;
}

async function pedirToken(config: DocusignConfig, fetchFn: typeof fetch, ahora: number): Promise<string> {
  const respuesta = await fetchFn(`https://${config.oauthHost}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: firmarAsercionJwt(config, Math.floor(ahora / 1000)),
    }),
  });

  const cuerpo = (await respuesta.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  } | null;

  if (!respuesta.ok || !cuerpo?.access_token) {
    // NOTA: `consent_required` significa que falta el consentimiento único del usuario
    // impersonado (Paso 0 del plan). Se distingue porque se arregla desde el panel, no con código.
    const motivo =
      cuerpo?.error === 'consent_required'
        ? 'Falta el consentimiento del usuario de DocuSign (consent_required).'
        : 'DocuSign rechazó la autenticación de la API.';
    throw new DocusignError(motivo, 502, cuerpo);
  }

  tokenEnCache = {
    valor: cuerpo.access_token,
    venceEn: ahora + (cuerpo.expires_in ?? SEGUNDOS_VIDA_ASERCION) * 1000,
  };

  return tokenEnCache.valor;
}

/**
 * Token de acceso vigente. Lo reutiliza hasta 5 minutos antes de su vencimiento; si no, pide uno
 * nuevo. `fetchFn` y `ahora` se pueden inyectar para probarlo sin red ni reloj real.
 */
export async function obtenerTokenDocusign(
  config: DocusignConfig = leerConfigDocusign(),
  fetchFn: typeof fetch = fetch,
  ahora: number = Date.now()
): Promise<string> {
  if (tokenEnCache && tokenEnCache.venceEn - MARGEN_RENOVACION_MS > ahora) {
    return tokenEnCache.valor;
  }

  pedidoEnCurso ??= pedirToken(config, fetchFn, ahora).finally(() => {
    pedidoEnCurso = null;
  });

  return pedidoEnCurso;
}
