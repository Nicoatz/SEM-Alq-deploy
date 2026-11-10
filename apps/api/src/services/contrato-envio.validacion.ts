/**
 * Validación de "enviar a firmar" (US-05, paso 4). Funciones puras: no tocan la base ni DocuSign.
 *
 * Un borrador puede guardarse incompleto; lo obligatorio se exige recién acá. La función SQL
 * `enviar_contrato` vuelve a controlarlo (defensa en profundidad), pero esta validación da el
 * mensaje claro y se hace antes de gastar una llamada a DocuSign.
 */
import type { ContratoBorradorResponse, EnviarContratoRequest } from '../dtos';

function fallar(message: string, codigo?: string): never {
  const error = new Error(message) as Error & { statusCode: number; codigo?: string };
  error.statusCode = 400;
  if (codigo) error.codigo = codigo;
  throw error;
}

/**
 * US-05, paso 4: para enviar a firmar se debe marcar la casilla "Revisé la correcta redacción del
 * contrato y entiendo que después de enviarlo no puedo editarlo".
 */
export function validarEnviar(cuerpo: unknown): EnviarContratoRequest {
  const confirma =
    typeof cuerpo === 'object' && cuerpo !== null && (cuerpo as Record<string, unknown>).confirma_revision;

  if (confirma !== true) {
    fallar(
      'Tenés que confirmar que revisaste la redacción del contrato antes de enviarlo a firmar.',
      'FALTA_CONFIRMAR_REVISION'
    );
  }

  return { confirma_revision: true };
}

/**
 * US-05, paso 4: el contrato debe estar completo para enviarse. Lanza 400 con el primer faltante,
 * en el orden de los pasos del alta.
 *
 * @param hoy Fecha de hoy en Córdoba (`YYYY-MM-DD`), por parámetro para poder probarla.
 */
export function validarContratoCompleto(contrato: ContratoBorradorResponse, hoy: string): void {
  const { condiciones } = contrato;

  // Paso 1: sin el locatario no hay a quién pedirle la firma.
  if (!contrato.locador || !contrato.locatario) {
    fallar('El contrato no tiene cargados al locador y al locatario.', 'FALTAN_PARTES');
  }

  // Paso 2: condiciones.
  if (!condiciones.fecha_inicio_contrato) {
    fallar('Indicá la fecha de inicio del contrato.', 'FALTAN_CONDICIONES');
  }
  if (condiciones.fecha_inicio_contrato < hoy) {
    // US-05, paso 2: no puede ser anterior a la fecha actual (el borrador pudo guardarse días atrás).
    fallar('La fecha de inicio no puede ser anterior a la fecha actual.', 'FECHA_INICIO_VENCIDA');
  }
  if (condiciones.duracion_meses === null) {
    fallar('Indicá la duración del contrato en meses.', 'FALTAN_CONDICIONES');
  }
  if (condiciones.monto_alquiler === null) {
    fallar('Indicá el monto inicial del alquiler.', 'FALTAN_CONDICIONES');
  }
  if (condiciones.dias_para_vencimiento === null) {
    fallar('Indicá el plazo de vencimiento del pago.', 'FALTAN_CONDICIONES');
  }
  // NOTA: `indice_aumento = null` es "Sin ajuste" y es válido; con índice, la periodicidad es obligatoria.
  if (condiciones.indice_aumento !== null && !condiciones.frecuencia_ajuste) {
    fallar('Indicá la periodicidad del ajuste.', 'FALTAN_CONDICIONES');
  }

  // Paso 3: el PDF.
  if (!contrato.pdf) {
    fallar('Cargá el PDF del contrato antes de enviarlo a firmar.', 'FALTA_PDF');
  }
}
