'use client'

/**
 * PasosAlta.tsx — el contenido de los 5 pasos del alta (US-01).
 *
 * Diseño: "Alta de propiedad" · 01 a 05. Cada paso es un `FormSection` o
 * varios, con los campos de US-01 y sus reglas (`lib/validation/propiedad.rules.ts`).
 * Los 5 pasos quedan montados todo el tiempo (el que no se ve, oculto): así
 * se puede validar todo antes de publicar y "Anterior" no pierde nada.
 *
 * NOTA: diferencias con el diseño, pedidas por producto: los tipos son los 4
 * de RentAR (sin Local ni Cochera: es residencial); las características son
 * las 5 del catálogo de `/buscar`; el estado es "Publicada / Pausada /
 * Alquilada" (alquilada con fecha → alquilada/publicada); no hay mapa; la antigüedad, el depósito y la duración van en
 * números (años y meses); la actualización es "cada N meses" (1 a 12).
 * Quién lo usa: `AltaPropiedad.tsx`.
 */
import { DatePicker, Form, Grid, Input, InputNumber, Select } from 'antd'
import dayjs from 'dayjs'
import type { ReactNode } from 'react'
import type { FotoNueva } from '@rentar/shared-types'
import { DetailList, FormSection, PropertyCard } from '@rentar/ui'
import { formatARS } from '@rentar/ui/src/utils/formatARS'
import { formatDate } from '@rentar/ui/src/utils/formatDate'
import Image from 'next/image'
import { characteristicOptions, characteristicShortLabel } from '@/lib/catalogs/characteristics'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
import {
  AJUSTE_MESES_OPTIONS,
  ESTADO_ALTA_OPTIONS,
  MEDIO_PAGO_CORTO,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPE_OPTIONS,
  periodicidad,
} from '@/lib/catalogs/propiedad'
import {
  DESCRIPCION_MAXIMO,
  INTERES_DIARIO_MAXIMO,
  M2_MAXIMO,
  reglasAmbientes,
  reglasBanos,
  reglasBarrio,
  reglasCalle,
  reglasDiasGracia,
  reglasDisponibleDesde,
  reglasDormitorios,
  reglasEstado,
  reglasExpensas,
  reglasFotos,
  reglasFotosEdicion,
  reglasMediosPago,
  reglasNumero,
  reglasPrecio,
  reglasSuperficieCubierta,
  reglasSuperficieTotal,
  reglasTipo,
  type AltaValues,
} from '@/lib/validation/propiedad.rules'
import { formatApproxAddress, formatFloorUnit } from '@/services/adapters/direccion'
import { seVeEnBusqueda, tituloDePropiedadNueva } from '@/services/adapters/propiedad.adapter'
import { hoy } from '@/lib/utils/fechas'
import { CaracteristicasField, IndiceField, MediosPagoField, Stepper } from './CamposAlta'
import { FotosField } from './FotosField'
import styles from './Alta.module.css'

/** Etiqueta con "(opcional)" en gris, como pide el diseño (los obligatorios no llevan asterisco). */
function Opcional({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className={styles.optional}>(opcional)</span>
    </>
  )
}

/** Props de `Form.Item` para un `DatePicker` que guarda la fecha como texto ISO (`YYYY-MM-DD`, lo que espera el service). */
const fechaIso = {
  getValueProps: (value?: string | null) => ({ value: value ? dayjs(value) : null }),
  normalize: (value: dayjs.Dayjs | null) => (value ? value.format('YYYY-MM-DD') : null),
}

// ─── Paso 1 · Tipo y ubicación ──────────────────────────────────────────

