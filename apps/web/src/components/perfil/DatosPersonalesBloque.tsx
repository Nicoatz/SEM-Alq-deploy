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
 *   el motivo; el correo se cambia acá mismo y se aplica al guardar (US-21
 *   actualizada el 06/11: sin enlace de confirmación); mensaje de éxito o de
 *   error en español. Al cambiar nombre, apellido o correo, la sesión se
 *   actualiza (`refrescarUsuario`: el UserMenu y `useAuth().user`).
 * - Pedido del PO (12/11): Guardar deshabilitado mientras el bloque no tenga
 *   cambios o algún campo tenga un error (incluido un DNI o correo que el
 *   back ya rechazó por repetido, y vaciar un teléfono o una fecha guardados).
 *
 * NOTA (bloqueo): el perfil trae el contrato que bloquea (`identityLock`, de
 * `bloqueo_identidad` en modo real), así que el aviso y los campos
 * deshabilitados se ven antes de editar. El 409 del PATCH queda de respaldo
 * (por ejemplo, si el contrato se creó con la pantalla abierta): el bloque
 * pasa a bloqueado hasta salir de la pantalla (`bloqueoDescubierto`).
 * De dónde saca los datos: `PerfilUsuario` (lo pasa `PerfilScreen`); guarda
 * con `perfil.service#actualizarDatosPersonales`. Qué cambió lo calcula
 * `lib/perfil/cambios.ts`.
 * Quién lo usa: `PerfilScreen.tsx`.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, DatePicker, Form, Input, type FormRule } from 'antd'
import type { Dayjs } from 'dayjs'
import type { PerfilUsuario } from '@rentar/shared-types'
import { DetailList } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { dniParaMostrar, fechaParaMostrar, telefonoParaMostrar } from '@/lib/perfil/formato'
import { cambiosEntre, hayCambiosDatos, valoresDe, type ValoresDatos } from '@/lib/perfil/cambios'
import { useFormularioValido } from '@/lib/perfil/useFormularioValido'
import { hoy } from '@/lib/utils/fechas'
import { formatoTelefonoEnCampo, MENSAJES_SOLICITUD, reglasEmailSolicitud, telefonoValido } from '@/lib/validation/solicitud.rules'
import { DNI_REGEX, esMayorDeEdad, MENSAJES, reglasNombrePerfil, soloDigitos } from '@/lib/validation/usuario.rules'
import { actualizarDatosPersonales, CAMPO_NO_BORRABLE, MENSAJE_NO_BORRABLE } from '@/services/perfil.service'
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
}

// ─── Reglas ─────────────────────────────────────────────────────────────
// NOTA: las reglas corren al cambiar cada valor (el `validateTrigger` por
// defecto de antd) y, en silencio, en cada cambio del formulario
// (`useFormularioValido`): así Guardar se deshabilita apenas hay un error.

/**
 * DNI (US-21: 7 u 8 dígitos). Decisión del PO (12/11): es opcional mientras
 * siga vacío y sin guardar; si se escribe algo, el formato es obligatorio; y
 * si ya había uno guardado, vaciarlo es un error.
 */
function reglasDniPerfil(dniGuardado: string | null): FormRule[] {
  return [
    {
      validator: (_rule, value?: string) => {
        const texto = (value ?? '').trim()
        if (!texto && !dniGuardado) return Promise.resolve()
        return DNI_REGEX.test(soloDigitos(texto)) ? Promise.resolve() : Promise.reject(new Error(MENSAJES.dniInvalido))
      },
    },
  ]
}

/**
 * Teléfono: opcional si no había uno guardado (Diego no lo tiene); vacío o
 * solo con el código de país cuenta como vacío. Si se escribe algo, las
 * reglas de US-35 (US-21: "con las mismas reglas que en US-35": solo
 * números, E.164 de 10 a 15 dígitos). Si ya había uno guardado, no se puede
 * borrar (decisión del PO, 12/11: el error se ve al vaciarlo, no al guardar).
 */
function reglasTelefonoPerfil(telefonoGuardado: string | null): FormRule[] {
  return [
    {
      validator: (_rule, value?: string) => {
        const texto = (value ?? '').replace(/^\+/, '')
        if (!/^[\d\s]*$/.test(texto)) return Promise.reject(new Error(MENSAJES_SOLICITUD.telefonoSoloNumeros))
        if (soloDigitos(texto).length <= 3) {
          return telefonoGuardado ? Promise.reject(new Error(MENSAJE_NO_BORRABLE.telefono)) : Promise.resolve()
        }
        return telefonoValido(texto) ? Promise.resolve() : Promise.reject(new Error(MENSAJES_SOLICITUD.telefonoLargo))
      },
    },
  ]
}

