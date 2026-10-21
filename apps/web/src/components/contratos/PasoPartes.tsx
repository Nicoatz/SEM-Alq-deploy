'use client'

/**
 * PasoPartes.tsx — paso 1 del alta de contrato: "Partes y garantes".
 *
 * Cubre: US-05 Registrar contrato de alquiler, "Paso 1 · Partes y garantes":
 * - los datos del locador y del locatario (nombre, apellido, DNI, correo y
 *   teléfono) sin poder modificarlos;
 * - el acceso a la solicitud de origen;
 * - las garantías que el locatario ofreció en su solicitud, como referencia;
 * - hasta 3 garantes con nombre y apellido, DNI y correo (los tres
 *   obligatorios), con las validaciones de `lib/contratos/validaciones.ts`;
 * - quitar un garante cargado.
 * Decisión del PO: el garante es un dato del contrato y NO firma este sprint.
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 02): el aviso de
 * contexto, las dos tarjetas de solo lectura y la lista de garantes.
 * NOTA (diseño vs. PO): el diseño dice "le llega un mail para firmar" y
 * reemplaza los garantes por la póliza con caución; acá no va ninguna de
 * las dos cosas.
 *
 * De dónde saca los datos: el borrador que maneja `AltaContrato`.
 * Quién lo usa: `AltaContrato.tsx`.
 */
import Link from 'next/link'
import { Button, Form, Input } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ContratoBorrador, GaranteContrato, ParteContrato } from '@rentar/shared-types'
import { FormSection } from '@rentar/ui'
import { erroresGarante, GARANTES_MAX, MENSAJES_CONTRATO } from '@/lib/contratos/validaciones'
import { fechaCorta } from '@/lib/contratos/fechas'
import { dniParaMostrar, telefonoParaMostrar } from '@/lib/perfil/formato'
import { iniciales } from '@/lib/utils/iniciales'
import { GARANTIA_LABEL } from '@/lib/validation/solicitud.rules'
import { SOLICITUDES_ACEPTADAS_HREF } from './ListadoContratos'
import styles from './AltaContrato.module.css'

/** Props de {@link PasoPartes}. */
interface PasoPartesProps {
  borrador: ContratoBorrador
  onGarantesChange: (garantes: GaranteContrato[]) => void
  /** `true` después de tocar "Siguiente" o "Enviar": se muestran todos los errores. */
  mostrarErrores: boolean
}

/** Tarjeta de solo lectura de una parte (US-05: "sin poder modificarlos"). */
function TarjetaParte({ parte, rol, testId }: { parte: ParteContrato; rol: string; testId: string }) {
  const nombre = `${parte.nombre} ${parte.apellido}`.trim()
  return (
    <div className={styles.parte} data-testid={testId}>
      <span className={styles.parteAvatar} aria-hidden>
        {iniciales(nombre)}
      </span>
      <span className={styles.parteDatos}>
        <span className={styles.parteNombre}>{nombre || 'Sin nombre'}</span>
        <span className={styles.parteRol}>{rol}</span>
        <span>DNI {parte.dni ? dniParaMostrar(parte.dni) : 'sin cargar'}</span>
        <span>{parte.email || 'Sin correo'}</span>
        <span>{parte.telefono ? telefonoParaMostrar(parte.telefono) : 'Sin teléfono'}</span>
      </span>
    </div>
  )
}

/** Clave nueva para un garante (no la manda el back). */
function claveNueva(garantes: readonly GaranteContrato[]): string {
  const usadas = new Set(garantes.map((garante) => garante.key))
  let numero = garantes.length + 1
  while (usadas.has(`garante-${numero}`)) numero++
  return `garante-${numero}`
}

