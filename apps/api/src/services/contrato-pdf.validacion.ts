import type { RegistrarPdfRequest } from '../dtos';

/**
 * Validación del PDF del contrato (US-05, paso 3: "se debe cargar el contrato en formato PDF,
 * con un tamaño no superior a 5MB"). Funciones puras: no tocan Storage ni la base.
 *
 * El navegador sube el archivo directo a Storage (la API en Vercel acepta cuerpos de hasta
 * 4,5 MB), así que la API no confía en lo que declara el cliente: descarga el archivo ya subido
 * y lo vuelve a validar acá.
 */

/** US-05, paso 3: tamaño no superior a 5 MB. */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** Bucket privado de US-27 donde también están los PDF que ve el locatario. */
export const BUCKET_CONTRATOS_PDF = 'contratos-pdf';

/** Cada PDF tiene su propia ruta (`contrato-<id>/<uuid>.pdf`): subir uno nuevo nunca pisa el anterior. */
const PATH_PDF = /^contrato-(\d+)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

/** Todo PDF empieza con `%PDF-`. */
const FIRMA_PDF = Buffer.from('%PDF-');

function fallar(message: string, statusCode = 400): never {
  const error = new Error(message);
  (error as Error & { statusCode: number }).statusCode = statusCode;
  throw error;
}

/** Ruta del PDF firmado de un contrato (el que devuelve DocuSign al completarse). */
export function nuevaRutaPdfFirmado(idContrato: number, uuid: string): string {
  return `contrato-${idContrato}/firmado-${uuid}.pdf`;
}

/** Ruta nueva para el PDF de un contrato. */
export function nuevaRutaPdf(idContrato: number, uuid: string): string {
  return `contrato-${idContrato}/${uuid}.pdf`;
}

/**
 * Valida el cuerpo de `PUT /contratos/:id/pdf`.
 * La ruta tiene que ser una de las que entregó la API **para este contrato**: sin esto, un
 * locador podría registrar el archivo de otro contrato.
 */
export function validarRegistrarPdf(cuerpo: unknown, idContrato: number): RegistrarPdfRequest {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    fallar('El cuerpo de la solicitud debe ser un objeto.');
  }
  const { path, nombre } = cuerpo as Record<string, unknown>;

  if (typeof path !== 'string') fallar('Falta la ruta del archivo subido.');
  const partes = PATH_PDF.exec(path);
  if (!partes || Number(partes[1]) !== idContrato) {
    fallar('La ruta del archivo no corresponde a este contrato.');
  }

  if (typeof nombre !== 'string') fallar('Falta el nombre del archivo.');
  // Se queda con el nombre sin carpetas (algunos navegadores mandan la ruta completa).
  const nombreLimpio = nombre.split(/[\\/]/).pop()?.trim() ?? '';
  if (!nombreLimpio || nombreLimpio.length > 255) {
    fallar('El nombre del archivo es obligatorio (hasta 255 caracteres).');
  }
  if (!/\.pdf$/i.test(nombreLimpio)) fallar('El contrato debe cargarse en formato PDF.');

  return { path, nombre: nombreLimpio };
}

/**
 * Valida el archivo ya descargado de Storage: formato PDF y tamaño de hasta 5 MB.
 * @throws Error con `statusCode` 400 (el tamaño excedido, 413).
 */
export function validarArchivoPdf(archivo: Buffer): void {
  if (archivo.length === 0) fallar('El archivo está vacío.');
  if (archivo.length > MAX_PDF_BYTES) {
    fallar('El contrato no puede superar los 5 MB.', 413);
  }
  if (!archivo.subarray(0, FIRMA_PDF.length).equals(FIRMA_PDF)) {
    fallar('El archivo no es un PDF válido.');
  }
}
