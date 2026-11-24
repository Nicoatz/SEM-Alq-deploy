'use client'

/**
 * NuevoReclamo.tsx — `/panel/reclamos/nuevo`, el registro de un reclamo (US-14).
 *
 * Cubre US-14 Registrar reclamo:
 * - "Se debe haber iniciado sesión como locatario" (la página va con `RequireRole`).
 * - "Se debe seleccionar una propiedad con la que se posea un contrato vigente":
 *   el selector solo ofrece esas; si hay una sola, viene elegida. También
 *   `?propiedad=<id>` (desde Mi alquiler) la deja elegida.
 * - "Se debe seleccionar un tipo de reclamo": cinco tarjetas.
 * - "mensaje … de mínimo 50 caracteres y máximo 5000": contador "172 / 5000";
 *   debajo del mínimo, el error dice cuántos faltan. No se recorta (decisión del PO).
 * - "hasta 10 imágenes en formato JPG/PNG que no excedan los 350kb cada una":
 *   `FotosReclamoField`.
 * Al registrar, el reclamo queda "abierto" y se vuelve al listado.
 *
 * Qué muestra (Claude Design, "Reclamos" · 01, 02 móvil y 05): las cuatro
 * secciones, el pie "Al enviarlo, <locador> recibe el aviso y el reclamo queda
 * abierto." con Volver y Registrar reclamo, y el error "No pudimos registrar el
 * reclamo" con Reintentar (lo escrito y las fotos se conservan).
 *
 * De dónde saca los datos: `getPropiedadesParaReclamo`, `getTiposReclamo` y
 * `registrarReclamo` (`services/reclamos.service.ts`).
 * Quién lo usa: `app/(app)/panel/reclamos/nuevo/page.tsx`.
 */
import { useState } from 'react'
import { Alert, Button, Input, Select, Skeleton } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { EmptyState, FormSection, PageHeader } from '@rentar/ui'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import type { PropiedadParaReclamo, TipoReclamoVista } from '@/lib/reclamos/tipos'
import { errorDeMensaje, largoMensaje, MENSAJES_RECLAMO, RECLAMO_MENSAJE_MAX, RECLAMO_MENSAJE_MIN } from '@/lib/validation/reclamo.rules'
import { getPropiedadesParaReclamo, getTiposReclamo, registrarReclamo } from '@/services/reclamos.service'
import { ServiceError } from '@/services/shared/errors'
import { FotoPropiedadReclamo } from './FotoPropiedadReclamo'
import { FotosReclamoField, type FotoCargada } from './FotosReclamoField'
import styles from './NuevoReclamo.module.css'

/** Lo que necesita el formulario antes de mostrarse: las propiedades y el catálogo. */
interface DatosFormulario {
  propiedades: PropiedadParaReclamo[]
  tipos: TipoReclamoVista[]
}

/** Pide las propiedades con contrato vigente y los tipos, juntos. */
async function cargarDatos(): Promise<DatosFormulario> {
  const [propiedades, tipos] = await Promise.all([getPropiedadesParaReclamo(), getTiposReclamo()])
  return { propiedades, tipos }
}

/** Errores de cada campo, después de tocar "Registrar reclamo". */
interface ErroresCampos {
  propiedad?: string
  tipo?: string
  mensaje?: string
}

/** Valida lo que pide US-14 antes de mandar. */
function validar(propiedadId: string | null, tipoId: number | null, mensaje: string): ErroresCampos {
  return {
    propiedad: propiedadId ? undefined : MENSAJES_RECLAMO.propiedad,
    tipo: tipoId ? undefined : MENSAJES_RECLAMO.tipo,
    mensaje: errorDeMensaje(mensaje) ?? undefined,
  }
}

/** "Contrato vigente con Nicolás Arrieta · CT-2026-0148". */
function lineaContrato(propiedad: PropiedadParaReclamo): string {
  return [`Contrato vigente con ${propiedad.locadorNombre}`, propiedad.contratoCodigo].filter(Boolean).join(' · ')
}

