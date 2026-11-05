'use client'

/**
 * RegistrarCobroModal.tsx — registra un cobro recibido fuera de la plataforma.
 *
 * Cubre: US-08 Registrar cobro, "Formulario":
 * - Desde el detalle, el período viene elegido. Desde el botón general, se elige
 *   la propiedad y el período.
 * - "Se debe registrar el saldo del período: el alquiler más los intereses por
 *   mora a la fecha del cobro." El monto no se edita (no hay pago parcial).
 * - La fecha no puede ser futura ni anterior al inicio del contrato. Por defecto,
 *   la de hoy.
 * - Medio obligatorio; con "otro", nota de hasta 200 caracteres.
 * - Comprobante opcional: PDF, JPG o PNG, hasta 4,5 MB (decisión del PO, 05/11).
 *
 * De dónde saca los datos: `cobros.service`.
 * Quién lo usa: `Cobros.tsx` y `DetallePeriodo.tsx`.
 */
import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Form, Input, Modal, Select, Skeleton } from 'antd'
import type { ButtonProps, UploadFile } from 'antd'
import dayjs from 'dayjs'
import type { CobroCreado, CondicionesCobro, MedioCobro, PeriodoRegistrable } from '@rentar/shared-types'
import { ConfirmActionModal, FileDropzone, formatARS, formatPeriod, MoneyAmount } from '@rentar/ui'
import { OPCIONES_MEDIO } from '@/lib/cobros/medios'
import { calcularMora } from '@/lib/cobros/mora'
import { ADJUNTO_ACCEPT, errorDeAdjunto, errorDeFechaCobro, errorDeNota, NOTA_MAX } from '@/lib/cobros/validaciones'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { hoy } from '@/lib/utils/fechas'
import { getCondicionesCobro, listarPeriodosRegistrables, registrarCobro } from '@/services/cobros.service'
import { ServiceError } from '@/services/shared/errors'
import styles from './Cobros.module.css'

/** Props de {@link RegistrarCobroModal}. */
interface RegistrarCobroModalProps {
  /** El período, si se abre desde el detalle; `null` desde el botón general. */
  periodo: PeriodoRegistrable | null
  onCerrar: () => void
  onRegistrado: (creado: CobroCreado) => void
}

/** Errores del formulario, por campo. */
interface ErroresCobro {
  periodo?: string
  medio?: string
  nota?: string
  adjunto?: string
}

/** Sin período elegido no hay condiciones que pedir. */
async function sinCondiciones(): Promise<CondicionesCobro | null> {
  return null
}

