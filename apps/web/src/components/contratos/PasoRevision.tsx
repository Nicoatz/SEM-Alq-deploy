'use client'

/**
 * PasoRevision.tsx — paso 4 del alta de contrato: "Revisión".
 *
 * Cubre: US-05 Registrar contrato de alquiler, "Paso 4 · Revisión y envío":
 * - resumen de todo lo cargado (propiedad, partes, garantes, vigencia,
 *   monto inicial, ajuste, depósito, vencimiento del pago y cláusulas), con
 *   "Editar" en cada bloque;
 * - la casilla obligatoria "Revisé las condiciones y las cláusulas, y
 *   entiendo que después de enviarlo no puedo editarlo".
 * La confirmación (quiénes firman) y el envío los maneja `AltaContrato`.
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 04, paso 4): "Cómo
 * queda el contrato" y "Al enviar a firmar".
 * NOTA (diseño vs. PO): el diseño dice que el garante firma por un link y
 * "hasta que estén las tres firmas"; acá firman locador y locatario.
 *
 * Quién lo usa: `AltaContrato.tsx`.
 */
import type { ReactNode } from 'react'
import { Button, Checkbox } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import type { ContratoBorrador } from '@rentar/shared-types'
import { DetailList, IndexBadge, MoneyAmount } from '@rentar/ui'
import { cantidadAjustes, fechaCorta, fechaFin, MESES_POR_PERIODO } from '@/lib/contratos/fechas'
import { contarClausulas, PLANTILLA_NOMBRE } from '@/lib/contratos/plantilla'
import { MENSAJES_CONTRATO } from '@/lib/contratos/validaciones'
import { dniParaMostrar } from '@/lib/perfil/formato'
import styles from './AltaContrato.module.css'

/** Props de {@link PasoRevision}. */
interface PasoRevisionProps {
  borrador: ContratoBorrador
  /** Lleva al paso para editar ese bloque (US-05: "cada bloque tiene la opción de volver a editarlo"). */
  onEditar: (paso: number) => void
  acepto: boolean
  onAceptoChange: (acepto: boolean) => void
  /** `true` si se tocó "Enviar a firmar" sin marcar la casilla. */
  mostrarErrorCasilla: boolean
}

/** "Nombre Apellido". */
function nombre(parte: { nombre: string; apellido: string }): string {
  return `${parte.nombre} ${parte.apellido}`.trim()
}

/** Un bloque del resumen con su "Editar". */
function Bloque({ titulo, paso, onEditar, testId, children }: { titulo: string; paso: number; onEditar: (paso: number) => void; testId: string; children: ReactNode }) {
  return (
    <section className={styles.bloqueRevision} data-testid={testId}>
      <div className={styles.bloqueRevisionHead}>
        <h3 className={styles.bloqueRevisionTitulo}>{titulo}</h3>
        <Button size="small" icon={<EditOutlined />} onClick={() => onEditar(paso)} data-testid={`${testId}-editar`}>
          Editar
        </Button>
      </div>
      {children}
    </section>
  )
}

