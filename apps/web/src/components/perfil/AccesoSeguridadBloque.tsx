'use client'

/**
 * AccesoSeguridadBloque.tsx — el bloque "Acceso y seguridad" de "Mi perfil".
 *
 * Qué es: con qué correo se entra y la contraseña (oculta).
 * Cubre: US-20 Consultar usuario.
 * De dónde saca los datos: `PerfilUsuario.email` (lo pasa `PerfilScreen`).
 * Quién lo usa: `PerfilScreen.tsx`.
 */
import { DetailList } from '@rentar/ui'
import { BloquePerfil } from './BloquePerfil'
import styles from './BloquesPerfil.module.css'

/** Props de {@link AccesoSeguridadBloque}. */
interface AccesoSeguridadBloqueProps {
  email: string
}

/** Acceso a la cuenta. */
export function AccesoSeguridadBloque({ email }: AccesoSeguridadBloqueProps) {
  return (
    <BloquePerfil testId="perfil-acceso" title="Acceso y seguridad" description="Con estos datos entrás a RentAR.">
      <div className={styles.stack}>
        <DetailList
          items={[
            { label: 'Correo para entrar', value: email },
            { label: 'Contraseña', value: '••••••••' },
          ]}
          column={1}
        />
      </div>
    </BloquePerfil>
  )
}
