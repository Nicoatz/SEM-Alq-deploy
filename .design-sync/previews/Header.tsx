import { Header } from '@rentar/ui'

/** Encabezado público — sin props, contenido fijo (logo, navegación, CTAs de sesión). */
export function Default() {
  return <Header />
}

/** Con sesión: "Ir a mi panel" y el `UserMenu` con el rol activo, en vez de "Iniciar sesión". */
export function ConSesion() {
  return (
    <Header
      session={{
        name: 'Sofía Ledesma',
        role: 'locatario',
        panelHref: '#',
        publishHref: '#',
        menuItems: [
          { key: 'panel', label: 'Mi panel' },
          { key: 'publicar', label: 'Publicar propiedad' },
          { key: 'perfil', label: 'Mi perfil' },
        ],
        onLogout: () => {},
      }}
    />
  )
}

/** Mientras la app confirma la sesión: un placeholder con la forma de la variante con sesión, sin parpadeo. */
export function CargandoSesion() {
  return <Header sessionPending />
}
