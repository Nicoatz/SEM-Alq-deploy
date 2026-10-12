'use client'

/**
 * FormularioSolicitud.tsx — el formulario del modal "Solicitar alquiler"
 * (US-35 actualizada).
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 01): la propiedad, "Tus
 * datos", "Tu situación", "Garantía que ofrecés", el mensaje al dueño y
 * "Antes de enviar" con el check obligatorio. Los datos y las validaciones
 * salen de los criterios de la US (`lib/validation/solicitud.rules.ts`).
 * - Nombre, apellido y DNI: de solo lectura (🔒). Teléfono y email:
 *   editables, solo para esta solicitud.
 * - Garantías: las que exige el dueño aparecen señaladas ("La pide el
 *   dueño"), sin tildar; alcanza con marcar una (decisión del PO).
 * NOTA: el diseño dice que el teléfono y el email editados "se actualizan
 * también en el perfil"; no va (decisión del PO): quedan solo en la solicitud.
 *
 * Quién lo usa: `SolicitarAlquilerModal` (el `Form` y el envío son suyos).
 */
import Image from 'next/image'
import { Checkbox, Form, Input, InputNumber, Radio, Select } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import type { PropiedadDetalle, UsuarioSesion } from '@rentar/shared-types'
import { MoneyAmount } from '@rentar/ui'
import { Stepper } from '@/components/alta/CamposAlta'
import type { ValoresSolicitud } from '@/lib/solicitudes/formulario'
import {
  formatoTelefonoEnCampo,
  GARANTIA_LABEL,
  GARANTIA_OPTIONS,
  MASCOTAS_DETALLE_MAX,
  OCUPACION_OPTIONS,
  reglasAceptacion,
  reglasConvivientes,
  reglasDetalleMascotas,
  reglasEmailSolicitud,
  reglasGarantias,
  reglasIngresos,
  reglasTelefonoSolicitud,
  SOLICITUD_MENSAJE_MAX,
} from '@/lib/validation/solicitud.rules'
import styles from './SolicitarAlquilerModal.module.css'

/** Props de {@link FormularioSolicitud}. */
interface FormularioSolicitudProps {
  propiedad: PropiedadDetalle
  usuario: UsuarioSesion | null
  /** Nombre del dueño, si se conoce ("Nicolás Arrieta"). */
  nombreDueno: string | null
  /** Solicitudes pendientes del usuario en OTRAS propiedades (US-35); `null` mientras carga. */
  pendientesEnOtras: number | null
  deshabilitado: boolean
}

/** "1 solicitud pendiente en otra propiedad" / "3 solicitudes pendientes en otras propiedades". */
function textoPendientes(cantidad: number): string {
  return cantidad === 1 ? 'Tenés 1 solicitud pendiente en otra propiedad.' : `Tenés ${cantidad} solicitudes pendientes en otras propiedades.`
}

