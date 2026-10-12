'use client'

/**
 * HeroSearch.tsx — el buscador del hero de la landing ("La consola"): Zona,
 * Tipología, Precio desde/hasta y Dormitorios en una fila, más "Más filtros".
 *
 * Qué cubre: US-34 Consultar propiedades a alquilar (la búsqueda en sí vive
 * en `/buscar`; este componente arma los filtros y lleva ahí).
 * Diseño: dirección "A · La consola" de la landing (la landing no tiene
 * vista de Claude Design, ver `docs/MapaDePantallas.pdf`).
 * Quién lo usa: la landing de `apps/web` (`components/landing/BuscadorLanding.tsx`)
 * y el catálogo `/design-system`.
 *
 * Cómo funciona (mejora progresiva):
 * - Sin JS (o antes de que hidrate) es un `<form method="get">` nativo con
 *   los mismos nombres de params que lee `/buscar` (`barrio`, `tipo`,
 *   `precioMin`, `precioMax`, `dorm`, `amb`, `tag`, `m2Min`, `m2Max`,
 *   `indice`): se puede usar desde el primer frame. "Más filtros" es un
 *   `<details>` que se despliega en el lugar.
 * - Con JS, el envío pasa por `onSearch` (quien lo usa arma la URL sin
 *   params vacíos y navega), el mismo `<details>` se muestra como panel
 *   flotante (escritorio) u hoja desde abajo (móvil), y aparece el
 *   contador de filtros activos.
 *
 * NOTA: los campos son NO controlados y sus valores se leen del formulario
 * (`FormData`) cuando hace falta. Así no se pierde lo que alguien eligió
 * antes de que la página hidrate (un campo controlado volvería a su valor
 * inicial).
 * NOTA: "Más filtros" no usa el Popover ni el Drawer de antd: los dos se
 * montan fuera del formulario, y para usarlos había que mover los campos
 * después de hidratar (y se perdía lo elegido antes). El `<details>` queda
 * siempre en el mismo lugar del formulario; la hoja móvil es `position:
 * fixed` y nada del hero crea un contexto que la recorte (sin `overflow`,
 * `transform` ni `z-index` en sus contenedores: ver HeroSearch.module.css).
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { Button } from 'antd'
import { CloseOutlined, DownOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import type { AdjustmentIndex, CharacteristicKey, CharacteristicOption, PropertyType } from '@rentar/shared-types'
import { motion } from '../../tokens'
import { formatARS } from '../../utils/formatARS'
import styles from './HeroSearch.module.css'

// ─── Tipos ─────────────────────────────────────────────────────────────────

/** Los filtros elegidos en el buscador. `null` (o lista vacía) = "todos". */
export interface HeroSearchValues {
  barrio: string | null
  tipo: PropertyType | null
  precioMin: number | null
  precioMax: number | null
  /** Cantidad exacta; el 4 es "4 o más" (igual que `/buscar`). */
  dormitorios: number | null
  /** Cantidad exacta; el 4 es "4 o más". */
  ambientes: number | null
  caracteristicas: CharacteristicKey[]
  m2Min: number | null
  m2Max: number | null
  indice: AdjustmentIndex | null
}

/** Props de {@link HeroSearch}. */
export interface HeroSearchProps {
  /** Barrios del select "Zona" (slug + nombre visible). */
  neighborhoods: readonly { slug: string; name: string }[]
  /** Montos de "Desde" y "Hasta", en pesos, de menor a mayor. */
  priceSteps: readonly number[]
  /** Características que se ofrecen en "Más filtros". */
  characteristics: readonly CharacteristicOption[]
  /** Explicación corta de cada índice de ajuste, para "Más filtros". */
  indexHelp: Record<AdjustmentIndex, string>
  /** A dónde se envía el formulario sin JS (GET). Por defecto, `/buscar`. */
  action?: string
  /**
   * Con JS, recibe los filtros al tocar "Buscar" y se encarga de navegar.
   * Sin este callback, el formulario se envía de forma nativa.
   */
  onSearch?: (values: HeroSearchValues) => void
  /** `id` del formulario. Por defecto, uno generado. */
  id?: string
  /** Base de los `data-testid` (ej. `landing-buscador` → `landing-buscador-barrio`). */
  'data-testid'?: string
}

// ─── Opciones fijas ────────────────────────────────────────────────────────

/** Tipologías, en el orden de `/buscar`. */
const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'monoambiente', label: 'Monoambiente' },
]