/**
 * Fecha de nacimiento (US-21: "el usuario debe ser mayor de 18 años"). Se
 * compara por día contra el "hoy" de `lib/utils/fechas.ts`: quien cumple 18
 * hoy pasa y quien los cumple mañana no (con hoy = 23/09/2026 en modo mock:
 * 23/09/2008 pasa, 24/09/2008 no). Si ya había una guardada, no se puede
 * borrar (decisión del PO, 12/11).
 */
function reglasFechaPerfil(fechaGuardada: string | null): FormRule[] {
  return [
    {
      validator: (_rule, value?: Dayjs | null) => {
        if (!value) return fechaGuardada ? Promise.reject(new Error(MENSAJE_NO_BORRABLE.fechaNacimiento)) : Promise.resolve()
        return esMayorDeEdad(value) ? Promise.resolve() : Promise.reject(new Error(MENSAJES.menorDeEdad))
      },
    },
  ]
}

/** Un valor que el back rechazó en esta edición (DNI o correo ya registrados) y su mensaje. */
interface ValorRechazado {
  /** El valor normalizado como viajó (DNI solo dígitos, correo en minúsculas). */
  valor: string
  mensaje: string
}

/** Los valores rechazados por campo. Viven solo en memoria (ver `rechazados` en el formulario). */
type Rechazados = Partial<Record<'dni' | 'email', ValorRechazado>>

/** DNI del campo como viaja al back. */
const normalizarDni = (texto: string): string => soloDigitos(texto)
/** Correo del campo como viaja al back. */
const normalizarEmail = (texto: string): string => texto.trim().toLowerCase()

/**
 * El valor no puede ser el que el back ya rechazó (DNI o correo "único en la
 * plataforma", US-21): el mensaje queda en el campo y Guardar deshabilitado
 * hasta que el usuario lo cambie. `valor` ya viene normalizado.
 */
function validarNoRechazado(rechazado: ValorRechazado | undefined, valor: string): Promise<void> {
  return rechazado && valor === rechazado.valor ? Promise.reject(new Error(rechazado.mensaje)) : Promise.resolve()
}

/** Lo que sigue al motivo del bloqueo (igual en los tres casos). */
const CONSECUENCIA_BLOQUEO = 'Mientras siga así, tu nombre, apellido y DNI no se pueden cambiar: son los que figuran en el contrato.'

/**
 * Texto del bloqueo por contrato (US-21: "se debe explicar el motivo"). Si el
 * contrato no tiene código, no se nombra. Sin el contrato (el bloqueo se supo
 * por el 409), un texto general.
 */
function textoBloqueo(lock: PerfilUsuario['identityLock']): string {
  if (!lock) return `Formás parte de un contrato vigente o pendiente de firma. ${CONSECUENCIA_BLOQUEO}`
  const estado = lock.contractStatus === 'vigente' ? 'vigente' : 'pendiente de firma'
  // Con código, la aclaración va entre comas; sin código, "un contrato que está…" (sin coma).
  const contrato = lock.contractCode ? `del contrato ${lock.contractCode}, que` : 'de un contrato que'
  return `Formás parte ${contrato} está ${estado}. ${CONSECUENCIA_BLOQUEO}`
}

/** Props de {@link FormularioDatos}. */
interface FormularioDatosProps {
  perfil: PerfilUsuario
  /** Nombre, apellido y DNI no se pueden cambiar (contrato vigente o pendiente de firma). */
  bloqueado: boolean
  avisoBloqueo: ReactNode
  /** El back respondió el 409 de contrato: el bloque pasa a bloqueado. */
  onBloqueoDescubierto: () => void
  /** `cambioLaSesion`: cambió el nombre, el apellido o el correo (lo que guarda la sesión). */
  onGuardado: (perfil: PerfilUsuario, cambioLaSesion: boolean) => void
  onCancelar: () => void
  onCambiosSinGuardar: (hayCambios: boolean) => void
}

/**
 * El formulario de edición. Tiene su propio `Form.useForm`: se monta al
 * tocar "Editar" y se desmonta al guardar o cancelar, así cada edición
 * arranca de lo guardado (US-21: "Cancelar restaura los valores guardados").
 */
