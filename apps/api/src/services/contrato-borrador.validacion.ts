import type {
  ClausulaRequest,
  CondicionesBorradorRequest,
  GaranteRequest,
  GuardarBorradorRequest,
  PeriodicidadAjuste,
  TipoClausula,
} from '../dtos';

/**
 * Validación de formato del borrador del contrato (US-05). Funciones puras: no tocan la base.
 * Las reglas que necesitan datos (dueño, estado, garantes distintos de las partes, cláusulas
 * fijas) las aplica la función SQL `guardar_borrador_contrato`.
 *
 * Un borrador puede guardarse incompleto (US-05): acá solo se valida lo que llega, nunca que
 * falte algo. Lo obligatorio se exige al enviar a firmar.
 */

// US-05, paso 1: mismo formato de correo que US-35.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DNI = /^[0-9]{7,8}$/;
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLAVE = /^[a-z0-9_-]{1,50}$/i;
const PERIODICIDADES: PeriodicidadAjuste[] = ['trimestral', 'semestral', 'anual'];
const TIPOS_CLAUSULA: TipoClausula[] = ['fija', 'editable', 'propia'];

export const MAX_GARANTES = 3;
/** US-05, paso 3: máximo por cláusula editable o propia. */
export const MAX_CARACTERES_CLAUSULA = 1000;
const MAX_CLAUSULAS = 60;
// numeric(12, 2) y fechas razonables: evitan un error de la base por desborde.
const MAX_MONTO = 9_999_999_999;
const MAX_DURACION_MESES = 600;

function fallar(message: string): never {
  const error = new Error(message);
  (error as Error & { statusCode: number }).statusCode = 400;
  throw error;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor);
}

/** Hoy en Córdoba (`YYYY-MM-DD`): el servidor corre en UTC y de noche ya sería "mañana". */
export function hoyEnArgentina(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba' }).format(ahora);
}

function esFechaValida(valor: string): boolean {
  const partes = FECHA_ISO.exec(valor);
  if (!partes) return false;
  const [, anio, mes, dia] = partes.map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

function validarCondiciones(crudo: unknown, hoy: string): CondicionesBorradorRequest {
  if (!esObjeto(crudo)) fallar('Las condiciones deben enviarse como un objeto.');
  const salida: CondicionesBorradorRequest = {};

  if ('fecha_inicio_contrato' in crudo) {
    const valor = crudo.fecha_inicio_contrato;
    if (valor !== null) {
      if (typeof valor !== 'string' || !esFechaValida(valor)) {
        fallar('La fecha de inicio debe tener el formato AAAA-MM-DD.');
      }
      // US-05, paso 2: la fecha de inicio no puede ser anterior a la fecha actual.
      if (valor < hoy) fallar('La fecha de inicio no puede ser anterior a la fecha actual.');
    }
    salida.fecha_inicio_contrato = valor;
  }

  if ('duracion_meses' in crudo) {
    const valor = crudo.duracion_meses;
    // US-05, paso 2: entero mayor a 0.
    if (!esEntero(valor) || valor <= 0 || valor > MAX_DURACION_MESES) {
      fallar(`La duración debe ser un número entero de meses mayor a 0 y hasta ${MAX_DURACION_MESES}.`);
    }
    salida.duracion_meses = valor;
  }

  if ('monto_alquiler' in crudo) {
    const valor = crudo.monto_alquiler;
    // US-05, paso 2: monto inicial entero mayor a 0.
    if (!esEntero(valor) || valor <= 0 || valor > MAX_MONTO) {
      fallar('El monto inicial del alquiler debe ser un número entero mayor a 0.');
    }
    salida.monto_alquiler = valor;
  }

  if ('deposito' in crudo) {
    const valor = crudo.deposito;
    // US-05, paso 2: depósito entero mayor o igual a 0; vacío = sin depósito.
    if (valor !== null && (!esEntero(valor) || valor < 0 || valor > MAX_MONTO)) {
      fallar('El depósito debe ser un número entero mayor o igual a 0.');
    }
    salida.deposito = valor;
  }

  if ('dias_para_vencimiento' in crudo) {
    const valor = crudo.dias_para_vencimiento;
    // US-05, paso 2: día de vencimiento del pago entre 1 y 28.
    if (!esEntero(valor) || valor < 1 || valor > 28) {
      fallar('El día de vencimiento del pago debe estar entre 1 y 28.');
    }
    salida.dias_para_vencimiento = valor;
  }

  if ('indice_aumento' in crudo) {
    const valor = crudo.indice_aumento;
    // `null` es "Sin ajuste"; si no, el id de un tipo de índice (la base verifica que exista).
    if (valor !== null && (!esEntero(valor) || valor <= 0)) {
      fallar('El índice de ajuste no es válido.');
    }
    salida.indice_aumento = valor;
  }

  if ('frecuencia_ajuste' in crudo) {
    const valor = crudo.frecuencia_ajuste;
    if (valor !== null && !PERIODICIDADES.includes(valor as PeriodicidadAjuste)) {
      fallar('La periodicidad del ajuste debe ser trimestral, semestral o anual.');
    }
    salida.frecuencia_ajuste = valor as PeriodicidadAjuste | null;
  }

  // US-05, paso 2: sin índice ("Sin ajuste") no hay periodicidad.
  if (salida.indice_aumento === null && salida.frecuencia_ajuste) {
    fallar('Sin índice de ajuste no se puede indicar la periodicidad.');
  }

  return salida;
}

function validarGarantes(crudo: unknown): GaranteRequest[] {
  if (!Array.isArray(crudo)) fallar('Los garantes deben enviarse como una lista.');
  // US-05, paso 1: hasta 3 garantes.
  if (crudo.length > MAX_GARANTES) fallar(`Se pueden agregar hasta ${MAX_GARANTES} garantes.`);

  const dnis = new Set<string>();
  const correos = new Set<string>();

  return crudo.map((item, indice) => {
    const numero = indice + 1;
    if (!esObjeto(item)) fallar(`El garante ${numero} no es válido.`);
    const { nombre, apellido, dni, email } = item;

    // US-05, paso 1: nombre, apellido, DNI y correo son obligatorios.
    for (const [campo, valor] of [['nombre', nombre], ['apellido', apellido]] as const) {
      if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > 100) {
        fallar(`El ${campo} del garante ${numero} es obligatorio (hasta 100 caracteres).`);
      }
    }
    if (typeof dni !== 'string' || !DNI.test(dni.trim())) {
      fallar(`El DNI del garante ${numero} debe tener 7 u 8 dígitos numéricos.`);
    }
    if (typeof email !== 'string' || email.trim().length > 255 || !EMAIL.test(email.trim())) {
      fallar(`El correo del garante ${numero} no tiene un formato válido.`);
    }

    // US-05, paso 1: no se repiten DNI ni correo entre garantes.
    const dniLimpio = (dni as string).trim();
    const correoLimpio = (email as string).trim().toLowerCase();
    if (dnis.has(dniLimpio)) fallar('No se puede repetir el DNI entre garantes.');
    if (correos.has(correoLimpio)) fallar('No se puede repetir el correo entre garantes.');
    dnis.add(dniLimpio);
    correos.add(correoLimpio);

    return {
      nombre: (nombre as string).trim(),
      apellido: (apellido as string).trim(),
      dni: dniLimpio,
      email: correoLimpio,
    };
  });
}

