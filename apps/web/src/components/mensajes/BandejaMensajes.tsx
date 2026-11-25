'use client'

/**
 * BandejaMensajes.tsx — `/panel/mensajes` y `/panel/mensajes/[id]` (US-24 Enviar mensajes).
 *
 * Cubre US-24:
 * - "Se debe haber iniciado sesión" (el proxy protege `/panel/*`).
 * - La bandeja: buscador por persona o propiedad y orden por último mensaje.
 *   Sin filtro de no leídas ni contadores (decisión del PO, 24/11). Las
 *   conversaciones de reclamos no aparecen (se ven en cada reclamo).
 * - "Nueva conversación": el locador, con sus locatarios con contrato vigente; el
 *   locatario, con los locadores de lo que alquila (`NuevaConversacionModal`).
 * - Desde "Escribirle al locador" (`?con=<persona>&nombre=…&propiedad=<id>&direccion=…`, y
 *   `&rol=locatario` si se le escribe a un locatario):
 *   si ya hay una conversación con esa persona por esa propiedad se abre esa; si
 *   no, una nueva lista para el primer mensaje (`PanelNuevaConversacion`).
 * - Enviar, eliminar los propios y "Mensaje eliminado · hh:mm": `ConversacionChat`.
 *
 * Qué muestra (Claude Design, "Mensajes" · 01, 04 y 05): en escritorio, dos
 * columnas (la bandeja y la conversación); en móvil, dos pantallas (la bandeja en
 * `/panel/mensajes` y la conversación en `/panel/mensajes/[id]`). Vacíos: bandeja
 * vacía y ninguna conversación abierta; carga con skeleton; error con Reintentar.
 *
 * NOTA: vive en el layout de `/panel/mensajes`: al abrir otra conversación la
 * bandeja no se vuelve a pedir ni pierde la búsqueda.
 * Tiempo real: sin polling (decisión del PO); se relee al enviar y al volver a la pestaña.
 *
 * De dónde saca los datos: `listarConversaciones` (`services/mensajes.service.ts`).
 * Quién lo usa: `app/(app)/panel/mensajes/layout.tsx`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Skeleton } from 'antd'
import { EditOutlined, SearchOutlined } from '@ant-design/icons'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { EmptyState, PageHeader } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { conversacionExistente, filtrarConversaciones } from '@/lib/mensajes/bandeja'
import type { ConversacionNueva } from '@/lib/mensajes/tipos'
import { ahoraIso } from '@/lib/utils/fechas'
import { listarConversaciones } from '@/services/mensajes.service'
import { ItemConversacion } from './ItemConversacion'
import { NuevaConversacionModal } from './NuevaConversacionModal'
import { PanelConversacion } from './PanelConversacion'
import { PanelNuevaConversacion } from './PanelNuevaConversacion'
import styles from './Mensajes.module.css'

/** Cuenta las veces que la pestaña vuelve a estar visible (visibilitychange). */
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

/** La conversación nueva que pide la URL (`?con=…`), o `null`. */
function nuevaDeLaUrl(parametros: URLSearchParams): ConversacionNueva | null {
  const con = parametros.get('con')
  if (!con) return null
  const propiedadId = parametros.get('propiedad')
  return {
    // Desde el detalle publicado se le escribe al dueño: el locador (`?rol=` lo cambia).
    destinatario: { personaId: con, nombre: parametros.get('nombre') ?? 'el locador', rol: parametros.get('rol') === 'locatario' ? 'locatario' : 'locador' },
    propiedad: propiedadId ? { id: propiedadId, direccion: parametros.get('direccion') } : null,
  }
}

/** Skeleton de la bandeja: filas con avatar y dos líneas (Mensajes · 04). */
function BandejaCargando() {
  return (
    <div className={styles.listaCargando} data-testid="mensajes-cargando" aria-busy="true">
      {[0, 1, 2, 3].map((fila) => (
        <Skeleton key={fila} active avatar title={{ width: '40%' }} paragraph={{ rows: 1, width: '80%' }} />
      ))}
    </div>
  )
}

