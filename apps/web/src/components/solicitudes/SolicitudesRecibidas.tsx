'use client'

/**
 * SolicitudesRecibidas.tsx — `/panel/solicitudes`, las solicitudes que
 * recibió el locador sobre sus propiedades.
 *
 * Cubre (numeración de Jira):
 * - US-36 Consultar solicitudes: estado, nombre y apellido del postulante,
 *   imagen principal de la propiedad y el mensaje opcional.
 * - US-37 Aceptar o rechazar: botones que se distinguen (color e ícono) y
 *   confirmación con `ConfirmActionModal`. El mail al locatario al aceptar
 *   lo manda el back.
 * - US-38 Cancelar: el locador da de baja una solicitud que había aceptado.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 02, 03, 05 y 06):
 * pestañas con contador, filtro por propiedad y orden; las solicitudes
 * agrupadas por propiedad; el detalle del postulante al costado (en móvil,
 * Drawer a pantalla completa); vacío, carga con skeleton y error.
 *
 * Reglas (`lib/validation/solicitud.rules.ts`):
 * - Una sola aceptada por propiedad: mientras haya una, el "Aceptar" de las
 *   demás pendientes queda deshabilitado con el motivo.
 * - Aceptar no rechaza a las demás: siguen pendientes.
 * - El locador ve la dirección EXACTA (son sus propiedades).
 *
 * De dónde saca los datos: `listarSolicitudesRecibidas` y, para el vacío,
 * `listarMisPropiedades`. Quién lo usa: `app/(app)/panel/solicitudes/page.tsx`.
 */
import { useMemo, useState, useSyncExternalStore } from 'react'
import { Alert, Button, Drawer, Select, Skeleton } from 'antd'
import { useRouter } from 'next/navigation'
import type { PropiedadLocador, Solicitud } from '@rentar/shared-types'
import { EmptyState, PageHeader } from '@rentar/ui'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import {
  agruparPorPropiedad,
  aplicarCambios,
  contarPorPestania,
  filtrarRecibidas,
  ORDEN_SOLICITUDES_OPTIONS,
  PESTANIAS_RECIBIDAS,
  propiedadesConSolicitudes,
  TODAS_LAS_PROPIEDADES,
  type CambiosSolicitudes,
  type OrdenSolicitudes,
  type PestaniaSolicitudes,
} from '@/lib/solicitudes/filtros'
import { aceptadaDeLaPropiedad, type AccionSolicitud } from '@/lib/validation/solicitud.rules'
import { listarMisPropiedades } from '@/services/propiedades.service'
import { listarSolicitudesRecibidas } from '@/services/solicitudes.service'
import { DetallePostulante } from './DetallePostulante'
import { GrupoPropiedad } from './GrupoPropiedad'
import { ModalAccionSolicitud } from './ModalAccionSolicitud'
import { PestaniasSolicitudes } from './PestaniasSolicitudes'
import { useAccionSolicitud } from './useAccionSolicitud'
import styles from './SolicitudesRecibidas.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Solicitudes' }]

/** Debajo de este ancho el detalle se abre en un Drawer (mismo corte que el CSS). */
const MEDIA_MOVIL = '(max-width: 767px)'

/** Se suscribe a los cambios del corte de móvil. */
function suscribirMovil(avisar: () => void): () => void {
  const consulta = window.matchMedia(MEDIA_MOVIL)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}

/**
 * `true` debajo de 768 px. En el servidor, `false` (escritorio).
 * NOTA: el detalle va en el panel del costado O en el Drawer, nunca en los
 * dos a la vez, así los `data-testid` del detalle no se repiten.
 */
function useEsMovil(): boolean {
  return useSyncExternalStore(suscribirMovil, () => window.matchMedia(MEDIA_MOVIL).matches, () => false)
}

/** Nombre de cada pestaña en minúscula, para el vacío "sin resultados". */
const NOMBRE_PESTANIA: Record<PestaniaSolicitudes, string> = {
  pendientes: 'pendientes',
  aceptadas: 'aceptadas',
  cerradas: 'cerradas',
  todas: '',
}

