/**
 * /panel/propiedades/nueva — Publicar propiedad (US-01 Registrar mis propiedades).
 *
 * Qué es: el alta en 5 pasos. La pantalla vive en
 * `components/alta/AltaPropiedad.tsx`; acá solo se monta.
 * Abierta para cualquier usuario con sesión, locatario o locador (regla del
 * equipo, 27/09/2026: al publicar la primera, el back le suma el rol
 * locador). La sesión la controla `proxy.ts` (US-01: "se debe haber iniciado
 * sesión"); acá no hay guard de rol.
 * Entra desde: "Publicar propiedad" del encabezado del panel, del listado,
 * del panel del locatario, del registro y del Header público.
 */
import { AltaPropiedad } from '@/components/alta/AltaPropiedad'

/** Monta el alta de propiedad (US-01). */
export default function NuevaPropiedadPage() {
  return <AltaPropiedad />
}
