'use client'

/**
 * SolicitarAlquilerModal.tsx — el modal "Solicitar alquiler": el formulario
 * de la solicitud (`FormularioSolicitud`) y, después, la pantalla de éxito.
 *
 * Diseño: Claude Design, "Flujo de solicitudes" · 01 (modal y "Enviada ·
 * confirmación") y · 05 (en móvil, pantalla completa con las acciones fijas
 * al pie).
 * Cubre: US-35 Enviar solicitud de alquiler, versión actualizada en
 * `develop` (80dfb8b), numeración de Jira: datos del locatario, ocupación,
 * ingresos, convivientes, mascotas, garantías, mensaje de hasta 600,
 * aceptación obligatoria y cuántas pendientes tiene en otras propiedades.
 * Reemplaza la versión de la tanda 1 ("sin legajo, 1000 caracteres").
 * Datos: `solicitudes.service#enviarSolicitud` y
 * `#contarMisSolicitudesPendientes`; los datos precargados, de la sesión.
 * Quién lo usa: `DetallePropiedad`.
 *
 * NOTA: las validaciones son reglas de antd `Form` (ver
 * `lib/validation/solicitud.rules.ts`); al tocar "Enviar", si algo falta,
 * arriba de las acciones aparece el resumen con un link a cada campo.
 * NOTA: el mail al locador lo manda el back (TODO(backend) en el service);
 * acá solo se avisa que se mandó.
 */
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Form, Modal } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import type { PropiedadDetalle } from '@rentar/shared-types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { hrefBuscarEnBarrio } from '@/lib/search/busquedaParams'
import { aSolicitudNueva, valoresIniciales, type ValoresSolicitud } from '@/lib/solicitudes/formulario'
import { contarMisSolicitudesPendientes, enviarSolicitud } from '@/services/solicitudes.service'
import { ServiceError } from '@/services/shared/errors'
import { hrefLoginParaSolicitar } from './estadoAccion'
import { FormularioSolicitud } from './FormularioSolicitud'
import styles from './SolicitarAlquilerModal.module.css'

// ─── Tipos ──────────────────────────────────────────────────────────────

/**
 * En qué parte del flujo está el modal:
 * - `formulario`: escribiendo (con un error opcional arriba de las acciones).
 * - `exito`: se envió (Flujo · 01, "Enviada · confirmación").
 * - `duplicada`: el back respondió 409 (ya la había solicitado).
 * - `sesion_vencida`: 401 con un mensaje escrito (se avisa que se pierde).
 */
type Fase =
  | { tipo: 'formulario'; error: string | null }
  | { tipo: 'exito' }
  | { tipo: 'duplicada' }
  | { tipo: 'sesion_vencida' }

/** Props de {@link SolicitarAlquilerModal}. */
interface SolicitarAlquilerModalProps {
  open: boolean
  propiedad: PropiedadDetalle
  /**
   * Se cerró el modal. `cambioElEstado` es `true` si ya existe una solicitud
   * (se envió o el back dijo que ya había una): el detalle vuelve a pedir
   * "mi solicitud" para mostrar su estado en el botón.
   */
  onClose: (cambioElEstado: boolean) => void
}

/** Nombre de cada campo, para el resumen de errores. */
const ETIQUETA: Record<string, string> = {
  telefono: 'Teléfono',
  email: 'Email',
  ingresos: 'Ingresos',
  convivientes: 'Personas a residir',
  detalleMascotas: 'Detalle de las mascotas',
  garantias: 'Garantías',
  mensaje: 'Mensaje',
  acepto: 'Confirmación',
}

/** Mis solicitudes. */
const HREF_MIS_SOLICITUDES = '/panel/mis-solicitudes'

