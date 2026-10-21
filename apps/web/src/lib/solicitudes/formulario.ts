/**
 * formulario.ts — los valores del formulario "Solicitar alquiler" (US-35
 * actualizada) y su traducción a lo que recibe el service.
 *
 * Qué es: funciones puras, separadas del modal para leerlas y probarlas
 * solas.
 * - `valoresIniciales`: lo que se precarga (del perfil y del legajo,
 *   `prepararSolicitud`) y los valores por defecto que pide la US (1 persona,
 *   sin mascotas, aceptación sin tildar; sin legajo: ocupación "-",
 *   ingresos vacíos y garantías sin tildar).
 * - `aSolicitudNueva`: lo validado → `SolicitudNueva`.
 *
 * NOTA de privacidad: nada de esto se guarda en `localStorage` ni en
 * `sessionStorage`: los datos viven mientras el modal está abierto.
 * Quién lo usa: `components/detalle-propiedad/SolicitarAlquilerModal.tsx` y
 * `FormularioSolicitud.tsx`.
 */
import type { GarantiaOfrecida, LegajoUsuario, OcupacionPostulante, PreparacionSolicitud, SolicitudNueva } from '@rentar/shared-types'
import { aE164, CONVIVIENTES_MINIMO, telefonoParaPrecargar } from '@/lib/validation/solicitud.rules'

/** Los campos del formulario, como los maneja antd `Form`. */
export interface ValoresSolicitud {
  /** Lo que se ve en el campo, sin el "+" (que es fijo), ej. "54 351 555 0103". */
  telefono: string
  email: string
  ocupacion: OcupacionPostulante
  /**
   * Entero; `null` = campo vacío (el valor por defecto, US-35: "por defecto
   * el monto de ingresos aproximados debe estar vacío"). Es opcional: vacío
   * y 0 ("prefiero no informarlo") se envían igual, como "no informa".
   */
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
 * - Ocupación "-" ("Prefiero no decirlo"), ingresos vacíos, 1 persona y "No" en
 *   mascotas: los valores por defecto que pide la US.
 * - Garantías y aceptación, sin tildar (decisión del PO: las exigidas se
 *   señalan, no se marcan solas).
 * - Con legajo (US-21: "los datos del legajo se precargan en las solicitudes
 *   nuevas"): situación, ingreso y garantías salen del perfil. Un ingreso
 *   vacío en el perfil queda VACÍO acá, no 0: en la solicitud el 0 es
 *   "prefiero no informarlo", una decisión que el usuario toma en cada
 *   solicitud (decisión del PO). Lo que se cambie en el modal no vuelve al
 *   perfil (nadie llama a `perfil.service` desde acá).
 */
export function valoresIniciales(
  perfil: Pick<PreparacionSolicitud['perfil'], 'email' | 'telefono'> | null,
  legajo: LegajoUsuario | null = null,
): ValoresSolicitud {
  return {
    telefono: telefonoParaPrecargar(perfil?.telefono),
    email: perfil?.email ?? '',
    ocupacion: legajo?.occupation ?? 'sin_informar',
    // Vacío por defecto en mock y en real, con o sin legajo (US-35). El 0
    // lo elige el usuario si prefiere no informarlo.
    ingresos: legajo?.monthlyIncome ?? null,
    convivientes: CONVIVIENTES_MINIMO,
    mascotas: false,
    detalleMascotas: '',
    garantias: legajo ? [...legajo.guarantees] : [],
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
