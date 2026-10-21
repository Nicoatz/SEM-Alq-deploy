'use client'

/**
 * IndiceAjuste.tsx — el índice de ajuste de un contrato, como se nombra en pantalla.
 *
 * Qué es: `IndexBadge` de `@rentar/ui` para ICL e IPC (regla del diseño: "el
 * índice se nombra siempre con IndexBadge"). CAC y "Sin ajuste" van como
 * texto: `IndexBadge` solo conoce ICL e IPC.
 * NOTA: si se quiere CAC con badge, hay que sumarlo a `IndexBadge`
 * (`packages/ui`, consultar con el PO y anotar en `.design-sync/NOTES.md`).
 * Cubre: US-05 Registrar contrato de alquiler (listado y paso 2).
 * Quién lo usa: `ListadoContratos.tsx` y los pasos del alta.
 */
import type { IndiceContrato } from '@rentar/shared-types'
import { IndexBadge } from '@rentar/ui'
import styles from './Contratos.module.css'

/** Props de {@link IndiceAjuste}. */
interface IndiceAjusteProps {
  indice: IndiceContrato
  'data-testid'?: string
}

/** ICL / IPC con badge; CAC y "Sin ajuste", como texto. */
export function IndiceAjuste({ indice, ...rest }: IndiceAjusteProps) {
  if (indice === 'ICL' || indice === 'IPC') return <IndexBadge index={indice} {...rest} />
  return (
    <span className={styles.indiceTexto} {...rest}>
      {indice === 'CAC' ? 'CAC' : 'Sin ajuste'}
    </span>
  )
}
