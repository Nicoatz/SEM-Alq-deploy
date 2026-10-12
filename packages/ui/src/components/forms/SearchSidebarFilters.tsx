'use client'

/**
 * SearchSidebarFilters.tsx — filtros de `/buscar`: barra lateral en escritorio y contenido del
 * Drawer en móvil.
 *
 * Diseño: "Búsqueda de propiedades" · 01 y 03.
 * Quién lo usa: `/buscar` (US-34) y el catálogo.
 */
import type { ReactNode } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import { Button, Checkbox, InputNumber, Radio, Select, Slider } from 'antd'
import type { AdjustmentIndex, BusquedaFiltros, CharacteristicOption, PropertyType, UbicacionOpciones } from '@rentar/shared-types'
import { IndexBadge } from '../data/IndexBadge'
import styles from './SearchSidebarFilters.module.css'

// ─── Opciones fijas ────────────────────────────────────────────────────────

/** Tipologías que se ofrecen, en el orden del diseño (sin "Dúplex": no existe en el sistema). */
const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'monoambiente', label: 'Monoambiente' },
]

/** Opciones de dormitorios y ambientes; el 4 es "4 o más". */
const COUNT_OPTIONS = [1, 2, 3, 4]

/** Límites del slider de precio (solo en la variante `drawer`). */
const PRICE_SLIDER_MAX = 1_000_000
const PRICE_STEP = 5_000