/** Formulario de registro, con los datos ya cargados. */
function Formulario({ datos }: { datos: DatosFormulario }) {
  const router = useRouter()
  const parametros = useSearchParams()

  // ─── Estado local ───────────────────────────────────────────────────
  const [propiedadId, setPropiedadId] = useState<string | null>(() => {
    const pedida = parametros.get('propiedad')
    if (pedida && datos.propiedades.some((item) => item.id === pedida)) return pedida
    // US-14 (prompt de la Tanda A): si hay una sola, viene elegida.
    return datos.propiedades.length === 1 ? (datos.propiedades[0]?.id ?? null) : null
  })
  const [tipoId, setTipoId] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [fotos, setFotos] = useState<FotoCargada[]>([])
  const [errores, setErrores] = useState<ErroresCampos>({})
  const [intentado, setIntentado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const propiedad = datos.propiedades.find((item) => item.id === propiedadId) ?? null
  const largo = largoMensaje(mensaje)

  // ─── Handlers ───────────────────────────────────────────────────────

  /** Revalida en vivo después del primer intento, así el error se va al corregir. */
  function actualizar(cambios: { propiedad?: string | null; tipo?: number | null; mensaje?: string }): void {
    const nuevaPropiedad = cambios.propiedad !== undefined ? cambios.propiedad : propiedadId
    const nuevoTipo = cambios.tipo !== undefined ? cambios.tipo : tipoId
    const nuevoMensaje = cambios.mensaje ?? mensaje
    if (cambios.propiedad !== undefined) setPropiedadId(cambios.propiedad)
    if (cambios.tipo !== undefined) setTipoId(cambios.tipo)
    if (cambios.mensaje !== undefined) setMensaje(cambios.mensaje)
    if (intentado) setErrores(validar(nuevaPropiedad, nuevoTipo, nuevoMensaje))
  }

  async function registrar(): Promise<void> {
    setIntentado(true)
    const encontrados = validar(propiedadId, tipoId, mensaje)
    setErrores(encontrados)
    if (encontrados.propiedad || encontrados.tipo || encontrados.mensaje || !propiedadId || !tipoId) return

    setEnviando(true)
    setErrorEnvio(null)
    try {
      const registrado = await registrarReclamo({
        propiedadId,
        tipoId,
        mensaje,
        fotos: fotos.map((foto) => ({ src: foto.src, nombre: foto.nombre })),
      })
      // El listado muestra "Registraste el reclamo RCL-…" con `?registrado=`.
      // TODO: con la Tanda B, ir al detalle (`/panel/reclamos/${registrado.id}`).
      router.push(`/panel/reclamos?registrado=${encodeURIComponent(registrado.codigo)}`)
    } catch (error) {
      const texto = error instanceof ServiceError ? error.message : 'No pudimos registrar el reclamo. Probá de nuevo en unos minutos.'
      // Un error de un campo (el back rechazó algo que el front dejó pasar) va en el aviso general igual.
      setErrorEnvio(texto)
      setEnviando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const opcionesPropiedad = datos.propiedades.map((item) => ({
    value: item.id,
    label: (
      <span className={styles.opcionPropiedad}>
        <FotoPropiedadReclamo src={item.fotoSrc} tamanio="sm" />
        <span className={styles.opcionTextos}>
          <span className={styles.opcionDireccion}>{item.direccion}</span>
          <span className={styles.opcionContrato}>{lineaContrato(item)}</span>
        </span>
      </span>
    ),
    // Texto para el lector de pantalla y para buscar.
    title: item.direccion,
  }))

  return (
    <div className={styles.form} data-testid="reclamo-nuevo-form">
      <FormSection title="¿Sobre qué propiedad?" description="Solo aparecen las propiedades que alquilás con un contrato vigente.">
        <Select
          className={styles.selectPropiedad}
          value={propiedadId ?? undefined}
          placeholder="Elegí la propiedad"
          options={opcionesPropiedad}
          onChange={(valor: string) => actualizar({ propiedad: valor })}
          status={errores.propiedad ? 'error' : undefined}
          disabled={enviando}
          aria-label="Propiedad del reclamo"
          data-testid="reclamo-nuevo-propiedad"
        />
        {errores.propiedad && (
          <span className={styles.error} role="alert" data-testid="reclamo-nuevo-propiedad-error">
            {errores.propiedad}
          </span>
        )}
      </FormSection>

      <FormSection title="Tipo de reclamo" description="Elegí el que más se acerque. Es obligatorio.">
        <div className={styles.tipos} role="radiogroup" aria-label="Tipo de reclamo">
          {datos.tipos.map((tipo) => {
            const elegido = tipo.id === tipoId
            return (
              <button
                key={tipo.id}
                type="button"
                role="radio"
                aria-checked={elegido}
                className={`${styles.tipo} ${elegido ? styles.tipoElegido : ''}`}
                onClick={() => actualizar({ tipo: tipo.id })}
                disabled={enviando}
                data-testid={`reclamo-nuevo-tipo-${tipo.nombre}`}
              >
                <span className={styles.tipoNombre}>{tipo.label}</span>
                {tipo.ayuda && <span className={styles.tipoAyuda}>{tipo.ayuda}</span>}
              </button>
            )
          })}
        </div>
        {errores.tipo && (
          <span className={styles.error} role="alert" data-testid="reclamo-nuevo-tipo-error">
            {errores.tipo}
          </span>
        )}
      </FormSection>

      <FormSection title="Mensaje" description="Contá qué pasa, desde cuándo y qué probaste. Lo lee el locador tal cual.">
        <Input.TextArea
          value={mensaje}
          onChange={(evento) => actualizar({ mensaje: evento.target.value })}
          autoSize={{ minRows: 4, maxRows: 14 }}
          placeholder="Contá qué pasa, desde cuándo y qué probaste…"
          status={errores.mensaje ? 'error' : undefined}
          disabled={enviando}
          aria-label="Mensaje del reclamo"
          aria-invalid={Boolean(errores.mensaje)}
          data-testid="reclamo-nuevo-mensaje"
        />
        <span className={styles.contadorFila}>
          {errores.mensaje ? (
            <span className={styles.error} role="alert" data-testid="reclamo-nuevo-mensaje-error">
              {errores.mensaje}
            </span>
          ) : (
            <span className={styles.ayuda}>
              Entre {RECLAMO_MENSAJE_MIN} y {RECLAMO_MENSAJE_MAX} caracteres.
            </span>
          )}
          <span className={`${styles.contador} ${largo > RECLAMO_MENSAJE_MAX ? styles.contadorExcedido : ''}`} data-testid="reclamo-nuevo-mensaje-contador">
            {largo} / {RECLAMO_MENSAJE_MAX}
          </span>
        </span>
      </FormSection>

      <FormSection title="Fotos" description="Opcionales. Ayudan al locador a entender el problema sin ir a verlo.">
        <FotosReclamoField value={fotos} onChange={setFotos} disabled={enviando} />
      </FormSection>

      {errorEnvio && (
        <Alert
          type="error"
          title="No pudimos registrar el reclamo"
          description={`${errorEnvio} Guardamos lo que escribiste y las fotos.`}
          action={
            <Button type="primary" onClick={() => void registrar()} data-testid="reclamo-nuevo-reintentar">
              Reintentar
            </Button>
          }
          data-testid="reclamo-nuevo-error"
        />
      )}

      <div className={styles.pie}>
        <span className={styles.pieTexto}>
          Al enviarlo, {propiedad ? <strong>{propiedad.locadorNombre.split(' ')[0]}</strong> : 'tu locador'} recibe el aviso y el reclamo queda <strong>abierto</strong>.
        </span>
        <span className={styles.pieBotones}>
          <Button onClick={() => router.push('/panel/reclamos')} disabled={enviando} data-testid="reclamo-nuevo-volver">
            Volver
          </Button>
          <Button type="primary" onClick={() => void registrar()} loading={enviando} data-testid="reclamo-nuevo-submit">
            Registrar reclamo
          </Button>
        </span>
      </div>
    </div>
  )
}

/** Registro de un reclamo: carga, error, sin propiedades o el formulario. */
export function NuevoReclamo() {
  const router = useRouter()
  const carga = useServiceCall(cargarDatos)

  return (
    <div className={styles.page} data-testid="reclamo-nuevo-page">
      <PageHeader title="Registrar reclamo" breadcrumb={[{ label: 'Mi panel', href: '/panel' }, { label: 'Mis reclamos', href: '/panel/reclamos' }, { label: 'Registrar reclamo' }]} />

      {carga.status === 'cargando' && (
        <div className={styles.form} data-testid="reclamo-nuevo-cargando">
          <Skeleton active paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      )}

      {carga.status === 'error' && (
        <Alert
          type="error"
          showIcon
          title="No pudimos preparar el formulario"
          description={carga.message}
          action={
            <Button onClick={carga.reintentar} data-testid="reclamo-nuevo-cargar-reintentar">
              Reintentar
            </Button>
          }
          data-testid="reclamo-nuevo-cargar-error"
        />
      )}

      {carga.status === 'listo' && carga.data.propiedades.length === 0 && (
        <div className={styles.vacio} data-testid="reclamo-nuevo-sin-propiedades">
          <EmptyState
            title="No tenés un alquiler vigente"
            description="Los reclamos se registran sobre una propiedad que alquilás con un contrato vigente. Cuando tengas uno, lo vas a poder elegir acá."
            action={
              <Button onClick={() => router.push('/panel/reclamos')} data-testid="reclamo-nuevo-sin-propiedades-volver">
                Volver a mis reclamos
              </Button>
            }
          />
        </div>
      )}

      {carga.status === 'listo' && carga.data.propiedades.length > 0 && <Formulario datos={carga.data} />}
    </div>
  )
}
