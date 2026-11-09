/**
 * Hoja de firmas del contrato (US-07).
 *
 * Qué hace: agrega al final del PDF que cargó el locador una página "Hoja de firmas" con un
 * recuadro por firmante, y devuelve en qué posición va el recuadro de firma de DocuSign de cada uno.
 * Quién lo usa: `contrato.service#enviar`, antes de crear el sobre.
 *
 * NOTA: el PDF del locador es de diseño libre y no sabemos dónde hay lugar para firmar. Una página
 * propia garantiza que las firmas nunca tapen texto del contrato. El archivo original no se
 * modifica: en Storage queda el PDF cargado, y a DocuSign viaja una copia con esta hoja.
 */
import { PDFDocument, PageSizes, StandardFonts, rgb } from 'pdf-lib';

import type { PosicionFirma } from './docusign.client';
import type { FirmanteContrato, RolFirmante } from './contrato-firmantes';
import { nombreFirmante } from './contrato-firmantes';

/** A4 en puntos (72 por pulgada). */
const [ANCHO, ALTO] = PageSizes.A4;
const MARGEN_X = 60;
const TOPE_PRIMER_BLOQUE = 150;
const ALTO_BLOQUE = 120;
/** Distancia desde el borde superior del bloque hasta el recuadro de firma de DocuSign. */
const DESPLAZAMIENTO_FIRMA = 22;
const DESPLAZAMIENTO_LINEA = 72;

/** locador + locatario + hasta 3 garantes (US-05, paso 1). */
export const MAX_FIRMANTES = 5;

const ETIQUETA_ROL: Record<RolFirmante, string> = {
  locador: 'Locador',
  locatario: 'Locatario',
  garante: 'Garante',
};

export interface HojaDeFirmas {
  /** PDF original más la hoja de firmas. */
  pdf: Buffer;
  /** Posición del recuadro de firma de cada firmante, en el mismo orden que la lista recibida. */
  posiciones: PosicionFirma[];
}

/**
 * Los textos se dibujan con Helvetica estándar, que solo codifica Latin-1: un carácter fuera de
 * ese rango (por ejemplo, una letra polaca en un apellido) haría fallar la generación. Se
 * reemplaza por "?" en la hoja; el nombre que viaja a DocuSign no se toca.
 */
function aLatin1(texto: string): string {
  return texto.replace(/[^\x20-\x7E -ÿ]/g, '?');
}

/**
 * @throws Error 400 si el PDF no se puede abrir (por ejemplo, está protegido con contraseña).
 */
export async function agregarHojaDeFirmas(archivo: Buffer, firmantes: FirmanteContrato[]): Promise<HojaDeFirmas> {
  if (firmantes.length === 0 || firmantes.length > MAX_FIRMANTES) {
    throw new Error(`La hoja de firmas admite de 1 a ${MAX_FIRMANTES} firmantes.`);
  }

  let documento: PDFDocument;
  try {
    documento = await PDFDocument.load(archivo);
  } catch {
    const error = new Error('No pudimos procesar el PDF del contrato. Probá cargarlo de nuevo.') as Error & {
      statusCode: number;
    };
    error.statusCode = 400;
    throw error;
  }

  const pagina = documento.addPage([ANCHO, ALTO]);
  const numeroDePagina = documento.getPageCount();
  const normal = await documento.embedFont(StandardFonts.Helvetica);
  const negrita = await documento.embedFont(StandardFonts.HelveticaBold);
  const gris = rgb(0.35, 0.35, 0.35);

  // pdf-lib mide desde abajo; DocuSign, desde arriba. `desdeArriba` convierte.
  const desdeArriba = (y: number) => ALTO - y;

  pagina.drawText('Hoja de firmas', { x: MARGEN_X, y: desdeArriba(80), size: 20, font: negrita });
  pagina.drawText('Las partes firman a continuación, en conformidad con el contrato.', {
    x: MARGEN_X,
    y: desdeArriba(104),
    size: 10,
    font: normal,
    color: gris,
  });

  const posiciones = firmantes.map((firmante, indice) => {
    const tope = TOPE_PRIMER_BLOQUE + indice * ALTO_BLOQUE;

    pagina.drawText(ETIQUETA_ROL[firmante.rol], { x: MARGEN_X, y: desdeArriba(tope), size: 11, font: negrita });

    // Línea sobre la que firma.
    pagina.drawLine({
      start: { x: MARGEN_X, y: desdeArriba(tope + DESPLAZAMIENTO_LINEA) },
      end: { x: ANCHO - MARGEN_X, y: desdeArriba(tope + DESPLAZAMIENTO_LINEA) },
      thickness: 0.8,
      color: gris,
    });

    pagina.drawText(aLatin1(nombreFirmante(firmante)), {
      x: MARGEN_X,
      y: desdeArriba(tope + DESPLAZAMIENTO_LINEA + 14),
      size: 10,
      font: normal,
    });
    pagina.drawText(`DNI ${aLatin1(firmante.dni)}`, {
      x: MARGEN_X,
      y: desdeArriba(tope + DESPLAZAMIENTO_LINEA + 27),
      size: 9,
      font: normal,
      color: gris,
    });

    return { pagina: numeroDePagina, x: MARGEN_X, y: tope + DESPLAZAMIENTO_FIRMA };
  });

  return { pdf: Buffer.from(await documento.save()), posiciones };
}
