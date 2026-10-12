'use client'

/**
 * AltaPropiedad.tsx — `/panel/propiedades/nueva`, US-01 Registrar mis
 * propiedades.
 *
 * Qué hace (Claude Design, "Alta de propiedad" · 01-10): un `WizardLayout`
 * de 5 pasos (tipo y ubicación, características, fotos, condiciones y
 * revisión). Cada paso se valida al tocar "Siguiente": si falta algo, arriba
 * del paso aparece "Faltan N datos para seguir" con un link a cada campo, el
 * paso se marca en rojo en el Steps y el foco salta al primero (· 06).
 * Después: publicando (· 07), error con "Intentar de nuevo" (· 07) o éxito
 * con el próximo paso (· 08).
 *
 * Quién puede publicar: cualquier usuario con sesión (regla del equipo,
 * 27/09/2026). Al publicar la primera propiedad, el back le suma el rol
 * locador a la cuenta. Por eso, después del 201 se releen los roles
 * (`useAuth().refrescarUsuario('locador')`) sin cerrar sesión:
 * - Si ya es locador: queda locador como rol activo (aparecen "Viendo como"
 *   y Mis propiedades) y el éxito ofrece "Ir a mis propiedades" primero.
 * - Si la cuenta sigue sin el rol: el mismo éxito, sin "Ir a mis
 *   propiedades" (le daría la vuelta a /panel).
 * - Si el back responde 403: se avisa con `PUBLICAR_SIN_ROL_MESSAGE` y lo
 *   cargado queda en el formulario.
 * NOTA: desde el 29/09 (`develop` d88deca) el back ya no exige el rol y lo
 * asigna al crear la propiedad (probado en real). Los dos últimos casos
 * quedan como respaldo, por si el rol no se asigna o vuelve el 403.
 *
 * NOTA: no hay borradores. RentAR no tiene estado "Borrador" y el alta
 * tampoco guarda lo cargado en el navegador: los datos viven mientras la
 * pantalla está abierta (moverse entre pasos no pierde nada).
 *
 * De dónde saca los datos: `propiedades.service#registrarPropiedad`.
 * Quién lo usa: `app/(app)/panel/propiedades/nueva/page.tsx`.
 */
import { useState } from 'react'
import { Button, Form, Result } from 'antd'
import { useRouter } from 'next/navigation'
import { PageHeader, StatusTag, WizardLayout } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
import { altaValuesToPropiedadNueva, erroresDeFormulario, esErrorDeValidacion, type ErrorDeCampo } from '@/lib/alta/valores'
import { ALTA_VALORES_INICIALES, CAMPOS_POR_PASO, type AltaValues } from '@/lib/validation/propiedad.rules'
import { seVeEnBusqueda, tituloDePropiedadNueva } from '@/services/adapters/propiedad.adapter'
import { registrarPropiedad, type PropiedadRegistrada } from '@/services/propiedades.service'
import { ServiceError } from '@/services/shared/errors'
import { PasoCaracteristicas, PasoCondiciones, PasoFotos, PasoRevision, PasoUbicacion } from './PasosAlta'
import styles from './Alta.module.css'

/** Los 5 pasos del diseño. */
const PASOS = [
  { key: 'ubicacion', title: 'Tipo y ubicación' },
  { key: 'caracteristicas', title: 'Características' },
  { key: 'fotos', title: 'Fotos' },
  { key: 'condiciones', title: 'Condiciones' },
  { key: 'revision', title: 'Revisión' },
] as const

/**
 * Miga del encabezado. "Propiedades" solo para el locador: un locatario
 * todavía no tiene Mis propiedades (la gana al publicar la primera).
 */
const MIGA_LOCADOR = [
  { label: 'Mi panel', href: '/panel' },
  { label: 'Propiedades', href: '/panel/propiedades' },
  { label: 'Nueva' },
]
const MIGA_LOCATARIO = [{ label: 'Mi panel', href: '/panel' }, { label: 'Publicar propiedad' }]

/** En qué etapa está el alta. */
type Fase = 'formulario' | 'publicando' | 'error' | 'exito'

// ─── Pantalla ───────────────────────────────────────────────────────────

