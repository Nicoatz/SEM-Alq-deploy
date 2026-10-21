'use client'

/**
 * DatosPersonalesBloque.tsx — el bloque "Datos personales" de "Mi perfil".
 *
 * Qué es: nombre, apellido, DNI, correo, teléfono (formato E.123) y fecha de
 * nacimiento (dd/mm/aaaa), en lectura y en edición. Lo que no está cargado
 * dice "Sin cargar", con "Completar" que abre la edición.
 * Cubre:
 * - US-20 Consultar usuario: los datos, los formatos y "Sin cargar".
 * - US-21 Modificar usuario: el bloque se edita y se guarda solo, con
 *   Guardar y Cancelar (Cancelar restaura lo guardado); nombre, apellido y
 *   DNI bloqueados con un contrato vigente o pendiente de firma, explicando
 *   el motivo; mensaje de éxito o de error en español. Al cambiar nombre o
 *   apellido, el UserMenu se actualiza (`refrescarUsuario`).
 * De dónde saca los datos: `PerfilUsuario` (lo pasa `PerfilScreen`); guarda
 * con `perfil.service#actualizarDatosPersonales`.
 * Quién lo usa: `PerfilScreen.tsx`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Alert, Button, DatePicker, Form, Input } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { DatosPersonalesCambios, PerfilUsuario } from '@rentar/shared-types'
import { DetailList } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { dniParaMostrar, fechaParaMostrar, telefonoParaMostrar } from '@/lib/perfil/formato'
import { hoy } from '@/lib/utils/fechas'
import { aE164, formatoTelefonoEnCampo, MENSAJES_SOLICITUD, telefonoParaPrecargar, telefonoValido } from '@/lib/validation/solicitud.rules'
import { esMayorDeEdad, MENSAJES, reglasDni, reglasNombrePerfil, soloDigitos } from '@/lib/validation/usuario.rules'
import { actualizarDatosPersonales } from '@/services/perfil.service'
import { ServiceError } from '@/services/shared/errors'
import { BloquePerfil } from './BloquePerfil'
import styles from './BloquesPerfil.module.css'
import { SinCargar } from './SinCargar'

/** Props de {@link DatosPersonalesBloque}. */
interface DatosPersonalesBloqueProps {
  perfil: PerfilUsuario
  /** El perfil quedó guardado: `PerfilScreen` lo reemplaza. */
  onActualizado: (perfil: PerfilUsuario) => void
  /** Avisa si hay cambios sin guardar (para el aviso de salida, US-21). */
  onCambiosSinGuardar: (hayCambios: boolean) => void
  /** Algo más al final del bloque (el cambio de correo). */
  children?: ReactNode
}

/** Los campos del formulario, como los maneja antd `Form`. */
interface ValoresDatos {
  nombre: string
  apellido: string
  dni: string
  /** Lo que se ve en el campo, sin el "+" (que es fijo). */
  telefono: string
  fechaNacimiento: Dayjs | null
}

/** Perfil → valores del formulario (lo que restaura Cancelar). */
function valoresDe(perfil: PerfilUsuario): ValoresDatos {
  return {
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    dni: perfil.dni ?? '',
    telefono: telefonoParaPrecargar(perfil.telefono),
    fechaNacimiento: perfil.fechaNacimiento ? dayjs(perfil.fechaNacimiento) : null,
  }
}

/** Teléfono del campo → E.164, o `null` si quedó vacío o solo con el código de país. */
function telefonoDelCampo(texto: string): string | null {
  const e164 = aE164(texto)
  return e164 && e164.length > 4 ? e164 : null
}

/**
 * Lo que cambió respecto del perfil guardado: solo eso viaja al back (US-21
 * "cada bloque se guarda por separado"). El DNI no viaja si está bloqueado.
 */
function cambiosEntre(perfil: PerfilUsuario, valores: ValoresDatos): DatosPersonalesCambios {
  const cambios: DatosPersonalesCambios = {}
  if (valores.nombre.trim() !== perfil.nombre) cambios.nombre = valores.nombre.trim()
  if (valores.apellido.trim() !== perfil.apellido) cambios.apellido = valores.apellido.trim()
  const dni = soloDigitos(valores.dni)
  if (dni && dni !== perfil.dni) cambios.dni = dni
  const telefono = telefonoDelCampo(valores.telefono)
  if (telefono !== perfil.telefono) cambios.telefono = telefono
  const fecha = valores.fechaNacimiento ? valores.fechaNacimiento.format('YYYY-MM-DD') : null
  if (fecha !== perfil.fechaNacimiento) cambios.fechaNacimiento = fecha
  return cambios
}

/**
 * Teléfono opcional en el perfil (Diego no lo tiene): vacío o solo con el
 * código de país pasa; si se escribe algo, las reglas de US-35 (US-21: "con
 * las mismas reglas que en US-35": solo números, E.164 de 10 a 15 dígitos).
 */
