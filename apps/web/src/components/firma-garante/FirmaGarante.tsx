'use client'

/**
 * FirmaGarante.tsx — la pantalla pública del garante (`/firma-garante/[token]`).
 *
 * Cubre: US-07 Firmar contrato de alquiler, "Garantes":
 * - "Los garantes firman el contrato desde un enlace temporal que les entrega el
 *   locador, sin necesidad de iniciar sesión."
 * - "Si el enlace no existe, venció o ya se usó, se debe mostrar el mismo
 *   mensaje en los tres casos": cualquier 404 es "Este enlace no es válido o ya
 *   no está disponible.", sin nada más.
 * - "Los garantes solo pueden firmar: no pueden rechazar la firma": no hay
 *   "Rechazar".
 * - D2 (PO, 11/11): el garante no ve el PDF en RentAR (la API no lo devuelve).
 *   Marca la casilla y confirma, sin el requisito de la última página: el
 *   contrato completo se lee en DocuSign.
 * - D3: el mismo aviso de firma de prueba que las partes.
 * Al volver de DocuSign (`?event=…`, `useEventoDeFirma`):
 * - `signing_complete` → "Listo, tu firma quedó registrada", SIN volver a pedir
 *   el enlace: puede que ya no sirva (se invalida cuando se registra la firma).
 * - `decline` → "Declinaste la firma…", también sin pedir el enlace (el contrato
 *   vuelve a borrador y el enlace deja de servir).
 * - `cancel`, `session_timeout`, `ttl_expired`, `exception` u otro → el mensaje
 *   y la pantalla de siempre, para volver a intentarlo.
 *
 * NOTA (seguridad): la pantalla muestra solo lo que manda el GET (nombre,
 * código, propiedad y vencimiento). El token no se muestra, no se loguea ni se
 * guarda: solo viaja en el path de la API.
 *
 * De dónde saca los datos: `firma-garante.service#consultarEnlaceGarante` y `#iniciarFirmaGarante`.
 * Quién lo usa: `app/firma-garante/[token]/page.tsx`.
 */
import { useCallback, useState } from 'react'
import { Alert, Button, Checkbox, Skeleton } from 'antd'
import { CheckCircleFilled, EditOutlined } from '@ant-design/icons'
import { ConfirmActionModal, EmptyState } from '@rentar/ui'
import { mensajeSinFirma } from '@/lib/contratos/eventoFirma'
import { fechaYHora } from '@/lib/contratos/firmas'
import { useEventoDeFirma } from '@/lib/hooks/useRegresoDeFirma'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { consultarEnlaceGarante, iniciarFirmaGarante } from '@/services/firma-garante.service'
import { ServiceError } from '@/services/shared/errors'
import { AvisoFirmaDePrueba } from '@/components/contratos/AvisoFirmaDePrueba'
import styles from './FirmaGarante.module.css'

/** Props de {@link FirmaGarante}. */
interface FirmaGaranteProps {
  /** El token del enlace (de la URL). Solo se usa para llamar a la API. */
  token: string
}

/** Texto de la casilla (US-07, el mismo que las partes). */
const TEXTO_CASILLA = 'Leí el contrato completo y acepto sus condiciones y cláusulas.'

/** Lo que se ve según cómo volvió de DocuSign (o la pantalla de siempre). */
export function FirmaGarante({ token }: FirmaGaranteProps) {
  const evento = useEventoDeFirma()

  if (evento === 'signing_complete') {
    return (
      <section className={styles.tarjeta} data-testid="firma-garante-listo">
        <CheckCircleFilled className={styles.iconoListo} aria-hidden />
        <h1 className={styles.titulo}>Listo, tu firma quedó registrada</h1>
        <p className={styles.texto}>Gracias por firmar. Podés cerrar esta página.</p>
      </section>
    )
  }

  if (evento === 'decline') {
    return (
      <section className={styles.tarjeta} data-testid="firma-garante-declinado">
        <h1 className={styles.titulo}>Declinaste la firma</h1>
        <p className={styles.texto}>
          El contrato volvió al locador. Si lo corrige, te va a mandar un enlace nuevo para firmarlo.
        </p>
      </section>
    )
  }

  return <ConsultaEnlace token={token} aviso={evento ? mensajeSinFirma(evento) : null} />
}

/** Props de {@link ConsultaEnlace}. */
interface ConsultaEnlaceProps {
  token: string
  /** Mensaje de un regreso sin firma (`cancel`, `session_timeout`…), o `null`. */
  aviso: string | null
}

