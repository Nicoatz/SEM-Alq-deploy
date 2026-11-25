'use client'

/**
 * DetalleReclamo.tsx — `/panel/reclamos/[id]`, el detalle de un reclamo.
 *
 * Cubre:
 * - US-15 Consultar: el estado, el tipo, la otra parte, el mensaje completo y las
 *   fotos (visor a pantalla completa) y "Datos del reclamo".
 * - US-16 Resolver y US-17 Cancelar: los botones del locatario que lo registró
 *   (`AccionesReclamo`). El locador no tiene botones de estado.
 * - US-18 Responder: el chat del reclamo (`ChatReclamo`), con el mensaje original
 *   y sus fotos siempre arriba.
 * - Acceso ajeno (otro locatario, el locador de otra propiedad): el mismo "No
 *   encontramos este reclamo" que un id que no existe. Sin sesión, el proxy manda
 *   al login.
 * - El estado cambió en otra pestaña: aviso en español y la vista se refresca.
 * - Al volver a la pestaña (visibilitychange) se relee todo, sin polling
 *   (decisión del PO, 24/11).
 * - `?registrado=1`: viene del registro (US-14) y confirma que quedó abierto.
 *
 * Qué muestra (Claude Design, "Reclamos" · 03 y 05): encabezado "Reclamo
 * RCL-2026-0041" con la dirección y la fecha, la barra de estado con las
 * acciones, el mensaje y el chat a la izquierda y los datos a la derecha. En
 * móvil, todo en una columna. Las cajas "Lo que podés hacer" y "Lo que ve el
 * locador" del diseño son anotaciones y no van.
 *
 * De dónde saca los datos: `getReclamo` (`services/reclamos.service.ts`).
 * Quién lo usa: `app/(app)/panel/reclamos/[id]/page.tsx`.
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { EmptyState, formatDate, PageHeader, StatusTag } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { esLocadorDelReclamo, esLocatarioDelReclamo } from '@/lib/reclamos/reglas'
import type { Reclamo } from '@/lib/reclamos/tipos'
import { getReclamo } from '@/services/reclamos.service'
import { AvatarPersona } from '@/components/personas/AvatarPersona'
import { AccionesReclamo } from './AccionesReclamo'
import { ChatReclamo } from './ChatReclamo'
import { DatosReclamo } from './DatosReclamo'
import { MensajeOriginalReclamo } from './MensajeOriginalReclamo'
import { TipoReclamoTag } from './TipoReclamoTag'
import styles from './DetalleReclamo.module.css'

/** Props de {@link DetalleReclamo}. */
interface DetalleReclamoProps {
  reclamoId: string
}

/**
 * Cuenta las veces que la pestaña vuelve a estar visible (visibilitychange):
 * cada cambio relee el reclamo y el chat.
 */
function useVueltasALaPestania(): number {
  const [vueltas, setVueltas] = useState(0)
  useEffect(() => {
    const alCambiar = () => {
      if (document.visibilityState === 'visible') setVueltas((actual) => actual + 1)
    }
    document.addEventListener('visibilitychange', alCambiar)
    return () => document.removeEventListener('visibilitychange', alCambiar)
  }, [])
  return vueltas
}

/** Skeleton del detalle: el mensaje primero, el chat después (Reclamos · 05). */
function Cargando() {
  return (
    <div className={styles.layout} data-testid="reclamo-cargando" aria-busy="true">
      <div className={styles.principal}>
        <div className={styles.tarjeta}>
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        </div>
        <div className={styles.tarjeta}>
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      </div>
      <div className={styles.tarjeta}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </div>
  )
}