const reglasTelefonoPerfil = [
  {
    validator: (_rule: unknown, value?: string) => {
      const texto = (value ?? '').replace(/^\+/, '')
      if (!/^[\d\s]*$/.test(texto)) return Promise.reject(new Error(MENSAJES_SOLICITUD.telefonoSoloNumeros))
      if (soloDigitos(texto).length <= 3 || telefonoValido(texto)) return Promise.resolve()
      return Promise.reject(new Error(MENSAJES_SOLICITUD.telefonoLargo))
    },
  },
]

/** US-21: la fecha se puede cambiar, pero el usuario tiene que ser mayor de 18 años. */
const reglasFechaPerfil = [
  {
    validator: (_rule: unknown, value?: Dayjs | null) =>
      !value || esMayorDeEdad(value) ? Promise.resolve() : Promise.reject(new Error(MENSAJES.menorDeEdad)),
  },
]

/** Texto del bloqueo por contrato (US-21: "se debe explicar el motivo"). */
function textoBloqueo(lock: NonNullable<PerfilUsuario['identityLock']>): string {
  const estado = lock.contractStatus === 'vigente' ? 'vigente' : 'pendiente de firma'
  return `Sos parte del contrato ${lock.contractCode}, ${estado}. Mientras siga así, tu nombre, apellido y DNI no se pueden cambiar: son los que figuran en el contrato.`
}

/** Props de {@link FormularioDatos}. */
interface FormularioDatosProps {
  perfil: PerfilUsuario
  avisoBloqueo: ReactNode
  onGuardado: (perfil: PerfilUsuario, cambioElNombre: boolean) => void
  onCancelar: () => void
  onCambiosSinGuardar: (hayCambios: boolean) => void
}

/**
 * El formulario de edición. Tiene su propio `Form.useForm`: se monta al
 * tocar "Editar" y se desmonta al guardar o cancelar, así cada edición
 * arranca de lo guardado (US-21: "Cancelar restaura los valores guardados").
 */