/** Cantidades de dormitorios y ambientes; el 4 es "4 o más". */
const COUNT_OPTIONS = [1, 2, 3, 4]

const INDEX_OPTIONS: AdjustmentIndex[] = ['IPC', 'ICL']

/**
 * Desde este ancho (breakpoints.md, 768 px) "Dormitorios" está en la fila
 * principal y "Más filtros" es un panel flotante; debajo, una hoja desde abajo.
 */
const DESKTOP_QUERY = '(min-width: 768px)'

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** Suscripción que nunca avisa: para saber si ya hidrató (ver {@link useHydrated}). */
function subscribeNothing(): () => void {
  return () => {}
}

/**
 * `false` en el servidor y durante la hidratación; `true` después. Es la
 * forma de React de mostrar algo solo con JS sin un `setState` en un efecto.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )
}

function subscribeDesktop(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** `true` desde 768 px. En el servidor, `true` (el CSS decide qué se ve hasta hidratar). */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Número positivo de un campo, o `null` si está vacío o no es válido. */
function positiveNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/**
 * Lee los filtros del formulario. `dormitorios` sale del campo visible: la
 * fila principal en escritorio o "Más filtros" en móvil (hay uno en cada
 * lugar, sincronizados en `handleChange`).
 */
function readValues(form: HTMLFormElement, characteristics: readonly CharacteristicOption[], isDesktop: boolean): HeroSearchValues {
  const data = new FormData(form)
  const text = (name: string): string | null => {
    const value = data.get(name)
    return typeof value === 'string' && value !== '' ? value : null
  }
  const bedrooms = data.getAll('dorm').map(positiveNumber)
  const tipo = text('tipo')
  const indice = text('indice')
  const tags = data.getAll('tag')
  return {
    barrio: text('barrio'),
    tipo: TYPE_OPTIONS.find((option) => option.value === tipo)?.value ?? null,
    precioMin: positiveNumber(data.get('precioMin')),
    precioMax: positiveNumber(data.get('precioMax')),
    // El primer `dorm` del formulario es el de la fila; el segundo, el de "Más filtros".
    dormitorios: (isDesktop ? bedrooms[0] : bedrooms[1]) ?? null,
    ambientes: positiveNumber(data.get('amb')),
    caracteristicas: characteristics.map((option) => option.key).filter((key) => tags.includes(key)),
    m2Min: positiveNumber(data.get('m2Min')),
    m2Max: positiveNumber(data.get('m2Max')),
    indice: INDEX_OPTIONS.find((option) => option === indice) ?? null,
  }
}

/** Cuántos filtros de "Más filtros" están activos. En móvil Dormitorios vive ahí, así que cuenta. */
function countActive(values: HeroSearchValues, isDesktop: boolean): number {
  return (
    (!isDesktop && values.dormitorios !== null ? 1 : 0) +
    (values.ambientes !== null ? 1 : 0) +
    values.caracteristicas.length +
    (values.m2Min !== null || values.m2Max !== null ? 1 : 0) +
    (values.indice !== null ? 1 : 0)
  )
}

/** "4 o más" para el 4; el número tal cual para el resto. */
function countLabel(count: number): string {
  return count === 4 ? '4 o más' : String(count)
}

// ─── Piezas internas ───────────────────────────────────────────────────────

/**
 * Un `<select>` nativo con la piel de los campos de `/buscar` y la flecha superpuesta.
 *
 * NOTA: va con `forwardRef` y no recibe `ref` como prop común (lo que permite
 * React 19): las plantillas de Claude Design corren con React 18.3.1, donde
 * esa `ref` no llega y el rango de precio dejaba de cuidarse.
 */
const NativeSelect = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<'select'>>(function NativeSelect({ className, children, ...rest }, ref) {
  return (
    <span className={styles.selectWrap}>
      <select ref={ref} className={`${styles.select} ${className ?? ''}`} {...rest}>
        {children}
      </select>
      <DownOutlined className={styles.selectIcon} aria-hidden="true" />
    </span>
  )
})

/** Props de {@link CountPills}. */
interface CountPillsProps {
  legend: string
  name: string
  testId: string
}

