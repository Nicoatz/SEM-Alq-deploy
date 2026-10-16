'use client'

/**
 * DetallePostulante.tsx — el detalle de una solicitud recibida: quién la
 * mandó, cuándo, su mensaje y las acciones.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 02, panel del
 * costado): avatar, nombre y apellido (US-36), "Solicitó el 14/09/2026 ·
 * hace 2 días", el estado con su línea, la propiedad, el mensaje opcional
 * del postulante (US-36: "se debe leer el mensaje opcional incluido por el
 * locatario, si lo hubiera") y los botones grandes de acción.
 * En escritorio va al costado de la lista; en móvil, en un Drawer a pantalla
 * completa (· 05: "el detalle del postulante se abre como pantalla propia").
 *
 * Desde la US-35 actualizada, también los "Datos del postulante" (· 02,
 * ficha del postulante): contacto, DNI, ocupación, ingresos, convivientes,
 * mascotas y garantías. Son datos sensibles: van solo acá, nunca en la
 * lista. Por eso la lista no los trae y llegan aparte, en `detalle`
 * (`useDetalleSolicitud` → `getSolicitudRecibida`), con su carga y su error. Una solicitud enviada antes de la US-35 actualizada no los trae:
 * "Sin datos de legajo".
 * En una rechazada, también el motivo completo que escribió el locador
 * (US-37, hasta 200 caracteres; en la lista va truncado a 80, US-36).
 * NOTA: el diseño suma la antigüedad laboral, la relación ingreso/alquiler
 * y la mudanza estimada; la US no los pide (decisión del PO): no van.
 *
 * Quién lo usa: `SolicitudesRecibidas`.
 */
import type { ReactNode } from 'react'
import { Avatar, Button, Skeleton } from 'antd'
import type { Solicitud } from '@rentar/shared-types'
import { DetailList, formatARS, StatusTag } from '@rentar/ui'
import { enviadaHace, fechaLargaNumerica, lineaRecibida } from '@/lib/solicitudes/textos'
import { iniciales } from '@/lib/utils/iniciales'
import { formatoE123, GARANTIA_LABEL, OCUPACION_LABEL, type AccionSolicitud } from '@/lib/validation/solicitud.rules'
import { AVISO_ACEPTADA_SIN_BAJA_MESSAGE, puedeCancelarAceptada } from '@/services/solicitudes.service'
import { AccionesSolicitudRecibida } from './FilaSolicitudRecibida'
import styles from './SolicitudesRecibidas.module.css'
import type { DetalleSolicitud } from './useDetalleSolicitud'

/** Props de {@link DetallePostulante}. */
interface DetallePostulanteProps {
  /** La fila de la lista (estado al día, sin datos sensibles). */
  solicitud: Solicitud
  /** Los datos del postulante de esta solicitud (`useDetalleSolicitud`). */
  detalle: DetalleSolicitud
  /** La aceptada de la misma propiedad, si es otra. */
  otraAceptada: Solicitud | undefined
  onAccion: (accion: AccionSolicitud, solicitud: Solicitud) => void
}

