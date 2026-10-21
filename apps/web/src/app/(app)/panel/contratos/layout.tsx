/**
 * /panel/contratos/* — layout de los contratos del locador (US-05 Registrar
 * contrato de alquiler).
 *
 * Qué es: envuelve el listado, el alta (`/nuevo`) y la edición del borrador
 * (`/[id]/editar`) en `RequireRole role="locador"`: un locatario que escribe
 * la URL vuelve a `/panel`. Así no se repite el guard en cada página. El
 * locatario va a ver sus contratos desde "Mi alquiler" (US-27), no desde acá.
 */
import type { ReactNode } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'

/** Solo para locadores. */
export default function ContratosLayout({ children }: { children: ReactNode }) {
  return <RequireRole role="locador">{children}</RequireRole>
}
