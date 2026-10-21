/**
 * StatusTag.test.tsx — `StatusTag` y `getStatusMeta` con estados que no están en `statusMeta`.
 *
 * Sin US en Sprint 0: es robustez del design system. Cubre el crash "Cannot read properties of
 * undefined (reading 'icon')" con un estado desconocido, un estado vacío o un dominio desconocido.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatusDomain } from '@rentar/shared-types'
import { getStatusMeta } from '../../utils/getStatusMeta'
import { StatusTag } from './StatusTag'

// ─── Preparación ─────────────────────────────────────────────────────────

// NOTA: los casos de abajo pasan valores que el tipo no permite, a propósito (es lo que puede
// llegar del back en ejecución). Los casts a `never` son solo para eso.
let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  warn.mockRestore()
})

// ─── getStatusMeta ───────────────────────────────────────────────────────

describe('getStatusMeta', () => {
  it('devuelve los metadatos de un estado conocido sin avisar', () => {
    expect(getStatusMeta('contrato', 'vigente')).toMatchObject({ label: 'Vigente', colorKey: 'success' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('con un estado desconocido devuelve el fallback neutro y avisa', () => {
    const meta = getStatusMeta('contrato', 'en_revision' as never)
    expect(meta).toMatchObject({ label: 'en_revision', colorKey: 'neutral' })
    expect(meta.icon).toBeDefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('domain="contrato", status="en_revision"'))
  })

  it('con un estado undefined usa "—" como texto', () => {
    expect(getStatusMeta('contrato', undefined)).toMatchObject({ label: '—', colorKey: 'neutral' })
  })

  it('con un dominio desconocido devuelve el fallback neutro', () => {
    expect(getStatusMeta('garantia' as StatusDomain, 'vigente' as never)).toMatchObject({
      label: 'vigente',
      colorKey: 'neutral',
    })
  })

  it('no confunde un estado con una propiedad del prototipo', () => {
    expect(getStatusMeta('contrato', 'constructor' as never)).toMatchObject({ label: 'constructor', colorKey: 'neutral' })
  })
})

// ─── StatusTag ───────────────────────────────────────────────────────────

describe('StatusTag', () => {
  it('renderiza un estado conocido con su texto e ícono', () => {
    render(<StatusTag domain="contrato" status="vigente" data-testid="tag" />)
    expect(screen.getByTestId('tag').textContent).toBe('Vigente')
    expect(screen.getByTestId('tag').querySelector('.anticon')).not.toBeNull()
  })

  it('renderiza un estado desconocido sin tirar error', () => {
    render(<StatusTag domain="contrato" status={'en_revision' as never} data-testid="tag" />)
    expect(screen.getByTestId('tag').textContent).toBe('en_revision')
  })

  it('renderiza un estado undefined sin tirar error', () => {
    render(<StatusTag domain="cobro" status={undefined as never} data-testid="tag" />)
    expect(screen.getByTestId('tag').textContent).toBe('—')
  })

  it('renderiza un dominio desconocido sin tirar error', () => {
    render(<StatusTag domain={'garantia' as StatusDomain} status={'vigente' as never} data-testid="tag" />)
    expect(screen.getByTestId('tag').textContent).toBe('vigente')
  })
})