/** Grupo de radios "Todos / 1 / 2 / 3 / 4 o más" con forma de pastilla. */
function CountPills({ legend, name, testId }: CountPillsProps) {
  return (
    <fieldset className={styles.group} data-testid={testId}>
      <legend className={styles.groupLegend}>{legend}</legend>
      <div className={styles.pills}>
        <label className={styles.pill}>
          <input className={styles.pillInput} type="radio" name={name} value="" defaultChecked data-testid={`${testId}-todos`} />
          <span className={styles.pillText}>Todos</span>
        </label>
        {COUNT_OPTIONS.map((count) => (
          <label key={count} className={styles.pill}>
            <input className={styles.pillInput} type="radio" name={name} value={count} data-testid={`${testId}-${count}`} />
            <span className={styles.pillText}>{countLabel(count)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// ─── Componente ────────────────────────────────────────────────────────────

/**
 * Buscador del hero de la landing. Ver el encabezado del archivo para la
 * mejora progresiva (sin JS es un `<form method="get">` nativo).
 *
 * `data-testid` (con la base `T` que recibe): `T` (formulario), `T-barrio`,
 * `T-tipo`, `T-precio-min`, `T-precio-max`, `T-dorm`, `T-submit`,
 * `T-mas-filtros` (el botón), `T-mas-filtros-contador`, `T-mas-filtros-panel`,
 * `T-dorm-movil-<n|todos>`, `T-amb-<n|todos>`, `T-tag-<clave>`, `T-m2-min`,
 * `T-m2-max`, `T-indice-<IPC|ICL|todos>`, `T-limpiar`, `T-mas-filtros-cerrar`
 * y `T-mas-filtros-buscar`.
 */
export function HeroSearch({
  neighborhoods,
  priceSteps,
  characteristics,
  indexHelp,
  action = '/buscar',
  onSearch,
  id,
  'data-testid': testId = 'hero-search',
}: HeroSearchProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  const generatedId = useId()
  const formId = id ?? `hero-search-${generatedId}`
  const formRef = useRef<HTMLFormElement>(null)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const panelSubmitRef = useRef<HTMLButtonElement>(null)
  const minPriceRef = useRef<HTMLSelectElement>(null)
  const maxPriceRef = useRef<HTMLSelectElement>(null)

  const hydrated = useHydrated()
  const isDesktop = useIsDesktop()
  // Lo que hay elegido (para el contador y el rango de precio). Se relee
  // del formulario en cada cambio; los campos no dependen de este estado.
  const [values, setValues] = useState<HeroSearchValues | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  // "Más filtros" se está cerrando: la salida se anima y después se cierra el <details>.
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)

  // ─── Cierre de "Más filtros" ────────────────────────────────────────
  /**
   * Cierra "Más filtros". Con JS, primero anima la salida (en móvil la hoja
   * vuelve a bajar y el fondo se apaga; en escritorio el panel se desvanece
   * hacia su botón) y recién después cierra el `<details>`: así sale por
   * donde entró. Sin JS o con "reducir movimiento", cierra de inmediato.
   * @param returnFocus Si el foco vuelve a "Más filtros" (Escape, ✕ y el fondo oscuro).
   */
  function closeMore(returnFocus: boolean) {
    if (!moreOpen || closingRef.current) return
    if (returnFocus) summaryRef.current?.focus()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!hydrated || reduceMotion) {
      setMoreOpen(false)
      return
    }
    closingRef.current = true
    setClosing(true)
    closeTimerRef.current = window.setTimeout(
      () => {
        closingRef.current = false
        closeTimerRef.current = null
        setClosing(false)
        setMoreOpen(false)
      },
      // Los mismos tiempos que la salida en HeroSearch.module.css (`.closing`).
      isDesktop ? motion.duration.fast : motion.duration.base,
    )
  }

  /**
   * `closeMore` para los listeners del efecto (Escape y clic afuera), siempre
   * con el estado al día y sin volver a suscribirlos en cada render.
   * NOTA: no se usa `useEffectEvent`, que hace esto mismo, porque es de React
   * 19.2 y las plantillas de Claude Design corren con React 18.3.1 ("is not a
   * function"). La ref se actualiza en un layout effect, antes que cualquier
   * listener pueda llamarla.
   */
  const closeMoreRef = useRef(closeMore)
  useLayoutEffect(() => {
    closeMoreRef.current = closeMore
  })
  const onCloseRequest = useCallback((returnFocus: boolean) => closeMoreRef.current(returnFocus), [])

  // ─── Efectos ────────────────────────────────────────────────────────
  // Con "Más filtros" abierto: Escape lo cierra (y el foco vuelve a "Más
  // filtros") y un clic afuera también. En móvil la hoja es modal: el foco
  // queda atrapado adentro (Tab y Shift+Tab dan la vuelta), se bloquea el
  // scroll de la página y el foco pasa al panel.
  useEffect(() => {
    if (!moreOpen) return
    const details = detailsRef.current
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRequest(true)
        return
      }
      if (event.key !== 'Tab' || isDesktop || closingRef.current) return
      // Trampa de foco: los bordes son la ✕ (primero) y "Buscar" (último).
      const panel = panelRef.current
      const first = closeButtonRef.current
      const last = panelSubmitRef.current
      if (!panel || !first || !last) return
      const active = document.activeElement
      if (!(active instanceof Node) || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (details && event.target instanceof Node && !details.contains(event.target)) onCloseRequest(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    const previousOverflow = document.body.style.overflow
    if (!isDesktop) {
      document.body.style.overflow = 'hidden'
      panelRef.current?.focus()
    } else {
      // En pantallas bajas (1280×720, por ejemplo) el panel flotante terminaba
      // debajo del pliegue, con "Buscar" fuera de vista: se desplaza lo justo.
      panelRef.current?.scrollIntoView({ block: 'nearest' })
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      document.body.style.overflow = previousOverflow
    }
  }, [moreOpen, isDesktop, onCloseRequest])

  // Si el componente se desmonta mientras "Más filtros" se cierra, se cancela el cierre pendiente.
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  // ─── Handlers ───────────────────────────────────────────────────────
  /** Con JS, tocar "Más filtros" abierto pasa por el cierre animado (abrir sigue siendo lo nativo del `<details>`). */
  function handleSummaryClick(event: MouseEvent<HTMLElement>) {
    if (!hydrated || !moreOpen) return
    event.preventDefault()
    closeMore(false)
  }

  /** Cualquier cambio: sincroniza los dos "Dormitorios", cuida el rango de precio y relee los filtros. */
  function handleChange(event: FormEvent<HTMLFormElement>) {
    const form = formRef.current
    if (!form) return
    const target = event.target

    // Hay un "Dormitorios" en la fila (select) y otro en "Más filtros"
    // (radios): el que no se tocó copia el valor del otro.
    if (target instanceof HTMLSelectElement && target.name === 'dorm') {
      form.querySelectorAll<HTMLInputElement>('input[type="radio"][name="dorm"]').forEach((radio) => {
        radio.checked = radio.value === target.value
      })
    } else if (target instanceof HTMLInputElement && target.name === 'dorm') {
      form.querySelectorAll<HTMLSelectElement>('select[name="dorm"]').forEach((select) => {
        select.value = target.value
      })
    }

    // Si "Desde" quedó por encima de "Hasta" (o al revés), el otro vuelve a "Sin máximo/mínimo".
    const min = positiveNumber(minPriceRef.current?.value ?? null)
    const max = positiveNumber(maxPriceRef.current?.value ?? null)
    if (min !== null && max !== null && min > max) {
      if (target === minPriceRef.current && maxPriceRef.current) maxPriceRef.current.value = ''
      if (target === maxPriceRef.current && minPriceRef.current) minPriceRef.current.value = ''
    }

    setValues(readValues(form, characteristics, isDesktop))
  }

  /** Con `onSearch`, el envío lo resuelve quien usa el componente; si no, sigue el envío nativo. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!onSearch || !formRef.current) return
    event.preventDefault()
    setMoreOpen(false)
    onSearch(readValues(formRef.current, characteristics, isDesktop))
  }

  /** "Limpiar": vuelve a "Todos" los campos de "Más filtros" (no toca la fila principal). */
  function clearMoreFilters() {
    const panel = panelRef.current
    const form = formRef.current
    if (!panel || !form) return
    panel.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      if (input.type === 'radio') input.checked = input.value === ''
      else if (input.type === 'checkbox') input.checked = false
      else input.value = ''
    })
    // En móvil, Dormitorios está en el panel: también vuelve a "Todos" el de la fila.
    if (!isDesktop) {
      form.querySelectorAll<HTMLSelectElement>('select[name="dorm"]').forEach((select) => {
        select.value = ''
      })
    }
    setValues(readValues(form, characteristics, isDesktop))
  }

  /** El `<details>` avisa cuando se abre o se cierra (por el resumen o por código). */
  function handleToggle() {
    setMoreOpen(detailsRef.current?.open ?? false)
  }

  /**
   * Escritorio: si el foco sale del panel flotante (Tab hasta el final, por
   * ejemplo), se cierra. En móvil no pasa: la hoja retiene el foco.
   */
  function handleDetailsBlur(event: FocusEvent<HTMLDetailsElement>) {
    if (!hydrated || !moreOpen || !isDesktop) return
    const next = event.relatedTarget
    if (next instanceof Node && detailsRef.current?.contains(next)) return
    // `relatedTarget` vacío = el foco fue a una parte no enfocable (o a otra ventana): se deja abierto.
    if (next) closeMore(false)
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const activeCount = values ? countActive(values, isDesktop) : 0
  const panelId = `${formId}-mas-filtros`
  const panelTitleId = `${formId}-mas-filtros-titulo`
  // En móvil (con JS) "Más filtros" es una hoja modal: se anuncia como diálogo.
  const isSheet = hydrated && !isDesktop

  return (
    <form
      id={formId}
      ref={formRef}
      className={`${styles.form} ${hydrated ? styles.enhanced : ''}`}
      method="get"
      action={action}
      role="search"
      aria-label="Buscar propiedades"
      onChange={handleChange}
      onSubmit={handleSubmit}
      data-testid={testId}
    >
      <div className={styles.tray}>
        <div className={styles.core}>
          <div className={styles.cells}>
            <div className={styles.cell}>
              <label className={styles.label} htmlFor={`${formId}-barrio`}>
                Zona
              </label>
              <NativeSelect id={`${formId}-barrio`} name="barrio" defaultValue="" data-testid={`${testId}-barrio`}>
                <option value="">Todos los barrios</option>
                {neighborhoods.map((neighborhood) => (
                  <option key={neighborhood.slug} value={neighborhood.slug}>
                    {neighborhood.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className={styles.cell}>
              <label className={styles.label} htmlFor={`${formId}-tipo`}>
                Tipología
              </label>
              <NativeSelect id={`${formId}-tipo`} name="tipo" defaultValue="" data-testid={`${testId}-tipo`}>
                <option value="">Todas</option>
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <fieldset className={`${styles.cell} ${styles.cellPrice}`}>
              <legend className={styles.label}>Precio</legend>
              <div className={styles.pair}>
                <label className={styles.srOnly} htmlFor={`${formId}-precio-min`}>
                  Precio desde
                </label>
                <NativeSelect ref={minPriceRef} id={`${formId}-precio-min`} name="precioMin" defaultValue="" className={styles.numeric} data-testid={`${testId}-precio-min`}>
                  <option value="">Sin mínimo</option>
                  {priceSteps.map((price) => (
                    <option key={price} value={price} disabled={values !== null && values.precioMax !== null && price > values.precioMax}>
                      {formatARS(price)}
                    </option>
                  ))}
                </NativeSelect>
                <label className={styles.srOnly} htmlFor={`${formId}-precio-max`}>
                  Precio hasta
                </label>
                <NativeSelect ref={maxPriceRef} id={`${formId}-precio-max`} name="precioMax" defaultValue="" className={styles.numeric} data-testid={`${testId}-precio-max`}>
                  <option value="">Sin máximo</option>
                  {priceSteps.map((price) => (
                    <option key={price} value={price} disabled={values !== null && values.precioMin !== null && price < values.precioMin}>
                      {formatARS(price)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </fieldset>

            <div className={`${styles.cell} ${styles.cellBedrooms}`}>
              <label className={styles.label} htmlFor={`${formId}-dorm`}>
                Dormitorios
              </label>
              {/* En móvil no se ve: Dormitorios está en "Más filtros" (los dos se sincronizan). */}
              <NativeSelect id={`${formId}-dorm`} name="dorm" defaultValue="" data-testid={`${testId}-dorm`}>
                <option value="">Todos</option>
                {COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {countLabel(count)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <details
              ref={detailsRef}
              className={`${styles.more} ${closing ? styles.closing : ''}`}
              open={moreOpen}
              onToggle={handleToggle}
              onBlur={handleDetailsBlur}
            >
              {/* Sin JS, el <summary> ya anuncia "expandido/contraído" por su cuenta; con JS se explicita (y apunta al panel). */}
              <summary
                ref={summaryRef}
                className={styles.summary}
                aria-expanded={hydrated ? moreOpen : undefined}
                aria-controls={hydrated ? panelId : undefined}
                onClick={handleSummaryClick}
                data-testid={`${testId}-mas-filtros`}
              >
                <FilterOutlined aria-hidden="true" />
                Más filtros
                <span className={`${styles.count} ${activeCount > 0 ? styles.countVisible : ''}`} aria-hidden="true" data-testid={`${testId}-mas-filtros-contador`}>
                  {activeCount}
                </span>
                {activeCount > 0 && <span className={styles.srOnly}>, {activeCount === 1 ? '1 activo' : `${activeCount} activos`}</span>}
              </summary>

              {/* Fondo oscuro de la hoja móvil (solo con JS; ver el CSS). Tocarlo cierra "Más filtros". */}
              <div className={styles.backdrop} aria-hidden="true" onClick={() => closeMore(true)} />

              <div
                ref={panelRef}
                id={panelId}
                className={styles.panel}
                tabIndex={-1}
                role={isSheet ? 'dialog' : 'group'}
                aria-modal={isSheet ? true : undefined}
                aria-labelledby={isSheet ? panelTitleId : undefined}
                aria-label={isSheet ? undefined : 'Más filtros'}
                data-testid={`${testId}-mas-filtros-panel`}
              >
                {hydrated && (
                  <div className={styles.panelHeader}>
                    <span id={panelTitleId} className={styles.panelTitle}>
                      Más filtros
                    </span>
                    <button
                      ref={closeButtonRef}
                      type="button"
                      className={styles.closeButton}
                      aria-label="Cerrar más filtros"
                      onClick={() => closeMore(true)}
                      data-testid={`${testId}-mas-filtros-cerrar`}
                    >
                      <CloseOutlined aria-hidden="true" />
                    </button>
                  </div>
                )}

                <div className={styles.panelBody}>
                  {/* Dormitorios del panel: solo en móvil (desde 768 px está en la fila). */}
                  <div className={styles.mobileOnly}>
                    <CountPills legend="Dormitorios" name="dorm" testId={`${testId}-dorm-movil`} />
                  </div>
                  <CountPills legend="Ambientes" name="amb" testId={`${testId}-amb`} />

                  <fieldset className={styles.group}>
                    <legend className={styles.groupLegend}>Características</legend>
                    <div className={styles.pills}>
                      {characteristics.map((option) => (
                        <label key={option.key} className={styles.pill}>
                          <input className={styles.pillInput} type="checkbox" name="tag" value={option.key} data-testid={`${testId}-tag-${option.key}`} />
                          <span className={styles.pillText}>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className={styles.group}>
                    <legend className={styles.groupLegend}>Superficie (m²)</legend>
                    <div className={styles.pair}>
                      <label className={styles.inlineField}>
                        <span className={styles.inlineLabel}>Desde</span>
                        <input className={styles.input} type="number" inputMode="numeric" min={1} step={1} name="m2Min" data-testid={`${testId}-m2-min`} />
                      </label>
                      <label className={styles.inlineField}>
                        <span className={styles.inlineLabel}>Hasta</span>
                        <input className={styles.input} type="number" inputMode="numeric" min={1} step={1} name="m2Max" data-testid={`${testId}-m2-max`} />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className={styles.group}>
                    <legend className={styles.groupLegend}>Índice de ajuste</legend>
                    <div className={styles.choices}>
                      <label className={styles.choice}>
                        <input className={styles.choiceInput} type="radio" name="indice" value="" defaultChecked data-testid={`${testId}-indice-todos`} />
                        <span className={styles.choiceTitle}>Cualquiera</span>
                      </label>
                      {INDEX_OPTIONS.map((index) => (
                        <label key={index} className={styles.choice}>
                          <input className={styles.choiceInput} type="radio" name="indice" value={index} data-testid={`${testId}-indice-${index}`} />
                          <span className={styles.choiceTitle}>{index}</span>
                          <span className={styles.choiceHelp}>{indexHelp[index]}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className={styles.panelFooter}>
                  {hydrated && (
                    <Button type="text" onClick={clearMoreFilters} className={styles.clearButton} data-testid={`${testId}-limpiar`}>
                      Limpiar
                    </Button>
                  )}
                  <Button ref={panelSubmitRef} type="primary" htmlType="submit" className={styles.panelSubmit} data-testid={`${testId}-mas-filtros-buscar`}>
                    Buscar
                  </Button>
                </div>
              </div>
            </details>

            <div className={styles.cellAction}>
              <Button type="primary" htmlType="submit" className={styles.submit} icon={<SearchOutlined aria-hidden="true" />} data-testid={`${testId}-submit`}>
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
