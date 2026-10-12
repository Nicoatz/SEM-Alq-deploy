import { AppShell } from '@rentar/ui'

const navItems = [
  { key: 'panel', label: 'Mi panel', href: '#' },
  { key: 'propiedades', label: 'Propiedades', href: '#' },
  { key: 'solicitudes', label: 'Solicitudes', href: '#' },
  { key: 'contratos', label: 'Contratos', href: '#' },
  { key: 'cobros', label: 'Cobros', href: '#' },
  { key: 'reclamos', label: 'Reclamos', href: '#' },
]

const notifications = [
  { id: '1', title: 'Nuevo reclamo de Sofía Ledesma', date: new Date('2026-09-08T18:03:00-03:00'), read: false },
  { id: '2', title: 'Cobro de septiembre registrado', date: new Date('2026-09-05T09:00:00-03:00'), read: true },
  { id: '3', title: 'Julieta Peralta firmó el contrato CT-2026-0207', date: new Date('2026-09-02T12:15:00-03:00'), read: true },
]

/** Panel del locador — sidebar, header con notificaciones y menú de usuario, y contenido de página. */
export function Default() {
  return (
    <AppShell
      navItems={navItems}
      activeKey="propiedades"
      user={{ name: 'Nicolás Arrieta', role: 'locador' }}
      notifications={notifications}
      userMenuItems={[{ key: 'perfil', label: 'Mi perfil' }]}
      onLogout={() => {}}
      compact
    >
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Propiedades</h2>
        <p style={{ margin: 0, color: 'var(--rentar-color-text-secondary)' }}>5 propiedades publicadas.</p>
      </div>
    </AppShell>
  )
}

/** Con "Publicar propiedad" en el encabezado (`headerAction`): cualquier rol puede publicar. */
export function ConPublicarPropiedad() {
  return (
    <AppShell
      navItems={navItems}
      activeKey="panel"
      user={{ name: 'Julieta Peralta', role: 'locatario' }}
      notifications={notifications}
      userMenuItems={[{ key: 'perfil', label: 'Mi perfil' }]}
      onLogout={() => {}}
      headerAction={{ label: 'Publicar propiedad', href: '#' }}
      compact
    >
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Mi panel</h2>
        <p style={{ margin: 0, color: 'var(--rentar-color-text-secondary)' }}>Tenés 2 solicitudes enviadas.</p>
      </div>
    </AppShell>
  )
}
