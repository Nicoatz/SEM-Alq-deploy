'use client'

/**
 * DatosPersonalesBloque.tsx — el bloque "Datos personales" de "Mi perfil".
 *
 * Qué es: nombre, apellido, DNI, correo, teléfono (formato E.123) y fecha de
 * nacimiento (dd/mm/aaaa). Lo que no está cargado dice "Sin cargar".
 * Cubre: US-20 Consultar usuario.
 * De dónde saca los datos: `PerfilUsuario` (lo pasa `PerfilScreen`, que lo
 * pide a `perfil.service#getMiPerfil`).
 * Quién lo usa: `PerfilScreen.tsx`.
 */
import type { PerfilUsuario } from '@rentar/shared-types'
import { DetailList } from '@rentar/ui'
import { dniParaMostrar, fechaParaMostrar, telefonoParaMostrar } from '@/lib/perfil/formato'
import { BloquePerfil } from './BloquePerfil'
import styles from './BloquesPerfil.module.css'
import { SinCargar } from './SinCargar'

/** Props de {@link DatosPersonalesBloque}. */
interface DatosPersonalesBloqueProps {
  perfil: PerfilUsuario
}

/** Datos personales del usuario en sesión. */
export function DatosPersonalesBloque({ perfil }: DatosPersonalesBloqueProps) {
  const items = [
    { label: 'Nombre', value: <span data-testid="perfil-nombre">{perfil.nombre}</span> },
    { label: 'Apellido', value: <span data-testid="perfil-apellido">{perfil.apellido}</span> },
    {
      label: 'DNI',
      value: perfil.dni ? <span data-testid="perfil-dni">{dniParaMostrar(perfil.dni)}</span> : <SinCargar campo="dni" />,
    },
    { label: 'Correo electrónico', value: <span data-testid="perfil-email">{perfil.email}</span> },
    {
      label: 'Teléfono',
      value: perfil.telefono ? <span data-testid="perfil-telefono">{telefonoParaMostrar(perfil.telefono)}</span> : <SinCargar campo="telefono" />,
    },
    {
      label: 'Fecha de nacimiento',
      value: perfil.fechaNacimiento ? (
        <span data-testid="perfil-fecha-nacimiento">{fechaParaMostrar(perfil.fechaNacimiento)}</span>
      ) : (
        <SinCargar campo="fecha-nacimiento" />
      ),
    },
  ]

  return (
    <BloquePerfil
      testId="perfil-datos"
      title="Datos personales"
      description="El nombre, el apellido y el DNI son los que figuran en tus contratos."
      defaultOpen
    >
      <div className={styles.stack}>
        <DetailList items={items} column={1} />
      </div>
    </BloquePerfil>
  )
}
