'use client'

/**
 * FirmaContrato.tsx — leer, aceptar y firmar (o rechazar) un contrato.
 *
 * Cubre: US-07 Firmar contrato de alquiler, "Firma" y "Rechazo":
 * - "Antes de firmar, se debe informar que en esta versión de la plataforma
 *   la firma es simulada" (`SimulatedFeatureNotice`, arriba de todo).
 * - "El botón 'Firmar contrato' solo se habilita cuando el usuario llegó a
 *   la última página del documento y marcó la casilla 'Leí el contrato
 *   completo y acepto sus condiciones y cláusulas'." Mientras tanto, cuántas
 *   páginas faltan (`VisorContrato`).
 * - "Se debe solicitar confirmación antes de firmar, avisando que la firma no
 *   se puede deshacer." Cancelar la confirmación no registra nada.
 * - Rechazo (solo el locatario, `permitirRechazo`): motivo opcional de hasta
 *   300 caracteres, con confirmación. El contrato sigue pendiente de firma.
 *
 * NOTA: es reutilizable y no depende de la ruta. Hoy lo monta el detalle del
 * locador (`/panel/contratos/[id]`); el locatario lo va a usar desde Mi
 * alquiler (`/panel/alquiler`, tanda 4). Habla con el service solo para
 * firmar y rechazar, y devuelve el contrato actualizado con `onCambio`.
 *
 * Quién lo usa: `DetalleContrato.tsx`.
 */
import { useState } from 'react'
import { Alert, Button, Checkbox, Input } from 'antd'
import { CloseCircleOutlined, EditOutlined } from '@ant-design/icons'
import type { ClausulaContrato, ContratoDetalle } from '@rentar/shared-types'
import { ConfirmActionModal, SimulatedFeatureNotice } from '@rentar/ui'
import { errorDeMotivoRechazo, MOTIVO_RECHAZO_MAX } from '@/lib/contratos/firmas'
import { paginarContrato } from '@/lib/contratos/paginas'
import { firmarContrato, rechazarFirma } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { VisorContrato } from './VisorContrato'
import styles from './DetalleContrato.module.css'

/** Props de {@link FirmaContrato}. */
interface FirmaContratoProps {
  contratoId: string
  /** Título y código del documento. */
  titulo: string
  codigo: string | null
  clausulas: readonly ClausulaContrato[]
  /** Nombre de la otra parte, para el aviso de la confirmación ("…queda pendiente la firma de Julieta"). */
  otraParte: string
  /** `true` para el locatario: muestra "Rechazar firma" (US-07: "el locatario puede rechazar la firma"). */
  permitirRechazo?: boolean
  /** El contrato después de firmar o rechazar. */
  onCambio: (contrato: ContratoDetalle) => void
}

/** Texto de la casilla, literal de la US. */
const TEXTO_CASILLA = 'Leí el contrato completo y acepto sus condiciones y cláusulas.'

/** Mensaje de un error del service, o uno genérico. */
function mensajeDe(error: unknown): string {
  return error instanceof ServiceError ? error.message : 'No pudimos registrar la acción. No se cambió nada: probá de nuevo.'
}

