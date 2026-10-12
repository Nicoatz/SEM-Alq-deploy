/**
 * formulario.ts — los valores del formulario "Solicitar alquiler" (US-35
 * actualizada) y su traducción a lo que recibe el service.
 *
 * Qué es: funciones puras, separadas del modal para leerlas y probarlas
 * solas.
 * - `valoresIniciales`: lo que se precarga (del perfil) y los valores por
 *   defecto que pide la US (ocupación "-", ingresos 0, 1 persona, sin
 *   mascotas, garantías sin tildar, aceptación sin tildar).
 * - `aSolicitudNueva`: lo validado → `SolicitudNueva`.
 *
 * NOTA de privacidad: nada de esto se guarda en `localStorage` ni en
 * `sessionStorage`: los datos viven mientras el modal está abierto.
 * Quién lo usa: `components/detalle-propiedad/SolicitarAlquilerModal.tsx` y
 * `FormularioSolicitud.tsx`.
 */
import type { GarantiaOfrecida, OcupacionPostulante, SolicitudNueva, UsuarioSesion } from '@rentar/shared-types'
import { aE164, CONVIVIENTES_MINIMO, telefonoParaPrecargar } from '@/lib/validation/solicitud.rules'

/** Los campos del formulario, como los maneja antd `Form`. */
export interface ValoresSolicitud {
  /** Lo que se ve en el campo, sin el "+" (que es fijo), ej. "54 351 555 0103". */
  telefono: string
  email: string
  ocupacion: OcupacionPostulante
  /** Entero; 0 = no informa. `null` si se borró el campo (cuenta como 0). */
  ingresos: number | null
  convivientes: number
  mascotas: boolean
  detalleMascotas: string
  garantias: GarantiaOfrecida[]
  mensaje: string
  acepto: boolean
}

/**
 * Valores con que se abre el formulario (US-35 actualizada):
 * - Teléfono y email, precargados del perfil (editables; solo para esta
 *   solicitud). Sin teléfono, "+54 " para completar (decisión del PO).
 * - Ocupación "-" ("Prefiero no decirlo"), ingresos 0, 1 persona y "No" en
 *   mascotas: los valores por defecto que pide la US.
 * - Garantías y aceptación, sin tildar (decisión del PO: las exigidas se
 *   señalan, no se marcan solas).
 */
export function valoresIniciales(usuario: Pick<UsuarioSesion, 'email' | 'telefono'> | null): ValoresSolicitud {
  return {
    telefono: telefonoParaPrecargar(usuario?.telefono),
    email: usuario?.email ?? '',
    ocupacion: 'sin_informar',
    ingresos: 0,
    convivientes: CONVIVIENTES_MINIMO,
    mascotas: false,
    detalleMascotas: '',
    garantias: [],
    mensaje: '',
    acepto: false,
  }
}

/** Valores ya validados → `SolicitudNueva` (lo que recibe `enviarSolicitud`). */
export function aSolicitudNueva(propertyId: string, valores: ValoresSolicitud): SolicitudNueva {
  return {
    propertyId,
    message: valores.mensaje,
    contact: { phone: aE164(valores.telefono) ?? '', email: valores.email.trim() },
    legajo: {
      occupation: valores.ocupacion,
      monthlyIncome: valores.ingresos ?? 0,
      residents: valores.convivientes,
      hasPets: valores.mascotas,
      petsDetail: valores.mascotas ? valores.detalleMascotas.trim() || null : null,
      guarantees: valores.garantias,
    },
    acceptedTerms: true,
  }
}