/** Alta · 01: qué es y dónde está. US-01: tipo, provincia, ciudad, barrio, calle y altura. */
export function PasoUbicacion() {
  return (
    <div className={styles.step}>
      <FormSection title="¿Qué vas a publicar?" description="Con esto armamos el título de la publicación.">
        <Form.Item name="type" label="Tipo de propiedad" rules={reglasTipo} className={styles.fieldNarrow}>
          <Select placeholder="Elegí el tipo" options={PROPERTY_TYPE_OPTIONS} size="large" data-testid="alta-tipo" />
        </Form.Item>
      </FormSection>

      <FormSection
        title="¿Dónde queda?"
        description="La dirección exacta la ves solo vos. En la búsqueda se muestra la calle y la cuadra, nunca la altura ni el piso."
      >
        <div className={styles.gridAddress}>
          <Form.Item name="street" label="Calle" rules={reglasCalle}>
            <Input size="large" placeholder="Ej. Obispo Trejo" autoComplete="off" data-testid="alta-calle" />
          </Form.Item>
          <Form.Item name="streetNumber" label="Número" rules={reglasNumero}>
            <InputNumber size="large" placeholder="Ej. 1250" controls={false} min={1} max={99999} precision={0} className={styles.fullWidth} data-testid="alta-numero" />
          </Form.Item>
          <Form.Item name="neighborhoodSlug" label="Barrio" rules={reglasBarrio}>
            <Select
              size="large"
              placeholder="Elegí el barrio"
              options={neighborhoods.map((barrio) => ({ value: barrio.slug, label: barrio.name }))}
              data-testid="alta-barrio"
            />
          </Form.Item>
        </div>
        <div className={styles.gridAuto}>
          <Form.Item name="floor" label={<Opcional>Piso</Opcional>}>
            <Input size="large" placeholder="Ej. 7 o PB" maxLength={10} data-testid="alta-piso" />
          </Form.Item>
          <Form.Item name="unit" label={<Opcional>Departamento</Opcional>}>
            <Input size="large" placeholder="Ej. B" maxLength={10} data-testid="alta-depto" />
          </Form.Item>
          <Form.Item name="city" label="Ciudad">
            <Input size="large" disabled data-testid="alta-ciudad" />
          </Form.Item>
          <Form.Item name="province" label="Provincia" extra="Por ahora RentAR opera solo en Córdoba Capital.">
            <Input size="large" disabled data-testid="alta-provincia" />
          </Form.Item>
        </div>
      </FormSection>
    </div>
  )
}

// ─── Paso 2 · Características ───────────────────────────────────────────

/**
 * Alta · 02. US-01: ambientes y dormitorios (salvo monoambiente), baños,
 * antigüedad, superficies, tags, descripción, estado y disponibilidad.
 */
/** Props de {@link PasoCaracteristicas}. */
interface PasoCaracteristicasProps {
  /**
   * Solo la edición (US-03): id del contrato vigente. Con contrato, el
   * estado queda en "Alquilada" (lo fija el contrato); la fecha de
   * disponibilidad sigue editable, para publicarla para el próximo inquilino.
   */
  estadoFijadoPorContrato?: string
}

