'use client'

/**
 * MisPropiedades.tsx — `/panel/propiedades`, US-02 Consultar mis propiedades.
 *
 * Qué muestra (Claude Design, "Listado de propiedades" · 01-05): todas las
 * propiedades del locador en sesión, con pestañas de estado y su contador,
 * búsqueda por dirección o locatario, filtros (barrio, tipo, reclamos) y
 * orden; la tabla de 8 columnas (tarjetas en móvil) y los estados vacío,
 * sin resultados, cargando y error.
 *
 * Criterios de US-02 que cubre:
 * - "todas las propiedades registradas por el locador": `listarMisPropiedades`.
 * - imagen principal, dirección, estado de publicación, locatario, estado
 *   del alquiler, reclamos sin resolver y próximo ajuste: ver `columnas.tsx`.
 * - "filtrar por barrio, tipo, estado de publicación, si posee reclamos" y
 *   "solo barrios de sus propiedades": ver `lib/mis-propiedades/filtros.ts`.
 *
 * Acciones: la fila entera abre el detalle (`/panel/propiedades/[id]`), con
 * mouse o teclado. En móvil, "Ver detalle" y el "⋯", con "Ver detalle" y
 * "Editar" (US-03). NOTA: eliminar vive en el detalle (US-04); publicar y
 * pausar no tienen US en Sprint 0 (mapa US-40) ni endpoint.
 *
 * Quién lo usa: `app/(app)/panel/propiedades/page.tsx`.
 */
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Drawer, Dropdown, Input, Pagination, Select } from 'antd'
import { CloseCircleFilled, EllipsisOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { MisPropiedadesFiltros, OrdenMisPropiedades, PropiedadLocador } from '@rentar/shared-types'
import { DataTable, EmptyState, PageHeader } from '@rentar/ui'
import { PROPERTY_TYPE_LABEL, PROPERTY_TYPE_OPTIONS } from '@/lib/catalogs/propiedad'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import {
  barriosDe,
  cantidadFiltros,
  contarPorPestania,
  filtrarMisPropiedades,
  FILTROS_INICIALES,
  hayFiltros,
  MIS_PROPIEDADES_PAGE_SIZE,
  ORDEN_OPTIONS,
  PESTANIAS_ESTADO,
  RECLAMOS_OPTIONS,
} from '@/lib/mis-propiedades/filtros'
import { direccionEliminada, olvidarEliminada, PARAM_ELIMINADA } from '@/lib/mis-propiedades/eliminada'
import { listarMisPropiedades } from '@/services/propiedades.service'
import { CabeceraTarjeta, columnasMisPropiedades } from './columnas'
import styles from './MisPropiedades.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Propiedades' }]

