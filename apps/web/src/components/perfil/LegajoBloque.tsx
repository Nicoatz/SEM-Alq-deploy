'use client'

/**
 * LegajoBloque.tsx — el bloque "Mi legajo" de "Mi perfil".
 *
 * Qué es: situación ocupacional, ingreso mensual declarado y garantías que
 * puede ofrecer, con el aviso de legajo completo o incompleto y qué falta
 * (criterio en `lib/perfil/legajo.ts`).
 * Cubre: US-20 Consultar usuario.
 * De dónde saca los datos: `PerfilUsuario.legajo` (lo pasa `PerfilScreen`).
 * Quién lo usa: `PerfilScreen.tsx`.
 *
 * NOTA (diseño vs. US): el diseño suma documentación (FileDropzone) y otras
 * garantías ("recibo de sueldo", "garante con recibo"). Manda la US: las
 * garantías son las de US-35 y no hay archivos en esta tanda.
 */
import type { LegajoUsuario } from '@rentar/shared-types'
import { DetailList, MoneyAmount } from '@rentar/ui'
import { estadoLegajo, textoFaltantes } from '@/lib/perfil/legajo'
import { GARANTIA_LABEL, OCUPACION_LABEL } from '@/lib/validation/solicitud.rules'
import { BloquePerfil } from './BloquePerfil'
import styles from './BloquesPerfil.module.css'
import { SinCargar } from './SinCargar'

/** Props de {@link LegajoBloque}. */
interface LegajoBloqueProps {
  legajo: LegajoUsuario
  /** En móvil, si arranca abierto (el legajo incompleto va primero y abierto, como en el diseño). */
  defaultOpen?: boolean
}

/** "2 de 3": el chip del encabezado del legajo en móvil. */
export function ChipLegajo({ legajo }: { legajo: LegajoUsuario }) {
  const estado = estadoLegajo(legajo)
  return (
    <span className={`${styles.chip} ${estado.completo ? styles.chipComplete : styles.chipIncomplete}`} data-testid="perfil-legajo-chip">
      {estado.completo ? 'Completo' : `${estado.cargados} de ${estado.total}`}
    </span>
  )
}

/** Aviso de legajo completo o incompleto (US-20: "indicar si está completo o incompleto y qué falta"). */
function AvisoLegajo({ legajo }: { legajo: LegajoUsuario }) {
  const estado = estadoLegajo(legajo)
  if (estado.completo) {
    return (
      <div className={`${styles.notice} ${styles.noticeSuccess}`} data-testid="perfil-legajo-estado" data-estado="completo">
        <span>
          <strong>Legajo completo.</strong> Se precarga en cada solicitud que envíes.
        </span>
      </div>
    )
  }
  return (
    <div className={`${styles.notice} ${styles.noticeWarning}`} data-testid="perfil-legajo-estado" data-estado="incompleto">
      <span className={styles.noticeTitle}>Legajo incompleto</span>
      <span data-testid="perfil-legajo-faltantes">{textoFaltantes(estado.faltantes)}</span>
    </div>
  )
}

/** El legajo del usuario en sesión. */
export function LegajoBloque({ legajo, defaultOpen = false }: LegajoBloqueProps) {
  const items = [
    {
      label: 'Situación ocupacional',
      value:
        legajo.occupation === 'sin_informar' ? (
          <SinCargar campo="ocupacion" />
        ) : (
          <span data-testid="perfil-legajo-ocupacion">{OCUPACION_LABEL[legajo.occupation]}</span>
        ),
    },
    {
      label: 'Ingreso mensual declarado',
      value:
        legajo.monthlyIncome === null ? (
          <SinCargar campo="ingresos" />
        ) : (
          <span data-testid="perfil-legajo-ingresos">
            <MoneyAmount amount={legajo.monthlyIncome} />
          </span>
        ),
    },
    {
      label: 'Garantías que podés ofrecer',
      value:
        legajo.guarantees.length === 0 ? (
          <SinCargar campo="garantias" />
        ) : (
          <span data-testid="perfil-legajo-garantias">{legajo.guarantees.map((garantia) => GARANTIA_LABEL[garantia]).join(', ')}</span>
        ),
    },
  ]

  return (
    <BloquePerfil
      testId="perfil-legajo"
      title="Mi legajo"
      description="Se precarga en cada solicitud que envíes. El dueño lo ve recién cuando te postulás, nunca antes."
      badge={<ChipLegajo legajo={legajo} />}
      defaultOpen={defaultOpen}
    >
      <div className={styles.stack}>
        <AvisoLegajo legajo={legajo} />
        <DetailList items={items} column={1} />
      </div>
    </BloquePerfil>
  )
}