function FormularioDatos({ perfil, avisoBloqueo, onGuardado, onCancelar, onCambiosSinGuardar }: FormularioDatosProps) {
  const [form] = Form.useForm<ValoresDatos>()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const iniciales = useMemo(() => valoresDe(perfil), [perfil])
  const valores = Form.useWatch([], form) as Partial<ValoresDatos> | undefined
  const bloqueado = perfil.identityLock !== null
  const hayCambios = valores !== undefined && Object.keys(cambiosEntre(perfil, { ...iniciales, ...valores })).length > 0

  useEffect(() => {
    onCambiosSinGuardar(hayCambios)
  }, [hayCambios, onCambiosSinGuardar])
  // Al desmontarse (guardó o canceló) ya no quedan cambios pendientes.
  useEffect(() => () => onCambiosSinGuardar(false), [onCambiosSinGuardar])

  // ─── Handlers ───────────────────────────────────────────────────────
  async function guardar(valoresForm: ValoresDatos): Promise<void> {
    const cambios = cambiosEntre(perfil, valoresForm)
    if (Object.keys(cambios).length === 0) {
      onCancelar()
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await actualizarDatosPersonales(cambios)
      onGuardado(actualizado, cambios.nombre !== undefined || cambios.apellido !== undefined)
    } catch (excepcion) {
      const mensaje = excepcion instanceof ServiceError ? excepcion.message : 'No pudimos guardar los cambios. Probá de nuevo.'
      if (excepcion instanceof ServiceError && excepcion.apiCode === 'DNI_DUPLICADO') form.setFields([{ name: 'dni', errors: [mensaje] }])
      setError(mensaje)
      setGuardando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <Form<ValoresDatos> form={form} layout="vertical" initialValues={iniciales} onFinish={guardar} requiredMark={false} disabled={guardando} data-testid="perfil-datos-form">
      {avisoBloqueo && <div className={styles.formAlert}>{avisoBloqueo}</div>}
      {error && <Alert type="error" showIcon title={error} className={styles.formAlert} data-testid="perfil-datos-error" />}
      <div className={styles.grid}>
        <Form.Item name="nombre" label="Nombre" rules={reglasNombrePerfil(MENSAJES.nombreVacio)}>
          <Input autoComplete="given-name" maxLength={100} disabled={bloqueado} data-testid="perfil-nombre-input" />
        </Form.Item>
        <Form.Item name="apellido" label="Apellido" rules={reglasNombrePerfil(MENSAJES.apellidoVacio)}>
          <Input autoComplete="family-name" maxLength={100} disabled={bloqueado} data-testid="perfil-apellido-input" />
        </Form.Item>
        <Form.Item name="dni" label="DNI" rules={bloqueado ? [] : reglasDni} extra={bloqueado ? undefined : 'Sin puntos ni guiones.'}>
          <Input inputMode="numeric" maxLength={10} disabled={bloqueado} data-testid="perfil-dni-input" />
        </Form.Item>
        <Form.Item
          name="telefono"
          label="Teléfono"
          rules={reglasTelefonoPerfil}
          normalize={(valor: string) => formatoTelefonoEnCampo(valor ?? '')}
          extra="Con el código de país (54 para Argentina)."
        >
          <Input prefix="+" inputMode="numeric" autoComplete="tel" data-testid="perfil-telefono-input" />
        </Form.Item>
        <Form.Item name="fechaNacimiento" label="Fecha de nacimiento" rules={reglasFechaPerfil} extra="Tenés que ser mayor de 18 años.">
          <DatePicker
            format="DD/MM/YYYY"
            placeholder="dd/mm/aaaa"
            disabledDate={(fecha) => fecha.isAfter(hoy(), 'day')}
            className={styles.fullWidth}
            data-testid="perfil-fecha-nacimiento-input"
          />
        </Form.Item>
      </div>
      <div className={styles.actions}>
        <Button type="primary" htmlType="submit" loading={guardando} data-testid="perfil-datos-guardar">
          Guardar
        </Button>
        <Button onClick={onCancelar} disabled={guardando} data-testid="perfil-datos-cancelar">
          Cancelar
        </Button>
      </div>
    </Form>
  )
}

/** Datos personales del usuario en sesión, en lectura o en edición. */
export function DatosPersonalesBloque({ perfil, onActualizado, onCambiosSinGuardar, children }: DatosPersonalesBloqueProps) {
  const { refrescarUsuario } = useAuth()

  // ─── Estado local ───────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [exito, setExito] = useState<string | null>(null)
  const bloqueado = perfil.identityLock !== null

  // ─── Handlers ───────────────────────────────────────────────────────
  function editar(): void {
    setExito(null)
    setEditando(true)
  }

  function guardado(actualizado: PerfilUsuario, cambioElNombre: boolean): void {
    onActualizado(actualizado)
    setEditando(false)
    setExito('Guardamos tus datos personales.')
    // US-21: el nombre nuevo se ve en el menú de usuario sin volver a entrar.
    if (cambioElNombre) void refrescarUsuario()
  }

  // ─── Render: lectura ────────────────────────────────────────────────
  const items = [
    { label: 'Nombre', value: <span data-testid="perfil-nombre">{perfil.nombre}</span> },
    { label: 'Apellido', value: <span data-testid="perfil-apellido">{perfil.apellido}</span> },
    {
      label: 'DNI',
      value: perfil.dni ? <span data-testid="perfil-dni">{dniParaMostrar(perfil.dni)}</span> : <SinCargar campo="dni" onCompletar={bloqueado ? undefined : editar} />,
    },
    { label: 'Correo electrónico', value: <span data-testid="perfil-email">{perfil.email}</span> },
    {
      label: 'Teléfono',
      value: perfil.telefono ? <span data-testid="perfil-telefono">{telefonoParaMostrar(perfil.telefono)}</span> : <SinCargar campo="telefono" onCompletar={editar} />,
    },
    {
      label: 'Fecha de nacimiento',
      value: perfil.fechaNacimiento ? (
        <span data-testid="perfil-fecha-nacimiento">{fechaParaMostrar(perfil.fechaNacimiento)}</span>
      ) : (
        <SinCargar campo="fecha-nacimiento" onCompletar={editar} />
      ),
    },
  ]

  const avisoBloqueo = perfil.identityLock && (
    <div className={`${styles.notice} ${styles.noticeWarning}`} data-testid="perfil-bloqueo-contrato">
      <span className={styles.noticeTitle}>Nombre, apellido y DNI bloqueados</span>
      <span>{textoBloqueo(perfil.identityLock)}</span>
    </div>
  )

  return (
    <BloquePerfil
      testId="perfil-datos"
      title="Datos personales"
      description="El nombre, el apellido y el DNI son los que figuran en tus contratos."
      defaultOpen
    >
      <div className={styles.stack}>
        {exito && !editando && (
          <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setExito(null)} title={exito} data-testid="perfil-datos-exito" />
        )}

        {!editando ? (
          <>
            {avisoBloqueo}
            <DetailList items={items} column={1} />
            <div className={styles.actions}>
              <Button onClick={editar} data-testid="perfil-datos-editar">
                Editar datos personales
              </Button>
            </div>
          </>
        ) : (
          // ─── Render: edición ──────────────────────────────────────────
          <FormularioDatos
            perfil={perfil}
            avisoBloqueo={avisoBloqueo}
            onGuardado={guardado}
            onCancelar={() => setEditando(false)}
            onCambiosSinGuardar={onCambiosSinGuardar}
          />
        )}

        {children}
      </div>
    </BloquePerfil>
  )
}