/** Modal del cobro: el formulario y, antes de registrar, la confirmación. */
export function RegistrarCobroModal({ periodo: periodoFijo, onCerrar, onRegistrado }: RegistrarCobroModalProps) {
  // ─── Estado local ───
  const [propiedadId, setPropiedadId] = useState<string | null>(null)
  const [periodoId, setPeriodoId] = useState<string | null>(null)
  const [fecha, setFecha] = useState<string | null>(() => hoy().format('YYYY-MM-DD'))
  const [medio, setMedio] = useState<MedioCobro | null>(null)
  const [nota, setNota] = useState('')
  const [adjunto, setAdjunto] = useState<File | null>(null)
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null)
  // Los errores se muestran después del primer intento y se recalculan al corregir.
  const [intento, setIntento] = useState(false)
  // Cambiarla vacía el `FileDropzone`, que no deja controlar su lista.
  const [claveAdjunto, setClaveAdjunto] = useState(0)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // ─── Datos ───
  const pedirPeriodos = useCallback(
    async (): Promise<PeriodoRegistrable[]> => (periodoFijo ? [periodoFijo] : listarPeriodosRegistrables()),
    [periodoFijo],
  )
  const periodos = useServiceCall(pedirPeriodos)
  const lista = useMemo(() => (periodos.status === 'listo' ? periodos.data : []), [periodos])

  const periodo = periodoFijo ?? lista.find((item) => item.id === periodoId) ?? null
  const contratoId = periodo?.contratoId ?? null
  const pedirCondiciones = useMemo(() => (contratoId ? () => getCondicionesCobro(contratoId) : sinCondiciones), [contratoId])
  const condiciones = useServiceCall<CondicionesCobro | null>(pedirCondiciones)
  const datosContrato = condiciones.status === 'listo' ? condiciones.data : null

  const propiedades = [...new Map(lista.map((item) => [item.propiedadId, item.propiedad]))]
  const delaPropiedad = lista.filter((item) => item.propiedadId === propiedadId)

  const hoyIso = hoy().format('YYYY-MM-DD')
  const inicioContrato = datosContrato?.inicioContrato ?? null
  const errorFecha = errorDeFechaCobro(fecha, hoyIso, inicioContrato)
  const calculo =
    periodo && datosContrato && fecha && !errorFecha
      ? calcularMora({ alquiler: periodo.alquiler, ...datosContrato, vencimiento: periodo.vencimiento, fecha })
      : null

  const errorNota = errorDeNota(medio, nota)
  const errores: ErroresCobro = intento
    ? {
        periodo: periodo ? undefined : 'Elegí el período.',
        medio: medio ? undefined : 'Elegí el medio.',
        nota: errorNota ?? undefined,
      }
    : {}

  // ─── Handlers ───
  /** Se queda con el último archivo elegido y lo valida. */
  function cambiarAdjunto(archivos: UploadFile[]): void {
    const archivo = archivos.at(-1)?.originFileObj ?? null
    const error = archivo ? errorDeAdjunto(archivo) : null
    setErrorAdjunto(error)
    setAdjunto(error ? null : archivo)
  }

  /** Saca el archivo elegido. */
  function quitarAdjunto(): void {
    setAdjunto(null)
    setErrorAdjunto(null)
    setClaveAdjunto((actual) => actual + 1)
  }

  /** Valida y pide la confirmación. */
  function pedirConfirmacion(): void {
    setIntento(true)
    setErrorEnvio(null)
    if (periodo && medio && !errorFecha && !errorNota && !errorAdjunto && calculo) setConfirmando(true)
  }

  /** Registra el cobro. El error se muestra en el formulario. */
  async function confirmar(): Promise<void> {
    if (!periodo || !fecha || !medio) return
    setEnviando(true)
    try {
      const creado = await registrarCobro({ periodoId: periodo.id, fecha, medio, nota: nota.trim() || null, adjunto })
      onRegistrado(creado)
    } catch (error) {
      setErrorEnvio(error instanceof ServiceError ? error.message : 'No pudimos registrar el cobro. Probá de nuevo.')
      setConfirmando(false)
      setEnviando(false)
    }
  }

  // ─── Render ───
  return (
    <>
      <Modal
        open
        title="Registrar cobro"
        okText="Registrar cobro"
        cancelText="Cancelar"
        onOk={pedirConfirmacion}
        onCancel={onCerrar}
        okButtonProps={{ 'data-testid': 'cobro-modal-submit', disabled: periodos.status !== 'listo' || lista.length === 0 } as ButtonProps}
        cancelButtonProps={{ 'data-testid': 'cobro-modal-cancelar' } as ButtonProps}
        destroyOnHidden
      >
        <div data-testid="cobro-modal">
          {periodos.status === 'cargando' && <Skeleton active paragraph={{ rows: 4 }} />}
          {periodos.status === 'error' && <Alert type="error" showIcon title={periodos.message} data-testid="cobro-modal-error-carga" />}
          {periodos.status === 'listo' && lista.length === 0 && (
            <Alert type="info" showIcon title="No tenés períodos pendientes ni vencidos para cobrar." data-testid="cobro-modal-sin-periodos" />
          )}

          {periodos.status === 'listo' && lista.length > 0 && (
            <Form layout="vertical" requiredMark={false}>
              {periodoFijo ? (
                <p className={styles.periodoFijo} data-testid="cobro-modal-resumen">
                  {periodoFijo.propiedad} · {periodoFijo.locatario ?? 'Sin dato'} · {formatPeriod(`${periodoFijo.periodo}-01`)}
                </p>
              ) : (
                <>
                  <Form.Item label="Propiedad">
                    <Select
                      value={propiedadId}
                      onChange={(valor) => {
                        setPropiedadId(valor)
                        setPeriodoId(null)
                      }}
                      options={propiedades.map(([value, label]) => ({ value, label }))}
                      placeholder="Elegí la propiedad"
                      data-testid="cobro-modal-propiedad"
                    />
                  </Form.Item>
                  <Form.Item label="Período" validateStatus={errores.periodo ? 'error' : undefined} help={errores.periodo}>
                    <Select
                      value={periodoId}
                      onChange={setPeriodoId}
                      options={delaPropiedad.map((item) => ({ value: item.id, label: formatPeriod(`${item.periodo}-01`) }))}
                      placeholder="Elegí el período"
                      disabled={!propiedadId}
                      data-testid="cobro-modal-periodo"
                    />
                  </Form.Item>
                </>
              )}

              <Form.Item label="Fecha del cobro" validateStatus={periodo && errorFecha ? 'error' : undefined} help={periodo ? (errorFecha ?? undefined) : undefined}>
                <DatePicker
                  value={fecha ? dayjs(fecha) : null}
                  onChange={(valor) => setFecha(valor ? valor.format('YYYY-MM-DD') : null)}
                  format="DD/MM/YYYY"
                  placeholder="dd/mm/aaaa"
                  className={styles.fullWidth}
                  data-testid="cobro-modal-fecha"
                />
              </Form.Item>

              <Form.Item label="Medio" validateStatus={errores.medio ? 'error' : undefined} help={errores.medio}>
                <Select value={medio} onChange={setMedio} options={OPCIONES_MEDIO} placeholder="Elegí el medio" data-testid="cobro-modal-medio" />
              </Form.Item>

              {medio === 'otro' && (
                <Form.Item label="Nota" validateStatus={errores.nota ? 'error' : undefined} help={errores.nota}>
                  <Input.TextArea value={nota} onChange={(evento) => setNota(evento.target.value)} rows={2} showCount maxLength={NOTA_MAX} data-testid="cobro-modal-nota" />
                </Form.Item>
              )}

              <Form.Item label="Comprobante (opcional)" validateStatus={errorAdjunto ? 'error' : undefined} help={errorAdjunto ?? undefined}>
                <div className={styles.adjunto}>
                  <FileDropzone key={claveAdjunto} accept={ADJUNTO_ACCEPT} multiple={false} onFilesChange={cambiarAdjunto} hint="PDF, JPG o PNG, hasta 4,5 MB." data-testid="cobro-modal-adjunto" />
                </div>
                {adjunto && (
                  <span className={styles.adjuntoElegido} data-testid="cobro-modal-adjunto-nombre">
                    {adjunto.name}
                    <Button type="link" size="small" onClick={quitarAdjunto} data-testid="cobro-modal-adjunto-quitar">
                      Quitar
                    </Button>
                  </span>
                )}
              </Form.Item>

              {periodo && condiciones.status === 'error' && (
                <Alert type="error" showIcon title="No pudimos calcular el monto. Probá de nuevo." data-testid="cobro-modal-error-monto" />
              )}
              {calculo && (
                <div className={styles.monto} data-testid="cobro-modal-monto">
                  <span className={styles.montoLinea}>
                    Alquiler <MoneyAmount amount={periodo?.alquiler ?? 0} size="sm" />
                  </span>
                  <span className={styles.montoLinea} data-testid="cobro-modal-mora">
                    {calculo.diasMora > 0 ? `Mora · ${calculo.diasMora === 1 ? '1 día' : `${calculo.diasMora} días`}` : 'Sin mora'}
                    <MoneyAmount amount={calculo.mora} size="sm" />
                  </span>
                  <span className={`${styles.montoLinea} ${styles.montoTotal}`}>
                    A registrar <MoneyAmount amount={calculo.total} emphasis data-testid="cobro-modal-total" />
                  </span>
                </div>
              )}

              {errorEnvio && <Alert type="error" showIcon title={errorEnvio} data-testid="cobro-modal-error" />}
            </Form>
          )}
        </div>
      </Modal>

      <ConfirmActionModal
        open={confirmando}
        title="¿Registrar este cobro?"
        description={calculo ? `Vas a registrar ${formatARS(calculo.total)}. El período queda pagado y se emite el comprobante.` : undefined}
        confirmLabel="Registrar cobro"
        cancelLabel="Volver"
        confirmLoading={enviando}
        onConfirm={() => void confirmar()}
        onCancel={() => setConfirmando(false)}
      />
    </>
  )
}
