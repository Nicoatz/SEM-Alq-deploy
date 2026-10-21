import { IndexBadge } from '@rentar/ui'

/** Los dos índices de ajuste que usa RentAR — IPC e ICL. */
export function Default() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <IndexBadge index="IPC" />
      <IndexBadge index="ICL" />
    </div>
  )
}

/** Los cuatro del contrato (US-05, Sprint 3): ICL, IPC, CAC y "Sin ajuste" (neutro). */
export function Contrato() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <IndexBadge index="ICL" />
      <IndexBadge index="IPC" />
      <IndexBadge index="CAC" />
      <IndexBadge index="sin_ajuste" />
    </div>
  )
}
