'use client'

/**
 * VisorContrato.tsx — el documento del contrato, de a una página.
 *
 * Cubre: US-07 Firmar contrato de alquiler:
 * - "Se debe mostrar el documento del contrato" (detalle, en cualquier estado).
 * - Para firmar: "el botón 'Firmar contrato' solo se habilita cuando el
 *   usuario llegó a la última página", "se debe indicar cuántas páginas
 *   faltan leer" y "volver a páginas anteriores no reduce el progreso de
 *   lectura" (con `conProgreso`).
 * Cómo se arma una página: `lib/contratos/paginas.ts` (por contenido, igual a
 * 390 y 1440 px). Las páginas que todavía no se leyeron no se pueden abrir
 * salteando ("Leer, aceptar, firmar… sin poder saltearlas", Claude Design ·
 * 06): se avanza con "Siguiente" o con el número de la página siguiente.
 * El progreso vive en este componente: al recargar, la lectura empieza de nuevo.
 *
 * Quién lo usa: `DetalleContrato.tsx` (solo lectura) y `FirmaContrato.tsx`.
 */
import { useState } from 'react'
import { Button, Progress } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import type { ClausulaContrato } from '@rentar/shared-types'
import { avanzarLectura, paginarContrato, paginasQueFaltan } from '@/lib/contratos/paginas'
import { ordinal } from '@/lib/contratos/plantilla'
import styles from './DetalleContrato.module.css'

/** Props de {@link VisorContrato}. */
interface VisorContratoProps {
  /** Título del documento ("Contrato de locación de vivienda · Rondeau 480, PB"). */
  titulo: string
  /** `CT-AAAA-NNNN`, para el encabezado del visor; `null` si no tiene. */
  codigo: string | null
  clausulas: readonly ClausulaContrato[]
  /** `true` en la firma: muestra la barra de lectura y no deja saltear páginas. */
  conProgreso?: boolean
  /** Avisa cada vez que cambia la página más alta leída (con el total). */
  onProgreso?: (leidaHasta: number, total: number) => void
  'data-testid'?: string
}

/** El documento paginado, con Anterior / Siguiente y los números de página. */
export function VisorContrato({ titulo, codigo, clausulas, conProgreso = false, onProgreso, ...rest }: VisorContratoProps) {
  const paginas = paginarContrato(clausulas)
  const total = paginas.length

  // ─── Estado local ───────────────────────────────────────────────────
  const [actual, setActual] = useState(1)
  /** US-07: el progreso es la página más alta vista; volver atrás no lo baja. */
  const [leidaHasta, setLeidaHasta] = useState(1)

  // ─── Handlers ───────────────────────────────────────────────────────
  function irA(numero: number): void {
    const destino = Math.min(Math.max(numero, 1), total)
    setActual(destino)
    const nueva = avanzarLectura(leidaHasta, destino)
    if (nueva !== leidaHasta) {
      setLeidaHasta(nueva)
      onProgreso?.(nueva, total)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const pagina = paginas[actual - 1] ?? paginas[0]
  const faltan = paginasQueFaltan(leidaHasta, total)

  return (
    <div className={styles.visor} data-testid={rest['data-testid'] ?? 'contrato-visor'}>
      <div className={styles.visorBarra}>
        <span className={styles.visorArchivo}>
          {codigo ? `${codigo} · ` : ''}
          {total} {total === 1 ? 'página' : 'páginas'}
        </span>
        <span className={styles.visorPagina} data-testid="contrato-visor-pagina">
          Página {actual} de {total}
        </span>
      </div>

      {conProgreso && (
        <div className={styles.visorProgreso} data-testid="contrato-visor-progreso" data-leidas={leidaHasta} data-total={total}>
          <Progress percent={Math.round((leidaHasta / total) * 100)} showInfo={false} size="small" aria-label="Progreso de lectura" />
          <span>
            Leíste {leidaHasta} de {total} {total === 1 ? 'página' : 'páginas'}
          </span>
        </div>
      )}

      <div className={styles.hoja} data-testid="contrato-visor-hoja" aria-live="polite">
        {actual === 1 && <h3 className={styles.hojaTitulo}>{titulo}</h3>}
        {pagina.clausulas.map(({ numero, clausula }) => (
          <p key={clausula.key} className={styles.hojaClausula}>
            <strong>
              {ordinal(numero)}. {clausula.titulo || 'Sin título'}.
            </strong>{' '}
            {clausula.texto || '[sin texto]'}
          </p>
        ))}
        {actual === total && <p className={styles.hojaFin}>— Fin del contrato —</p>}
      </div>

      {conProgreso && faltan > 0 && (
        <p className={styles.visorFaltan} data-testid="contrato-firma-faltan">
          Te {faltan === 1 ? 'falta 1 página' : `faltan ${faltan} páginas`} para poder firmar.
        </p>
      )}

      <nav className={styles.visorNav} aria-label="Páginas del contrato">
        <Button icon={<LeftOutlined />} onClick={() => irA(actual - 1)} disabled={actual === 1} data-testid="contrato-visor-anterior">
          Anterior
        </Button>
        <span className={styles.visorNumeros}>
          {paginas.map(({ numero }) => {
            // Con progreso no se saltea: se puede abrir una leída o la siguiente.
            const bloqueada = conProgreso && numero > leidaHasta + 1
            return (
              <button
                key={numero}
                type="button"
                className={numero === actual ? `${styles.visorNumero} ${styles.visorNumeroActual}` : styles.visorNumero}
                onClick={() => irA(numero)}
                disabled={bloqueada}
                aria-current={numero === actual ? 'page' : undefined}
                aria-label={`Página ${numero}`}
                data-testid="contrato-visor-numero"
              >
                {numero}
              </button>
            )
          })}
        </span>
        <Button onClick={() => irA(actual + 1)} disabled={actual === total} data-testid="contrato-visor-siguiente">
          Siguiente <RightOutlined />
        </Button>
      </nav>
    </div>
  )
}