/** Paso 4 del alta: el resumen y la casilla de revisión. */
export function PasoRevision({ borrador, onEditar, acepto, onAceptoChange, mostrarErrorCasilla }: PasoRevisionProps) {
  const { condiciones, propiedad, locador, locatario, garantes } = borrador
  const fin = fechaFin(condiciones.startDate, condiciones.durationMonths)
  const ajustes = cantidadAjustes(condiciones.durationMonths, condiciones.adjustmentIndex, condiciones.adjustmentPeriod)
  const conteo = contarClausulas(borrador.clausulas)
  const falta = 'Sin cargar'

  return (
    <div className={styles.paso} data-testid="contrato-paso-revision">
      <Bloque titulo="Propiedad y partes" paso={0} onEditar={onEditar} testId="contrato-revision-partes">
        <DetailList
          items={[
            { label: 'Propiedad', value: `${propiedad.address}${propiedad.neighborhoodName ? ` · ${propiedad.neighborhoodName}` : ''}, Córdoba` },
            { label: 'Locador', value: `${nombre(locador)} · DNI ${locador.dni ? dniParaMostrar(locador.dni) : falta}` },
            { label: 'Locatario', value: `${nombre(locatario)} · DNI ${locatario.dni ? dniParaMostrar(locatario.dni) : falta}` },
          ]}
          column={1}
        />
      </Bloque>

      <Bloque titulo="Garantes" paso={0} onEditar={onEditar} testId="contrato-revision-garantes">
        {garantes.length === 0 ? (
          <p className={styles.referencia}>Sin garantes.</p>
        ) : (
          <DetailList
            items={garantes.map((garante, indice) => ({
              label: `Garante ${indice + 1}`,
              value: `${garante.fullName} · DNI ${garante.dni ? dniParaMostrar(garante.dni) : falta} · ${garante.email}`,
            }))}
            column={1}
          />
        )}
      </Bloque>

      <Bloque titulo="Condiciones" paso={1} onEditar={onEditar} testId="contrato-revision-condiciones">
        <DetailList
          items={[
            {
              label: 'Vigencia',
              value: condiciones.startDate && fin ? `Del ${fechaCorta(condiciones.startDate)} al ${fechaCorta(fin)} · ${condiciones.durationMonths} meses` : falta,
            },
            { label: 'Monto inicial', value: condiciones.initialAmount === null ? falta : <MoneyAmount amount={condiciones.initialAmount} emphasis /> },
            {
              label: 'Ajuste',
              value:
                condiciones.adjustmentIndex === 'sin_ajuste' ? (
                  <IndexBadge index="sin_ajuste" />
                ) : (
                  <span className={styles.ajusteRevision}>
                    <IndexBadge index={condiciones.adjustmentIndex} />
                    {condiciones.adjustmentPeriod ? `cada ${MESES_POR_PERIODO[condiciones.adjustmentPeriod]} meses · ${ajustes} ${ajustes === 1 ? 'ajuste' : 'ajustes'}` : 'periodicidad sin elegir'}
                  </span>
                ),
            },
            { label: 'Depósito', value: condiciones.deposit === null ? 'Sin depósito' : <MoneyAmount amount={condiciones.deposit} /> },
            { label: 'Vencimiento del pago', value: condiciones.paymentDueDay === null ? falta : `Día ${condiciones.paymentDueDay} de cada mes` },
          ]}
          column={1}
        />
      </Bloque>

      <Bloque titulo="Cláusulas" paso={2} onEditar={onEditar} testId="contrato-revision-clausulas">
        <p className={styles.referencia}>
          {PLANTILLA_NOMBRE} · {conteo.total} cláusulas, {conteo.editadas} {conteo.editadas === 1 ? 'editada' : 'editadas'}
          {conteo.propias > 0 ? ` y ${conteo.propias} ${conteo.propias === 1 ? 'agregada por vos' : 'agregadas por vos'}` : ''}.
        </p>
      </Bloque>

      <section className={styles.alEnviar} data-testid="contrato-al-enviar">
        <h3 className={styles.bloqueRevisionTitulo}>Al enviar a firmar</h3>
        <ul className={styles.alEnviarLista}>
          <li>
            Lo firman <strong>{nombre(locador)}</strong> (locador) y <strong>{nombre(locatario)}</strong> (locatario), cada uno desde su panel.
            {garantes.length > 0 ? ' El garante queda como dato del contrato: en esta versión no firma.' : ''}
          </li>
          <li>
            El contrato queda <strong>pendiente de firma</strong> y ya no se puede editar.
          </li>
          <li>La propiedad sigue publicada mientras el contrato está pendiente de firma.</li>
        </ul>
      </section>

      {/* US-05: "Para enviar a firmar, se debe marcar la casilla …". */}
      <div>
        <Checkbox checked={acepto} onChange={(evento) => onAceptoChange(evento.target.checked)} data-testid="contrato-revision-acepto">
          Revisé las condiciones y las cláusulas, y entiendo que después de enviarlo no puedo editarlo.
        </Checkbox>
        {mostrarErrorCasilla && !acepto && (
          <p className={styles.clausulaError} role="alert" data-testid="contrato-revision-acepto-error">
            {MENSAJES_CONTRATO.revisionSinMarcar}
          </p>
        )}
      </div>
    </div>
  )
}