/** "1 propiedad" / "7 propiedades". */
function propiedadesTexto(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'propiedad' : 'propiedades'}`
}

/**
 * Qué filtros hay aplicados, para el vacío "sin resultados" (Listado · 04:
 * "el vacío nombra los filtros aplicados"): "barrio Güemes y estado Pausadas".
 */
function describirFiltros(filtros: MisPropiedadesFiltros, barrios: { value: string; label: string }[]): string {
  const partes: string[] = []
  if (filtros.text.trim()) partes.push(`"${filtros.text.trim()}"`)
  if (filtros.neighborhoodSlug !== 'todos') partes.push(`barrio ${barrios.find((b) => b.value === filtros.neighborhoodSlug)?.label ?? filtros.neighborhoodSlug}`)
  if (filtros.type !== 'todos') partes.push(`tipo ${PROPERTY_TYPE_LABEL[filtros.type]}`)
  if (filtros.status !== 'todas') partes.push(`estado ${PESTANIAS_ESTADO.find((p) => p.value === filtros.status)?.label}`)
  if (filtros.claims !== 'todas') partes.push(filtros.claims === 'con_reclamos' ? 'con reclamos' : 'sin reclamos')
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : (partes[0] ?? '')
}

// ─── Pantalla ───────────────────────────────────────────────────────────

/**
 * Título y texto del bloque de error, según qué falló (Listado · 05).
 * - Sin respuesta del back (`network`) o el dispositivo sin red: "Revisá tu
 *   conexión".
 * - Sesión vencida (`unauthorized`): el mensaje del service ("Tu sesión venció…").
 * - Cualquier otra respuesta del back (4xx/5xx): error del servidor. NOTA: no
 *   se sugiere la conexión, porque el back sí respondió (por ejemplo, el 400
 *   de `/mis-alquileres` con firmantes duplicados, ver HANDOFF §7).
 */
function textoDeError(code: string, message: string): { titulo: string; detalle: string } {
  const sinRed = code === 'network' || (typeof navigator !== 'undefined' && navigator.onLine === false)
  if (sinRed) {
    return { titulo: 'No pudimos traer tus propiedades', detalle: 'Revisá tu conexión y probá de nuevo. Nada se perdió: tus propiedades siguen cargadas.' }
  }
  if (code === 'unauthorized') return { titulo: 'No pudimos traer tus propiedades', detalle: message }
  return {
    titulo: 'No pudimos traer tus propiedades por un error del servidor',
    detalle: 'El problema es nuestro, no de tu conexión. Probá de nuevo en unos minutos: tus propiedades siguen cargadas.',
  }
}

/** Listado de las propiedades del locador en sesión. */
export function MisPropiedades() {
  const router = useRouter()
  const carga = useServiceCall(listarMisPropiedades)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ─── Estado local ───────────────────────────────────────────────────
  const [filtros, setFiltros] = useState<MisPropiedadesFiltros>(FILTROS_INICIALES)
  const [orden, setOrden] = useState<OrdenMisPropiedades>('recientes')
  const [pagina, setPagina] = useState(1)
  // Drawer de filtros (móvil): se edita una copia y se aplica con "Ver N propiedades".
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [borrador, setBorrador] = useState<{ filtros: MisPropiedadesFiltros; orden: OrdenMisPropiedades }>({ filtros, orden })

  const datos = carga.status === 'listo' ? carga.data : null
  const todas = useMemo(() => datos ?? [], [datos])
  const barrios = useMemo(() => barriosDe(todas), [todas])
  const visibles = useMemo(() => filtrarMisPropiedades(todas, filtros, orden), [todas, filtros, orden])
  const contadores = useMemo(() => contarPorPestania(todas, filtros), [todas, filtros])
  const conReclamos = visibles.filter((propiedad) => propiedad.hasOpenClaims).length
  const alquiladasHoy = todas.filter((propiedad) => propiedad.status === 'alquilada' || propiedad.status === 'alquilada_publicada').length
  const paginaVisible = visibles.slice((pagina - 1) * MIS_PROPIEDADES_PAGE_SIZE, pagina * MIS_PROPIEDADES_PAGE_SIZE)
  const conteoBorrador = useMemo(() => filtrarMisPropiedades(todas, borrador.filtros, borrador.orden).length, [todas, borrador])

  // Aviso "Eliminaste <dirección>." (US-04): llega por `?eliminada=<id>` desde el detalle.
  const [eliminada, setEliminada] = useState<{ id: string; direccion: string | null } | null>(() => {
    const id = searchParams.get(PARAM_ELIMINADA)
    return id ? { id, direccion: direccionEliminada(id) } : null
  })

  // Se limpia la URL (como el `?solicitar=1` del detalle público), así recargar no repite el aviso.
  useEffect(() => {
    const id = searchParams.get(PARAM_ELIMINADA)
    if (!id) return
    olvidarEliminada(id)
    router.replace(pathname, { scroll: false })
  }, [searchParams, router, pathname])

  // ─── Handlers ───────────────────────────────────────────────────────
  function cambiarFiltros(cambio: Partial<MisPropiedadesFiltros>): void {
    setFiltros((actual) => ({ ...actual, ...cambio }))
    setPagina(1)
  }

  function limpiarFiltros(): void {
    setFiltros(FILTROS_INICIALES)
    setPagina(1)
  }

  function abrirDetalle(propiedad: PropiedadLocador): void {
    router.push(`/panel/propiedades/${propiedad.id}`)
  }

  function abrirDrawer(): void {
    setBorrador({ filtros, orden })
    setDrawerAbierto(true)
  }

  function aplicarDrawer(): void {
    setFiltros(borrador.filtros)
    setOrden(borrador.orden)
    setPagina(1)
    setDrawerAbierto(false)
  }

  const avisoEliminada = eliminada && (
    <Alert
      type="success"
      showIcon
      closable={{ 'aria-label': 'Cerrar el aviso' }}
      onClose={() => setEliminada(null)}
      title={eliminada.direccion ? `Eliminaste ${eliminada.direccion}.` : 'Eliminaste la propiedad.'}
      data-testid="mis-propiedades-eliminada"
    />
  )

  const publicarBoton = (
    <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => router.push('/panel/propiedades/nueva')} data-testid="mis-propiedades-publicar">
      Publicar propiedad
    </Button>
  )

  // ─── Error (Listado · 05) ───────────────────────────────────────────
  if (carga.status === 'error') {
    const texto = textoDeError(carga.code, carga.message)
    return (
      <div className={styles.page}>
        <PageHeader title="Propiedades" breadcrumb={MIGA} />
        <div className={styles.errorBlock} role="alert" data-testid="mis-propiedades-error">
          <span className={styles.errorIcon} aria-hidden="true">
            !
          </span>
          <span className={styles.errorTitle}>{texto.titulo}</span>
          <span className={styles.errorText}>{texto.detalle}</span>
          <div className={styles.errorActions}>
            <Button type="primary" onClick={carga.reintentar} data-testid="mis-propiedades-reintentar">
              Reintentar
            </Button>
            <Button onClick={() => router.push('/panel')} data-testid="mis-propiedades-ir-panel">
              Ir a mi panel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const cargando = carga.status === 'cargando'

  // ─── Vacío de primera vez (Listado · 04) ────────────────────────────
  // Sin tabs ni buscador: filtrar la nada no tiene sentido.
  if (!cargando && todas.length === 0) {
    return (
      <div className={styles.page}>
        <PageHeader title="Propiedades" breadcrumb={MIGA} actions={publicarBoton} />
        {avisoEliminada}
        <div className={styles.emptyBlock} data-testid="mis-propiedades-vacio">
          <EmptyState
            title="Todavía no publicaste ninguna propiedad"
            description="Cargala una vez y desde acá manejás el contrato, los cobros y los reclamos de esa propiedad."
            action={publicarBoton}
          />
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page} data-testid="mis-propiedades">
      <PageHeader
        title="Propiedades"
        subtitle={cargando ? undefined : `${propiedadesTexto(todas.length)} ${todas.length === 1 ? 'cargada' : 'cargadas'} · ${alquiladasHoy} ${alquiladasHoy === 1 ? 'alquilada' : 'alquiladas'} hoy`}
        breadcrumb={MIGA}
        actions={<span className={styles.desktopOnly}>{publicarBoton}</span>}
      />

      {avisoEliminada}

      {/* Pestañas de estado con su contador (un guion mientras carga, nunca un 0 falso). */}
      <div className={styles.tabs} role="tablist" aria-label="Estado de la publicación">
        {PESTANIAS_ESTADO.map((pestania) => {
          const activa = filtros.status === pestania.value
          return (
            <button
              key={pestania.value}
              type="button"
              role="tab"
              aria-selected={activa}
              className={`${styles.tab} ${activa ? styles.tabActive : ''}`}
              onClick={() => cambiarFiltros({ status: pestania.value })}
              data-testid={`mis-propiedades-tab-${pestania.value}`}
            >
              {pestania.label}
              <span className={styles.tabCount}>{cargando ? '—' : contadores[pestania.value]}</span>
            </button>
          )
        })}
      </div>

      {/* Buscador y filtros (escritorio). */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarFilters}>
          <Input
            className={styles.search}
            prefix={<SearchOutlined />}
            placeholder="Buscar por dirección o locatario"
            // El botón de borrar de antd toma el nombre del ícono ("close-circle",
            // en inglés): se lo pisa con uno en español.
            allowClear={{ clearIcon: <CloseCircleFilled aria-label="Borrar la búsqueda" /> }}
            value={filtros.text}
            onChange={(event) => cambiarFiltros({ text: event.target.value })}
            aria-label="Buscar por dirección o locatario"
            data-testid="mis-propiedades-buscar"
          />
          <span className={styles.desktopOnlyFlex}>
            <Select
              className={styles.select}
              prefix="Barrio:"
              value={filtros.neighborhoodSlug}
              onChange={(value) => cambiarFiltros({ neighborhoodSlug: value })}
              options={[{ value: 'todos', label: 'Todos' }, ...barrios]}
              popupMatchSelectWidth={false}
              aria-label="Barrio"
              data-testid="mis-propiedades-filtro-barrio"
            />
            <Select
              className={styles.select}
              prefix="Tipo:"
              value={filtros.type}
              onChange={(value) => cambiarFiltros({ type: value })}
              options={[{ value: 'todos', label: 'Todos' }, ...PROPERTY_TYPE_OPTIONS]}
              popupMatchSelectWidth={false}
              aria-label="Tipo"
              data-testid="mis-propiedades-filtro-tipo"
            />
            <Select
              className={styles.select}
              prefix="Reclamos pendientes:"
              value={filtros.claims}
              onChange={(value) => cambiarFiltros({ claims: value })}
              options={RECLAMOS_OPTIONS}
              popupMatchSelectWidth={false}
              aria-label="Reclamos pendientes"
              data-testid="mis-propiedades-filtro-reclamos"
            />
          </span>
        </div>
        <span className={styles.desktopOnlyFlex}>
          <Select
            className={styles.select}
            prefix="Ordenar:"
            value={orden}
            onChange={setOrden}
            options={ORDEN_OPTIONS}
            popupMatchSelectWidth={false}
            aria-label="Ordenar"
            data-testid="mis-propiedades-orden"
          />
        </span>
        {/* Móvil: el conteo y el botón que abre el Drawer de filtros. */}
        <div className={styles.mobileFiltersRow}>
          <span className={styles.summary}>{cargando ? 'Cargando…' : propiedadesTexto(visibles.length)}</span>
          <Button onClick={abrirDrawer} className={styles.filtersButton} data-testid="mis-propiedades-abrir-filtros">
            Filtros
            {cantidadFiltros(filtros) > 0 && <span className={styles.filtersBadge}>{cantidadFiltros(filtros)}</span>}
          </Button>
        </div>
      </div>

      {!cargando && (
        <p className={`${styles.summary} ${styles.desktopOnlyBlock}`} data-testid="mis-propiedades-mostrando">
          Mostrando {visibles.length} de {propiedadesTexto(todas.length)}
          <span className={styles.summaryDot}>·</span>
          {conReclamos} con reclamos abiertos
          {hayFiltros(filtros) && (
            <>
              <span className={styles.summaryDot}>·</span>
              <button type="button" className={styles.linkButton} onClick={limpiarFiltros} data-testid="mis-propiedades-limpiar">
                Limpiar filtros
              </button>
            </>
          )}
        </p>
      )}

      {!cargando && visibles.length === 0 ? (
        <div className={styles.emptyBlock} data-testid="mis-propiedades-sin-resultados">
          <EmptyState
            title="Ninguna propiedad coincide con esos filtros"
            description={`Estás filtrando por ${describirFiltros(filtros, barrios)}. Probá soltando alguno.`}
            action={
              <Button onClick={limpiarFiltros} data-testid="mis-propiedades-limpiar-vacio">
                Limpiar filtros
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columnasMisPropiedades}
            data={paginaVisible}
            rowKey={(propiedad) => propiedad.id}
            loading={cargando}
            onRowClick={abrirDetalle}
            rowLabel={(propiedad) => `Ver detalle de ${propiedad.address}`}
            cardHeader={(propiedad) => <CabeceraTarjeta propiedad={propiedad} />}
            cardActions={(propiedad) => (
              <>
                <Button type="primary" className={styles.cardPrimary} onClick={() => abrirDetalle(propiedad)} data-testid="mis-propiedades-ver-detalle">
                  Ver detalle
                </Button>
                {/* NOTA: eliminar vive en el detalle (US-04), con su confirmación; pausar y publicar no tienen US todavía. */}
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'detalle', label: 'Ver detalle', onClick: () => abrirDetalle(propiedad) },
                      // US-03: atajo a la edición, sin pasar por el detalle.
                      { key: 'editar', label: <span data-testid="mis-propiedades-editar">Editar</span>, onClick: () => router.push(`/panel/propiedades/${encodeURIComponent(propiedad.id)}/editar`) },
                    ],
                  }}
                >
                  <Button className={styles.cardMore} aria-label={`Más opciones de ${propiedad.address}`} icon={<EllipsisOutlined />} data-testid="mis-propiedades-mas" />
                </Dropdown>
              </>
            )}
            data-testid="mis-propiedades-tabla"
          />
          {visibles.length > MIS_PROPIEDADES_PAGE_SIZE && (
            <Pagination
              className={styles.pagination}
              current={pagina}
              pageSize={MIS_PROPIEDADES_PAGE_SIZE}
              total={visibles.length}
              showSizeChanger={false}
              onChange={setPagina}
            />
          )}
        </>
      )}

      {/* CTA fijo abajo en móvil (Listado · 03). */}
      <div className={styles.mobileCta}>
        <Button type="primary" block icon={<PlusOutlined />} onClick={() => router.push('/panel/propiedades/nueva')} data-testid="mis-propiedades-publicar-movil">
          Publicar propiedad
        </Button>
      </div>

      {/* Drawer de filtros (móvil): confirma con la cantidad de resultados. */}
      <Drawer
        placement="bottom"
        open={drawerAbierto}
        onClose={() => setDrawerAbierto(false)}
        size="auto"
        title="Filtros"
        extra={
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setBorrador({ filtros: { ...FILTROS_INICIALES, text: filtros.text }, orden: 'recientes' })}
            data-testid="mis-propiedades-drawer-limpiar"
          >
            Limpiar
          </button>
        }
        footer={
          <div className={styles.drawerFooter}>
            <Button size="large" onClick={() => setDrawerAbierto(false)} data-testid="mis-propiedades-drawer-cancelar">
              Cancelar
            </Button>
            <Button type="primary" size="large" onClick={aplicarDrawer} data-testid="mis-propiedades-drawer-aplicar">
              Ver {propiedadesTexto(conteoBorrador)}
            </Button>
          </div>
        }
        data-testid="mis-propiedades-drawer"
      >
        <div className={styles.drawerBody}>
          <div className={styles.drawerField}>
            <span className={styles.drawerLabel}>Estado</span>
            <div className={styles.drawerChips}>
              {PESTANIAS_ESTADO.map((pestania) => {
                const activa = borrador.filtros.status === pestania.value
                return (
                  <button
                    key={pestania.value}
                    type="button"
                    aria-pressed={activa}
                    className={`${styles.drawerChip} ${activa ? styles.drawerChipActive : ''}`}
                    onClick={() => setBorrador((actual) => ({ ...actual, filtros: { ...actual.filtros, status: pestania.value } }))}
                  >
                    {pestania.label}
                  </button>
                )
              })}
            </div>
          </div>
          <label className={styles.drawerField}>
            <span className={styles.drawerLabel}>Barrio</span>
            <Select
              size="large"
              value={borrador.filtros.neighborhoodSlug}
              onChange={(value) => setBorrador((actual) => ({ ...actual, filtros: { ...actual.filtros, neighborhoodSlug: value } }))}
              options={[{ value: 'todos', label: 'Todos los barrios' }, ...barrios]}
              data-testid="mis-propiedades-drawer-barrio"
            />
          </label>
          <label className={styles.drawerField}>
            <span className={styles.drawerLabel}>Tipo</span>
            <Select
              size="large"
              value={borrador.filtros.type}
              onChange={(value) => setBorrador((actual) => ({ ...actual, filtros: { ...actual.filtros, type: value } }))}
              options={[{ value: 'todos', label: 'Todos' }, ...PROPERTY_TYPE_OPTIONS]}
              data-testid="mis-propiedades-drawer-tipo"
            />
          </label>
          <div className={styles.drawerField}>
            <span className={styles.drawerLabel}>Avisos</span>
            <Checkbox
              checked={borrador.filtros.claims === 'con_reclamos'}
              onChange={(event) =>
                setBorrador((actual) => ({ ...actual, filtros: { ...actual.filtros, claims: event.target.checked ? 'con_reclamos' : 'todas' } }))
              }
              data-testid="mis-propiedades-drawer-reclamos"
            >
              Con reclamos pendientes
            </Checkbox>
          </div>
          <label className={styles.drawerField}>
            <span className={styles.drawerLabel}>Ordenar por</span>
            <Select
              size="large"
              value={borrador.orden}
              onChange={(value) => setBorrador((actual) => ({ ...actual, orden: value }))}
              options={ORDEN_OPTIONS}
              data-testid="mis-propiedades-drawer-orden"
            />
          </label>
        </div>
      </Drawer>
    </div>
  )
}