/** "1 persona" / "2 personas". */
function personas(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'persona' : 'personas'}`
}

/** Las filas de "Datos del postulante" (US-35 actualizada). `null` si la solicitud no trae legajo. */
function filasLegajo(solicitud: Solicitud): { label: string; value: ReactNode }[] | null {
  const { legajo, contact } = solicitud
  if (!legajo) return null
  return [
    {
      label: 'Contacto',
      // El teléfono se muestra en E.123 ("+54 351 555 0103"); se guarda en E.164.
      value: <span data-testid="solicitudes-detalle-contacto">{contact ? [contact.phone ? formatoE123(contact.phone) : '', contact.email].filter(Boolean).join(' · ') : '—'}</span>,
    },
    // TODO(db): la tabla `usuario` no guarda el DNI: con el back real puede venir vacío.
    { label: 'DNI', value: solicitud.applicant.dni ? Number(solicitud.applicant.dni).toLocaleString('es-AR') : '—' },
    { label: 'Ocupación', value: OCUPACION_LABEL[legajo.occupation] },
    // 0 = no los informa (decisión del PO, HANDOFF §7).
    { label: 'Ingresos declarados', value: legajo.monthlyIncome > 0 ? `${formatARS(legajo.monthlyIncome)} por mes` : 'No informó' },
    { label: 'Van a vivir', value: personas(legajo.residents) },
    { label: 'Mascotas', value: legajo.hasPets ? (legajo.petsDetail ? `Sí: ${legajo.petsDetail}` : 'Sí') : 'No' },
    { label: 'Garantía que ofrece', value: legajo.guarantees.length ? legajo.guarantees.map((garantia) => GARANTIA_LABEL[garantia]).join(' · ') : 'Ninguna' },
  ]
}

/** El detalle de la solicitud elegida. */
export function DetallePostulante({ solicitud, detalle, otraAceptada, onAccion }: DetallePostulanteProps) {
  const propiedad = [solicitud.property.address, solicitud.property.neighborhoodName].filter(Boolean).join(' · ')
  const legajo = detalle.solicitud ? filasLegajo(detalle.solicitud) : null

  return (
    <article className={styles.detail} aria-label={`Solicitud de ${solicitud.applicant.fullName}`} data-testid="solicitudes-detalle">
      <header className={styles.detailHeader}>
        <Avatar size={46} className={styles.avatarSelected} aria-hidden="true">
          {iniciales(solicitud.applicant.fullName)}
        </Avatar>
        <div className={styles.detailTitle}>
          <span className={styles.detailName}>{solicitud.applicant.fullName}</span>
          <span className={styles.detailSub}>
            Solicitó el {fechaLargaNumerica(solicitud.createdAt)} · {enviadaHace(solicitud)}
          </span>
        </div>
      </header>

      <div className={styles.detailBody}>
        <div className={styles.detailStatus}>
          <StatusTag domain="solicitud" status={solicitud.status} />
          <span className={styles.rowLine}>{lineaRecibida(solicitud, otraAceptada, puedeCancelarAceptada)}</span>
        </div>

        {/* Brecha 1 de HANDOFF §7: en real, el botón "Cancelar solicitud" no está; se explica acá. */}
        {solicitud.status === 'aceptada' && !puedeCancelarAceptada && (
          <p className={styles.detailEmpty} data-testid="solicitudes-detalle-aviso-aceptada">
            {AVISO_ACEPTADA_SIN_BAJA_MESSAGE}
          </p>
        )}

        {propiedad && (
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Propiedad</span>
            <span className={styles.detailValue}>{propiedad}</span>
          </div>
        )}

        {/* Datos del postulante (US-35 actualizada): solo en el detalle, nunca en la lista. */}
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Datos del postulante</span>
          {detalle.estado === 'cargando' || detalle.estado === 'sin_solicitud' ? (
            <div data-testid="solicitudes-detalle-cargando">
              <Skeleton active title={false} paragraph={{ rows: 4 }} />
            </div>
          ) : detalle.estado === 'error' ? (
            <div className={styles.detailError} role="alert" data-testid="solicitudes-detalle-error">
              <span className={styles.detailEmpty}>{detalle.message}</span>
              <Button size="small" onClick={detalle.recargar} data-testid="solicitudes-detalle-reintentar">
                Reintentar
              </Button>
            </div>
          ) : legajo ? (
            <div className={styles.legajo} data-testid="solicitudes-detalle-legajo">
              <DetailList items={legajo} column={1} />
            </div>
          ) : (
            <span className={styles.detailEmpty} data-testid="solicitudes-detalle-sin-legajo">
              Sin datos de legajo: la envió antes de que el formulario los pidiera.
            </span>
          )}
        </div>

        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Su mensaje</span>
          {solicitud.message ? (
            <p className={styles.detailMessage} data-testid="solicitudes-detalle-mensaje">
              {solicitud.message}
            </p>
          ) : (
            <span className={styles.detailEmpty} data-testid="solicitudes-detalle-mensaje">
              No dejó ningún mensaje.
            </span>
          )}
        </div>

        {solicitud.status === 'rechazada' && (
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Motivo del rechazo</span>
            {solicitud.rejectionMessage ? (
              <p className={styles.detailMessage} data-testid="solicitudes-detalle-motivo-rechazo">
                {solicitud.rejectionMessage}
              </p>
            ) : (
              <span className={styles.detailEmpty} data-testid="solicitudes-detalle-motivo-rechazo">
                No escribiste un motivo.
              </span>
            )}
          </div>
        )}

        <AccionesSolicitudRecibida solicitud={solicitud} otraAceptada={otraAceptada} onAccion={onAccion} variante="detalle" testIdPrefix="solicitudes-detalle" />
      </div>
    </article>
  )
}
