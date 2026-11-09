/**
 * Validación del cuerpo de "firmar" (US-07). Función pura.
 *
 * NOTA: la lectura del documento (llegar a la última página) y la confirmación previa son del
 * front: la API no puede comprobarlas. Lo único que puede exigir es que el cliente declare que
 * el usuario marcó "Leí el contrato completo y acepto sus condiciones y cláusulas".
 */

import type { FirmarContratoRequest } from '../dtos';

/** US-07: el motivo del rechazo tiene hasta 300 caracteres. */
export const MAX_MOTIVO_RECHAZO = 300;

/**
 * Cuerpo de "rechazar" (US-07): `{ motivo?: string | null }`. El motivo es opcional; un texto vacío
 * o de puros espacios cuenta como "sin motivo". Más de 300 caracteres es un 400.
 */
export function validarRechazar(cuerpo: unknown): string | null {
  const motivo =
    typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>).motivo : undefined;

  if (motivo === undefined || motivo === null) return null;

  if (typeof motivo !== 'string') {
    const error = new Error('El motivo debe ser un texto.') as Error & { statusCode: number; codigo: string };
    error.statusCode = 400;
    error.codigo = 'MOTIVO_INVALIDO';
    throw error;
  }

  const limpio = motivo.trim();

  if (limpio.length > MAX_MOTIVO_RECHAZO) {
    const error = new Error(`El motivo no puede superar los ${MAX_MOTIVO_RECHAZO} caracteres.`) as Error & {
      statusCode: number;
      codigo: string;
    };
    error.statusCode = 400;
    error.codigo = 'MOTIVO_MUY_LARGO';
    throw error;
  }

  return limpio === '' ? null : limpio;
}

export function validarFirmar(cuerpo: unknown): FirmarContratoRequest {
  const acepta =
    typeof cuerpo === 'object' && cuerpo !== null && (cuerpo as Record<string, unknown>).acepta_condiciones;

  if (acepta !== true) {
    const error = new Error('Tenés que aceptar las condiciones del contrato para firmarlo.') as Error & {
      statusCode: number;
      codigo: string;
    };
    error.statusCode = 400;
    error.codigo = 'FALTA_ACEPTAR_CONDICIONES';
    throw error;
  }

  return { acepta_condiciones: true };
}
