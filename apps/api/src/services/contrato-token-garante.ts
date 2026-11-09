/**
 * Token del enlace de firma de un garante (US-07). Funciones puras.
 *
 * Los garantes no tienen sesión: el enlace que les entrega el locador es su única credencial. Por
 * eso el token es aleatorio de 256 bits (no adivinable) y en la base se guarda solo su hash
 * SHA-256: quien lea la base no puede reconstruir ningún enlace.
 */
import { createHash, randomBytes } from 'crypto';

/**
 * Vigencia del enlace: 2 días (US-07, sección "Garantes"). Es una regla de negocio: si cambia, se
 * cambia también el criterio de la US.
 */
export const HORAS_VIGENCIA_ENLACE_GARANTE = 48;

/** 32 bytes en base64url son siempre 43 caracteres. */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** SHA-256 en hexadecimal (64 caracteres), el formato que exige `garante.token_firma_hash`. */
export function hashearToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Token nuevo y su hash. El token se entrega una sola vez; el hash es lo único que se guarda. */
export function generarTokenGarante(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashearToken(token) };
}

/**
 * `true` si el texto tiene la forma de un token. Sirve para descartar basura sin ir a la base:
 * un token con otra forma nunca pudo haberse emitido.
 */
export function tokenTieneFormato(token: unknown): token is string {
  return typeof token === 'string' && FORMATO_TOKEN.test(token);
}

/** Fecha de vencimiento de un enlace generado en `ahora`. */
export function vencimientoDelEnlace(ahora: Date): Date {
  return new Date(ahora.getTime() + HORAS_VIGENCIA_ENLACE_GARANTE * 60 * 60 * 1000);
}
