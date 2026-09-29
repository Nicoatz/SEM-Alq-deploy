'use client'

/**
 * BuscarPropiedades.tsx — la pantalla `/buscar` (US-34 Consultar propiedades a alquilar).
 *
 * Qué es: encabezado con el conteo y el orden, filtros activos, barra lateral
 * de filtros (escritorio) o Drawer (móvil), grilla de tarjetas y paginación,
 * con los estados cargando, error y sin resultados. Diseño: Claude Design,
 * "Búsqueda de propiedades" · 01, 03 y 04 (sin la vista Mapa, que no es del
 * Sprint 1).
 *
 * Cómo funciona el estado:
 * - La búsqueda APLICADA vive en la URL (`lib/search/busquedaParams.ts`): así
 *   "atrás", recargar o compartir el link mantienen filtros, orden y página.
 * - Los filtros que se están EDITANDO son un borrador local: se aplican con
 *   "Aplicar filtros" (escritorio) o "Ver N propiedades" (móvil).
 * - Los chips y el orden se aplican al instante.
 *
 * De dónde saca los datos: `services/propiedades.service.ts`
 * (`buscarPropiedades`, `contarPropiedades`, `listarUbicaciones`), llamado
 * desde el navegador: así también aparecen las propiedades creadas en el
 * alta en modo mock (que viven en `localStorage`).
 *
 * Accesible con y sin sesión: la ruta no está protegida por `proxy.ts`.
 * Quién lo usa: `app/(public)/buscar/page.tsx`.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Drawer, Dropdown, Select, message } from 'antd'
import { FilterOutlined, SwapOutlined } from '@ant-design/icons'
import type { BusquedaFiltros, OrdenBusqueda, Paginado, PropiedadResumen, UbicacionOpciones } from '@rentar/shared-types'
import { SearchSidebarFilters } from '@rentar/ui'
import { characteristicOptions } from '@/lib/catalogs/characteristics'
import { FILTROS_INICIALES, ORDEN_OPCIONES } from '@/lib/search/busqueda'
import { escribirBusqueda, leerBusqueda, type EstadoBusqueda } from '@/lib/search/busquedaParams'
import { chipsFiltros, type ChipFiltro } from '@/lib/search/filtrosActivos'
import { buscarPropiedades, contarPropiedades, listarUbicaciones } from '@/services/propiedades.service'
import { ChipsFiltros } from './ChipsFiltros'
import { ResultadosCargando, ResultadosError, ResultadosGrilla, SinResultados } from './ResultadosBusqueda'
import styles from './Buscar.module.css'

/** Resultado de una búsqueda, asociado a la URL que la pidió. */
interface ResultadoCargado {
  /** Query string de la búsqueda (para saber si el resultado es de la búsqueda actual). */
  key: string
  data: Paginado<PropiedadResumen> | null
  error: boolean
}

/** Espera antes de recalcular "Ver N propiedades" mientras se tocan los filtros del Drawer. */
const CONTEO_DEBOUNCE_MS = 300