/** "El dueño pide garantía propietaria o seguro de caución: marcá al menos una". */
function textoGarantiasExigidas(exigidas: PropiedadDetalle['requiredGuarantees']): string {
  const nombres = exigidas.map((garantia) => GARANTIA_LABEL[garantia].toLowerCase())
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}` : nombres[0]
  return exigidas.length > 1 ? `El dueño pide ${lista}: marcá al menos una.` : `El dueño pide ${lista}: marcala para poder enviar.`
}

/** Un dato del perfil que no se edita (US-35: "no el nombre, apellido ni DNI"). */
function DatoFijo({ label, valor, testId }: { label: string; valor: string; testId: string }) {
  return (
    <div className={styles.datoFijo}>
      <span className={styles.datoFijoLabel}>{label}</span>
      <span className={styles.datoFijoValor} data-testid={testId}>
        {valor}
        <LockOutlined className={styles.lock} aria-label="No se puede editar" />
      </span>
    </div>
  )
}

/** Los campos de la solicitud. */
export function FormularioSolicitud({ propiedad, usuario, nombreDueno, pendientesEnOtras, deshabilitado }: FormularioSolicitudProps) {
  const form = Form.useFormInstance<ValoresSolicitud>()
  const mascotas = Form.useWatch('mascotas', form)
  const exigidas = propiedad.requiredGuarantees
  const aptaMascotas = propiedad.characteristics.includes('mascotas')
  // US-35: "metros cuadrados (reales)" = la superficie cubierta; si no la tiene, la total (supuesto, HANDOFF §7).
  const superficie = propiedad.coveredAreaM2 > 0 ? `${propiedad.coveredAreaM2} m² cubiertos` : `${propiedad.areaM2} m² totales`
  const nombreCompleto = usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : ''

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <>
      {/* ─── La propiedad (US-35: dirección, piso, barrio, ambientes, m², mascotas, monto y foto) ─── */}
      <div className={styles.property} data-testid="solicitar-propiedad">
        {/* `unoptimized`, como en el alta: en modo mock la foto puede ser una data URL. */}
        <Image src={propiedad.imageSrc} alt="" width={96} height={72} unoptimized className={styles.propertyPhoto} />
        <div className={styles.propertyText}>
          {/* La exacta con el piso: el modal se abre solo con sesión (decisión del PO). */}
          <span className={styles.propertyAddress}>
            {propiedad.address}
            {propiedad.neighborhoodName && ` · ${propiedad.neighborhoodName}`}
          </span>
          <span className={styles.propertyMeta}>
            {propiedad.rooms} {propiedad.rooms === 1 ? 'ambiente' : 'ambientes'} · {superficie} · {aptaMascotas ? 'apto mascotas' : 'no acepta mascotas'}
          </span>
          <span className={styles.propertyPrice}>
            {propiedad.priceMonthly === null ? 'Precio a consultar' : <><MoneyAmount amount={propiedad.priceMonthly} emphasis /> / mes</>}
          </span>
        </div>
      </div>

      {/* ─── Tus datos ─── */}
      <section className={styles.bloque}>
        <h3 className={styles.bloqueTitulo}>Tus datos</h3>
        <p className={styles.help}>Vienen de tu perfil. Nombre y DNI no se editan; el teléfono y el email que pongas acá van solo en esta solicitud.</p>
        <div className={styles.grid}>
          <DatoFijo label="Nombre y apellido" valor={nombreCompleto || '—'} testId="solicitar-nombre" />
          {/* TODO(db): la tabla `usuario` no guarda el DNI; en modo real puede no venir ("—"). */}
          <DatoFijo label="DNI" valor={usuario?.dni ? Number(usuario.dni).toLocaleString('es-AR') : '—'} testId="solicitar-dni" />
          {/*
           * US-35: teléfono en E.164 (10 a 15 dígitos, solo números), con el "+" visible y
           * no editable, y formato E.123 automático mientras se escribe.
           */}
          <Form.Item
            name="telefono"
            label="Teléfono"
            rules={reglasTelefonoSolicitud}
            normalize={(valor: string) => formatoTelefonoEnCampo(valor ?? '')}
            extra="Con el código de país (54 para Argentina)."
          >
            <Input prefix="+" inputMode="numeric" autoComplete="tel" disabled={deshabilitado} data-testid="solicitar-telefono" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={reglasEmailSolicitud}>
            <Input inputMode="email" autoComplete="email" disabled={deshabilitado} data-testid="solicitar-email" />
          </Form.Item>
        </div>
      </section>

      {/* ─── Tu situación ─── */}
      <section className={styles.bloque}>
        <h3 className={styles.bloqueTitulo}>Tu situación</h3>
        <p className={styles.help}>Todo opcional. Contestarlo ayuda a que el dueño te responda más rápido.</p>
        <div className={styles.grid}>
          <Form.Item name="ocupacion" label="Situación ocupacional">
            <Select options={OCUPACION_OPTIONS} disabled={deshabilitado} data-testid="solicitar-ocupacion" />
          </Form.Item>
          {/* US-35: entero; 0 = no lo informa. Solo lo ve el dueño de esta propiedad. */}
          <Form.Item name="ingresos" label="Ingresos aproximados por mes" rules={reglasIngresos} extra="Solo lo ve el dueño de esta propiedad. Dejá 0 si preferís no decirlo.">
            <InputNumber<number> prefix="$" controls={false} decimalSeparator="," className={styles.full} disabled={deshabilitado} data-testid="solicitar-ingresos" />
          </Form.Item>
        </div>
        <Form.Item name="convivientes" label="¿Cuántos van a vivir ahí? (te incluye)" rules={reglasConvivientes}>
          <Stepper min={1} max={12} label="una persona" disabled={deshabilitado} data-testid="solicitar-convivientes" />
        </Form.Item>
        <Form.Item name="mascotas" label="¿Tenés mascotas?">
          <Radio.Group
            optionType="button"
            disabled={deshabilitado}
            options={[
              { value: true, label: <span data-testid="solicitar-mascotas-si">Sí</span> },
              { value: false, label: <span data-testid="solicitar-mascotas-no">No</span> },
            ]}
          />
        </Form.Item>
        {/* US-35: el detalle aparece solo si marcó que tiene mascotas. */}
        {/* La ayuda va arriba: abajo está el contador ("N / 300"). */}
        {mascotas && (
          <Form.Item
            name="detalleMascotas"
            label={
              <span className={styles.labelConAyuda}>
                Contanos de tus mascotas
                <span className={styles.labelAyuda}>
                  {aptaMascotas ? 'Esta propiedad está publicada como apta mascotas.' : 'Ojo: esta propiedad no está publicada como apta mascotas.'}
                </span>
              </span>
            }
            rules={reglasDetalleMascotas}
          >
            <Input.TextArea maxLength={MASCOTAS_DETALLE_MAX} showCount autoSize={{ minRows: 2, maxRows: 4 }} disabled={deshabilitado} data-testid="solicitar-mascotas-detalle" />
          </Form.Item>
        )}
      </section>

      {/* ─── Garantía que ofrecés ─── */}
      <section className={styles.bloque}>
        <h3 className={styles.bloqueTitulo}>Garantía que ofrecés</h3>
        <p className={styles.help}>Podés marcar más de una. Los papeles se cargan recién cuando la solicitud se acepta.</p>
        {exigidas.length > 0 && (
          <p className={styles.exigidas} data-testid="solicitar-garantias-exigidas">
            {textoGarantiasExigidas(exigidas)}
          </p>
        )}
        <Form.Item name="garantias" rules={reglasGarantias(exigidas)} className={styles.sinLabel}>
          <Checkbox.Group className={styles.garantias} disabled={deshabilitado}>
            {GARANTIA_OPTIONS.map((opcion) => {
              const exigida = exigidas.includes(opcion.value)
              return (
                <Checkbox key={opcion.value} value={opcion.value} className={`${styles.garantia} ${exigida ? styles.garantiaExigida : ''}`} data-testid={`solicitar-garantia-${opcion.value}`}>
                  <span className={styles.garantiaTexto}>
                    <span className={styles.garantiaTitulo}>
                      {opcion.label}
                      {exigida && (
                        <span className={styles.garantiaBadge} data-testid="solicitar-garantia-exigida">
                          La pide el dueño
                        </span>
                      )}
                    </span>
                    <span className={styles.garantiaAyuda}>{opcion.ayuda}</span>
                  </span>
                </Checkbox>
              )
            })}
          </Checkbox.Group>
        </Form.Item>
      </section>

      {/* ─── Mensaje al dueño (US-35: hasta 600, con contador en tiempo real) ─── */}
      <section className={styles.bloque}>
        {/* La ayuda va arriba: abajo está el contador en tiempo real ("N / 600", US-35). */}
        <Form.Item
          name="mensaje"
          label={
            <span className={styles.labelConAyuda}>
              <span>
                Mensaje al dueño <span className={styles.optional}>· opcional</span>
              </span>
              <span className={styles.labelAyuda}>Lo primero que lee. Contale cuándo te querés mudar y por cuánto tiempo.</span>
            </span>
          }
        >
          <Input.TextArea
            maxLength={SOLICITUD_MENSAJE_MAX}
            showCount
            autoSize={{ minRows: 4, maxRows: 8 }}
            disabled={deshabilitado}
            placeholder={nombreDueno ? `Hola ${nombreDueno.split(' ')[0]}, …` : 'Hola, …'}
            data-testid="solicitar-mensaje"
          />
        </Form.Item>
      </section>

      {/* ─── Antes de enviar ─── */}
      <section className={styles.before}>
        <h3 className={styles.beforeTitle}>Antes de enviar</h3>
        <p className={styles.beforeText}>
          Enviás una solicitud {nombreDueno ? `a ${nombreDueno}` : 'al dueño'} por {propiedad.address}. Va a ver tus datos y lo que completaste acá, y le llega un
          aviso por mail. Podés cancelarla mientras esté pendiente.
        </p>
        {/* US-35: "se debe aceptar lo que implica el envío de la solicitud". */}
        <Form.Item name="acepto" valuePropName="checked" rules={reglasAceptacion} className={styles.sinLabel}>
          <Checkbox disabled={deshabilitado} data-testid="solicitar-acepto">
            Los datos que puse son correctos y entiendo que enviar la solicitud no reserva la propiedad.
          </Checkbox>
        </Form.Item>
        {/* US-35: cuántas pendientes tiene en otras propiedades, solo si son más de 0. */}
        {pendientesEnOtras !== null && pendientesEnOtras > 0 && (
          <p className={styles.pendientes} data-testid="solicitar-pendientes-otras">
            {textoPendientes(pendientesEnOtras)}
          </p>
        )}
      </section>
    </>
  )
}