/** Modal "Solicitar alquiler" (US-35). Se monta de cero cada vez que se abre. */
export function SolicitarAlquilerModal({ open, propiedad, onClose }: SolicitarAlquilerModalProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [form] = Form.useForm<ValoresSolicitud>()
  // Se calcula una sola vez (el modal se monta de cero cada vez que se abre).
  const [iniciales] = useState(() => valoresIniciales(user))
  const contarPendientes = useCallback(() => contarMisSolicitudesPendientes(propiedad.id), [propiedad.id])
  const pendientes = useServiceCall(contarPendientes)

  // ─── Estado local ───────────────────────────────────────────────────────
  const [enviando, setEnviando] = useState(false)
  const [fase, setFase] = useState<Fase>({ tipo: 'formulario', error: null })
  /** Campos con error al tocar "Enviar" (el resumen de arriba de las acciones). */
  const [errores, setErrores] = useState<{ name: string; label: string; message: string }[]>([])

  const nombreDueno = propiedad.owner?.fullName ?? null
  const primerNombre = nombreDueno?.split(' ')[0] ?? null
  const hrefLogin = hrefLoginParaSolicitar(propiedad.id)

  // ─── Handlers ───────────────────────────────────────────────────────────

  /**
   * 401: vuelve a ingresar y retoma acá (`/login?next=/propiedad/[id]?solicitar=1`).
   * NOTA: primero se cierra la sesión que quedó en memoria (`logout({ quedarse: true })`):
   * si no, `/login` todavía ve al usuario y lo devuelve a `next` sin pedirle nada.
   */
  const reingresar = () => {
    logout({ quedarse: true })
    router.push(hrefLogin)
  }

  const cerrar = () => {
    if (enviando) return
    onClose(fase.tipo === 'exito' || fase.tipo === 'duplicada')
  }

  const enviar = async () => {
    let valores: ValoresSolicitud
    try {
      valores = await form.validateFields()
      setErrores([])
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        const campos = (error as { errorFields: { name: (string | number)[]; errors: string[] }[] }).errorFields.filter((campo) => campo.errors.length > 0)
        setErrores(campos.map((campo) => ({ name: String(campo.name[0]), label: ETIQUETA[String(campo.name[0])] ?? String(campo.name[0]), message: campo.errors[0] ?? '' })))
        const primero = campos[0]
        if (primero) form.scrollToField(primero.name, { focus: true, block: 'center' })
      }
      return
    }
    setEnviando(true)
    setFase({ tipo: 'formulario', error: null })
    try {
      await enviarSolicitud(aSolicitudNueva(propiedad.id, valores))
      setFase({ tipo: 'exito' })
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'conflict') {
        // 409: no se cierra sin explicar qué pasó.
        setFase({ tipo: 'duplicada' })
      } else if (error instanceof ServiceError && error.code === 'unauthorized') {
        // 401: se vuelve a ingresar y se retoma acá (?solicitar=1). Si completó algo, primero se avisa.
        if (form.isFieldsTouched()) setFase({ tipo: 'sesion_vencida' })
        else reingresar()
      } else {
        const texto = error instanceof ServiceError ? error.message : 'No pudimos enviar la solicitud. Probá de nuevo en un momento.'
        setFase({ tipo: 'formulario', error: texto })
      }
    } finally {
      setEnviando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  const footer = (() => {
    switch (fase.tipo) {
      case 'exito':
        return (
          <div className={styles.footerStack}>
            <Button type="primary" size="large" block href={HREF_MIS_SOLICITUDES} className={styles.action} data-testid="solicitar-ver-solicitudes-button">
              Ver mis solicitudes
            </Button>
            <Button size="large" block href={hrefBuscarEnBarrio(propiedad.neighborhoodSlug)} className={styles.action} data-testid="solicitar-seguir-buscando-button">
              Seguir buscando
            </Button>
          </div>
        )
      case 'duplicada':
        return (
          <div className={styles.footerRow}>
            <Button size="large" onClick={cerrar} className={styles.action} data-testid="solicitar-cerrar-button">
              Cerrar
            </Button>
            <Button type="primary" size="large" href={HREF_MIS_SOLICITUDES} className={styles.action} data-testid="solicitar-ver-mi-solicitud-button">
              Ver mi solicitud
            </Button>
          </div>
        )
      case 'sesion_vencida':
        return (
          <div className={styles.footerRow}>
            <Button size="large" onClick={() => setFase({ tipo: 'formulario', error: null })} className={styles.action} data-testid="solicitar-volver-button">
              Volver a la solicitud
            </Button>
            <Button type="primary" size="large" onClick={reingresar} className={styles.action} data-testid="solicitar-reingresar-button">
              Ingresar de nuevo
            </Button>
          </div>
        )
      case 'formulario':
        return (
          <div className={styles.footerRow}>
            <Button size="large" onClick={cerrar} disabled={enviando} className={styles.action} data-testid="solicitar-cancelar-button">
              Cancelar
            </Button>
            <Button type="primary" size="large" onClick={enviar} loading={enviando} className={styles.action} data-testid="solicitar-enviar-button">
              Enviar solicitud
            </Button>
          </div>
        )
    }
  })()

  return (
    <Modal
      open={open}
      onCancel={cerrar}
      title={fase.tipo === 'exito' ? null : 'Solicitar alquiler'}
      footer={footer}
      width={560}
      centered
      destroyOnHidden
      mask={{ closable: !enviando }}
      keyboard={!enviando}
      className={styles.modal}
      classNames={{ container: styles.container, body: styles.body, footer: styles.footer }}
    >
      <div data-testid="solicitar-modal">
        {fase.tipo === 'exito' ? (
          // ─── Enviada · confirmación (Flujo · 01) ───
          <div className={styles.success} data-testid="solicitar-exito">
            <CheckCircleFilled className={styles.successIcon} aria-hidden="true" />
            <h2 className={styles.successTitle}>{primerNombre ? `Le mandamos tu solicitud a ${primerNombre}` : 'Le mandamos tu solicitud al dueño'}</h2>
            {/* US-35: el back le manda un mail al locador; acá solo se informa. */}
            <p className={styles.successText} data-testid="solicitar-exito-mail">
              {nombreDueno ? `Le avisamos por mail a ${nombreDueno}.` : 'Le avisamos por mail al dueño.'} Te avisamos cuando responda.
            </p>
            <p className={styles.successText}>Mientras tanto seguí mirando: podés tener varias solicitudes abiertas a la vez.</p>
          </div>
        ) : (
          <>
            {fase.tipo === 'duplicada' && (
              <Alert
                type="info"
                showIcon
                className={styles.alert}
                title="Ya habías enviado una solicitud para esta propiedad"
                description="Podés ver en qué estado está desde Mis solicitudes."
                data-testid="solicitar-duplicada"
              />
            )}

            {fase.tipo === 'sesion_vencida' && (
              <Alert
                type="warning"
                showIcon
                className={styles.alert}
                title="Tu sesión venció"
                description="Para enviarla tenés que ingresar de nuevo. Al volver se abre este formulario, pero lo que completaste se pierde: copiá el mensaje antes si lo querés conservar."
                data-testid="solicitar-sesion-vencida"
              />
            )}

            {/* El formulario queda montado en las otras fases (duplicada, sesión vencida), así no se pierde lo cargado. */}
            <div hidden={fase.tipo !== 'formulario'}>
              <Form<ValoresSolicitud> form={form} layout="vertical" requiredMark={false} initialValues={iniciales} onValuesChange={(cambios) => setErrores((actual) => actual.filter((error) => !(error.name in cambios)))} className={styles.form}>
                <FormularioSolicitud
                  propiedad={propiedad}
                  usuario={user}
                  nombreDueno={nombreDueno}
                  pendientesEnOtras={pendientes.status === 'listo' ? pendientes.data : null}
                  deshabilitado={enviando}
                />
              </Form>
            </div>

            {fase.tipo === 'formulario' && (
              <>
                {errores.length > 0 && (
                  <div className={styles.errorSummary} role="alert" data-testid="solicitar-errores">
                    <span className={styles.errorSummaryTitle}>{errores.length === 1 ? 'Falta 1 dato para enviar' : `Faltan ${errores.length} datos para enviar`}</span>
                    <ul className={styles.errorSummaryList}>
                      {errores.map((error) => (
                        <li key={error.name}>
                          <button type="button" className={styles.linkButton} onClick={() => form.scrollToField(error.name, { focus: true, block: 'center' })}>
                            {error.label}
                          </button>{' '}
                          — {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {fase.error && <Alert type="error" showIcon className={styles.alert} title={fase.error} data-testid="solicitar-error" />}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