export function PasoCaracteristicas({ estadoFijadoPorContrato }: PasoCaracteristicasProps = {}) {
  const form = Form.useFormInstance<AltaValues>()
  const tipo = Form.useWatch('type', form)
  const ambientes = Form.useWatch('rooms', form) ?? 2
  const total = Form.useWatch('totalAreaM2', form)
  const estado = Form.useWatch('status', form)
  const esMono = tipo === 'monoambiente'

  return (
    <div className={styles.step}>
      <FormSection title="Cuántos y cuánto" description="Son los datos que más filtran en la búsqueda: conviene completarlos todos.">
        <div className={styles.gridCounters}>
          <Form.Item
            name="rooms"
            label="Ambientes"
            rules={reglasAmbientes(tipo)}
            dependencies={['type']}
            extra={esMono ? 'Un monoambiente tiene un solo ambiente.' : undefined}
          >
            <Stepper label="un ambiente" min={1} max={20} disabled={esMono} data-testid="alta-ambientes" />
          </Form.Item>
          <Form.Item
            name="bedrooms"
            label="Dormitorios"
            rules={reglasDormitorios(tipo, ambientes)}
            dependencies={['type', 'rooms']}
            extra={esMono ? 'Sin dormitorios aparte.' : undefined}
          >
            <Stepper label="un dormitorio" min={0} max={19} disabled={esMono} data-testid="alta-dormitorios" />
          </Form.Item>
          <Form.Item name="bathrooms" label="Baños" rules={reglasBanos}>
            <Stepper label="un baño" min={1} max={10} data-testid="alta-banos" />
          </Form.Item>
          <Form.Item name="ageYears" label={<Opcional>Antigüedad</Opcional>} extra="Si no sabés el año exacto, poné un aproximado.">
            <InputNumber size="large" min={0} max={200} precision={0} suffix="años" className={styles.fullWidth} data-testid="alta-antiguedad" />
          </Form.Item>
        </div>
        <div className={styles.gridTwo}>
          <Form.Item name="totalAreaM2" label="Superficie total" rules={reglasSuperficieTotal}>
            <InputNumber size="large" min={1} max={M2_MAXIMO} precision={0} suffix="m²" className={styles.fullWidth} data-testid="alta-superficie-total" />
          </Form.Item>
          <Form.Item
            name="coveredAreaM2"
            label="Superficie cubierta"
            rules={reglasSuperficieCubierta(total)}
            dependencies={['totalAreaM2']}
            extra="Lo cubierto no incluye balcón ni patio. Nunca puede ser mayor que la total."
          >
            <InputNumber size="large" min={1} max={M2_MAXIMO} precision={0} suffix="m²" className={styles.fullWidth} data-testid="alta-superficie-cubierta" />
          </Form.Item>
        </div>
      </FormSection>

      <FormSection title="¿Qué tiene?" description="Marcá solo lo que la propiedad tiene de verdad. Los interesados filtran por esto.">
        <Form.Item name="characteristics" label={<Opcional>Características</Opcional>}>
          <CaracteristicasField />
        </Form.Item>
      </FormSection>

      <FormSection
        title="Contala y decinos en qué estado está"
        description="La descripción es lo primero que lee el interesado. El estado define si la publicación se ve en la búsqueda."
      >
        <Form.Item name="description" label={<Opcional>Descripción</Opcional>}>
          <Input.TextArea
            rows={4}
            maxLength={DESCRIPCION_MAXIMO}
            showCount
            placeholder="Ej. Luminoso, a dos cuadras de Ciudad Universitaria, con balcón al frente y cocina separada."
            data-testid="alta-descripcion"
          />
        </Form.Item>
        <div className={styles.gridTwo}>
          <Form.Item
            name="status"
            label="Estado de la publicación"
            rules={reglasEstado}
            extra={
              estadoFijadoPorContrato ? (
                <span data-testid="editar-propiedad-bloqueado-status">🔒 Lo fija el contrato {estadoFijadoPorContrato}.</span>
              ) : (
                'Publicada se ve en la búsqueda. Pausada no. Alquilada, solo si cargás desde cuándo vuelve a estar disponible.'
              )
            }
          >
            <Select size="large" placeholder="Elegí el estado" options={ESTADO_ALTA_OPTIONS} disabled={Boolean(estadoFijadoPorContrato)} data-testid="alta-estado" />
          </Form.Item>
          <Form.Item
            name="availableFrom"
            label={<Opcional>Disponible desde</Opcional>}
            rules={reglasDisponibleDesde}
            extra={estado === 'alquilada' ? 'Si la cargás, la propiedad se publica para el próximo inquilino.' : 'Dejalo vacío si ya está disponible.'}
            {...fechaIso}
          >
            <DatePicker
              size="large"
              format="DD/MM/YYYY"
              placeholder="dd/mm/aaaa"
              disabledDate={(fecha) => fecha.isBefore(hoy())}
              className={styles.fullWidth}
              data-testid="alta-disponible"
            />
          </Form.Item>
        </div>
      </FormSection>
    </div>
  )
}

// ─── Paso 3 · Fotos ─────────────────────────────────────────────────────

/** Props de {@link PasoFotos}. */
interface PasoFotosProps {
  /**
   * Solo la edición (US-03): las fotos guardadas. Con esto, el mínimo de 3
   * se valida solo si se cambian las fotos (`reglasFotosEdicion`). El alta
   * no lo pasa: ahí el mínimo vale siempre.
   */
  fotosOriginales?: FotoNueva[]
}

/** Alta · 03. US-01: de 3 a 50 fotos JPG o PNG de hasta 350 KB; la primera es la principal. */
export function PasoFotos({ fotosOriginales }: PasoFotosProps = {}) {
  return (
    <div className={styles.step}>
      <FormSection title="Subí las fotos" description="Con 3 fotos alcanza para publicar, pero con 6 o más se entiende mucho mejor la propiedad.">
        <Form.Item name="photos" rules={fotosOriginales ? reglasFotosEdicion(fotosOriginales) : reglasFotos} className={styles.noLabel}>
          <FotosField />
        </Form.Item>
        {/* La principal se guarda aparte, por id (la maneja FotosField). */}
        <Form.Item name="mainPhotoId" hidden>
          <Input />
        </Form.Item>
      </FormSection>
    </div>
  )
}