/** Alta de una propiedad del locador en sesión. */
export function AltaPropiedad() {
  const router = useRouter()
  const { activeRole, refrescarUsuario, logout } = useAuth()
  const [form] = Form.useForm<AltaValues>()
  const valores = (Form.useWatch([], form) as AltaValues | undefined) ?? ALTA_VALORES_INICIALES

  // ─── Estado local ───────────────────────────────────────────────────
  const [paso, setPaso] = useState(0)
  const [pasosConError, setPasosConError] = useState<Set<number>>(new Set())
  const [errores, setErrores] = useState<ErrorDeCampo[]>([])
  const [fase, setFase] = useState<Fase>('formulario')
  const [errorPublicacion, setErrorPublicacion] = useState<ServiceError | null>(null)
  const [registrada, setRegistrada] = useState<(PropiedadRegistrada & { resumen: string }) | null>(null)
  // Si la cuenta ya tiene el rol locador después de publicar (ver el encabezado).
  const [esLocador, setEsLocador] = useState(false)

  // ─── Navegación entre pasos ─────────────────────────────────────────

  /** Muestra el resumen de errores de un paso y lleva el foco al primer campo. */
  function mostrarErrores(pasoConError: number, lista: ErrorDeCampo[]): void {
    setPaso(pasoConError)
    setErrores(lista)
    setPasosConError((actual) => new Set(actual).add(pasoConError))
    const primero = lista[0]
    // Después del render (el paso puede haber cambiado de visible).
    if (primero) setTimeout(() => form.scrollToField(primero.name, { focus: true, block: 'center' }), 0)
  }

  /** Limpia el error de un paso que ya se completó bien. */
  function marcarPasoOk(pasoOk: number): void {
    setErrores([])
    setPasosConError((actual) => {
      const siguiente = new Set(actual)
      siguiente.delete(pasoOk)
      return siguiente
    })
  }

  async function irAPaso(destino: number): Promise<void> {
    if (destino < 0 || destino >= PASOS.length || fase === 'publicando') return
    // Hacia atrás no se valida: nunca se pierde lo cargado.
    if (destino < paso) {
      setErrores([])
      setPaso(destino)
      return
    }
    try {
      await form.validateFields(CAMPOS_POR_PASO[paso])
      marcarPasoOk(paso)
      setPaso(destino)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (esErrorDeValidacion(error)) mostrarErrores(paso, erroresDeFormulario(error.errorFields))
    }
  }

  // ─── Publicar ───────────────────────────────────────────────────────

  async function publicar(): Promise<void> {
    // Revalida todo: si algo quedó mal en un paso anterior, se vuelve ahí.
    let validos: AltaValues
    try {
      await form.validateFields()
      validos = form.getFieldsValue(true) as AltaValues
    } catch (error) {
      if (!esErrorDeValidacion(error)) return
      const lista = erroresDeFormulario(error.errorFields)
      const pasoConError = CAMPOS_POR_PASO.findIndex((campos) => campos.some((campo) => lista.some((item) => item.name === campo)))
      mostrarErrores(pasoConError >= 0 ? pasoConError : 0, lista.filter((item) => CAMPOS_POR_PASO[pasoConError]?.includes(item.name)))
      return
    }

    const nueva = altaValuesToPropiedadNueva(validos)
    setFase('publicando')
    setErrorPublicacion(null)
    try {
      const resultado = await registrarPropiedad(nueva)
      const barrio = neighborhoods.find((item) => item.slug === nueva.neighborhoodSlug)?.name ?? ''
      setEsLocador(await rolLocadorDespuesDePublicar())
      setRegistrada({ ...resultado, resumen: `${tituloDePropiedadNueva(nueva)} en ${barrio}` })
      setFase('exito')
      window.scrollTo({ top: 0 })
    } catch (error) {
      setErrorPublicacion(error instanceof ServiceError ? error : new ServiceError('server', 'Ocurrió un error inesperado.'))
      setFase('error')
    }
  }

  /**
   * Relee los roles después del 201 y devuelve si la cuenta ya es locadora.
   * NOTA: la propiedad ya se creó; si releer falla (sin red, back caído), no
   * es un error del alta: se muestra el éxito con lo que se sabía antes.
   */
  async function rolLocadorDespuesDePublicar(): Promise<boolean> {
    try {
      const usuario = await refrescarUsuario('locador')
      return usuario?.roles.includes('locador') ?? false
    } catch {
      return activeRole === 'locador'
    }
  }

  /**
   * 401 al publicar (US-01: "se debe haber iniciado sesión"): vuelve a pedir el
   * login y retoma en el alta (`/login?next=/panel/propiedades/nueva`).
   * NOTA: primero se cierra la sesión que quedó en memoria (`logout({ quedarse:
   * true })`): si no, `/login` todavía ve al usuario y lo devuelve al alta sin
   * pedirle nada (mismo arreglo que el modal "Solicitar alquiler", US-35).
   */
  function ingresarDeNuevo(): void {
    logout({ quedarse: true })
    router.push(`/login?next=${encodeURIComponent('/panel/propiedades/nueva')}`)
  }

  function publicarOtra(): void {
    form.resetFields()
    setPaso(0)
    setPasosConError(new Set())
    setErrores([])
    setRegistrada(null)
    setFase('formulario')
  }

  // ─── Éxito (· 08) ───────────────────────────────────────────────────
  if (fase === 'exito' && registrada) {
    const publicada = registrada.status === 'publicada'
    const alquiladaPublicada = registrada.status === 'alquilada_publicada'
    const seVe = publicada || alquiladaPublicada
    return (
      <div className={styles.page}>
        <Result
          className={styles.result}
          icon={
            <span className={styles.resultIcon} aria-hidden="true">
              ✓
            </span>
          }
          title={publicada ? 'Tu propiedad ya está publicada' : alquiladaPublicada ? 'Tu propiedad quedó publicada para el próximo inquilino' : 'Tu propiedad quedó guardada'}
          subTitle={
            publicada
              ? `${registrada.resumen}. Desde ahora aparece en la búsqueda y puede recibir solicitudes.`
              : alquiladaPublicada
                ? `${registrada.resumen} quedó alquilada, y como cargaste la fecha de disponibilidad aparece en la búsqueda como "Disponible desde".`
                : `${registrada.resumen} quedó guardada como ${registrada.status} y no aparece en la búsqueda.`
          }
          extra={
            <div className={styles.resultBody}>
              <StatusTag domain="propiedad" status={registrada.status} />
              <div className={styles.resultActions}>
                {/* Con el rol locador, "Ir a mis propiedades" va primero. Sin el rol
                    (respaldo: el back lo asigna al publicar desde d88deca), no se
                    ofrece: Mis propiedades es solo para locadores. */}
                {esLocador && (
                  <Button type="primary" size="large" onClick={() => router.push('/panel/propiedades')} data-testid="alta-exito-mis-propiedades">
                    Ir a mis propiedades
                  </Button>
                )}
                {seVe && (
                  <Button type={esLocador ? 'default' : 'primary'} size="large" onClick={() => router.push(`/propiedad/${registrada.id}`)} data-testid="alta-exito-ver">
                    Ver la publicación
                  </Button>
                )}
                {!esLocador && !seVe && (
                  <Button type="primary" size="large" onClick={() => router.push('/panel')} data-testid="alta-exito-panel">
                    Ir a mi panel
                  </Button>
                )}
                <Button size="large" onClick={publicarOtra} data-testid="alta-exito-otra">
                  Publicar otra
                </Button>
              </div>
              <div className={styles.nextBox}>
                <span className={styles.nextTitle}>Lo que sigue</span>
                <span className={styles.nextText}>
                  {seVe
                    ? 'Cuando alguien la solicite, la vas a ver en Solicitudes. Desde ahí se arma el contrato con estos mismos datos.'
                    : esLocador
                      ? 'La vas a encontrar en Mis propiedades con su estado. Cuando quieras que se vea en la búsqueda, la publicás desde su detalle.'
                      : 'Quedó guardada con su estado. Cuando quieras que se vea en la búsqueda, la vas a poder publicar desde Mis propiedades.'}
                </span>
              </div>
            </div>
          }
          data-testid="alta-exito"
        />
      </div>
    )
  }

  // ─── Contenido de los pasos ─────────────────────────────────────────
  const publicando = fase === 'publicando'
  // Publicada, o alquilada con fecha de disponibilidad: las dos se ven en la búsqueda.
  const publicada = valores.status ? seVeEnBusqueda({ status: valores.status, availableFrom: valores.availableFrom ?? null }) : false

  const formulario = (
    <Form<AltaValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={ALTA_VALORES_INICIALES}
      onValuesChange={(cambios: Partial<AltaValues>) => {
        // Monoambiente: 1 ambiente y sin dormitorios aparte (US-01).
        if (cambios.type === 'monoambiente') form.setFieldsValue({ rooms: 1, bedrooms: 0 })
        else if (cambios.type && form.getFieldValue('rooms') === 1) form.setFieldsValue({ rooms: 2, bedrooms: 1 })
        // Un dato corregido sale del resumen de errores (el resto se revalida con "Siguiente").
        setErrores((actual) => actual.filter((error) => !(error.name in cambios)))
      }}
      disabled={publicando}
      className={styles.form}
      data-testid="alta-form"
    >
      {errores.length > 0 && (
        <div className={styles.errorSummary} role="alert" data-testid="alta-errores">
          <span className={styles.errorSummaryIcon} aria-hidden="true">
            !
          </span>
          <div className={styles.errorSummaryBody}>
            <span className={styles.errorSummaryTitle}>
              {errores.length === 1 ? 'Falta 1 dato para seguir' : `Faltan ${errores.length} datos para seguir`}
            </span>
            <ul className={styles.errorSummaryList}>
              {errores.map((error) => (
                <li key={error.name}>
                  <button type="button" className={styles.errorSummaryLink} onClick={() => form.scrollToField(error.name, { focus: true, block: 'center' })}>
                    {error.label}
                  </button>{' '}
                  — {error.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* Los 5 pasos quedan montados; se ve solo el actual. */}
      <div hidden={paso !== 0}>
        <PasoUbicacion />
      </div>
      <div hidden={paso !== 1}>
        <PasoCaracteristicas />
      </div>
      <div hidden={paso !== 2}>
        <PasoFotos />
      </div>
      <div hidden={paso !== 3}>
        <PasoCondiciones />
      </div>
      <div hidden={paso !== 4}>
        {publicando && (
          <div className={styles.publishing} role="status" data-testid="alta-publicando">
            <span className={styles.spinner} aria-hidden="true" />
            {publicada ? 'Publicando tu propiedad… no cierres esta pantalla.' : 'Guardando tu propiedad… no cierres esta pantalla.'}
          </div>
        )}
        {fase === 'error' && errorPublicacion && (
          <div className={styles.publishError} role="alert" data-testid="alta-error-publicar">
            <span className={styles.publishErrorTitle}>{publicada ? 'No pudimos publicarla' : 'No pudimos guardarla'}</span>
            <span className={styles.publishErrorText}>
              {errorPublicacion.message}{' '}
              {errorPublicacion.code !== 'unauthorized'
                ? 'Tus datos siguen acá: no perdiste nada.'
                : // Los datos del alta viven solo en memoria: al ir al login se pierden, y se avisa antes.
                  form.isFieldsTouched()
                  ? 'Al ingresar de nuevo, los datos que cargaste se pierden y el alta vuelve a empezar.'
                  : ''}
            </span>
            <div className={styles.publishErrorActions}>
              {errorPublicacion.code === 'unauthorized' ? (
                <Button type="primary" onClick={ingresarDeNuevo} data-testid="alta-error-login">
                  Iniciar sesión
                </Button>
              ) : (
                <Button type="primary" onClick={() => void publicar()} data-testid="alta-reintentar">
                  Intentar de nuevo
                </Button>
              )}
            </div>
          </div>
        )}
        <PasoRevision valores={valores} onEditar={(destino) => void irAPaso(destino)} />
      </div>
    </Form>
  )

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <PageHeader title="Publicar una propiedad" subtitle={`Paso ${paso + 1} de ${PASOS.length} · ${PASOS[paso].title}.`} breadcrumb={activeRole === 'locador' ? MIGA_LOCADOR : MIGA_LOCATARIO} />
      </div>

      <div className={styles.wizardCard}>
        <WizardLayout
          steps={PASOS.map((item, index) => ({
            key: item.key,
            title: item.title,
            // El mismo formulario en todos los pasos: así no se desmonta al cambiar.
            content: index === paso ? formulario : null,
            status: pasosConError.has(index) ? 'error' : undefined,
          }))}
          currentStep={paso}
          onStepChange={(destino) => void irAPaso(destino)}
          onFinish={() => void publicar()}
          finishLabel={publicada ? 'Publicar la propiedad' : 'Guardar la propiedad'}
          navigableSteps
          loading={publicando}
          data-testid="alta-wizard"
        />
      </div>
    </div>
  )
}
