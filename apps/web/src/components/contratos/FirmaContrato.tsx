'use client'

/**
 * FirmaContrato.tsx — leer, aceptar y firmar en DocuSign (o rechazar) un contrato.
 *
 * Cubre: US-07 Firmar contrato de alquiler, "Firma" y "Rechazo y cancelación":
 * - "Antes de firmar, se debe informar que, mientras se use el entorno de
 *   prueba de DocuSign, la firma no tiene validez legal" (`AvisoFirmaDePrueba`).
 * - "El botón 'Firmar contrato' solo se habilita cuando el usuario llegó a la
 *   última página del documento y marcó la casilla 'Leí el contrato completo y
 *   acepto sus condiciones y cláusulas'". Mientras tanto, cuántas páginas
 *   faltan: se cuentan las vistas en el PDF (`VisorPdf`) y volver atrás no resta.
 * - "Se debe solicitar confirmación antes de firmar, avisando que la firma no
 *   se puede deshacer." Cancelar la confirmación no pide nada al back.
 * - Todo eso pasa ANTES de `POST /firmar` (decisión del PO del 11/11): la URL que
 *   devuelve dura pocos minutos y se usa una sola vez. Al llegar, se redirige
 *   (`window.location.assign`) y la URL no se guarda en ningún lado.
 * - "Tanto el locatario como el locador pueden rechazar la firma" mientras no
 *   hayan firmado (este bloque solo aparece si quien mira no firmó). Motivo
 *   opcional de hasta 300 caracteres, con confirmación. El contrato vuelve a
 *   borrador y se borran todas las firmas. Para el locador es la acción
 *   secundaria: la principal para volver atrás es "Modificar" (D1, PO 11/11).
 *
 * NOTA: es reutilizable y no depende de la ruta: lo usan el detalle del locador
 * (`/panel/contratos/[id]`) y Mi alquiler (`/panel/alquiler`). La firma no se
 * registra acá: la registra el back cuando DocuSign le avisa, y la pantalla lo
 * espera al volver (`useRegresoDeFirma`).
 *
 * Quién lo usa: `DetalleContrato.tsx`.
 */
import { useCallback, useState } from 'react'
import { Alert, Button, Checkbox, Input } from 'antd'
import { CloseCircleOutlined, EditOutlined } from '@ant-design/icons'
import { ConfirmActionModal } from '@rentar/ui'
import { errorDeMotivoRechazo, MOTIVO_RECHAZO_MAX } from '@/lib/contratos/firmas'
import { paginasQueFaltanLeer } from '@/lib/contratos/lectura'
import type { ObtenerUrlPdf } from '@/lib/contratos/pdfVisor'
import { iniciarFirma, rechazarFirma } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { AvisoFirmaDePrueba } from './AvisoFirmaDePrueba'
import { VisorPdf } from './VisorPdf'
import styles from './DetalleContrato.module.css'

/** Props de {@link FirmaContrato}. */
interface FirmaContratoProps {
  contratoId: string
  /** Pide la URL del PDF al abrir el visor (S4-13). */
  obtenerPdf: ObtenerUrlPdf
  nombrePdf?: string
  /** Quién firma: cambia el texto del rechazo y su peso (D1). */
  miRol: 'locador' | 'locatario'
  /** Cuántos firmantes tiene el contrato (locador, locatario y garantes), para la confirmación. */
  cantidadFirmantes: number
  /** Después de rechazar: el contrato ya es un borrador. */
  onRechazado: () => void
}

/** Texto de la casilla (US-07, decisión del PO del 11/11). */
const TEXTO_CASILLA = 'Leí el contrato completo y acepto sus condiciones y cláusulas.'

/** Lo que dice la confirmación del rechazo, según quién rechaza (D1: sin vueltas). */
const DESCRIPCION_RECHAZO = {
  locador:
    'El contrato vuelve a borrador y se borran todas las firmas, incluida la del locatario si ya firmó. Para que lo firmen, lo vas a tener que enviar de nuevo. Si el locatario todavía no firmó y solo querés corregir algo, usá Modificar.',
  locatario:
    'El contrato vuelve a borrador y se borran todas las firmas. Deja de aparecer en Mi alquiler hasta que el locador lo corrija y te lo vuelva a enviar. Podés contarle por qué (opcional).',
} as const

