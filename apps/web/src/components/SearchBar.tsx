'use client'

/**
 * SearchBar.tsx — buscador de la landing: barrio, tipo, dormitorios, precio y características.
 *
 * Qué es: filtra la vista previa de la landing en el cliente. La búsqueda
 * completa (US-34) está en `/buscar`.
 * Quién lo usa: `Hero.tsx` y el catálogo `/design-system`.
 */
import { Card, Col, InputNumber, Row, Select, Slider, Tag } from 'antd'
import type { FilterState } from '@rentar/shared-types'
import { characteristicOptions } from '@/lib/catalogs/characteristics'
import { neighborhoods, type OpcionBarrio } from '@/lib/catalogs/neighborhoods'
import { formatMonthlyPrice } from '@/lib/utils/format'
import styles from './SearchBar.module.css'

/** Da formato de miles al valor mostrado en los campos de precio (ej. `580000` -> "$ 580.000"). */
function formatPriceInput(value: number | undefined): string {
  if (value === undefined) return ''
  return `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Revierte {@link formatPriceInput} a un número editable. */
function parsePriceInput(displayValue: string | undefined): number {
  if (!displayValue) return 0
  return Number(displayValue.replace(/\$\s?|(\.)/g, ''))
}

/** Props de {@link SearchBar}. */
interface SearchBarProps {
  /** Estado actual de los filtros. */
  filters: FilterState
  /** Notifica el nuevo estado de filtros cada vez que el usuario cambia uno. */
  onChange: (filters: FilterState) => void
  /** Cantidad de propiedades que matchean los filtros actuales (se anuncia con `role="status"`). */
  resultCount: number
  /**
   * Opciones del filtro de zona. Por defecto, el catálogo del piloto; la
   * landing le pasa el catálogo más los barrios de los datos reales
   * (`barriosConDatos`).
   */
  neighborhoodOptions?: readonly OpcionBarrio[]
}

/**
 * Buscador/filtro de la landing: zona, tipología, dormitorios, rango de
 * precio (campos numéricos + slider sincronizados) y características
 * (chips multi-select). Es controlado en su totalidad por `filters`/`onChange`
 * desde `Landing`, no tiene estado propio.
 */
export default function SearchBar({ filters, onChange, resultCount, neighborhoodOptions = neighborhoods }: SearchBarProps) {
  return (
    <Card id="buscar" className={styles.card}>
      <div className={styles.priceRowsWrap}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8} lg={8}>
            <label htmlFor="filtro-barrio" className={styles.label}>
              Zona
            </label>
            <Select
              id="filtro-barrio"
              className={styles.control}
              value={filters.neighborhoodSlug}
              onChange={(value: string) => onChange({ ...filters, neighborhoodSlug: value })}
              data-testid="search-neighborhood-select"
              options={[
                { value: 'todos', label: 'Todos los barrios' },
                ...neighborhoodOptions.map((n) => ({ value: n.slug, label: n.name })),
              ]}
            />
          </Col>

          <Col xs={24} sm={8} lg={8}>
            <label htmlFor="filtro-tipologia" className={styles.label}>
              Tipología
            </label>
            <Select
              id="filtro-tipologia"
              className={styles.control}
              value={filters.type}
              onChange={(value: FilterState['type']) => onChange({ ...filters, type: value })}
              data-testid="search-type-select"
              options={[
                { value: 'todos', label: 'Todas' },
                { value: 'departamento', label: 'Departamento' },
                { value: 'casa', label: 'Casa' },
                { value: 'ph', label: 'PH' },
              ]}
            />
          </Col>

          <Col xs={24} sm={8} lg={8}>
            <label htmlFor="filtro-dormitorios" className={styles.label}>
              Dormitorios
            </label>
            <Select
              id="filtro-dormitorios"
              className={styles.control}
              value={String(filters.bedrooms)}
              onChange={(value: string) =>
                onChange({
                  ...filters,
                  bedrooms: value === 'todos' ? 'todos' : Number(value),
                })
              }
              data-testid="search-bedrooms-select"
              options={[
                { value: 'todos', label: 'Todos' },
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3 o más' },
              ]}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={24}>
            <label htmlFor="filtro-precio-hibrido" className={styles.label}>
              Precio mensual
            </label>
            <div className={styles.priceInline}>
              <InputNumber
                className={styles.priceInlineInput}
                size="large"
                controls={false}
                min={0}
                max={filters.maxPrice}
                step={5000}
                value={filters.minPrice}
                onChange={(value) => onChange({ ...filters, minPrice: value ?? 0 })}
                formatter={formatPriceInput}
                parser={parsePriceInput}
                aria-label="Precio mínimo"
                data-testid="search-price-min-input"
              />
              <Slider
                id="filtro-precio-hibrido"
                range
                className={`${styles.slider} ${styles.priceInlineSlider}`}
                min={400000}
                max={1000000}
                step={5000}
                value={[filters.minPrice, filters.maxPrice]}
                onChange={(value) => {
                  if (!Array.isArray(value)) return
                  onChange({ ...filters, minPrice: value[0], maxPrice: value[1] })
                }}
                tooltip={{ formatter: (value) => formatMonthlyPrice(value ?? 0) }}
                data-testid="search-price-slider"
              />
              <InputNumber
                className={styles.priceInlineInput}
                size="large"
                controls={false}
                min={filters.minPrice}
                max={1000000}
                step={5000}
                value={filters.maxPrice}
                onChange={(value) => onChange({ ...filters, maxPrice: value ?? 1000000 })}
                formatter={formatPriceInput}
                parser={parsePriceInput}
                aria-label="Precio máximo"
                data-testid="search-price-max-input"
              />
            </div>
          </Col>
        </Row>
      </div>

      <div className={styles.characteristics}>
        <p className={styles.legend} id="caracteristicas-legend">
          Características
        </p>
        <Tag.CheckableTagGroup
          multiple
          aria-labelledby="caracteristicas-legend"
          data-testid="search-characteristics-chips"
          options={characteristicOptions.map((c) => ({ value: c.key, label: c.label }))}
          value={filters.characteristics}
          onChange={(values) => onChange({ ...filters, characteristics: values })}
        />
      </div>

      <p className={styles.resultCount} role="status" data-testid="search-result-count">
        {resultCount} {resultCount === 1 ? 'propiedad encontrada' : 'propiedades encontradas'}
      </p>
    </Card>
  )
}
