'use client'

/**
 * EditarPropiedad.tsx — `/panel/propiedades/[id]/editar`, US-03 Modificar
 * mis propiedades (numeración de Jira).
 *
 * Qué hace (Claude Design, "Detalle de propiedad del locador" · 06): los
 * pasos del alta, todos a la vez, en una sola página ("editar es corregir un
 * dato suelto"), con índice lateral de secciones, una barra de guardado fija
 * abajo con "Cambios sin guardar: N", y las mismas validaciones del alta
 * (`lib/validation/propiedad.rules.ts`), que corren al guardar.
 * - Reutiliza `PasoUbicacion`, `PasoCaracteristicas`, `PasoFotos` y
 *   `PasoCondiciones` del alta (y con ellos `CamposAlta` y `FotosField`).
 * - Con contrato vigente, el precio, el índice y la frecuencia de ajuste
 *   quedan bloqueados ("Lo fija el contrato"), y el estado queda en
 *   "Alquilada".
 * - Si se sale con cambios sin guardar, se pregunta antes: con los botones
 *   de la pantalla, con cualquier link interno y al cerrar o recargar la
 *   pestaña (`beforeunload`).
 * NOTA: el diseño marca cada campo cambiado con "Modificado · antes …"; no
 * va (decisión del PO: alcanza con el contador).
 * NOTA: US-03 no tiene criterios escritos todavía: se usó el diseño como
 * criterio (decisión del PO, como con US-41).
 *
 * De dónde saca los datos: `getMiPropiedad` y `actualizarPropiedad`.
 * Quién lo usa: `app/(app)/panel/propiedades/[id]/editar/page.tsx`.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, Button, Form, Skeleton } from 'antd'
import type { PropiedadLocadorDetalle } from '@rentar/shared-types'
import { ConfirmActionModal, EmptyState, PageHeader } from '@rentar/ui'
import { contarCambios, erroresDeFormulario, esErrorDeValidacion, altaValuesToPropiedadNueva, propiedadNuevaToAltaValues, type ErrorDeCampo } from '@/lib/alta/valores'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import type { AltaValues } from '@/lib/validation/propiedad.rules'
import { PasoCaracteristicas, PasoCondiciones, PasoFotos, PasoUbicacion } from '@/components/alta/PasosAlta'
import { actualizarPropiedad, getMiPropiedad } from '@/services/propiedades.service'
import { ServiceError } from '@/services/shared/errors'
import styles from './EditarPropiedad.module.css'

/** Las secciones del formulario, con su ancla para el índice lateral (· 06). */
const SECCIONES = [
  { key: 'ubicacion', title: 'Tipo y ubicación' },
  { key: 'caracteristicas', title: 'Características' },
  { key: 'fotos', title: 'Fotos' },
  { key: 'condiciones', title: 'Condiciones' },
] as const

/** Props de {@link EditarPropiedad}. */
interface EditarPropiedadProps {
  id: string
}

/** Miga: Mi panel / Propiedades / <dirección> / Editar. */
function miga(id: string, direccion: string) {
  return [
    { label: 'Mi panel', href: '/panel' },
    { label: 'Propiedades', href: '/panel/propiedades' },
    { label: direccion, href: `/panel/propiedades/${encodeURIComponent(id)}` },
    { label: 'Editar' },
  ]
}

/** "1 cambio sin guardar" / "Cambios sin guardar: 3". */
function textoCambios(cantidad: number): string {
  return cantidad === 0 ? 'Sin cambios' : `Cambios sin guardar: ${cantidad}`
}

// ─── Aviso al salir ─────────────────────────────────────────────────────

/**
 * Mientras haya cambios sin guardar, frena la salida y pide confirmar:
 * - al cerrar o recargar la pestaña (`beforeunload`, el diálogo del navegador);
 * - al tocar cualquier link interno (el router de Next no tiene un "antes de
 *   salir"): se intercepta el click y se guarda adónde iba.
 * Devuelve el destino pendiente y cómo seguir o quedarse.
 */
function useAvisoSalida(conCambios: boolean) {
  const [destino, setDestino] = useState<string | null>(null)

  useEffect(() => {
    if (!conCambios) return
    function antesDeSalir(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    function alHacerClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
      const link = (event.target as Element | null)?.closest('a[href]')
      const href = link?.getAttribute('href')
      // Solo links internos que cambian de pantalla (no anclas de la misma página).
      if (!href || !href.startsWith('/') || link?.getAttribute('target') === '_blank') return
      event.preventDefault()
      event.stopPropagation()
      setDestino(href)
    }
    window.addEventListener('beforeunload', antesDeSalir)
    document.addEventListener('click', alHacerClick, true)
    return () => {
      window.removeEventListener('beforeunload', antesDeSalir)
      document.removeEventListener('click', alHacerClick, true)
    }
  }, [conCambios])

  return { destino, pedirSalida: setDestino, quedarse: () => setDestino(null) }
}