/** Props de {@link SearchSidebarFilters}. */
interface SearchSidebarFiltersProps {
  /** Filtros que se están editando (borrador: se aplican con `onApply`). */
  value: BusquedaFiltros
  onChange: (value: BusquedaFiltros) => void
  /** "Limpiar": vuelve los filtros a su estado inicial. */
  onClear: () => void
  /** Si se pasa, se dibuja el botón "Aplicar filtros" al pie. */
  onApply?: () => void
  /** Deshabilita "Aplicar filtros" (por ejemplo, mientras carga la búsqueda anterior). */
  applyDisabled?: boolean
  /** Si se pasa, el encabezado muestra una ✕ para cerrar (en el Drawer de móvil). */
  onClose?: () => void
  /** Provincias, ciudades y barrios que se pueden elegir (salen de los datos). */
  locations: UbicacionOpciones
  characteristics: CharacteristicOption[]
  /**
   * `'sidebar'` (escritorio, "Búsqueda de propiedades" · 01): tipología con
   * casillas y precio con dos campos. `'drawer'` (móvil, · 03): tipología con
   * pastillas y precio con slider.
   */
  variant?: 'sidebar' | 'drawer'
  'data-testid'?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Formato "$ 250.000" para los campos de precio. */
function formatPrice(value: number | string | undefined): string {
  if (value === undefined || value === '') return ''
  return `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Revierte {@link formatPrice} a número. */
function parsePrice(value: string | undefined): number {
  return Number((value ?? '').replace(/[^\d]/g, ''))
}

/** Agrega o saca un valor de una lista (para las selecciones múltiples). */
function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((current) => current !== item) : [...list, item]
}

// ─── Piezas internas ───────────────────────────────────────────────────────

/**
 * Grupo de botones "Todos / 1 / 2 / 3 / 4+" de selección múltiple
 * (dormitorios y ambientes). "Todos" está activo cuando no hay ninguno elegido.
 */
function CountToggle({ label, value, onChange, testId }: { label: string; value: number[]; onChange: (value: number[]) => void; testId: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.sectionTitle} id={`${testId}-label`}>
        {label}
      </span>
      <div className={styles.toggleGroup} role="group" aria-labelledby={`${testId}-label`} data-testid={testId}>
        <button type="button" className={`${styles.toggle} ${value.length === 0 ? styles.toggleOn : ''}`} aria-pressed={value.length === 0} onClick={() => onChange([])}>
          Todos
        </button>
        {COUNT_OPTIONS.map((count) => (
          <button
            key={count}
            type="button"
            className={`${styles.toggle} ${value.includes(count) ? styles.toggleOn : ''}`}
            aria-pressed={value.includes(count)}
            onClick={() => onChange(toggle(value, count))}
            data-testid={`${testId}-${count}`}
          >
            {count === 4 ? '4+' : count}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Sección con título en mayúsculas y un separador arriba. `unit` va aparte
 * para que no se transforme (un "M²" en mayúscula es otra unidad).
 */
function Section({ title, unit, children }: { title: string; unit?: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <span className={styles.sectionTitle}>
        {title}
        {unit && <span className={styles.unit}> ({unit})</span>}
      </span>
      {children}
    </div>
  )
}

// ─── Componente ────────────────────────────────────────────────────────────

/**
 * Filtros de `/buscar` (US-34) como barra lateral (escritorio) o contenido
 * del Drawer (móvil). Diseño: Claude Design, "Búsqueda de propiedades" · 01 y
 * 03. Filtra por ubicación (provincia, ciudad y barrios), precio, tipología,
 * dormitorios, ambientes, superficie, características e índice de ajuste.
 *
 * Es un componente controlado sobre un BORRADOR: cada cambio llama a
 * `onChange`, y la búsqueda se hace recién con "Aplicar filtros" (`onApply`)
 * o con el botón del Drawer. Así, en móvil, "Ver N propiedades" puede
 * mostrar el resultado antes de aplicar.
 *
 * `data-testid`: `search-sidebar-*` en escritorio y `search-drawer-*` en el Drawer
 * (por ejemplo `search-sidebar-apply`, `search-drawer-types`).
 */
export function SearchSidebarFilters({
  value,
  onChange,
  onClear,
  onApply,
  applyDisabled = false,
  onClose,
  locations,
  characteristics,
  variant = 'sidebar',
  ...rest
}: SearchSidebarFiltersProps) {
  // Prefijo de los data-testid: la barra lateral y el Drawer pueden estar en
  // la página a la vez (uno oculto), así que no pueden repetir los mismos ids.
  const tid = variant === 'drawer' ? 'search-drawer' : 'search-sidebar'
  const set = <K extends keyof BusquedaFiltros>(key: K, fieldValue: BusquedaFiltros[K]) => onChange({ ...value, [key]: fieldValue })

  const province = locations.provinces.find((item) => item.name === value.province)
  const city = province?.cities.find((item) => item.name === value.city)

  return (
    <div className={`${styles.panel} ${styles[variant]}`} {...rest}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Filtros</span>
        <div className={styles.headerActions}>
          <button type="button" className={styles.linkButton} onClick={onClear} data-testid={`${tid}-clear`}>
            Limpiar
          </button>
          {onClose && (
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar filtros" data-testid={`${tid}-close`}>
              <CloseOutlined />
            </button>
          )}
        </div>
      </div>

      <Section title="Ubicación">
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Provincia</span>
          <Select
            value={value.province ?? undefined}
            placeholder="Todas"
            // `label`: nombre del botón de borrar (antd lo deja en inglés, "Clear").
            allowClear={{ label: 'Borrar la provincia' }}
            showSearch
            options={locations.provinces.map((item) => ({ value: item.name, label: item.name }))}
            // Cambiar de provincia vacía la ciudad y los barrios: dependen de ella.
            onChange={(next?: string) => onChange({ ...value, province: next ?? null, city: null, neighborhoodSlugs: [] })}
            data-testid={`${tid}-province`}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Ciudad</span>
          <Select
            value={value.city ?? undefined}
            placeholder="Todas"
            allowClear={{ label: 'Borrar la ciudad' }}
            showSearch
            // Se habilita recién con una provincia, y lista solo sus ciudades.
            disabled={!province}
            options={(province?.cities ?? []).map((item) => ({ value: item.name, label: item.name }))}
            onChange={(next?: string) => onChange({ ...value, city: next ?? null, neighborhoodSlugs: [] })}
            data-testid={`${tid}-city`}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Barrio</span>
          <Select
            mode="multiple"
            value={value.neighborhoodSlugs}
            placeholder="Todos"
            allowClear={{ label: 'Borrar los barrios' }}
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            disabled={!city}
            options={(city?.neighborhoods ?? []).map((item) => ({ value: item.slug, label: item.name }))}
            onChange={(next: string[]) => set('neighborhoodSlugs', next)}
            data-testid={`${tid}-neighborhoods`}
          />
        </label>
      </Section>

      <Section title="Precio mensual">
        {variant === 'drawer' ? (
          <>
            <Slider
              range
              min={0}
              max={PRICE_SLIDER_MAX}
              step={PRICE_STEP}
              value={[value.minPrice ?? 0, value.maxPrice ?? PRICE_SLIDER_MAX]}
              onChange={([min, max]) => onChange({ ...value, minPrice: min > 0 ? min : null, maxPrice: max < PRICE_SLIDER_MAX ? max : null })}
              tooltip={{ formatter: (price) => formatPrice(price) }}
              data-testid={`${tid}-price-slider`}
            />
            <div className={styles.priceValues}>
              <span>{value.minPrice ? formatPrice(value.minPrice) : 'Sin mínimo'}</span>
              <span>{value.maxPrice ? formatPrice(value.maxPrice) : 'Sin máximo'}</span>
            </div>
          </>
        ) : (
          <div className={styles.pair}>
            <label className={styles.pairField}>
              <span className={styles.pairLabel}>Mínimo</span>
              <InputNumber
                className={styles.moneyInput}
                controls={false}
                min={0}
                step={PRICE_STEP}
                value={value.minPrice}
                placeholder="Sin mínimo"
                formatter={formatPrice}
                parser={parsePrice}
                onChange={(next) => set('minPrice', next || null)}
                data-testid={`${tid}-price-min`}
              />
            </label>
            <label className={styles.pairField}>
              <span className={styles.pairLabel}>Máximo</span>
              <InputNumber
                className={styles.moneyInput}
                controls={false}
                min={0}
                step={PRICE_STEP}
                value={value.maxPrice}
                placeholder="Sin máximo"
                formatter={formatPrice}
                parser={parsePrice}
                onChange={(next) => set('maxPrice', next || null)}
                data-testid={`${tid}-price-max`}
              />
            </label>
          </div>
        )}
      </Section>

      <Section title="Tipología">
        {variant === 'drawer' ? (
          <div className={styles.pills} role="group" aria-label="Tipología" data-testid={`${tid}-types`}>
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.pill} ${value.types.includes(option.value) ? styles.pillOn : ''}`}
                aria-pressed={value.types.includes(option.value)}
                onClick={() => set('types', toggle(value.types, option.value))}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <Checkbox.Group
            className={styles.checkList}
            value={value.types}
            options={TYPE_OPTIONS}
            onChange={(next) => set('types', next as PropertyType[])}
            data-testid={`${tid}-types`}
          />
        )}
      </Section>

      <div className={styles.section}>
        <CountToggle label="Dormitorios" value={value.bedrooms} onChange={(next) => set('bedrooms', next)} testId={`${tid}-bedrooms`} />
        <CountToggle label="Ambientes" value={value.rooms} onChange={(next) => set('rooms', next)} testId={`${tid}-rooms`} />
      </div>

      <Section title="Superficie total" unit="m²">
        <div className={styles.pairInline}>
          <InputNumber
            className={styles.areaInput}
            controls={false}
            min={0}
            value={value.minAreaM2}
            placeholder="Sin mínimo"
            aria-label="Superficie mínima en m²"
            onChange={(next) => set('minAreaM2', next || null)}
            data-testid={`${tid}-area-min`}
          />
          <span className={styles.pairSeparator}>a</span>
          <InputNumber
            className={styles.areaInput}
            controls={false}
            min={0}
            value={value.maxAreaM2}
            placeholder="Sin límite"
            aria-label="Superficie máxima en m²"
            onChange={(next) => set('maxAreaM2', next || null)}
            data-testid={`${tid}-area-max`}
          />
        </div>
      </Section>

      <Section title="Características">
        <Checkbox.Group
          className={styles.checkList}
          value={value.characteristics}
          options={characteristics.map((option) => ({ value: option.key, label: option.label }))}
          onChange={(next) => set('characteristics', next as BusquedaFiltros['characteristics'])}
          data-testid={`${tid}-characteristics`}
        />
      </Section>

      <Section title="Índice de ajuste">
        <div className={styles.badges} aria-hidden="true">
          <IndexBadge index="ICL" />
          <IndexBadge index="IPC" />
        </div>
        <Radio.Group
          className={styles.checkList}
          value={value.adjustmentIndex ?? 'cualquiera'}
          onChange={(event) => {
            const next = event.target.value as AdjustmentIndex | 'cualquiera'
            set('adjustmentIndex', next === 'cualquiera' ? null : next)
          }}
          options={[
            { value: 'ICL', label: 'ICL (Banco Central)' },
            { value: 'IPC', label: 'IPC (INDEC)' },
            { value: 'cualquiera', label: 'Cualquiera' },
          ]}
          data-testid={`${tid}-index`}
        />
      </Section>

      {onApply && (
        <Button type="primary" block className={styles.apply} onClick={onApply} disabled={applyDisabled} data-testid={`${tid}-apply`}>
          Aplicar filtros
        </Button>
      )}
    </div>
  )
}