// ─── Paso 4 · Condiciones ───────────────────────────────────────────────

/**
 * Alta · 04. US-01: precio y expensas (obligatorios), interés por día y días
 * de gracia, medios de pago, índice y frecuencia, depósito y duración.
 */
/** Props de {@link PasoCondiciones}. */
interface PasoCondicionesProps {
  /**
   * Solo la edición (US-03): id del contrato vigente. Con contrato, el
   * precio, el índice y la frecuencia de ajuste quedan bloqueados ("Detalle
   * de propiedad del locador" · 06: "eso vive en el contrato"). El alta no lo pasa.
   */
  fijadosPorContrato?: string
}

/** "🔒 Lo fija el contrato CT-2026-0148." con su `data-testid`. */
function LoFijaElContrato({ contrato, campo }: { contrato: string; campo: string }) {
  return <span data-testid={`editar-propiedad-bloqueado-${campo}`}>🔒 Lo fija el contrato {contrato}.</span>
}

export function PasoCondiciones({ fijadosPorContrato }: PasoCondicionesProps = {}) {
  const form = Form.useFormInstance<AltaValues>()
  const interes = Form.useWatch('dailyInterestPct', form)
  const precio = Form.useWatch('priceMonthly', form)
  const deposito = Form.useWatch('depositMonths', form)

  return (
    <div className={styles.step}>
      <FormSection title="Cuánto pedís" description="El precio es lo único dorado de esta pantalla: en RentAR, el dorado marca la plata.">
        <div className={styles.gridTwo}>
          <Form.Item
            name="priceMonthly"
            label="Precio mensual"
            rules={reglasPrecio}
            extra={fijadosPorContrato ? <LoFijaElContrato contrato={fijadosPorContrato} campo="priceMonthly" /> : 'Por mes, sin expensas.'}
          >
            <InputNumber<number>
              size="large"
              disabled={Boolean(fijadosPorContrato)}
              min={0}
              step={5000}
              controls={false}
              prefix="$"
              formatter={(valor) => (valor ? Number(valor).toLocaleString('es-AR') : '')}
              parser={(texto) => Number((texto ?? '').replace(/\D/g, ''))}
              className={`${styles.fullWidth} ${styles.moneyInput}`}
              data-testid="alta-precio"
            />
          </Form.Item>
          <Form.Item name="expenses" label="Expensas" rules={reglasExpensas} extra="Si la propiedad no paga expensas, dejá 0.">
            <InputNumber<number>
              size="large"
              min={0}
              step={1000}
              controls={false}
              prefix="$"
              formatter={(valor) => (valor || valor === 0 ? Number(valor).toLocaleString('es-AR') : '')}
              parser={(texto) => Number((texto ?? '').replace(/\D/g, ''))}
              className={styles.fullWidth}
              data-testid="alta-expensas"
            />
          </Form.Item>
        </div>
      </FormSection>

      <FormSection
        title="Penalización por mora"
        description="Qué se cobra si el alquiler se paga después del vencimiento. Se copia al contrato y el locatario lo ve antes de firmar."
      >
        <div className={styles.gridTwo}>
          <Form.Item name="dailyInterestPct" label={<Opcional>Interés por día de atraso</Opcional>} extra="Sobre el monto impago. Dejalo vacío si no cobrás recargo.">
            <InputNumber
              size="large"
              min={0}
              max={INTERES_DIARIO_MAXIMO}
              step={0.1}
              decimalSeparator=","
              suffix="% diario"
              className={styles.fullWidth}
              data-testid="alta-interes"
            />
          </Form.Item>
          <Form.Item
            name="graceDays"
            label={(interes ?? 0) > 0 ? 'Días de gracia' : <Opcional>Días de gracia</Opcional>}
            rules={reglasDiasGracia(interes)}
            dependencies={['dailyInterestPct']}
            extra="Antes de que empiece a correr el interés."
          >
            <InputNumber size="large" min={0} max={31} precision={0} suffix="días" className={styles.fullWidth} data-testid="alta-dias-gracia" />
          </Form.Item>
        </div>
      </FormSection>

      <FormSection
        title="Cómo aceptás que te paguen"
        description="Los medios que habilitás para este alquiler, y el recargo si alguno te cuesta plata. El locatario ve estos mismos números antes de elegir."
      >
        <Form.Item name="paymentMethods" rules={reglasMediosPago} className={styles.noLabel}>
          <MediosPagoField />
        </Form.Item>
        <p className={styles.infoNote}>
          El recargo se aplica sobre el total del período y se muestra aparte al pagar, nunca escondido dentro del alquiler. Tope del 3 %; con 0, el medio se ofrece
          sin costo extra. Al menos un medio tiene que quedar habilitado.
        </p>
      </FormSection>

      <FormSection
        title="Cómo se actualiza el precio"
        description="Por ley el alquiler se ajusta con un índice público: vos elegís cuál y cada cuánto. RentAR hace la cuenta cuando toca."
      >
        <div className={styles.gridAdjust}>
          <Form.Item
            name="adjustmentEveryMonths"
            label={<Opcional>Cada cuánto se actualiza</Opcional>}
            extra={
              fijadosPorContrato ? (
                <LoFijaElContrato contrato={fijadosPorContrato} campo="adjustmentEveryMonths" />
              ) : (
                'De 1 a 12 meses. El alquiler queda igual durante ese período y después se ajusta una vez.'
              )
            }
          >
            <Select size="large" allowClear placeholder="Elegí cada cuánto" options={AJUSTE_MESES_OPTIONS} disabled={Boolean(fijadosPorContrato)} data-testid="alta-ajuste-meses" />
          </Form.Item>
          <Form.Item
            name="adjustmentIndex"
            label={<Opcional>Índice de ajuste</Opcional>}
            extra={fijadosPorContrato ? <LoFijaElContrato contrato={fijadosPorContrato} campo="adjustmentIndex" /> : undefined}
          >
            <IndiceField disabled={Boolean(fijadosPorContrato)} />
          </Form.Item>
        </div>
      </FormSection>

      <FormSection title="Qué le vas a pedir al inquilino" description="Cuanto más claro esté acá, menos consultas repetidas vas a recibir.">
        <div className={styles.gridTwo}>
          <Form.Item
            name="depositMonths"
            label={<Opcional>Depósito</Opcional>}
            extra={
              deposito && precio
                ? `Se devuelve al final si no hay daños. Hoy son ${formatARS(deposito * precio)}.`
                : 'En meses de alquiler. Se devuelve al final si no hay daños.'
            }
          >
            <InputNumber size="large" min={0} max={12} precision={0} suffix={deposito === 1 ? 'mes' : 'meses'} className={styles.fullWidth} data-testid="alta-deposito" />
          </Form.Item>
          <Form.Item name="contractMonths" label={<Opcional>Duración del contrato</Opcional>} extra="Lo habitual en vivienda son 36 meses.">
            <InputNumber size="large" min={1} max={120} precision={0} suffix="meses" className={styles.fullWidth} data-testid="alta-duracion" />
          </Form.Item>
        </div>
      </FormSection>
    </div>
  )
}