/** La bandeja de Mensajes y la conversación abierta. */
export function BandejaMensajes() {
  const router = useRouter()
  const parametros = useSearchParams()
  const { id } = useParams<{ id?: string }>()
  const conversacionId = id ? decodeURIComponent(id) : null
  const { user, activeRole } = useAuth()
  const usuarioId = user?.id ?? ''
  const rol: 'locador' | 'locatario' = activeRole === 'locador' ? 'locador' : 'locatario'

  const cargar = useCallback(() => listarConversaciones(usuarioId), [usuarioId])
  const carga = useServiceCall(cargar)
  const { reintentar } = carga
  const vueltas = useVueltasALaPestania()

  // ─── Estado local ───────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => {
    if (vueltas > 0) reintentar()
  }, [vueltas, reintentar])

  const conversaciones = useMemo(() => (carga.status === 'listo' ? carga.data : []), [carga])
  const visibles = useMemo(() => filtrarConversaciones(conversaciones, busqueda), [conversaciones, busqueda])
  const nueva = useMemo(() => (conversacionId ? null : nuevaDeLaUrl(parametros)), [conversacionId, parametros])
  const existente = nueva && carga.status === 'listo' ? conversacionExistente(conversaciones, nueva.destinatario.personaId, nueva.propiedad?.id ?? null) : null

  // Decisión del PO: antes de crear, buscar una que ya exista con esa persona y esa propiedad, y abrir esa.
  useEffect(() => {
    if (existente) router.replace(`/panel/mensajes/${encodeURIComponent(existente.id)}`)
  }, [existente, router])

  // ─── Handlers ───────────────────────────────────────────────────────
  const abrir = (idNueva: string) => {
    setModalAbierto(false)
    reintentar()
    router.push(`/panel/mensajes/${encodeURIComponent(idNueva)}`)
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const conPanel = Boolean(conversacionId) || (nueva !== null && !existente)
  const botonNueva = (
    <Button type="primary" icon={<EditOutlined />} onClick={() => setModalAbierto(true)} data-testid="mensajes-nueva-button">
      Nueva conversación
    </Button>
  )
  const total = conversaciones.length
  const subtitulo = carga.status === 'listo' && total > 0 ? `${total} ${total === 1 ? 'conversación' : 'conversaciones'}` : undefined

  return (
    <div className={`${styles.page} ${conPanel ? styles.conPanel : ''}`} data-testid="mensajes-page">
      <div className={styles.encabezado}>
        <PageHeader title="Mensajes" subtitle={subtitulo} breadcrumb={[{ label: 'Mi panel', href: '/panel' }, { label: 'Mensajes' }]} actions={botonNueva} />
      </div>

      {carga.status === 'listo' && total === 0 && !conPanel ? (
        <div className={styles.bandejaVacia} data-testid="mensajes-vacio">
          <EmptyState
            title="Todavía no tenés mensajes"
            description="Escribile a un locador desde una propiedad publicada o, si sos locador, a tus locatarios con contrato vigente."
            action={
              <Button type="primary" onClick={() => setModalAbierto(true)} data-testid="mensajes-vacio-nueva">
                Nueva conversación
              </Button>
            }
          />
        </div>
      ) : (
        <div className={styles.columnas}>
          <section className={styles.bandeja} aria-label="Conversaciones" data-testid="mensajes-bandeja">
            <div className={styles.buscador}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Buscar por persona o propiedad"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                aria-label="Buscar por persona o propiedad"
                data-testid="mensajes-buscar"
              />
            </div>
            {carga.status === 'cargando' && <BandejaCargando />}
            {carga.status === 'error' && (
              <Alert
                type="error"
                className={styles.errorBandeja}
                title={carga.message}
                action={
                  <Button size="small" onClick={reintentar} data-testid="mensajes-reintentar">
                    Reintentar
                  </Button>
                }
                data-testid="mensajes-error"
              />
            )}
            {carga.status === 'listo' && (
              <nav className={styles.items} aria-label="Conversaciones">
                {visibles.map((item) => (
                  <ItemConversacion key={item.id} conversacion={item} seleccionada={item.id === conversacionId} ahoraIso={ahoraIso()} />
                ))}
                {visibles.length === 0 && (
                  <p className={styles.sinResultados} data-testid="mensajes-sin-resultados">
                    No hay conversaciones con “{busqueda}”.
                  </p>
                )}
              </nav>
            )}
          </section>

          <section className={styles.detalle} aria-label="Conversación">
            {conversacionId && user && <PanelConversacion key={conversacionId} conversacionId={conversacionId} usuarioId={usuarioId} recarga={vueltas} onCambio={reintentar} />}
            {!conversacionId && nueva && !existente && carga.status === 'listo' && <PanelNuevaConversacion nueva={nueva} existentes={conversaciones} onCreada={abrir} />}
            {!conPanel && (
              <div className={styles.panelVacio} data-testid="mensajes-ninguna-abierta">
                <EmptyState title="Elegí una conversación" description="Tocá una conversación de la lista para leerla y responder." />
              </div>
            )}
          </section>
        </div>
      )}

      {user && <NuevaConversacionModal open={modalAbierto} rol={rol} usuarioId={usuarioId} existentes={conversaciones} onCerrar={() => setModalAbierto(false)} onCreada={abrir} />}
    </div>
  )
}