/** Visor con progreso, casilla, "Firmar contrato" y (si corresponde) "Rechazar firma". */
export function FirmaContrato({ contratoId, titulo, codigo, clausulas, otraParte, permitirRechazo = false, onCambio }: FirmaContratoProps) {
  const total = paginarContrato(clausulas).length

  // ─── Estado local ───────────────────────────────────────────────────
  const [leidaHasta, setLeidaHasta] = useState(1)
  const [acepto, setAcepto] = useState(false)
  const [confirmarFirma, setConfirmarFirma] = useState(false)
  const [firmando, setFirmando] = useState(false)
  const [errorFirma, setErrorFirma] = useState<string | null>(null)
  const [rechazoAbierto, setRechazoAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [errorRechazo, setErrorRechazo] = useState<string | null>(null)

  const llegoAlFinal = leidaHasta >= total
  const puedeFirmar = llegoAlFinal && acepto
  const errorMotivo = errorDeMotivoRechazo(motivo)

  // ─── Handlers ───────────────────────────────────────────────────────
  async function firmar(): Promise<void> {
    setFirmando(true)
    setErrorFirma(null)
    try {
      const contrato = await firmarContrato(contratoId)
      setConfirmarFirma(false)
      onCambio(contrato)
    } catch (error) {
      setErrorFirma(mensajeDe(error))
    } finally {
      setFirmando(false)
    }
  }

  async function rechazar(): Promise<void> {
    if (errorMotivo) return
    setRechazando(true)
    setErrorRechazo(null)
    try {
      const contrato = await rechazarFirma(contratoId, motivo)
      setRechazoAbierto(false)
      onCambio(contrato)
    } catch (error) {
      setErrorRechazo(mensajeDe(error))
    } finally {
      setRechazando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <section className={styles.firma} aria-labelledby="contrato-firma-titulo" data-testid="contrato-firma">
      <h2 id="contrato-firma-titulo" className={styles.tarjetaTitulo}>
        Firmar el contrato
      </h2>
      <SimulatedFeatureNotice
        feature="la firma electrónica"
        reason="Tu firma queda registrada con fecha y hora, pero en esta versión de RentAR no tiene validez legal."
        data-testid="contrato-firma-aviso"
      />

      <VisorContrato
        titulo={titulo}
        codigo={codigo}
        clausulas={clausulas}
        conProgreso
        onProgreso={(leidas) => setLeidaHasta(leidas)}
      />

      <div className={styles.firmaAcciones}>
        <Checkbox checked={acepto} onChange={(evento) => setAcepto(evento.target.checked)} data-testid="contrato-firma-acepto">
          {TEXTO_CASILLA}
        </Checkbox>
        {!puedeFirmar && (
          <p className={styles.firmaAyuda} data-testid="contrato-firma-requisitos">
            {!llegoAlFinal ? 'Para firmar, leé el contrato hasta la última página' : 'Para firmar, marcá la casilla'}
            {!llegoAlFinal && !acepto ? ' y marcá la casilla.' : '.'}
          </p>
        )}
        <span className={styles.acciones}>
          <Button
            type="primary"
            icon={<EditOutlined />}
            disabled={!puedeFirmar}
            onClick={() => {
              setErrorFirma(null)
              setConfirmarFirma(true)
            }}
            data-testid="contrato-firma-firmar"
          >
            Firmar contrato
          </Button>
          {permitirRechazo && (
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => {
                setErrorRechazo(null)
                setRechazoAbierto(true)
              }}
              data-testid="contrato-firma-rechazar"
            >
              Rechazar firma
            </Button>
          )}
        </span>
      </div>

      <ConfirmActionModal
        open={confirmarFirma}
        title="¿Firmar el contrato?"
        description={`La firma no se puede deshacer: para cambiar algo después, habría que rescindir el contrato. Cuando firme ${otraParte}, el contrato queda vigente.`}
        confirmLabel="Firmar contrato"
        cancelLabel="Volver"
        confirmLoading={firmando}
        onConfirm={() => void firmar()}
        onCancel={() => setConfirmarFirma(false)}
        data-testid="contrato-firma-modal"
      >
        {errorFirma && <Alert type="error" showIcon title={errorFirma} data-testid="contrato-firma-error" />}
      </ConfirmActionModal>

      <ConfirmActionModal
        open={rechazoAbierto}
        title="¿Rechazar la firma?"
        description="El contrato sigue pendiente de firma y el rechazo se ve en el detalle. Podés contarle al locador por qué (opcional)."
        confirmLabel="Rechazar firma"
        cancelLabel="Volver"
        danger
        confirmLoading={rechazando}
        onConfirm={() => void rechazar()}
        onCancel={() => setRechazoAbierto(false)}
        data-testid="contrato-rechazo-modal"
      >
        <label className={styles.campo}>
          <span>Motivo (opcional)</span>
          <Input.TextArea
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            autoSize={{ minRows: 3, maxRows: 6 }}
            count={{ show: true, max: MOTIVO_RECHAZO_MAX }}
            status={errorMotivo ? 'error' : undefined}
            placeholder="Ej.: el monto no es el que acordamos."
            data-testid="contrato-rechazo-motivo"
          />
        </label>
        {errorMotivo && (
          <p className={styles.error} role="alert" data-testid="contrato-rechazo-motivo-error">
            {errorMotivo}
          </p>
        )}
        {errorRechazo && <Alert type="error" showIcon title={errorRechazo} data-testid="contrato-rechazo-error" />}
      </ConfirmActionModal>
    </section>
  )
}