// ─── Paso 5 · Revisión ──────────────────────────────────────────────────

/** "a, b y c". */
function enumerar(partes: string[]): string {
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : (partes[0] ?? '')
}

interface ResumenProps {
  title: string
  onEditar: () => void
  children: ReactNode
  'data-testid'?: string
}

/** Una tarjeta de resumen con su "Editar" (Alta · 05). */
function Resumen({ title, onEditar, children, ...rest }: ResumenProps) {
  return (
    <section className={styles.summaryCard} {...rest}>
      <div className={styles.summaryHeader}>
        <h4 className={styles.summaryTitle}>{title}</h4>
        <button type="button" className={styles.linkButton} onClick={onEditar}>
          Editar
        </button>
      </div>
      {children}
    </section>
  )
}

interface PasoRevisionProps {
  valores: AltaValues
  onEditar: (paso: number) => void
}

/**
 * Alta · 05: lo que cargó, con "Editar" por sección, y la tarjeta tal como
 * se va a ver en `/buscar` (la misma `PropertyCard`, con la dirección
 * aproximada de la zona pública).
 */
export function PasoRevision({ valores, onEditar }: PasoRevisionProps) {
  // En móvil, las características en una columna (en dos no entran).
  const pantallas = Grid.useBreakpoint()
  const columnasCaracteristicas = pantallas.md === false ? 1 : 2
  const barrio = neighborhoods.find((item) => item.slug === valores.neighborhoodSlug)
  const pisoDepto = formatFloorUnit(valores.floor ?? null, valores.unit ?? null)
  const direccion = valores.street && valores.streetNumber ? `${valores.street} ${valores.streetNumber}${pisoDepto ? `, ${pisoDepto}` : ''}` : '—'
  const principal = valores.photos.find((foto) => foto.id === valores.mainPhotoId) ?? valores.photos[0]
  const fotosOrdenadas = principal ? [principal, ...valores.photos.filter((foto) => foto.id !== principal.id)] : []
  const estadoTexto = ESTADO_ALTA_OPTIONS.find((opcion) => opcion.value === valores.status)?.label ?? '—'
  const medios = valores.paymentMethods.map((medio) => (medio.surchargePct > 0 ? `${MEDIO_PAGO_CORTO[medio.method]} +${String(medio.surchargePct).replace('.', ',')} %` : MEDIO_PAGO_CORTO[medio.method]))
  // Publicada, o alquilada con fecha de disponibilidad (alquilada/publicada).
  const publicada = valores.status ? seVeEnBusqueda({ status: valores.status, availableFrom: valores.availableFrom ?? null }) : false

  return (
    <div className={styles.review}>
      <div className={styles.reviewColumn}>
        <Resumen title="Tipo y ubicación" onEditar={() => onEditar(0)} data-testid="alta-resumen-ubicacion">
          <DetailList
            column={1}
            items={[
              { label: 'Tipo', value: valores.type ? PROPERTY_TYPE_LABEL[valores.type] : '—' },
              { label: 'Dirección', value: direccion },
              { label: 'Barrio', value: barrio ? `${barrio.name}, ${valores.city}, ${valores.province}` : '—' },
            ]}
          />
        </Resumen>
        <Resumen title="Características" onEditar={() => onEditar(1)} data-testid="alta-resumen-caracteristicas">
          <DetailList
            column={columnasCaracteristicas}
            items={[
              { label: 'Ambientes', value: String(valores.rooms) },
              { label: 'Dormitorios', value: String(valores.bedrooms) },
              { label: 'Baños', value: String(valores.bathrooms) },
              { label: 'Antigüedad', value: valores.ageYears || valores.ageYears === 0 ? `${valores.ageYears} años` : 'Sin dato' },
              { label: 'Superficie', value: valores.totalAreaM2 ? `${valores.totalAreaM2} m² (${valores.coveredAreaM2 ?? '—'} m² cubiertos)` : '—' },
              {
                label: 'Características',
                value: valores.characteristics.length ? enumerar(characteristicOptions.filter((o) => valores.characteristics.includes(o.key)).map((o) => o.label)) : 'Ninguna',
              },
              { label: 'Estado', value: valores.availableFrom ? `${estadoTexto} · disponible desde ${formatDate(valores.availableFrom)}` : estadoTexto },
            ]}
          />
        </Resumen>
        <Resumen title={`Fotos · ${valores.photos.length} cargadas`} onEditar={() => onEditar(2)} data-testid="alta-resumen-fotos">
          <div className={styles.summaryPhotos}>
            {fotosOrdenadas.slice(0, 4).map((foto, index) => (
              <Image key={foto.id} src={foto.src} alt={foto.name} width={96} height={58} unoptimized className={`${styles.summaryPhoto} ${index === 0 ? styles.summaryPhotoMain : ''}`} />
            ))}
            {fotosOrdenadas.length > 4 && <span className={styles.summaryPhotoMore}>+{fotosOrdenadas.length - 4}</span>}
          </div>
        </Resumen>
        <Resumen title="Condiciones" onEditar={() => onEditar(3)} data-testid="alta-resumen-condiciones">
          <DetailList
            column={1}
            items={[
              { label: 'Precio mensual', value: valores.priceMonthly ? formatARS(valores.priceMonthly) : '—' },
              { label: 'Expensas', value: valores.expenses ? formatARS(valores.expenses) : 'Sin expensas' },
              {
                label: 'Mora',
                value: valores.dailyInterestPct
                  ? `${String(valores.dailyInterestPct).replace('.', ',')} % diario · ${valores.graceDays ?? 0} días de gracia`
                  : 'Sin interés por atraso',
              },
              { label: 'Medios de pago', value: medios.length ? enumerar(medios) : '—' },
              {
                label: 'Ajuste',
                value: valores.adjustmentIndex
                  ? `${valores.adjustmentIndex}${valores.adjustmentEveryMonths ? `, ${periodicidad(valores.adjustmentEveryMonths)}` : ''}`
                  : valores.adjustmentEveryMonths
                    ? `Sin índice, ${periodicidad(valores.adjustmentEveryMonths)}`
                    : 'Sin índice',
              },
              {
                label: 'Depósito',
                value: valores.depositMonths
                  ? `${valores.depositMonths} ${valores.depositMonths === 1 ? 'mes' : 'meses'}${valores.priceMonthly ? ` (${formatARS(valores.depositMonths * valores.priceMonthly)})` : ''}`
                  : 'Sin depósito',
              },
              { label: 'Duración', value: valores.contractMonths ? `${valores.contractMonths} meses` : 'Sin dato' },
            ]}
          />
        </Resumen>
      </div>

      <div className={styles.reviewColumn}>
        <section className={styles.preview}>
          <span className={styles.previewTitle}>Así te van a ver</span>
          <span className={styles.previewText}>
            {publicada
              ? 'Esta es la tarjeta que aparece en la búsqueda de propiedades.'
              : 'Mientras esté pausada, o alquilada sin fecha de disponibilidad, no aparece en la búsqueda. Así se va a ver cuando la publiques.'}
          </span>
          {/* `inert`: es una vista previa, la tarjeta no se puede tocar. */}
          <div className={styles.previewCard} inert data-testid="alta-vista-previa">
            <PropertyCard
              layout="busqueda"
              href="#"
              title={valores.type ? tituloDePropiedadNueva({ type: valores.type, rooms: valores.rooms }) : 'Tu propiedad'}
              neighborhoodName={barrio?.name ?? ''}
              propertyType={valores.type ?? 'departamento'}
              priceMonthly={valores.priceMonthly ?? 0}
              expenses={valores.expenses ?? undefined}
              bedrooms={valores.bedrooms}
              areaM2={valores.totalAreaM2 ?? 0}
              adjustmentIndex={valores.adjustmentIndex ?? null}
              imageSrc={principal?.src ?? '/placeholder-propiedad.svg'}
              photoSrcs={fotosOrdenadas.map((foto) => foto.src)}
              // Zona pública: dirección aproximada (ver la NOTA de privacidad en direccion.ts).
              address={valores.street && valores.streetNumber ? formatApproxAddress(valores.street, valores.streetNumber) : undefined}
              description={valores.description}
              availableFrom={valores.availableFrom ?? null}
              characteristicLabel={valores.characteristics[0] ? characteristicShortLabel[valores.characteristics[0]] : undefined}
              referenceDate={hoy().toDate()}
            />
          </div>
        </section>

        <section className={styles.beforeNotes}>
          <span className={styles.beforeTitle}>{publicada ? 'Antes de publicar' : 'Antes de guardar'}</span>
          <ul className={styles.beforeList}>
            {publicada ? (
              <li>
                {valores.status === 'alquilada'
                  ? 'Como cargaste desde cuándo vuelve a estar disponible, se publica para el próximo inquilino: se ve en la búsqueda con esa fecha.'
                  : 'Al publicar, la propiedad queda visible para cualquiera que busque en Córdoba.'}
              </li>
            ) : (
              <li>Queda guardada en Mis propiedades como {estadoTexto.toLowerCase()}, sin aparecer en la búsqueda.</li>
            )}
            <li>La dirección exacta la ves solo vos: en la búsqueda se muestra la calle y la cuadra.</li>
            <li>El precio y el índice se copian al contrato cuando aceptes a un inquilino.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