function FormularioDatos({ perfil, bloqueado, avisoBloqueo, onBloqueoDescubierto, onGuardado, onCancelar, onCambiosSinGuardar }: FormularioDatosProps) {
  const [form] = Form.useForm<ValoresDatos>()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** El campo que causó el cartel de error (DNI o correo repetidos): al cambiarlo, el cartel se va. */
  const [campoDelError, setCampoDelError] = useState<keyof Rechazados | null>(null)
  /**
   * DNI y correo que el back rechazó por repetidos. NOTA: solo en memoria
   * (nada de storage ni logs); se borran al cancelar y al guardar con éxito.
   */
  const rechazados = useRef<Rechazados>({})

  const iniciales = useMemo(() => valoresDe(perfil), [perfil])
  const valores = Form.useWatch([], form) as Partial<ValoresDatos> | undefined
  // El mismo criterio para Guardar y para el aviso de salida (`lib/perfil/cambios.ts`).
  const hayCambios = valores !== undefined && hayCambiosDatos(perfil, { ...iniciales, ...valores }, { bloqueado })
  const { valido, revalidar } = useFormularioValido(form)

  // NOTA: los validadores de "rechazado" leen el ref al validar, no al renderizar.
  const reglas = useMemo<Record<'dni' | 'email' | 'telefono' | 'fechaNacimiento', FormRule[]>>(
    () => ({
      dni: [...reglasDniPerfil(perfil.dni), { validator: (_rule, value?: string) => validarNoRechazado(rechazados.current.dni, normalizarDni(value ?? '')) }],
      email: [...reglasEmailSolicitud, { validator: (_rule, value?: string) => validarNoRechazado(rechazados.current.email, normalizarEmail(value ?? '')) }],
      telefono: reglasTelefonoPerfil(perfil.telefono),
      fechaNacimiento: reglasFechaPerfil(perfil.fechaNacimiento),
    }),
    [perfil],
  )

  useEffect(() => {
    onCambiosSinGuardar(hayCambios)
  }, [hayCambios, onCambiosSinGuardar])
  // Al desmontarse (guardó o canceló) ya no quedan cambios pendientes.
  useEffect(() => () => onCambiosSinGuardar(false), [onCambiosSinGuardar])

  // ─── Handlers ───────────────────────────────────────────────────────
  function cancelar(): void {
    rechazados.current = {}
    onCancelar()
  }

  async function guardar(valoresForm: ValoresDatos): Promise<void> {
    const cambios = cambiosEntre(perfil, valoresForm, { bloqueado })
    // Sin cambios Guardar está deshabilitado; esto cubre un envío por otra vía.
    if (Object.keys(cambios).length === 0) {
      cancelar()
      return
    }
    setGuardando(true)
    setError(null)
    setCampoDelError(null)
    try {
      const actualizado = await actualizarDatosPersonales(cambios)
      rechazados.current = {}
      onGuardado(actualizado, cambios.nombre !== undefined || cambios.apellido !== undefined || cambios.email !== undefined)
    } catch (excepcion) {
      setGuardando(false)
      const codigo = excepcion instanceof ServiceError ? excepcion.apiCode : undefined
      if (codigo === 'IDENTIDAD_BLOQUEADA_POR_CONTRATO') {
        // El aviso de bloqueo ya explica el motivo: nombre, apellido y DNI
        // vuelven a lo guardado y se deshabilitan; lo demás se puede guardar.
        form.setFieldsValue({ nombre: iniciales.nombre, apellido: iniciales.apellido, dni: iniciales.dni })
        onBloqueoDescubierto()
        return
      }
      const mensaje = excepcion instanceof ServiceError ? excepcion.message : 'No pudimos guardar los cambios. Probá de nuevo.'
      if (codigo === 'DNI_DUPLICADO' || codigo === 'EMAIL_DUPLICADO') {
        const campo = codigo === 'DNI_DUPLICADO' ? 'dni' : 'email'
        const valor = campo === 'dni' ? normalizarDni(valoresForm.dni) : normalizarEmail(valoresForm.email)
        rechazados.current = { ...rechazados.current, [campo]: { valor, mensaje } }
        setCampoDelError(campo)
        form.setFields([{ name: campo, errors: [mensaje] }])
        revalidar()
      }
      // Respaldo: hoy las reglas del campo ya frenan el vaciado antes de guardar.
      if (codigo === CAMPO_NO_BORRABLE.telefono) form.setFields([{ name: 'telefono', errors: [mensaje] }])
      if (codigo === CAMPO_NO_BORRABLE.fechaNacimiento) form.setFields([{ name: 'fechaNacimiento', errors: [mensaje] }])
      setError(mensaje)
    }
  }

  /**
   * Pedido del PO (12/11): el cartel del DNI o del correo repetido se va
   * cuando el usuario cambia ese campo (el mensaje del campo lo sigue
   * explicando si vuelve al valor rechazado). Al cancelar o guardar se
   * desmonta el formulario y se va solo.
   */
  function alCambiarValores(cambiados: Partial<ValoresDatos>): void {
    if (campoDelError && campoDelError in cambiados) {
      setError(null)
      setCampoDelError(null)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <Form<ValoresDatos>
      form={form}
      layout="vertical"
      initialValues={iniciales}
      onFinish={guardar}
      onValuesChange={alCambiarValores}
      requiredMark={false}
      disabled={guardando}
      data-testid="perfil-datos-form"
    >
      {avisoBloqueo && <div className={styles.formAlert}>{avisoBloqueo}</div>}
      {error && <Alert type="error" showIcon title={error} className={styles.formAlert} data-testid="perfil-datos-error" />}
      <div className={styles.grid}>
        <Form.Item name="nombre" label="Nombre" rules={reglasNombrePerfil(MENSAJES.nombreVacio)}>
          <Input autoComplete="given-name" maxLength={100} disabled={bloqueado} data-testid="perfil-nombre-input" />
        </Form.Item>
        <Form.Item name="apellido" label="Apellido" rules={reglasNombrePerfil(MENSAJES.apellidoVacio)}>
          <Input autoComplete="family-name" maxLength={100} disabled={bloqueado} data-testid="perfil-apellido-input" />
        </Form.Item>
        <Form.Item name="dni" label="DNI" rules={bloqueado ? [] : reglas.dni} extra={bloqueado ? undefined : 'Sin puntos ni guiones.'}>
          <Input inputMode="numeric" maxLength={10} disabled={bloqueado} data-testid="perfil-dni-input" />
        </Form.Item>
        <Form.Item name="email" label="Correo electrónico" rules={reglas.email} extra="Es el que usás para entrar. El cambio vale apenas guardás.">
          <Input inputMode="email" autoComplete="email" maxLength={255} data-testid="perfil-email-input" />
        </Form.Item>
        <Form.Item
          name="telefono"
          label="Teléfono"
          rules={reglas.telefono}
          normalize={(valor: string) => formatoTelefonoEnCampo(valor ?? '')}
          extra="Con el código de país (54 para Argentina)."
        >
          <Input prefix="+" inputMode="numeric" autoComplete="tel" data-testid="perfil-telefono-input" />
        </Form.Item>
        <Form.Item name="fechaNacimiento" label="Fecha de nacimiento" rules={reglas.fechaNacimiento} extra="Tenés que ser mayor de 18 años.">
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
        {/* Deshabilitado (atributo `disabled`) sin cambios o con algún error: el
            porqué lo dice el mensaje de cada campo. `guardando` va explícito
            porque el `disabled` del botón le gana al del Form. */}
        <Button type="primary" htmlType="submit" loading={guardando} disabled={guardando || !hayCambios || !valido} data-testid="perfil-datos-guardar">
          Guardar
        </Button>
        <Button onClick={cancelar} disabled={guardando} data-testid="perfil-datos-cancelar">
          Cancelar
        </Button>
      </div>
    </Form>
  )
}

/** Datos personales del usuario en sesión, en lectura o en edición. */
export function DatosPersonalesBloque({ perfil, onActualizado, onCambiosSinGuardar }: DatosPersonalesBloqueProps) {
  const { refrescarUsuario } = useAuth()

  // ─── Estado local ───────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [exito, setExito] = useState<string | null>(null)
  /** El PATCH respondió el 409 de contrato en esta visita (respaldo, ver la NOTA del encabezado). */
  const [bloqueoDescubierto, setBloqueoDescubierto] = useState(false)
  const bloqueado = perfil.identityLock !== null || bloqueoDescubierto

  // ─── Handlers ───────────────────────────────────────────────────────
  function editar(): void {
    setExito(null)
    setEditando(true)
  }

  function guardado(actualizado: PerfilUsuario, cambioLaSesion: boolean): void {
    onActualizado(actualizado)
    setEditando(false)
    setExito('Guardamos tus datos personales.')
    // US-21: el nombre y el correo nuevos se ven en la sesión (UserMenu,
    // `useAuth().user`) sin volver a entrar.
    if (cambioLaSesion) void refrescarUsuario()
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

  const avisoBloqueo = bloqueado && (
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
            bloqueado={bloqueado}
            avisoBloqueo={avisoBloqueo}
            onBloqueoDescubierto={() => setBloqueoDescubierto(true)}
            onGuardado={guardado}
            onCancelar={() => setEditando(false)}
            onCambiosSinGuardar={onCambiosSinGuardar}
          />
        )}
      </div>
    </BloquePerfil>
  )
}
