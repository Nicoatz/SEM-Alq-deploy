/**
 * tipos.ts — los tipos de vista de un reclamo (US-14 a US-18).
 *
 * Qué es: lo que usan las pantallas de Reclamos, igual en modo mock y en real.
 * Los adaptadores (`services/adapters/reclamo*.adapter.ts`) traducen a esto el
 * `ReclamoResponse` del back (`@rentar/shared-types`, `reclamo.ts`) y el elenco
 * de `lib/mocks/reclamos.mock.ts`. Un dato que el back no manda queda en `null`,
 * nunca inventado.
 *
 * Decisiones del PO (24/11): sin urgencia ni título visible; estados abierto →
 * en proceso → resuelto, o cancelado. En la base el estado "abierto" se llama
 * `pendiente`: el adaptador lo traduce.
 *
 * Quién lo usa: `lib/reclamos/*`, `services/reclamos.service.ts` y `components/reclamos/*`.
 */
import type { ClaimStatus, TipoReclamoNombre } from '@rentar/shared-types'

export type { TipoReclamoNombre }

/** Un tipo de reclamo del catálogo (US-14), con su texto de ayuda. */
export interface TipoReclamoVista {
  /** Id del catálogo del back (`tipo_reclamo.id`); se manda en el alta. */
  id: number
  nombre: TipoReclamoNombre
  /** "Reparación del inmueble". */
  label: string
  /** Ejemplos debajo del nombre, en las tarjetas del alta: "Cañerías, humedad, pisos, techos". */
  ayuda: string
}

/** La otra parte de un reclamo (locador o locatario). */
export interface PersonaReclamo {
  id: string
  /** Nombre y apellido. */
  nombre: string
  /**
   * Foto de perfil (US-15). TODO(db): la tabla `usuario` no tiene foto, así que
   * hoy siempre es `null` y se muestran las iniciales.
   */
  fotoSrc: string | null
}

/** La propiedad de un reclamo: imagen principal y dirección (US-15). */
export interface PropiedadReclamo {
  id: string
  /** Dirección con número y piso: "Obispo Trejo 1250, 7° B". */
  direccion: string
  barrio: string | null
  /** Imagen principal; `null` si no tiene (se ve el placeholder). */
  fotoSrc: string | null
}

/** Una foto adjunta al reclamo (US-14: hasta 10, JPG o PNG). */
export interface FotoDeReclamo {
  id: string
  src: string
  /** Nombre del archivo ("bacha-1.jpg"); en real, el que queda en el bucket. */
  nombre: string
}

/** Un reclamo, como lo ven el listado y el detalle (US-15). */
export interface Reclamo {
  /** Id para la URL `/panel/reclamos/[id]` (en real, el id numérico del back). */
  id: string
  /** "RCL-2026-0041": `RCL-<año de registro>-<id con 4 dígitos>` (decisión del PO, 24/11). */
  codigo: string
  propiedad: PropiedadReclamo
  locador: PersonaReclamo
  /** El locatario que lo registró. */
  locatario: PersonaReclamo
  tipo: TipoReclamoNombre
  estado: ClaimStatus
  /** El mensaje completo (de 50 a 5000 caracteres, US-14). */
  mensaje: string
  fotos: FotoDeReclamo[]
  /** Fecha y hora ISO del registro. */
  creadoEl: string
  /**
   * Desde cuándo está en proceso (la primera respuesta del locador, US-18).
   * TODO(backend): el back no guarda la fecha del cambio de estado; en real es `null`.
   */
  enProcesoDesde: string | null
  /** Cuándo se resolvió o se canceló. En real, `null` por lo mismo. */
  cerradoEl: string | null
  /** Conversación del chat del reclamo (Tanda B); `null` si todavía no tiene. */
  conversacionId: string | null
}

/** Una propiedad que el locatario puede elegir al registrar un reclamo (US-14: con contrato vigente). */
export interface PropiedadParaReclamo extends PropiedadReclamo {
  /** "CT-2026-0148"; `null` si el back no manda un código con esa forma (en real manda el id, R-13). */
  contratoCodigo: string | null
  /** Nombre del locador, para "Contrato vigente con Nicolás Arrieta". */
  locadorNombre: string
}

/** Lo que manda el formulario de registro (US-14). */
export interface ReclamoNuevo {
  propiedadId: string
  /** Id del catálogo (`TipoReclamoVista.id`). */
  tipoId: number
  mensaje: string
  /** Fotos como data URL, en el orden en que se cargaron. */
  fotos: { src: string; nombre: string }[]
}

/** El rol desde el que se mira la lista (sale del rol activo, no de `RequireRole`). */
export type RolReclamos = 'locador' | 'locatario'
