import { EmptyState } from '@rentar/ui'

/** Sin reclamos abiertos — con acción sugerida. */
export function Default() {
  return (
    <EmptyState
      title="Sin reclamos abiertos"
      description="Cuando un locatario abra un reclamo sobre uno de tus contratos, vas a verlo acá."
      action={
        <span style={{ color: 'var(--rentar-color-blue)', fontWeight: 600, cursor: 'pointer' }}>Ver contratos vigentes</span>
      }
    />
  )
}

/**
 * Con la acción a todo el ancho debajo de 640 px (`actionBlock`), como el
 * panel del locatario en móvil. En una card más ancha se ve como `Default`.
 */
export function AccionAnchoCompleto() {
  return (
    <div style={{ width: 360 }}>
      <EmptyState
        title="Todavía no enviaste solicitudes"
        description="Buscá una propiedad y mandale una solicitud al dueño."
        action={
          <a href="#" style={{ display: 'block', textAlign: 'center', padding: '10px 16px', borderRadius: 'var(--rentar-radius-pill)', background: 'var(--rentar-color-blue)', color: 'var(--rentar-color-bg-surface)', fontWeight: 600, textDecoration: 'none' }}>
            Buscar propiedades
          </a>
        }
        actionBlock
      />
    </div>
  )
}