/** "1 solicitud" / "5 solicitudes". */
function solicitudesTexto(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'solicitud' : 'solicitudes'}`
}

/** Subtítulo (· 02): "5 solicitudes en 2 propiedades · 2 esperan tu respuesta". */
function subtitulo(todas: readonly Solicitud[]): string {
  const propiedades = new Set(todas.map((item) => item.property.id)).size
  const pendientes = todas.filter((item) => item.status === 'pendiente').length
  const espera = pendientes === 1 ? '1 espera tu respuesta' : `${pendientes} esperan tu respuesta`
  return `${solicitudesTexto(todas.length)} en ${propiedades} ${propiedades === 1 ? 'propiedad' : 'propiedades'} · ${espera}`
}

/** La aceptada de cada propiedad (de la lista completa: el "Aceptar" se bloquea aunque la aceptada no se vea en la pestaña). */
function aceptadasPorPropiedad(todas: readonly Solicitud[]): Map<string, Solicitud> {
  const mapa = new Map<string, Solicitud>()
  for (const propertyId of new Set(todas.map((item) => item.property.id))) {
    const aceptada = aceptadaDeLaPropiedad(todas.filter((item) => item.property.id === propertyId))
    if (aceptada) mapa.set(propertyId, aceptada)
  }
  return mapa
}

/** Tres filas de skeleton con la forma real: avatar, dos líneas y los botones (· 06). */
function FilasCargando() {
  return (
    <div className={styles.group} data-testid="solicitudes-cargando">
      {[0, 1, 2].map((fila) => (
        <div key={fila} className={styles.skeletonRow}>
          <Skeleton avatar={{ size: 42 }} active title={{ width: '40%' }} paragraph={{ rows: 1, width: '70%' }} />
          <Skeleton.Button active shape="round" />
        </div>
      ))}
    </div>
  )
}

/** Qué vacío corresponde, según las propiedades del locador. */
type CasoVacio = 'sin_propiedades' | 'sin_publicadas' | 'con_publicadas'

/**
 * Elige el caso del vacío. Cuentan como publicadas las que aparecen en la
 * búsqueda y reciben solicitudes: `publicada` y `alquilada_publicada`.
 */
function casoVacio(propiedades: readonly PropiedadLocador[]): { caso: CasoVacio; publicadas: number } {
  const publicadas = propiedades.filter((item) => item.status === 'publicada' || item.status === 'alquilada_publicada').length
  if (propiedades.length === 0) return { caso: 'sin_propiedades', publicadas }
  return { caso: publicadas > 0 ? 'con_publicadas' : 'sin_publicadas', publicadas }
}

/**
 * Vacío del locador (· 06), con tres casos según `listarMisPropiedades`:
 * - Con propiedades publicadas: que ya aparecen en la búsqueda.
 * - Sin ninguna propiedad: "Publicá tu primera propiedad" (texto del diseño).
 * - Con propiedades pero ninguna publicada (ej. Sofía, con una alquilada):
 *   las solicitudes llegan solo a las publicadas (texto del PO, anotado en
 *   `.design-sync/NOTES.md`).
 * Si falla el pedido de propiedades, no se adivina el caso: solo "Ver mis
 * propiedades".
 * NOTA: el diseño suma "las publicaciones con 5 fotos reciben el triple de
 * solicitudes"; es un dato que no tenemos, no se muestra.
 */
function VacioLocador() {
  const router = useRouter()
  const propiedades = useServiceCall(listarMisPropiedades)
  if (propiedades.status === 'cargando') return <FilasCargando />

  const verPropiedades = (
    <Button onClick={() => router.push('/panel/propiedades')} data-testid="solicitudes-vacio-propiedades">
      Ver mis propiedades
    </Button>
  )
  const publicar = (texto: string) => (
    <Button type="primary" onClick={() => router.push('/panel/propiedades/nueva')} data-testid="solicitudes-vacio-publicar">
      {texto}
    </Button>
  )

  // ─── Render ─────────────────────────────────────────────────────────
  if (propiedades.status === 'error') {
    return (
      <div className={styles.emptyBlock} data-testid="solicitudes-vacio">
        <EmptyState title="Todavía no recibiste solicitudes" description="Cuando alguien solicite una de tus propiedades publicadas, la vas a ver acá." action={verPropiedades} />
      </div>
    )
  }

  const { caso, publicadas } = casoVacio(propiedades.data)
  return (
    <div className={styles.emptyBlock} data-testid="solicitudes-vacio" data-caso={caso}>
      {caso === 'con_publicadas' && (
        <EmptyState
          title="Todavía no recibiste solicitudes"
          description={`${publicadas === 1 ? 'Tu propiedad publicada ya aparece' : `Tus ${publicadas} propiedades publicadas ya aparecen`} en la búsqueda. Cuando alguien la solicite, la vas a ver acá.`}
          action={verPropiedades}
        />
      )}
      {caso === 'sin_propiedades' && (
        <EmptyState
          title="Todavía no recibiste solicitudes"
          description="Publicá una propiedad y las solicitudes que te manden van a aparecer acá."
          action={publicar('Publicá tu primera propiedad')}
        />
      )}
      {caso === 'sin_publicadas' && (
        <EmptyState
          title="Todavía no recibiste solicitudes"
          description="Ninguna de tus propiedades está publicada. Las solicitudes llegan solo a las publicadas."
          action={
            <div className={styles.emptyActions}>
              {publicar('Publicar una propiedad')}
              {verPropiedades}
            </div>
          }
        />
      )}
    </div>
  )
}

/** Solicitudes recibidas por el locador en sesión. */
export function SolicitudesRecibidas() {
  const carga = useServiceCall(listarSolicitudesRecibidas)
  const esMovil = useEsMovil()

  // ─── Estado local ───────────────────────────────────────────────────
  const [cambios, setCambios] = useState<CambiosSolicitudes>({})
  const [pestania, setPestania] = useState<PestaniaSolicitudes>('pendientes')
  const [propiedad, setPropiedad] = useState<string>(TODAS_LAS_PROPIEDADES)
  const [orden, setOrden] = useState<OrdenSolicitudes>('recientes')
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  /** Aviso del 409 (la solicitud cambió mientras se miraba). */
  const [conflicto, setConflicto] = useState<{ titulo: string; detalle: string } | null>(null)

  const datos = carga.status === 'listo' ? carga.data : null
  const todas = useMemo(() => aplicarCambios(datos ?? [], cambios), [datos, cambios])
  const contadores = useMemo(() => contarPorPestania(todas), [todas])
  const opcionesPropiedad = useMemo(() => propiedadesConSolicitudes(todas), [todas])
  const visibles = useMemo(() => filtrarRecibidas(todas, pestania, propiedad, orden), [todas, pestania, propiedad, orden])
  const grupos = useMemo(() => agruparPorPropiedad(visibles), [visibles])
  const aceptadas = useMemo(() => aceptadasPorPropiedad(todas), [todas])
  // En escritorio, si no eligió ninguna, se muestra la primera de la lista.
  const seleccionada = visibles.find((item) => item.id === seleccionadaId) ?? visibles[0] ?? null
  const enDrawer = todas.find((item) => item.id === seleccionadaId) ?? null

  // ─── Acciones (US-37, US-38) ────────────────────────────────────────
  const accion = useAccionSolicitud({
    onExito: (actualizada) => {
      setConflicto(null)
      setCambios((actual) => ({ ...actual, [actualizada.id]: { status: actualizada.status, respondedAt: actualizada.respondedAt } }))
    },
    onConflicto: (message, pedida) => {
      // · 06: el error dice qué pasó y la lista se refresca sola.
      setConflicto({ titulo: `La solicitud de ${pedida.solicitud.applicant.fullName} cambió mientras la mirabas`, detalle: message })
      setCambios({})
      setDrawerAbierto(false)
      carga.reintentar()
    },
  })
  const pedida = accion.pedida
  const otrasPendientes = pedida
    ? todas.filter((item) => item.property.id === pedida.solicitud.property.id && item.id !== pedida.solicitud.id && item.status === 'pendiente').length
    : 0

  // ─── Handlers ───────────────────────────────────────────────────────
  function abrir(solicitud: Solicitud): void {
    setSeleccionadaId(solicitud.id)
    if (esMovil) setDrawerAbierto(true)
  }

  function pedirAccion(tipo: AccionSolicitud, solicitud: Solicitud): void {
    accion.pedir(tipo, solicitud)
  }

  function reintentarCarga(): void {
    setCambios({})
    carga.reintentar()
  }

  const otraAceptadaDe = (solicitud: Solicitud): Solicitud | undefined => {
    const aceptada = aceptadas.get(solicitud.property.id)
    return aceptada && aceptada.id !== solicitud.id ? aceptada : undefined
  }

  // ─── Error (· 06) ───────────────────────────────────────────────────
  if (carga.status === 'error') {
    const sinRed = carga.code === 'network'
    return (
      <div className={styles.page}>
        <PageHeader title="Solicitudes" breadcrumb={MIGA} />
        <div className={styles.errorBlock} role="alert" data-testid="solicitudes-error">
          <span className={styles.errorTitle}>No pudimos traer tus solicitudes</span>
          <span className={styles.errorText}>
            {sinRed ? 'Revisá tu conexión y probá de nuevo. Nada se perdió: tus solicitudes siguen guardadas.' : carga.message}
          </span>
          <Button type="primary" onClick={reintentarCarga} data-testid="solicitudes-reintentar">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const cargando = carga.status === 'cargando'

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page} data-testid="solicitudes">
      <PageHeader title="Solicitudes" subtitle={cargando || todas.length === 0 ? undefined : subtitulo(todas)} breadcrumb={MIGA} />

      {conflicto && (
        <Alert
          type="warning"
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setConflicto(null)}
          title={conflicto.titulo}
          description={`${conflicto.detalle} Actualizamos la lista con el estado de ahora.`}
          data-testid="solicitudes-conflicto"
        />
      )}

      {!cargando && todas.length === 0 ? (
        <VacioLocador />
      ) : (
        <>
          {/* Los filtros se muestran enseguida, no esperan a los datos (· 06). */}
          <div className={styles.toolbar}>
            <PestaniasSolicitudes opciones={PESTANIAS_RECIBIDAS} value={pestania} onChange={setPestania} contadores={cargando ? null : contadores} testIdPrefix="solicitudes" />
            <div className={styles.toolbarSelects}>
              <Select
                className={styles.select}
                value={propiedad}
                onChange={setPropiedad}
                options={[{ value: TODAS_LAS_PROPIEDADES, label: 'Todas las propiedades' }, ...opcionesPropiedad]}
                popupMatchSelectWidth={false}
                aria-label="Propiedad"
                data-testid="solicitudes-filtro-propiedad"
              />
              <Select
                className={styles.select}
                value={orden}
                onChange={setOrden}
                options={ORDEN_SOLICITUDES_OPTIONS}
                popupMatchSelectWidth={false}
                aria-label="Ordenar"
                data-testid="solicitudes-orden"
              />
            </div>
          </div>

          <div className={styles.layout}>
            <div className={styles.list}>
              {cargando ? (
                <FilasCargando />
              ) : visibles.length === 0 ? (
                <div className={styles.emptyBlock} data-testid="solicitudes-sin-resultados">
                  <EmptyState
                    title={pestania === 'todas' ? 'No hay solicitudes para esta propiedad' : `No tenés solicitudes ${NOMBRE_PESTANIA[pestania]}`}
                    description={propiedad === TODAS_LAS_PROPIEDADES ? 'Probá con otra pestaña.' : 'Probá con otra pestaña o con todas las propiedades.'}
                  />
                </div>
              ) : (
                grupos.map((grupo) => (
                  <GrupoPropiedad
                    key={grupo.property.id}
                    grupo={grupo}
                    aceptada={aceptadas.get(grupo.property.id)}
                    // En móvil no hay panel al costado: ninguna fila se marca como elegida.
                    seleccionadaId={esMovil ? null : (seleccionada?.id ?? null)}
                    onAbrir={abrir}
                    onAccion={pedirAccion}
                  />
                ))
              )}

              {/* · 02: aceptar no rechaza a los demás. Con la regla del PO: una sola aceptada por propiedad. */}
              {!cargando && (
                <Alert
                  type="info"
                  showIcon
                  className={styles.infoNote}
                  title="Aceptar una solicitud no rechaza las otras: siguen pendientes."
                  description="Podés tener una sola aceptada por propiedad. Para aceptar a otra persona, primero cancelá la que aceptaste."
                  data-testid="solicitudes-aviso-aceptar"
                />
              )}
            </div>

            {/* Detalle al costado (escritorio). En móvil va en el Drawer. */}
            {!esMovil && (
              <aside className={styles.aside}>
                {seleccionada && !cargando && <DetallePostulante solicitud={seleccionada} otraAceptada={otraAceptadaDe(seleccionada)} onAccion={pedirAccion} />}
              </aside>
            )}
          </div>
        </>
      )}

      {/* Detalle en móvil: pantalla propia, sin ruta nueva (decisión del PO). */}
      <Drawer
        placement="right"
        size="100%"
        open={esMovil && drawerAbierto && enDrawer !== null}
        onClose={() => setDrawerAbierto(false)}
        title="Solicitud"
        closable={{ 'aria-label': 'Volver a la lista' }}
        data-testid="solicitudes-detalle-drawer"
      >
        {enDrawer && <DetallePostulante solicitud={enDrawer} otraAceptada={otraAceptadaDe(enDrawer)} onAccion={pedirAccion} />}
      </Drawer>

      <ModalAccionSolicitud estado={accion} actor="locador" otrasPendientes={otrasPendientes} testIdPrefix="solicitudes" />
    </div>
  )
}
