/**
 * status.ts — estados de ciclo de vida que muestra el frontend.
 *
 * Qué es: TIPOS DE VISTA DEL FRONT. Son los valores que entiende `StatusTag`
 * de `@rentar/ui` (color, ícono y texto de cada estado). No son columnas de
 * una tabla: el back guarda sus propios estados (por ejemplo
 * `MisAlquileresItem.estado_alquiler = 'disponible' | 'alquilado'`) y los
 * adaptadores de `apps/web/src/services/adapters/` los traducen a estos.
 *
 * Quién lo usa: `@rentar/ui` (`StatusTag`, `statusMeta`, `UserMenu`,
 * `AppShell`) y las pantallas de `apps/web`.
 */

/**
 * Estado de una propiedad publicada por su dueño.
 *
 * `alquilada_publicada` es un estado derivado, calculado por el backend
 * (alquilada + fecha de "Disponible desde" cargada) — nunca una opción que
 * el locador elija a mano en un formulario: la propiedad sigue alquilada,
 * pero como ya tiene fecha de disponibilidad futura vuelve a listarse en
 * `/buscar` como "disponible el dd/mm/aaaa" (US-34, US-02).
 *
 * NOTA: no existe un estado `borrador` — quedó fuera del alcance del MVP.
 * Adaptador: `propiedad.adapter.ts#misAlquileresItemToPropiedadLocador`.
 */
export type PropertyStatus = 'publicada' | 'pausada' | 'alquilada' | 'alquilada_publicada'

/**
 * Estado del contrato de alquiler entre locador, locatario y garante.
 *
 * Ciclo: `borrador` (el locador lo está armando, todavía no se mandó a firmar) →
 * `pendiente_firma` → `vigente` → `finalizado` (terminó en su fecha) o `rescindido`
 * (se cortó antes).
 *
 * NOTA: `borrador` se sumó el 21/10/2026 a pedido del equipo (antes había quedado fuera del
 * MVP). Los valores siguen los del estado de contrato pedido para el Sprint 3; hoy la base
 * todavía tiene la tabla `estado_contrato` con otros valores (`disponible`, `vigente`,
 * `finalizado`, ver `supabase/seed.sql`). TODO(db): alinear la base con estos cinco valores.
 * No confundir con `EstadoContrato` (modelo del back, tabla `contrato`).
 */
export type ContractStatus = 'borrador' | 'pendiente_firma' | 'vigente' | 'finalizado' | 'rescindido'

/** Estado de la firma electrónica de un firmante individual dentro de un contrato. */
export type SignatureStatus = 'pendiente' | 'firmado' | 'rechazado'

/**
 * Estado de un cobro/pago periódico del alquiler.
 * `parcial` cubre el caso de un comprobante que documenta un pago incompleto
 * del período (ver Comprobante en `docs/MapaDePantallas.pdf`, sección Cobros).
 */
export type PaymentStatus = 'pendiente' | 'pagado' | 'vencido' | 'anulado' | 'parcial'

/** Estado de un reclamo abierto por locador o locatario. */
export type ClaimStatus = 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado'

/** Estado de la suscripción paga del locador a la plataforma. */
export type SubscriptionStatus = 'activa' | 'vencida' | 'cancelada'

/**
 * Estado de una solicitud de alquiler enviada por un locatario sobre una
 * propiedad publicada (US-35 a US-38).
 */
export type SolicitudStatus = 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada'

/**
 * Estado de la cuenta de un usuario (activo/suspendido por un admin, o
 * pendiente de verificar el email al registrarse). NO es lo mismo que
 * {@link UserRole}: esto es ciclo de vida de la cuenta, `UserRole` es
 * identidad (qué puede hacer), por eso son dos dominios separados.
 */
export type UsuarioStatus = 'activo' | 'suspendido' | 'sin_verificar'

/** Estado de una factura de la suscripción del locador (US-30 a US-33). */
export type FacturaStatus = 'pagada' | 'rechazada'

/**
 * Rol de un usuario dentro de la plataforma. No es un "estado de ciclo de
 * vida" como los de arriba (no envejece ni progresa), así que no forma parte
 * de {@link StatusDomainMap} ni se muestra con `StatusTag` — se representa
 * con un tag neutro simple (ver `UserMenu`/`AppShell`).
 *
 * NOTA: el back usa `Rol.nombre = 'administrador'` donde el front dice
 * `'admin'`. La traducción vive en un solo lugar:
 * `apps/web/src/services/adapters/usuario.adapter.ts#rolDtoToUserRole`.
 */
export type UserRole = 'locador' | 'locatario' | 'garante' | 'admin'

/** Dominios de negocio que tienen un estado de ciclo de vida mostrable con `StatusTag`. */
export type StatusDomain =
  | 'propiedad'
  | 'contrato'
  | 'firma'
  | 'cobro'
  | 'reclamo'
  | 'suscripcion'
  | 'solicitud'
  | 'usuario'
  | 'factura'

/**
 * Mapea cada {@link StatusDomain} a su tipo de estado correspondiente. La usa
 * `getStatusMeta`/`StatusTag` de `@rentar/ui` para tipar `status` en función
 * de `domain` (si `domain` es `'cobro'`, `status` solo acepta `PaymentStatus`).
 */
export interface StatusDomainMap {
  propiedad: PropertyStatus
  contrato: ContractStatus
  firma: SignatureStatus
  cobro: PaymentStatus
  reclamo: ClaimStatus
  suscripcion: SubscriptionStatus
  solicitud: SolicitudStatus
  usuario: UsuarioStatus
  factura: FacturaStatus
}
