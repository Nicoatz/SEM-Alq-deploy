'use client'

/**
 * SimuladorFirma.tsx — la pantalla de firma de DocuSign, simulada (solo modo mock).
 *
 * Cubre: US-07 Firmar contrato de alquiler (D5, PO 11/11). Reproduce la ida y
 * vuelta a DocuSign para probar sin DocuSign:
 * - "Firmar": la firma se registra unos segundos después (8 s, o 60 s con
 *   "Simular un aviso demorado"), como el aviso de DocuSign al back. Vuelve con
 *   `?event=signing_complete`.
 * - "Declinar": el contrato vuelve a borrador unos segundos después. Vuelve con
 *   `?event=decline`.
 * - "Cerrar sin firmar" (`cancel`) y "Dejar vencer la sesión" (`session_timeout`):
 *   no registran nada.
 * Sirve para el locador, el locatario y cada garante (que llega desde
 * `/firma-garante/[token]`): el cierre en mock se hace firmando con cada uno.
 *
 * NOTA (seguridad): los datos llegan en el fragmento de la URL (`#…`): no van al
 * servidor ni al `Referer`, y no se guardan en `localStorage`. La ruta de
 * regreso tiene que ser interna (lo valida `leerSesionSimulador`).
 *
 * De dónde saca los datos: `contratos.service#leerSesionSimulador` y `#simularFirmaMock`.
 * Quién lo usa: `app/simulador-firma/page.tsx`.
 */
import { useMemo, useState, useSyncExternalStore } from 'react'
import { Alert, Button, Checkbox } from 'antd'
import { EmptyState } from '@rentar/ui'
import { leerSesionSimulador, simularFirmaMock, type AccionSimulador } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import styles from './SimuladorFirma.module.css'

/** Demora del aviso simulado (guía del back, §6: entre 3 y 30 s). */
const DEMORA_MS = 8_000

/** Demora "larga", para ver "Todavía estamos registrando tu firma" (pasa los 45 s de espera). */
const DEMORA_LARGA_MS = 60_000

/** El fragmento no cambia mientras la página está abierta: no hace falta suscribirse. */
function sinSuscripcion(): () => void {
  return () => {}
}

/** La ruta de regreso con `?event=` (respeta el query que ya tenga, como `?contrato=`). */
function conEvento(regreso: string, evento: string): string {
  return `${regreso}${regreso.includes('?') ? '&' : '?'}event=${evento}`
}

/** El simulador: datos de la firma y las cuatro salidas. */
export function SimuladorFirma() {
  // ─── Estado local ───────────────────────────────────────────────────
  const fragmento = useSyncExternalStore(sinSuscripcion, () => window.location.hash, () => '')
  const sesion = useMemo(() => (fragmento ? leerSesionSimulador(fragmento) : null), [fragmento])
  const [demorado, setDemorado] = useState(false)
  const [procesando, setProcesando] = useState<AccionSimulador | 'salir' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ─── Handlers ───────────────────────────────────────────────────────
  /** Firmar o declinar: deja la acción diferida y vuelve a RentAR. */
  async function registrar(accion: AccionSimulador): Promise<void> {
    if (!sesion) return
    setProcesando(accion)
    setError(null)
    try {
      await simularFirmaMock(sesion, accion, demorado ? DEMORA_LARGA_MS : DEMORA_MS)
      window.location.assign(conEvento(sesion.regreso, accion === 'firmar' ? 'signing_complete' : 'decline'))
    } catch (causa) {
      setError(causa instanceof ServiceError ? causa.message : 'No pudimos simular la firma.')
      setProcesando(null)
    }
  }

  /** Volver sin firmar (`cancel` o `session_timeout`): no se registra nada. */
  function salir(evento: 'cancel' | 'session_timeout'): void {
    if (!sesion) return
    setProcesando('salir')
    window.location.assign(conEvento(sesion.regreso, evento))
  }

  // ─── Render ─────────────────────────────────────────────────────────
  if (!sesion) {
    return (
      <main className={styles.page}>
        <div className={styles.tarjeta} data-testid="simulador-firma-invalido">
          <EmptyState title="Esta sesión de firma no es válida" description="Volvé a RentAR y tocá Firmar contrato de nuevo." />
        </div>
      </main>
    )
  }

  const ocupado = procesando !== null
  return (
    <main className={styles.page}>
      <section className={styles.tarjeta} aria-labelledby="simulador-titulo" data-testid="simulador-firma">
        <h1 id="simulador-titulo" className={styles.titulo}>
          Simulador de DocuSign
        </h1>
        <Alert
          type="warning"
          showIcon
          title="Modo de prueba (mock): esta pantalla reemplaza a DocuSign."
          description="Elegí qué hace la persona. La firma o el rechazo se registran unos segundos después, como cuando DocuSign le avisa a RentAR."
        />
        <p className={styles.datos}>
          Contrato <strong>{sesion.contratoId}</strong> · firma como <strong>{sesion.firmante.startsWith('garante-') ? `garante ${sesion.firmante.replace('garante-', '')}` : sesion.firmante}</strong>
        </p>
        <Checkbox checked={demorado} onChange={(evento) => setDemorado(evento.target.checked)} disabled={ocupado} data-testid="simulador-firma-demora">
          Simular un aviso demorado (60 s)
        </Checkbox>
        <div className={styles.acciones}>
          <Button type="primary" loading={procesando === 'firmar'} disabled={ocupado} onClick={() => void registrar('firmar')} data-testid="simulador-firma-firmar">
            Firmar
          </Button>
          <Button danger loading={procesando === 'declinar'} disabled={ocupado} onClick={() => void registrar('declinar')} data-testid="simulador-firma-declinar">
            Declinar
          </Button>
          <Button disabled={ocupado} onClick={() => salir('cancel')} data-testid="simulador-firma-cancelar">
            Cerrar sin firmar
          </Button>
          <Button disabled={ocupado} onClick={() => salir('session_timeout')} data-testid="simulador-firma-vencer">
            Dejar vencer la sesión
          </Button>
        </div>
        {error && <Alert type="error" showIcon title={error} data-testid="simulador-firma-error" />}
      </section>
    </main>
  )
}