// ─── Formulario ─────────────────────────────────────────────────────────

/** El formulario, montado con los datos ya cargados (así `initialValues` arranca con lo guardado). */
function FormularioEdicion({ detalle }: { detalle: PropiedadLocadorDetalle }) {
  const router = useRouter()
  const [form] = Form.useForm<AltaValues>()
  const valores = Form.useWatch([], form) as AltaValues | undefined
  const hrefDetalle = `/panel/propiedades/${encodeURIComponent(detalle.id)}`
  const contrato = detalle.activeContract?.id

  // ─── Estado local ───────────────────────────────────────────────────
  /** Lo guardado: contra esto se cuentan los cambios. Se actualiza al guardar. */
  const [original, setOriginal] = useState<AltaValues>(() => propiedadNuevaToAltaValues(detalle.values))
  const [errores, setErrores] = useState<ErrorDeCampo[]>([])
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<ServiceError | null>(null)
  const [guardado, setGuardado] = useState(false)

  const cambios = valores ? contarCambios(original, valores) : 0
  const salida = useAvisoSalida(cambios > 0 && !guardando)

  // ─── Handlers ───────────────────────────────────────────────────────
  async function guardar(): Promise<void> {
    let validos: AltaValues
    try {
      await form.validateFields()
      validos = form.getFieldsValue(true) as AltaValues
    } catch (error) {
      if (!esErrorDeValidacion(error)) return
      const lista = erroresDeFormulario(error.errorFields)
      setErrores(lista)
      const primero = lista[0]
      if (primero) form.scrollToField(primero.name, { focus: true, block: 'center' })
      return
    }

    setGuardando(true)
    setErrorGuardar(null)
    setGuardado(false)
    try {
      // La pantalla manda el formulario completo (decisión del PO).
      const actualizada = await actualizarPropiedad(detalle.id, altaValuesToPropiedadNueva(validos))
      const nuevos = propiedadNuevaToAltaValues(actualizada.values)
      form.setFieldsValue(nuevos)
      setOriginal(nuevos)
      setErrores([])
      setGuardado(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setErrorGuardar(error instanceof ServiceError ? error : new ServiceError('server', 'Ocurrió un error inesperado.'))
    } finally {
      setGuardando(false)
    }
  }

  /** "Descartar cambios": con cambios, pregunta antes; vuelve al detalle. */
  function descartar(): void {
    if (cambios > 0) salida.pedirSalida(hrefDetalle)
    else router.push(hrefDetalle)
  }

  function salirSinGuardar(): void {
    const destino = salida.destino
    // Se vuelve a lo guardado antes de salir, así el aviso no se dispara de nuevo.
    form.setFieldsValue(original)
    salida.quedarse()
    if (destino) router.push(destino)
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const publicada = detalle.status === 'publicada' || detalle.status === 'alquilada_publicada'
  return (
    <div className={styles.page} data-testid="editar-propiedad">
      <PageHeader title="Editar publicación" subtitle={detalle.address} breadcrumb={miga(detalle.id, detalle.address)} />

      <Alert
        type={contrato ? 'warning' : 'info'}
        showIcon
        title={
          contrato
            ? `Alquilada · con el contrato ${contrato} vigente no se puede cambiar el precio ni el ajuste: eso lo fija el contrato.`
            : publicada
              ? 'Estás editando una propiedad publicada: los cambios se ven en la búsqueda al guardar.'
              : 'Esta propiedad no está publicada: los cambios no se ven en la búsqueda.'
        }
        data-testid="editar-propiedad-aviso"
      />

      {guardado && (
        <Alert
          type="success"
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setGuardado(false)}
          title="Guardamos los cambios."
          action={
            <Link href={hrefDetalle} className={styles.link}>
              Volver al detalle
            </Link>
          }
          data-testid="editar-propiedad-exito"
        />
      )}

      {errorGuardar && (
        <Alert
          type="error"
          showIcon
          title="No pudimos guardar los cambios"
          description={`${errorGuardar.message} Tus cambios siguen acá: no perdiste nada.`}
          data-testid="editar-propiedad-error"
        />
      )}

      <div className={styles.layout}>
        {/* Índice lateral (· 06). */}
        <nav className={styles.indice} aria-label="Secciones">
          <span className={styles.indiceTitulo}>Secciones</span>
          {SECCIONES.map((seccion) => (
            <a key={seccion.key} href={`#${seccion.key}`} className={styles.indiceLink} data-testid={`editar-propiedad-indice-${seccion.key}`}>
              {seccion.title}
            </a>
          ))}
        </nav>

        <Form<AltaValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={original}
          onValuesChange={(cambiados: Partial<AltaValues>) => {
            // Monoambiente: 1 ambiente y sin dormitorios aparte (US-01, igual que en el alta).
            if (cambiados.type === 'monoambiente') form.setFieldsValue({ rooms: 1, bedrooms: 0 })
            else if (cambiados.type && form.getFieldValue('rooms') === 1) form.setFieldsValue({ rooms: 2, bedrooms: 1 })
            setErrores((actual) => actual.filter((error) => !(error.name in cambiados)))
          }}
          disabled={guardando}
          className={styles.form}
        >
          {errores.length > 0 && (
            <div className={styles.errorSummary} role="alert" data-testid="editar-propiedad-errores">
              <span className={styles.errorSummaryTitle}>{errores.length === 1 ? 'Falta 1 dato para guardar' : `Faltan ${errores.length} datos para guardar`}</span>
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
          <section id="ubicacion" className={styles.seccion}>
            <PasoUbicacion />
          </section>
          <section id="caracteristicas" className={styles.seccion}>
            <PasoCaracteristicas estadoFijadoPorContrato={contrato} />
          </section>
          <section id="fotos" className={styles.seccion}>
            {/* El mínimo de 3 fotos se pide solo si se cambian las fotos (ver `reglasFotosEdicion`). */}
            <PasoFotos fotosOriginales={original.photos} />
          </section>
          <section id="condiciones" className={styles.seccion}>
            <PasoCondiciones fijadosPorContrato={contrato} />
          </section>
        </Form>
      </div>

      {/* Barra de guardado fija (· 06). */}
      <div className={styles.barra}>
        <span className={styles.barraTexto} data-testid="editar-propiedad-cambios">
          {textoCambios(cambios)}
        </span>
        <div className={styles.barraAcciones}>
          <Button size="large" onClick={descartar} disabled={guardando} data-testid="editar-propiedad-descartar">
            Descartar cambios
          </Button>
          <Button type="primary" size="large" onClick={() => void guardar()} loading={guardando} disabled={cambios === 0} data-testid="editar-propiedad-guardar">
            Guardar cambios
          </Button>
        </div>
      </div>

      <ConfirmActionModal
        open={salida.destino !== null}
        title="¿Descartar los cambios sin guardar?"
        description={`Tenés ${cambios === 1 ? '1 cambio' : `${cambios} cambios`} sin guardar. Si salís, se pierden.`}
        confirmLabel="Descartar y salir"
        cancelLabel="Seguir editando"
        onConfirm={salirSinGuardar}
        onCancel={salida.quedarse}
        data-testid="editar-propiedad-salir-modal"
      />
    </div>
  )
}

// ─── Pantalla ───────────────────────────────────────────────────────────

/** Edición de una propiedad del locador en sesión. */
export function EditarPropiedad({ id }: EditarPropiedadProps) {
  const router = useRouter()
  const pedir = useCallback(() => getMiPropiedad(id), [id])
  const carga = useServiceCall(pedir)

  if (carga.status === 'cargando') {
    return (
      <div className={styles.page} data-testid="editar-propiedad-cargando">
        <Skeleton active paragraph={{ rows: 2 }} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }
  if (carga.status === 'error') {
    if (carga.code === 'not_found') {
      return (
        <div className={styles.emptyBlock} data-testid="editar-propiedad-no-encontrada">
          <EmptyState
            title="No encontramos esta propiedad"
            description="Puede que la hayas eliminado o que el link sea de otra cuenta."
            action={
              <Button type="primary" onClick={() => router.push('/panel/propiedades')}>
                Ir a mis propiedades
              </Button>
            }
          />
        </div>
      )
    }
    return (
      <div className={styles.errorBlock} role="alert" data-testid="editar-propiedad-error-carga">
        <span className={styles.errorTitle}>No pudimos traer esta propiedad</span>
        <span className={styles.errorText}>{carga.code === 'network' ? 'Revisá tu conexión y probá de nuevo.' : carga.message}</span>
        <Button type="primary" onClick={carga.reintentar}>
          Reintentar
        </Button>
      </div>
    )
  }
  return <FormularioEdicion detalle={carga.data} />
}
