'use client'

/**
 * useRegresoDeFirma.ts — qué pasa cuando la persona vuelve de firmar en DocuSign.
 *
 * Cubre: US-07 Firmar contrato de alquiler (guía del back, §4 y §6). DocuSign
 * devuelve a la persona apenas firma, con `?event=` en la URL, pero el back se
 * entera de la firma entre 3 y 30 segundos después (el aviso de DocuSign). Esa
 * espera la resuelve el front:
 * - `signing_complete`: "Estamos registrando tu firma…" y se vuelve a pedir el
 *   contrato cada 2,5 s, hasta 45 s. Corta cuando la firma de quien mira figura
 *   `firmado` (y, si era la última, cuando el contrato pasa a `vigente`). Si se
 *   pasan los 45 s, "Todavía estamos registrando tu firma" con "Actualizar": no
 *   es un error, DocuSign reintenta el aviso.
 * - `decline`: lo mismo, hasta que el contrato vuelve a borrador (el detalle del
 *   locador responde 409 `CONTRATO_BORRADOR`; Mi alquiler, 404).
 * - `cancel`, `session_timeout`, `ttl_expired`, `exception` y cualquier otro: el
 *   mensaje, sin espera. La persona no firmó y puede volver a intentarlo.
 *
 * NOTA (seguridad): `?event=signing_complete` se puede escribir a mano. Nunca se
 * muestra "Firmaste" por el evento: solo cuando el contrato que manda el back
 * dice que la firma quedó registrada.
 *
 * Quién lo usa: `components/contratos/DetalleContrato.tsx` (`VistaContrato`, para
 * el locador y para Mi alquiler) y `components/contratos/MiAlquiler.tsx`.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ContratoDetalle, EventoFirma, RolFirmante } from '@rentar/shared-types'
import { leerEventoFirma, mensajeSinFirma, PARAMETRO_EVENTO, urlSinEvento } from '@/lib/contratos/eventoFirma'
import { firmasQueFaltan } from '@/lib/contratos/firmas'
import { ServiceError } from '@/services/shared/errors'

/** Cada cuánto se vuelve a pedir el contrato (guía del back, §6: "cada 2 o 3 segundos"). */
export const SONDEO_INTERVALO_MS = 2_500

/** Hasta cuándo se espera antes de mostrar "Todavía estamos registrando" (guía del back, §6). */
export const SONDEO_LIMITE_MS = 45_000

/** En qué está el regreso de DocuSign. */
export type FaseRegreso =
  /** Sin `?event=`: la pantalla de siempre. */
  | { tipo: 'nada' }
  /** `signing_complete`, esperando el aviso: "Estamos registrando tu firma…". */
  | { tipo: 'esperando' }
  /** La firma quedó registrada. `vigente`: era la última y el contrato quedó vigente. */
  | { tipo: 'confirmada'; vigente: boolean }
  /** Pasaron 45 s sin el aviso: "Todavía estamos registrando tu firma" + "Actualizar". */
  | { tipo: 'demorada' }
  /** `decline`, esperando que el contrato vuelva a borrador. */
  | { tipo: 'esperando_rechazo' }
  /** Pasaron 45 s y el contrato sigue pendiente: "Todavía estamos registrando el rechazo". */
  | { tipo: 'rechazo_demorado' }
  /** El contrato volvió a borrador (rechazo propio o de otra parte): ya no se puede leer como antes. */
  | { tipo: 'ya_no_esta' }
  /** Volvió sin firmar (`cancel`, `session_timeout`…): el mensaje, sin espera. */
  | { tipo: 'sin_firma'; mensaje: string }

/**
 * El `?event=` con que se abrió la pantalla, leído una sola vez. Después de
 * leerlo, lo saca de la barra de direcciones (`history.replaceState`, sin
 * recargar ni volver a pedir la página), así recargar no repite la espera.
 * Conserva el resto del query (el `?contrato=` de Mi alquiler).
 */
export function useEventoDeFirma(): EventoFirma | null {
  const searchParams = useSearchParams()
  const [evento] = useState(() => leerEventoFirma(searchParams.get(PARAMETRO_EVENTO)))

  useEffect(() => {
    if (evento && new URL(window.location.href).searchParams.has(PARAMETRO_EVENTO)) {
      window.history.replaceState(null, '', urlSinEvento(window.location.href))
    }
  }, [evento])

  return evento
}

/**
 * `vigente` o `firmada` si el contrato ya muestra la firma de `rol`; `null` si
 * todavía no. Con la firma registrada y sin firmas pendientes, falta el paso a
 * vigente (lo hace el back en el mismo aviso): se sigue esperando.
 */
function firmaRegistrada(contrato: ContratoDetalle, rol: RolFirmante): 'vigente' | 'firmada' | null {
  if (contrato.status === 'vigente') return 'vigente'
  if (contrato.status !== 'pendiente_firma') return null
  const mia = contrato.firmantes.find((firmante) => firmante.rol === rol)
  return mia?.estado === 'firmado' && firmasQueFaltan(contrato.firmantes) > 0 ? 'firmada' : null
}