/** Paso 1 del alta: partes (solo lectura) y garantes. */
export function PasoPartes({ borrador, onGarantesChange, mostrarErrores }: PasoPartesProps) {
  const { garantes, locador, locatario, propiedad } = borrador
  const partes = [locador, locatario]
  const nombreLocatario = `${locatario.nombre} ${locatario.apellido}`.trim()

  // ─── Handlers ───────────────────────────────────────────────────────
  function cambiar(key: string, campo: 'fullName' | 'dni' | 'email', valor: string): void {
    onGarantesChange(garantes.map((garante) => (garante.key === key ? { ...garante, [campo]: valor } : garante)))
  }

  function agregar(): void {
    if (garantes.length >= GARANTES_MAX) return
    onGarantesChange([...garantes, { key: claveNueva(garantes), fullName: '', dni: '', email: '' }])
  }

  function quitar(key: string): void {
    onGarantesChange(garantes.filter((garante) => garante.key !== key))
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.paso} data-testid="contrato-paso-partes">
      <div className={styles.contexto} data-testid="contrato-contexto">
        <span>
          Estás armando el contrato de <strong>{propiedad.address}</strong> con <strong>{nombreLocatario}</strong>
          {borrador.solicitudAceptadaEl ? `, a partir de la solicitud que aceptaste el ${fechaCorta(borrador.solicitudAceptadaEl)}.` : ', a partir de su solicitud aceptada.'}
        </span>
        <Link href={SOLICITUDES_ACEPTADAS_HREF} data-testid="contrato-ver-solicitud">
          Ver la solicitud
        </Link>
      </div>

      <FormSection title="Las partes" description="Vienen de la solicitud y del perfil de cada uno. Si algo está mal, se corrige en el perfil.">
        <div className={styles.partes}>
          <TarjetaParte parte={locador} rol="Locador" testId="contrato-parte-locador" />
          <TarjetaParte parte={locatario} rol="Locatario" testId="contrato-parte-locatario" />
        </div>
      </FormSection>

      <FormSection
        title="Garantes"
        description={`Hasta ${GARANTES_MAX}. En esta versión el garante queda como dato del contrato: no firma. Podés enviar el contrato sin garantes.`}
      >
        <p className={styles.referencia} data-testid="contrato-garantias-ofrecidas">
          {borrador.garantiasOfrecidas.length > 0
            ? `En su solicitud, ${locatario.nombre || 'el locatario'} ofreció: ${borrador.garantiasOfrecidas.map((garantia) => GARANTIA_LABEL[garantia]).join(', ')}.`
            : `En su solicitud, ${locatario.nombre || 'el locatario'} no indicó garantías.`}
        </p>

        {garantes.map((garante, indice) => {
          const otros = garantes.filter((otro) => otro.key !== garante.key)
          const errores = mostrarErrores ? erroresGarante(garante, otros, partes) : {}
          return (
            <div key={garante.key} className={styles.garante} data-testid="contrato-garante">
              <div className={styles.garanteHead}>
                <span className={styles.garanteTitulo}>Garante {indice + 1}</span>
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => quitar(garante.key)} data-testid="contrato-garante-quitar">
                  Quitar
                </Button>
              </div>
              <Form layout="vertical" component="div" requiredMark={false} className={styles.grid3}>
                <Form.Item label="Nombre y apellido" validateStatus={errores.fullName ? 'error' : undefined} help={errores.fullName}>
                  <Input value={garante.fullName} onChange={(evento) => cambiar(garante.key, 'fullName', evento.target.value)} maxLength={120} autoComplete="off" data-testid="contrato-garante-nombre" />
                </Form.Item>
                <Form.Item label="DNI" validateStatus={errores.dni ? 'error' : undefined} help={errores.dni ?? 'Sin puntos ni espacios.'}>
                  <Input value={garante.dni} onChange={(evento) => cambiar(garante.key, 'dni', evento.target.value.trim())} inputMode="numeric" maxLength={10} autoComplete="off" data-testid="contrato-garante-dni" />
                </Form.Item>
                <Form.Item label="Correo electrónico" validateStatus={errores.email ? 'error' : undefined} help={errores.email}>
                  <Input value={garante.email} onChange={(evento) => cambiar(garante.key, 'email', evento.target.value)} inputMode="email" autoComplete="off" data-testid="contrato-garante-email" />
                </Form.Item>
              </Form>
            </div>
          )
        })}

        {garantes.length < GARANTES_MAX ? (
          <Button icon={<PlusOutlined />} onClick={agregar} className={styles.agregar} data-testid="contrato-garante-agregar">
            {garantes.length === 0 ? 'Agregar un garante' : 'Agregar otro garante'}
          </Button>
        ) : (
          <p className={styles.referencia} data-testid="contrato-garantes-maximo">
            {MENSAJES_CONTRATO.garantesMaximo}
          </p>
        )}
      </FormSection>
    </div>
  )
}