function validarClausulas(crudo: unknown): ClausulaRequest[] {
  if (!Array.isArray(crudo)) fallar('Las cláusulas deben enviarse como una lista.');
  if (crudo.length > MAX_CLAUSULAS) fallar(`El contrato no puede tener más de ${MAX_CLAUSULAS} cláusulas.`);

  const claves = new Set<string>();

  return crudo.map((item, indice) => {
    const numero = indice + 1;
    if (!esObjeto(item)) fallar(`La cláusula ${numero} no es válida.`);
    const { clave, tipo, titulo, texto, editada } = item;

    if (typeof clave !== 'string' || !CLAVE.test(clave)) fallar(`La cláusula ${numero} no tiene una clave válida.`);
    if (claves.has(clave)) fallar(`La clave "${clave}" está repetida entre las cláusulas.`);
    claves.add(clave);

    if (!TIPOS_CLAUSULA.includes(tipo as TipoClausula)) {
      fallar(`El tipo de la cláusula ${numero} debe ser fija, editable o propia.`);
    }
    if (typeof titulo !== 'string' || !titulo.trim() || titulo.trim().length > 150) {
      fallar(`El título de la cláusula ${numero} es obligatorio (hasta 150 caracteres).`);
    }
    if (typeof texto !== 'string' || !texto.trim()) {
      fallar(`El texto de la cláusula ${numero} no puede estar vacío.`);
    }
    // US-05, paso 3: las editables y las propias, hasta 1.000 caracteres.
    if (tipo !== 'fija' && (texto as string).length > MAX_CARACTERES_CLAUSULA) {
      fallar(`El texto de la cláusula ${numero} no puede superar los ${MAX_CARACTERES_CLAUSULA} caracteres.`);
    }
    if (editada !== undefined && typeof editada !== 'boolean') {
      fallar(`El campo editada de la cláusula ${numero} debe ser verdadero o falso.`);
    }

    return {
      clave,
      tipo: tipo as TipoClausula,
      titulo: (titulo as string).trim(),
      // El texto se guarda tal cual: lo que se firma no se recorta ni se normaliza.
      texto: texto as string,
      editada: tipo === 'fija' ? false : editada ?? false,
    };
  });
}

/**
 * Valida el cuerpo de `PATCH /contratos/:id` y devuelve solo lo que corresponde guardar.
 * @throws Error con `statusCode` 400 y un mensaje para mostrar al locador.
 */
export function validarGuardarBorrador(cuerpo: unknown, hoy: string): GuardarBorradorRequest {
  if (!esObjeto(cuerpo)) fallar('El cuerpo de la solicitud debe ser un objeto.');
  const salida: GuardarBorradorRequest = {};

  if ('paso' in cuerpo) {
    if (!esEntero(cuerpo.paso) || cuerpo.paso < 1 || cuerpo.paso > 4) {
      fallar('El paso del alta debe estar entre 1 y 4.');
    }
    salida.paso = cuerpo.paso;
  }
  if ('condiciones' in cuerpo) salida.condiciones = validarCondiciones(cuerpo.condiciones, hoy);
  if ('garantes' in cuerpo) salida.garantes = validarGarantes(cuerpo.garantes);
  if ('clausulas' in cuerpo) salida.clausulas = validarClausulas(cuerpo.clausulas);

  if (Object.keys(salida).length === 0) fallar('No hay datos para guardar.');
  return salida;
}
