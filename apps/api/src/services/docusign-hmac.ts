/**
 * Verificación de la firma HMAC de los avisos de DocuSign Connect (US-07).
 *
 * DocuSign firma el cuerpo EXACTO del aviso con una clave compartida (HMAC-SHA256, en base64) y
 * manda el resultado en las cabeceras `X-DocuSign-Signature-1`, `-2`, etc. (una por clave activa).
 * Se verifica sobre los bytes crudos: volver a serializar el JSON cambiaría la firma.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const CANTIDAD_MAXIMA_DE_CLAVES = 10;

/** Firma esperada del cuerpo, en base64. */
export function firmarCuerpo(cuerpo: Buffer, clave: string): string {
  return createHmac('sha256', clave).update(cuerpo).digest('base64');
}

/**
 * `true` si alguna cabecera `x-docusign-signature-N` coincide con la firma del cuerpo.
 * La comparación es de tiempo constante, para no filtrar la firma por diferencias de tiempo.
 */
export function firmaDocusignValida(
  cuerpo: Buffer,
  cabecera: (nombre: string) => string | undefined,
  clave: string
): boolean {
  const esperada = Buffer.from(firmarCuerpo(cuerpo, clave));

  for (let n = 1; n <= CANTIDAD_MAXIMA_DE_CLAVES; n++) {
    const recibida = cabecera(`x-docusign-signature-${n}`);
    if (!recibida) continue;

    const bytes = Buffer.from(recibida);
    if (bytes.length === esperada.length && timingSafeEqual(bytes, esperada)) return true;
  }

  return false;
}