/** El enlace consultado: cargando, inválido, demasiados intentos, error o los datos con la firma. */
function ConsultaEnlace({ token, aviso }: ConsultaEnlaceProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  const cargar = useCallback(() => consultarEnlaceGarante(token), [token])
  const carga = useServiceCall(cargar)
  const [acepto, setAcepto] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [firmando, setFirmando] = useState(false)
  const [errorFirma, setErrorFirma] = useState<string | null>(null)

  // ─── Handlers ───────────────────────────────────────────────────────
  /** Pide la URL de DocuSign y se va (no se guarda). Si falla, el error queda en el modal. */
  async function firmar(): Promise<void> {
    setFirmando(true)
    setErrorFirma(null)
    try {
      const { url } = await iniciarFirmaGarante(token)
      window.location.assign(url)
    } catch (error) {
      setErrorFirma(error instanceof ServiceError ? error.message : 'No pudimos abrir la firma. Probá de nuevo.')
      setFirmando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  if (carga.status === 'cargando') {
    return (
      <section className={styles.tarjeta} data-testid="firma-garante-cargando">
        <Skeleton active paragraph={{ rows: 5 }} />
      </section>
    )
  }

  if (carga.status === 'error') {
    // US-07: un único mensaje para cualquier enlace que no sirve, sin acciones ni motivo.
    if (carga.code === 'not_found') {
      return (
        <section className={styles.tarjeta} data-testid="firma-garante-invalido">
          <EmptyState title={carga.message} />
        </section>
      )
    }
    if (carga.code === 'too_many_requests') {
      return (
        <section className={styles.tarjeta} data-testid="firma-garante-limite">
          <EmptyState title={carga.message} />
        </section>
      )
    }
    return (
      <section className={styles.tarjeta} data-testid="firma-garante-error-carga">
        <EmptyState
          title="No pudimos abrir el enlace"
          description={carga.message}
          action={
            <Button onClick={carga.reintentar} data-testid="firma-garante-reintentar">
              Reintentar
            </Button>
          }
        />
      </section>
    )
  }

  const { nombre, codigo, propiedad, venceEl } = carga.data
  return (
    <section className={styles.tarjeta} aria-labelledby="firma-garante-titulo" data-testid="firma-garante-datos">
      {aviso && <Alert type="warning" showIcon title={aviso} data-testid="firma-garante-aviso" />}
      <h1 id="firma-garante-titulo" className={styles.titulo}>
        Hola, {nombre}
      </h1>
      <p className={styles.texto}>
        Te pidieron que firmes como garante el contrato <strong>{codigo ?? 'de alquiler'}</strong> de <strong>{propiedad}</strong>.
      </p>
      {venceEl && (
        <p className={styles.secundario} data-testid="firma-garante-vence">
          Este enlace vence el {fechaYHora(venceEl)}.
        </p>
      )}
      <AvisoFirmaDePrueba data-testid="firma-garante-aviso-prueba" />

      <div className={styles.firma}>
        <Checkbox checked={acepto} onChange={(evento) => setAcepto(evento.target.checked)} data-testid="firma-garante-acepto">
          {TEXTO_CASILLA}
        </Checkbox>
        {/* D2: el garante no ve el PDF en RentAR; lo lee en DocuSign antes de firmar. */}
        <p className={styles.secundario} data-testid="firma-garante-ayuda">
          El contrato completo se abre en DocuSign: podés leerlo entero y salir sin firmar.
        </p>
        <Button
          type="primary"
          icon={<EditOutlined />}
          disabled={!acepto}
          onClick={() => {
            setErrorFirma(null)
            setConfirmar(true)
          }}
          data-testid="firma-garante-firmar"
        >
          Firmar contrato
        </Button>
      </div>

      <ConfirmActionModal
        open={confirmar}
        title="¿Firmar el contrato?"
        description="Vas a leer y firmar el contrato en DocuSign, y después volvés acá. La firma no se puede deshacer."
        confirmLabel="Ir a firmar"
        cancelLabel="Volver"
        confirmLoading={firmando}
        onConfirm={() => void firmar()}
        onCancel={() => {
          if (!firmando) setConfirmar(false)
        }}
        data-testid="firma-garante-modal"
      >
        {errorFirma && <Alert type="error" showIcon title={errorFirma} data-testid="firma-garante-error" />}
      </ConfirmActionModal>
    </section>
  )
}