/** Mensaje de un error del service, o uno genérico. */
function mensajeDe(error: unknown): string {
  return error instanceof ServiceError ? error.message : 'No pudimos registrar la acción. No se cambió nada: probá de nuevo.'
}

/** Visor con progreso, casilla, "Firmar contrato" y "Rechazar firma". */
export function FirmaContrato({ contratoId, obtenerPdf, nombrePdf, miRol, cantidadFirmantes, onRechazado }: FirmaContratoProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  /** Cuántas páginas faltan; `null` mientras el PDF no abrió: sin PDF no se firma. */
  const [faltan, setFaltan] = useState<number | null>(null)
  const [acepto, setAcepto] = useState(false)
  const [confirmarFirma, setConfirmarFirma] = useState(false)
  const [firmando, setFirmando] = useState(false)
  const [errorFirma, setErrorFirma] = useState<string | null>(null)
  const [rechazoAbierto, setRechazoAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [errorRechazo, setErrorRechazo] = useState<string | null>(null)

  const llegoAlFinal = faltan === 0
  const puedeFirmar = llegoAlFinal && acepto
  const errorMotivo = errorDeMotivoRechazo(motivo)

  // ─── Handlers ───────────────────────────────────────────────────────
  const verPaginas = useCallback((vistas: ReadonlySet<number>, total: number) => setFaltan(paginasQueFaltanLeer(vistas, total)), [])

  /**
   * Pide la URL de DocuSign y se va. El modal queda "cargando" hasta que el
   * navegador cambia de página: si se cerrara, se podría pedir otra URL.
   */
  async function firmar(): Promise<void> {
    setFirmando(true)
    setErrorFirma(null)
    try {
      const { url } = await iniciarFirma(contratoId)
      window.location.assign(url)
    } catch (error) {
      setErrorFirma(mensajeDe(error))
      setFirmando(false)
    }
  }

  async function rechazar(): Promise<void> {
    if (errorMotivo) return
    setRechazando(true)
    setErrorRechazo(null)
    try {
      await rechazarFirma(contratoId, motivo)
      setRechazoAbierto(false)
      onRechazado()
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
      <AvisoFirmaDePrueba data-testid="contrato-firma-aviso-prueba" />

      <VisorPdf obtenerUrl={obtenerPdf} nombre={nombrePdf} onPaginasVistas={verPaginas} data-testid="contrato-firma-visor" />

      {faltan !== null && faltan > 0 && (
        <p className={styles.firmaFaltan} data-testid="contrato-firma-faltan">
          {faltan === 1 ? 'Te falta 1 página para poder firmar.' : `Te faltan ${faltan} páginas para poder firmar.`}
        </p>
      )}

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
          <Button
            danger
            type={miRol === 'locador' ? 'link' : 'default'}
            icon={<CloseCircleOutlined />}
            onClick={() => {
              setErrorRechazo(null)
              setRechazoAbierto(true)
            }}
            data-testid="contrato-firma-rechazar"
          >
            Rechazar firma
          </Button>
        </span>
      </div>

      <ConfirmActionModal
        open={confirmarFirma}
        title="¿Firmar el contrato?"
        description={`Vas a firmar en DocuSign y después volvés a RentAR. La firma no se puede deshacer. El contrato queda vigente cuando firmen todos (${cantidadFirmantes} firmantes).`}
        confirmLabel="Ir a firmar"
        cancelLabel="Volver"
        confirmLoading={firmando}
        onConfirm={() => void firmar()}
        onCancel={() => {
          if (!firmando) setConfirmarFirma(false)
        }}
        data-testid="contrato-firma-modal"
      >
        {errorFirma && <Alert type="error" showIcon title={errorFirma} data-testid="contrato-firma-error" />}
      </ConfirmActionModal>

      <ConfirmActionModal
        open={rechazoAbierto}
        title="¿Rechazar la firma?"
        description={DESCRIPCION_RECHAZO[miRol]}
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