/** Pantalla de búsqueda de propiedades. */
export function BuscarPropiedades() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messageApi, messageHolder] = message.useMessage()

  // ─── Búsqueda aplicada (sale de la URL) ─────────────────────────────
  const busquedaKey = searchParams.toString()
  const aplicada = useMemo(() => leerBusqueda(new URLSearchParams(busquedaKey)), [busquedaKey])

  // ─── Estado local ───────────────────────────────────────────────────
  // Borrador de filtros: se descarta solo cuando cambia la búsqueda aplicada
  // (se guarda junto con la key de la URL a la que pertenece).
  const [borradorState, setBorradorState] = useState<{ key: string; filtros: BusquedaFiltros }>({ key: busquedaKey, filtros: aplicada.filtros })
  const borrador = borradorState.key === busquedaKey ? borradorState.filtros : aplicada.filtros
  const setBorrador = (filtros: BusquedaFiltros) => setBorradorState({ key: busquedaKey, filtros })

  const [resultado, setResultado] = useState<ResultadoCargado | null>(null)
  const [ultimoConDatos, setUltimoConDatos] = useState<Paginado<PropiedadResumen> | null>(null)
  const [reintentos, setReintentos] = useState(0)
  const [ubicaciones, setUbicaciones] = useState<UbicacionOpciones>({ provinces: [] })
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [conteoDrawer, setConteoDrawer] = useState<number | null>(null)

  const cargando = resultado?.key !== busquedaKey

  // ─── Carga de datos (service) ───────────────────────────────────────

  // Resultados de la búsqueda aplicada.
  useEffect(() => {
    let cancelado = false
    buscarPropiedades(aplicada.filtros, aplicada.orden, aplicada.pagina)
      .then((data) => {
        if (cancelado) return
        setResultado({ key: busquedaKey, data, error: false })
        setUltimoConDatos(data)
      })
      .catch(() => {
        if (!cancelado) setResultado({ key: busquedaKey, data: null, error: true })
      })
    return () => {
      cancelado = true
    }
  }, [aplicada, busquedaKey, reintentos])

  // Si falla una página posterior, se mantiene la grilla anterior y se avisa
  // arriba (diseño: "el aviso aparece como message.error").
  const errorDePaginaPosterior = resultado?.key === busquedaKey && resultado.error && aplicada.pagina > 1 && ultimoConDatos !== null
  useEffect(() => {
    if (errorDePaginaPosterior) {
      void messageApi.error('No pudimos traer esa página. Probá de nuevo en un momento.')
    }
  }, [errorDePaginaPosterior, messageApi])

  // Opciones de ubicación (una sola vez).
  useEffect(() => {
    listarUbicaciones()
      .then(setUbicaciones)
      .catch(() => {
        // Sin opciones, los selects de ubicación quedan vacíos; la búsqueda sigue funcionando.
      })
  }, [])

  // "Ver N propiedades" del Drawer: se recalcula en vivo con el borrador.
  useEffect(() => {
    if (!drawerAbierto) return
    let cancelado = false
    const timer = setTimeout(() => {
      contarPropiedades(borrador)
        .then((total) => {
          if (!cancelado) setConteoDrawer(total)
        })
        .catch(() => {
          if (!cancelado) setConteoDrawer(null)
        })
    }, CONTEO_DEBOUNCE_MS)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [drawerAbierto, borrador])

  // ─── Handlers ───────────────────────────────────────────────────────

  /** Aplica una búsqueda: la escribe en la URL (queda en el historial para "atrás"). */
  function navegar(estado: EstadoBusqueda): void {
    const query = escribirBusqueda(estado).toString()
    router.push(query ? `/buscar?${query}` : '/buscar', { scroll: false })
  }

  function aplicarFiltros(filtros: BusquedaFiltros): void {
    navegar({ filtros, orden: aplicada.orden, pagina: 1 })
  }

  function cambiarOrden(orden: OrdenBusqueda): void {
    navegar({ filtros: aplicada.filtros, orden, pagina: 1 })
  }

  function cambiarPagina(pagina: number): void {
    navegar({ ...aplicada, pagina })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function quitarChip(chip: ChipFiltro): void {
    aplicarFiltros(chip.quitar(aplicada.filtros))
  }

  /** "Limpiar todo" y "Quitar todos los filtros": vuelve a la búsqueda inicial (conserva el orden). */
  function limpiarTodo(): void {
    aplicarFiltros(FILTROS_INICIALES)
  }

  function cerrarDrawer(): void {
    setDrawerAbierto(false)
    setConteoDrawer(null)
  }

  /** "Cancelar" del Drawer: descarta lo editado. */
  function cancelarDrawer(): void {
    setBorrador(aplicada.filtros)
    cerrarDrawer()
  }

  // ─── Render ─────────────────────────────────────────────────────────

  const nombreBarrio = (slug: string) =>
    ubicaciones.provinces.flatMap((p) => p.cities).flatMap((c) => c.neighborhoods).find((n) => n.slug === slug)?.name ?? slug
  const chips = chipsFiltros(aplicada.filtros, nombreBarrio, characteristicOptions)
  const ubicacionTexto = [aplicada.filtros.province, aplicada.filtros.city].filter(Boolean).join(' · ') || null
  const lugar = aplicada.filtros.city ?? aplicada.filtros.province

  // Mientras carga una página posterior (o si falló), se sigue mostrando la grilla anterior.
  const datos = resultado?.key === busquedaKey ? resultado.data : null
  const grilla = datos ?? (errorDePaginaPosterior || (cargando && aplicada.pagina > 1) ? ultimoConDatos : null)
  const total = datos?.total ?? (cargando || errorDePaginaPosterior ? ultimoConDatos?.total : undefined)
  // Falló la búsqueda y no hay una grilla anterior para mostrar: el subtítulo
  // no puede quedar en "Buscando propiedades…" (QA del 30/09).
  const errorSinDatos = !cargando && resultado?.error === true && total === undefined

  const selectorOrden = (
    <label className={`${styles.sortLabel} ${styles.desktopOnly}`}>
      <span>Ordenar por</span>
      <Select
        className={styles.sortSelect}
        value={aplicada.orden}
        options={ORDEN_OPCIONES}
        onChange={cambiarOrden}
        popupMatchSelectWidth={false}
        data-testid="buscar-orden"
      />
    </label>
  )

  return (
    <div className={styles.page}>
      {messageHolder}
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.headingGroup}>
            <h1 className={styles.heading}>
              <span className={styles.desktopOnly}>{lugar ? `Alquileres en ${lugar}` : 'Alquileres'}</span>
              <span className={styles.mobileOnly}>{aplicada.filtros.province ? `Alquileres en ${aplicada.filtros.province}` : 'Alquileres'}</span>
            </h1>
            <p className={styles.count} role="status" data-testid="buscar-conteo">
              {total !== undefined ? (
                <>
                  <strong>
                    {total} {total === 1 ? 'propiedad' : 'propiedades'}
                  </strong>
                  <span className={styles.desktopOnly}> con los filtros que elegiste · trato directo con el dueño</span>
                </>
              ) : errorSinDatos ? (
                'No pudimos cargar las propiedades'
              ) : (
                'Buscando propiedades…'
              )}
            </p>
          </div>

          {selectorOrden}

          <div className={`${styles.mobileActions} ${styles.mobileOnly}`}>
            <Button type="primary" icon={<FilterOutlined />} className={styles.filtersButton} onClick={() => setDrawerAbierto(true)} data-testid="buscar-abrir-filtros">
              Filtros
              {chips.length > 0 && (
                <span className={styles.filtersCount} aria-label={`${chips.length} filtros activos`}>
                  {chips.length}
                </span>
              )}
            </Button>
            <Dropdown
              trigger={['click']}
              menu={{
                selectable: true,
                selectedKeys: [aplicada.orden],
                items: ORDEN_OPCIONES.map((opcion) => ({ key: opcion.value, label: opcion.label })),
                onClick: ({ key }) => cambiarOrden(key as OrdenBusqueda),
              }}
            >
              <Button className={styles.sortButton} icon={<SwapOutlined rotate={90} />} aria-label="Ordenar" data-testid="buscar-orden-movil" />
            </Dropdown>
          </div>
        </header>

        <ChipsFiltros ubicacion={ubicacionTexto} chips={chips} onQuitar={quitarChip} onLimpiarTodo={limpiarTodo} />

        <div className={styles.layout}>
          <aside className={`${styles.sidebar} ${styles.desktopOnly}`} aria-label="Filtros">
            <SearchSidebarFilters
              value={borrador}
              onChange={setBorrador}
              onClear={limpiarTodo}
              onApply={() => aplicarFiltros(borrador)}
              // Diseño: mientras carga, los filtros quedan usables; solo se deshabilita "Aplicar".
              applyDisabled={cargando}
              locations={ubicaciones}
              characteristics={characteristicOptions}
              data-testid="buscar-filtros"
            />
          </aside>

          <section aria-label="Resultados">
            {grilla && grilla.total > 0 ? (
              <ResultadosGrilla resultado={grilla} onPagina={cambiarPagina} />
            ) : cargando ? (
              <ResultadosCargando />
            ) : resultado?.error ? (
              <ResultadosError onReintentar={() => setReintentos((n) => n + 1)} />
            ) : null}
            {!cargando && datos && datos.total === 0 && (
              <SinResultados filtros={aplicada.filtros} onAmpliarPrecio={(maxPrice) => aplicarFiltros({ ...aplicada.filtros, maxPrice })} onQuitarFiltros={limpiarTodo} />
            )}
          </section>
        </div>
      </div>

      <Drawer
        placement="bottom"
        open={drawerAbierto}
        onClose={cancelarDrawer}
        closable={false}
        size="85vh"
        className={styles.drawer}
        footer={
          <div className={styles.drawerFooter}>
            <Button size="large" onClick={cancelarDrawer} data-testid="buscar-drawer-cancelar">
              Cancelar
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                aplicarFiltros(borrador)
                cerrarDrawer()
              }}
              data-testid="buscar-drawer-ver"
            >
              {conteoDrawer === null ? 'Ver propiedades' : `Ver ${conteoDrawer} ${conteoDrawer === 1 ? 'propiedad' : 'propiedades'}`}
            </Button>
          </div>
        }
        data-testid="buscar-drawer"
      >
        <SearchSidebarFilters
          variant="drawer"
          value={borrador}
          onChange={setBorrador}
          // En el Drawer, "Limpiar" solo limpia el borrador: se ve el conteo antes de aplicar.
          onClear={() => setBorrador(FILTROS_INICIALES)}
          onClose={cancelarDrawer}
          locations={ubicaciones}
          characteristics={characteristicOptions}
        />
      </Drawer>
    </div>
  )
}
