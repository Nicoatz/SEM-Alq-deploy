'use client'

/**
 * EnlaceGarante.tsx — "Generar enlace" de firma para un garante, en el detalle del locador.
 *
 * Cubre: US-07 Firmar contrato de alquiler, "Garantes":
 * - "Los garantes firman el contrato desde un enlace temporal que les entrega
 *   el locador, sin necesidad de iniciar sesión." El locador lo genera acá y
 *   se lo pasa por el medio que quiera (no hay mails).
 * - "El enlace vence a los 2 días […]. Si el locador genera un enlace nuevo, el
 *   anterior deja de funcionar": por eso "Generar otro enlace" pide confirmación.
 *
 * NOTA (seguridad): la URL se muestra una sola vez. Vive solo en el estado de
 * este componente mientras el modal está abierto; al cerrarlo, se descarta. No
 * va a `localStorage`, `sessionStorage`, logs ni a la URL de la página. El
 * vencimiento tampoco se guarda: el detalle no lo informa
 * (TODO(backend): `enlace_vence_en` por garante, HANDOFF §7), así que después de
 * recargar se ve "Generar enlace" con la ayuda "Si ya le mandaste uno, generar
 * otro lo anula".
 *
 * De dónde saca los datos: `contratos.service#generarEnlaceGarante`.
 * Quién lo usa: `DetalleContrato.tsx` (en la fila de cada garante pendiente).
 */
import { useState } from 'react'
import { Alert, Button, Input, Modal } from 'antd'
import { CheckOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons'
import type { EnlaceGarante as Enlace } from '@rentar/shared-types'
import { ConfirmActionModal } from '@rentar/ui'
import { fechaYHora } from '@/lib/contratos/firmas'
import { generarEnlaceGarante } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import styles from './EnlaceGarante.module.css'

/** Props de {@link EnlaceGarante}. */
interface EnlaceGaranteProps {
  contratoId: string
  /** Id del garante para la ruta del back (en real, emparejado por posición con `garantes[]`). */
  garanteId: string
  /** Nombre del garante, para los textos. */
  nombre: string
}

/** Botón, ayuda, confirmación de "Generar otro enlace" y el modal con la URL. */
export function EnlaceGarante({ contratoId, garanteId, nombre }: EnlaceGaranteProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  /** El enlace recién generado; `null` con el modal cerrado (la URL no se conserva). */
  const [enlace, setEnlace] = useState<Enlace | null>(null)
  /** `true` si ya se generó uno en esta visita: el siguiente anula al anterior y pide confirmación. */
  const [generadoAntes, setGeneradoAntes] = useState(false)
  const [confirmarOtro, setConfirmarOtro] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  // ─── Handlers ───────────────────────────────────────────────────────
  async function generar(): Promise<void> {
    setGenerando(true)
    setError(null)
    try {
      const nuevo = await generarEnlaceGarante(contratoId, garanteId)
      setConfirmarOtro(false)
      setCopiado(false)
      setGeneradoAntes(true)
      setEnlace(nuevo)
    } catch (causa) {
      setConfirmarOtro(false)
      setError(causa instanceof ServiceError ? causa.message : 'No pudimos generar el enlace. Probá de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  async function copiar(): Promise<void> {
    if (!enlace) return
    try {
      await navigator.clipboard.writeText(enlace.url)
      setCopiado(true)
    } catch {
      // Sin permiso para el portapapeles: el campo queda seleccionable para copiarlo a mano.
      setError('No pudimos copiar el enlace. Seleccionalo y copialo a mano.')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <span className={styles.enlace}>
      <Button
        size="small"
        icon={<LinkOutlined />}
        loading={generando && !confirmarOtro}
        onClick={() => (generadoAntes ? setConfirmarOtro(true) : void generar())}
        data-testid="contrato-garante-enlace-generar"
      >
        {generadoAntes ? 'Generar otro enlace' : 'Generar enlace'}
      </Button>
      {!generadoAntes && (
        <span className={styles.ayuda} data-testid="contrato-garante-enlace-ayuda">
          Si ya le mandaste uno, generar otro lo anula.
        </span>
      )}
      {error && <Alert type="error" showIcon title={error} data-testid="contrato-garante-enlace-error" />}

      <ConfirmActionModal
        open={confirmarOtro}
        title="¿Generar otro enlace?"
        description={`El enlace anterior de ${nombre} va a dejar de funcionar. Vas a tener que mandarle el nuevo.`}
        confirmLabel="Generar otro enlace"
        cancelLabel="Volver"
        confirmLoading={generando}
        onConfirm={() => void generar()}
        onCancel={() => setConfirmarOtro(false)}
        data-testid="contrato-garante-enlace-confirmar"
      />

      <Modal
        open={enlace !== null}
        title={`Enlace de firma para ${nombre}`}
        onCancel={() => setEnlace(null)}
        footer={
          <Button type="primary" onClick={() => setEnlace(null)} data-testid="contrato-garante-enlace-listo">
            Listo
          </Button>
        }
        destroyOnHidden
        modalRender={(contenido) => <div data-testid="contrato-garante-enlace-modal">{contenido}</div>}
      >
        {enlace && (
          <div className={styles.modal}>
            <p className={styles.texto}>
              Este enlace se muestra <strong>una sola vez</strong>. Mandáselo a {nombre} por el medio que quieras: con él firma el contrato sin crear una cuenta.
            </p>
            <span className={styles.campo}>
              <Input readOnly value={enlace.url} onFocus={(evento) => evento.target.select()} aria-label="Enlace de firma" data-testid="contrato-garante-enlace-url" />
              <Button icon={copiado ? <CheckOutlined /> : <CopyOutlined />} onClick={() => void copiar()} data-testid="contrato-garante-enlace-copiar">
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
            </span>
            <p className={styles.texto} data-testid="contrato-garante-enlace-vence">
              Vence el {fechaYHora(enlace.venceEl)}. Pedir otro enlace anula este.
            </p>
          </div>
        )}
      </Modal>
    </span>
  )
}
