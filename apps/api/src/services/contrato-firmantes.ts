/**
 * Firmantes de un contrato para DocuSign (US-07). Funciones puras.
 *
 * Qué es: arma la lista de firmantes (locador, locatario y garantes) con el identificador que les
 * toca en el sobre. Quién lo usa: el envío a firmar (`contrato.service#enviar`) y, más adelante,
 * el pedido de la URL de firma, que tiene que repetir EXACTAMENTE los mismos nombre, mail y
 * `clientUserId` o DocuSign rechaza la vista de firma.
 */
import type { ContratoBorradorResponse } from '../dtos';

export type RolFirmante = 'locador' | 'locatario' | 'garante';

export interface FirmanteContrato {
  rol: RolFirmante;
  /** `usuario.id` (locador, locatario) o `garante.id` (garante). */
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  /** Número del destinatario dentro del sobre. */
  recipientId: string;
  /** Identificador de la firma embebida: único por firmante y estable. */
  clientUserId: string;
}

/**
 * Identificador de la firma embebida de un firmante. Se calcula (no se lee de la base) para que
 * el envío del sobre y el pedido de la URL de firma usen siempre exactamente el mismo valor.
 */
export function clientUserIdDe(rol: RolFirmante, id: number): string {
  return `${rol}-${id}`;
}

/** Nombre completo tal como se manda a DocuSign. */
export function nombreFirmante(firmante: Pick<FirmanteContrato, 'nombre' | 'apellido'>): string {
  return `${firmante.nombre} ${firmante.apellido}`.trim();
}

/**
 * Locador, locatario y garantes, en ese orden. El `recipientId` es la posición (1, 2, 3, …) y
 * el `clientUserId` incluye el rol y el id, así nunca se repite entre firmantes.
 *
 * NOTA: los garantes firman (decisión de Camila, 07/11/2026; revierte lo dicho por el PO el 05/11).
 */
export function armarFirmantes(contrato: ContratoBorradorResponse): FirmanteContrato[] {
  const { locador, locatario, garantes } = contrato;

  if (!locador || !locatario) {
    throw new Error('El contrato no tiene cargados al locador y al locatario.');
  }

  const firmantes = [
    { rol: 'locador' as const, id: locador.id, ...datosDe(locador) },
    { rol: 'locatario' as const, id: locatario.id, ...datosDe(locatario) },
    ...garantes.map(garante => ({ rol: 'garante' as const, id: garante.id, ...datosDe(garante) })),
  ];

  return firmantes.map((firmante, indice) => ({
    ...firmante,
    recipientId: String(indice + 1),
    clientUserId: clientUserIdDe(firmante.rol, firmante.id),
  }));
}

function datosDe(persona: { nombre: string; apellido: string; email: string } & ({ dni: string } | { numero_documento: string })) {
  return {
    nombre: persona.nombre,
    apellido: persona.apellido,
    email: persona.email,
    dni: 'dni' in persona ? persona.dni : persona.numero_documento,
  };
}