/** `true` si el error dice que el contrato volvió a borrador (para quien mira ya no existe como antes). */
function contratoVolvioABorrador(error: unknown): boolean {
  return error instanceof ServiceError && (error.code === 'not_found' || (error.code === 'conflict' && error.apiCode === 'CONTRATO_BORRADOR'))
}

/** Fase con que arranca, según el evento y el contrato que ya cargó la pantalla. */
function faseInicial(evento: EventoFirma | null, inicial: ContratoDetalle, rol: RolFirmante): FaseRegreso {
  if (!evento) return { tipo: 'nada' }
  if (evento === 'signing_complete') {
    const registrada = firmaRegistrada(inicial, rol)
    return registrada ? { tipo: 'confirmada', vigente: registrada === 'vigente' } : { tipo: 'esperando' }
  }
  if (evento === 'decline') return { tipo: 'esperando_rechazo' }
  return { tipo: 'sin_firma', mensaje: mensajeSinFirma(evento) ?? 'No se completó la firma. Podés volver a intentarlo.' }
}

/** Opciones de {@link useRegresoDeFirma}. */
interface OpcionesRegreso {
  /** El evento leído con {@link useEventoDeFirma}. */
  evento: EventoFirma | null
  /** El contrato que ya cargó la pantalla. */
  inicial: ContratoDetalle
  /** Rol de quien mira: su firma es la que se espera. */
  rol: RolFirmante | null
  /** Vuelve a pedir el contrato (el detalle del locador o la ficha de Mi alquiler). */
  consultar: () => Promise<ContratoDetalle>
  /** Con la firma confirmada: el contrato actualizado, para mostrarlo sin recargar. */
  onDatos: (contrato: ContratoDetalle) => void
  /** El contrato volvió a borrador: el locador sigue en el alta; el locatario ya no lo ve. */
  onYaNoEsta: () => void
}

/**
 * La fase del regreso de DocuSign y "Actualizar" (otra vuelta de 45 s).
 * El sondeo usa `setTimeout` encadenado: un pedido nunca se pisa con el
 * siguiente. Se corta al desmontar la pantalla.
 */
export function useRegresoDeFirma({ evento, inicial, rol, consultar, onDatos, onYaNoEsta }: OpcionesRegreso): { fase: FaseRegreso; actualizar: () => void } {
  const router = useRouter()
  const [fase, setFase] = useState<FaseRegreso>(() => (rol ? faseInicial(evento, inicial, rol) : { tipo: 'nada' }))
  // Las funciones de la pantalla cambian en cada render: el sondeo lee siempre la última.
  const callbacks = useRef({ consultar, onDatos, onYaNoEsta })
  useEffect(() => {
    callbacks.current = { consultar, onDatos, onYaNoEsta }
  })

  const esperando = fase.tipo === 'esperando' || fase.tipo === 'esperando_rechazo'
  const esperaRechazo = fase.tipo === 'esperando_rechazo'

  useEffect(() => {
    if (!esperando || !rol) return
    let cancelado = false
    let temporizador: number | undefined
    const inicio = Date.now()

    async function consultarUnaVez(): Promise<void> {
      try {
        const datos = await callbacks.current.consultar()
        if (cancelado) return
        const registrada = esperaRechazo ? null : firmaRegistrada(datos, rol as RolFirmante)
        if (registrada) {
          callbacks.current.onDatos(datos)
          setFase({ tipo: 'confirmada', vigente: registrada === 'vigente' })
          // Guía del back, §5: con el contrato vigente, la propiedad pasa a alquilada.
          // `router.refresh()` vacía el caché de rutas (Mis propiedades, la pestaña Contratos).
          if (registrada === 'vigente') router.refresh()
          return
        }
      } catch (error) {
        if (cancelado) return
        if (contratoVolvioABorrador(error)) {
          setFase({ tipo: 'ya_no_esta' })
          callbacks.current.onYaNoEsta()
          return
        }
        // Sin red o un 5xx: no corta la espera, se vuelve a intentar.
      }
      if (Date.now() - inicio >= SONDEO_LIMITE_MS) {
        setFase({ tipo: esperaRechazo ? 'rechazo_demorado' : 'demorada' })
        return
      }
      temporizador = window.setTimeout(() => void consultarUnaVez(), SONDEO_INTERVALO_MS)
    }

    temporizador = window.setTimeout(() => void consultarUnaVez(), SONDEO_INTERVALO_MS)
    return () => {
      cancelado = true
      window.clearTimeout(temporizador)
    }
  }, [esperando, esperaRechazo, rol, router])

  /** "Actualizar": otra vuelta de espera, desde cero. */
  function actualizar(): void {
    setFase((actual) => (actual.tipo === 'demorada' ? { tipo: 'esperando' } : actual.tipo === 'rechazo_demorado' ? { tipo: 'esperando_rechazo' } : actual))
  }

  return { fase, actualizar }
}