/** Contenido del detalle, con el reclamo ya cargado. */
function Contenido({ inicial, usuarioId, recargar, vueltas }: { inicial: Reclamo; usuarioId: string; recargar: () => void; vueltas: number }) {
  const router = useRouter()
  const registrado = useSearchParams().get('registrado') === '1'
  // El reclamo que devolvió la última acción, hasta que llega la relectura (`base`
  // es el cargado en ese momento: cuando cambia, manda el releído).
  const [cambio, setCambio] = useState<{ base: Reclamo; nuevo: Reclamo } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [avisoRegistro, setAvisoRegistro] = useState(registrado)
  const reclamo = cambio && cambio.base === inicial ? cambio.nuevo : inicial

  const vista: 'locador' | 'locatario' = esLocadorDelReclamo(reclamo, usuarioId) ? 'locador' : 'locatario'
  const otra = vista === 'locador' ? { persona: reclamo.locatario, rol: 'locatario' } : { persona: reclamo.locador, rol: 'locador' }

  // ─── Handlers ───────────────────────────────────────────────────────
  /** Una acción cambió el reclamo, o el back avisó que cambió en otra pestaña (se relee). */
  const alCambiar = useCallback(
    ({ reclamo: nuevo, aviso: texto }: { reclamo?: Reclamo; aviso?: string }) => {
      if (nuevo) setCambio({ base: inicial, nuevo })
      setAviso(texto ?? null)
      setAvisoRegistro(false)
      recargar()
    },
    [recargar, inicial],
  )

  // ─── Render ─────────────────────────────────────────────────────────
  const hrefPropiedad = vista === 'locador' ? `/panel/propiedades/${encodeURIComponent(reclamo.propiedad.id)}` : '/panel/alquiler'
  const miga = vista === 'locador' ? 'Reclamos' : 'Mis reclamos'

  return (
    <>
      <PageHeader
        title={`Reclamo ${reclamo.codigo}`}
        subtitle={`${reclamo.propiedad.direccion} · registrado el ${formatDate(reclamo.creadoEl)} a las ${formatDate(reclamo.creadoEl, 'HH:mm')}`}
        breadcrumb={[{ label: 'Mi panel', href: '/panel' }, { label: miga, href: '/panel/reclamos' }, { label: reclamo.codigo }]}
        actions={
          <Button onClick={() => router.push(hrefPropiedad)} data-testid="reclamo-ver-propiedad">
            Ver la propiedad
          </Button>
        }
      />

      {avisoRegistro && (
        <Alert
          type="success"
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setAvisoRegistro(false)}
          title={`Registraste el reclamo ${reclamo.codigo}`}
          description={`Quedó abierto y le avisamos a ${reclamo.locador.nombre}. Cuando responda, pasa a en proceso.`}
          data-testid="reclamo-registrado"
        />
      )}

      {aviso && (
        <Alert
          type="warning"
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setAviso(null)}
          title={aviso}
          description="Actualizamos el reclamo con el estado de ahora."
          data-testid="reclamo-conflicto"
        />
      )}

      <div className={styles.barra} data-testid="reclamo-barra">
        <span className={styles.barraDatos}>
          <span data-testid="reclamo-estado" data-estado={reclamo.estado}>
            <StatusTag domain="reclamo" status={reclamo.estado} />
          </span>
          <TipoReclamoTag tipo={reclamo.tipo} />
          <span className={styles.barraPersona}>
            <AvatarPersona nombre={otra.persona.nombre} fotoSrc={otra.persona.fotoSrc} conNombre={false} tamanio="sm" />
            <span>
              {otra.persona.nombre} · {otra.rol}
            </span>
          </span>
        </span>
        {esLocatarioDelReclamo(reclamo, usuarioId) && <AccionesReclamo reclamo={reclamo} usuarioId={usuarioId} onCambio={alCambiar} />}
      </div>

      <div className={styles.layout}>
        <div className={styles.principal}>
          <MensajeOriginalReclamo reclamo={reclamo} esPropio={esLocatarioDelReclamo(reclamo, usuarioId)} />
          <ChatReclamo reclamo={reclamo} usuarioId={usuarioId} onCambio={alCambiar} recarga={vueltas} />
        </div>
        <DatosReclamo reclamo={reclamo} vista={vista} />
      </div>
    </>
  )
}

/** Detalle de un reclamo: carga, no encontrado, error o el contenido. */
export function DetalleReclamo({ reclamoId }: DetalleReclamoProps) {
  const router = useRouter()
  const { user } = useAuth()
  const cargar = useCallback(() => getReclamo(reclamoId), [reclamoId])
  const carga = useServiceCall(cargar)
  const { reintentar } = carga
  const vueltas = useVueltasALaPestania()

  // Al volver a la pestaña, se relee el reclamo (el estado pudo cambiar en otra).
  useEffect(() => {
    if (vueltas > 0) reintentar()
  }, [vueltas, reintentar])

  // NOTA: con una recarga el reclamo vuelve a "cargando" y el chat se remonta; se
  // conserva el último cargado mientras tanto, así la pantalla no parpadea.
  const [ultimo, setUltimo] = useState<Reclamo | null>(null)
  if (carga.status === 'listo' && carga.data !== ultimo) setUltimo(carga.data)
  const reclamo = carga.status === 'listo' ? carga.data : ultimo

  return (
    <div className={styles.page} data-testid="reclamo-detalle">
      {!reclamo && carga.status === 'cargando' && <Cargando />}

      {carga.status === 'error' && carga.code === 'not_found' && (
        <div className={styles.vacio} data-testid="reclamo-no-encontrado">
          <EmptyState
            title="No encontramos este reclamo"
            description="Puede que el link esté mal o que el reclamo no sea de una propiedad tuya."
            action={
              <Button type="primary" onClick={() => router.push('/panel/reclamos')} data-testid="reclamo-no-encontrado-volver">
                Ir a reclamos
              </Button>
            }
          />
        </div>
      )}

      {carga.status === 'error' && carga.code !== 'not_found' && (
        <Alert
          type="error"
          showIcon
          title="No pudimos cargar el reclamo"
          description={carga.message}
          action={
            <Button onClick={reintentar} data-testid="reclamo-reintentar">
              Reintentar
            </Button>
          }
          data-testid="reclamo-error"
        />
      )}

      {reclamo && user && carga.status !== 'error' && <Contenido inicial={reclamo} usuarioId={user.id} recargar={reintentar} vueltas={vueltas} />}
    </div>
  )
}
