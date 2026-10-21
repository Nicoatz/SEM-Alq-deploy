'use client'

/**
 * FichaAlquiler.tsx — los bloques de la ficha del locatario (Mi alquiler).
 *
 * Cubre: US-27 Consultar mis alquileres, "Ficha del alquiler":
 * - la propiedad: foto principal, dirección exacta (con el piso) y barrio;
 *   el estado y el código del contrato ({@link EncabezadoAlquiler});
 * - el locador con su nombre y contacto ({@link LocadorAlquiler});
 * - las condiciones: vigencia, monto actual, depósito, índice y
 *   periodicidad, día de pago, medios de pago y garantes
 *   ({@link CondicionesAlquiler});
 * - "Lo que viene": próximo pago, próximo ajuste con su índice (monto "a
 *   definir", decisión del PO) y fin del contrato, con los días que faltan
 *   ({@link LoQueVieneAlquiler}). No va en un contrato finalizado.
 * NOTA: solo datos de ESTE contrato: nada de otras propiedades del locador,
 * solicitudes de terceros ni legajos ajenos.
 *
 * Lo arma `VistaContrato` (`DetalleContrato.tsx`) con `vista="locatario"`;
 * la firma, el documento, el PDF y el historial son los mismos que ve el locador.
 */
import Image from 'next/image'
import { HomeOutlined } from '@ant-design/icons'
import type { ContratoDetalle } from '@rentar/shared-types'
import { DetailList, IndexBadge, MoneyAmount, StatusTag } from '@rentar/ui'
import { MEDIO_PAGO_CORTO } from '@/lib/catalogs/propiedad'
import { fechaCorta } from '@/lib/contratos/fechas'
import { loQueViene, textoFaltan } from '@/lib/contratos/loQueViene'
import { useFotoConRespaldo } from '@/lib/imagenes/fotoConRespaldo'
import { dniParaMostrar, telefonoParaMostrar } from '@/lib/perfil/formato'
import { hoy } from '@/lib/utils/fechas'
import styles from './DetalleContrato.module.css'

/** Props comunes: el contrato cargado. */
interface FichaProps {
  contrato: ContratoDetalle
}

/** "Nombre Apellido" de una parte. */
function nombreDe(parte: ContratoDetalle['locador']): string {
  return `${parte.nombre} ${parte.apellido}`.trim()
}

/** "cada 6 meses" / "cada 12 meses". */
function cadaTexto(meses: number | null): string {
  return meses ? `cada ${meses} meses` : ''
}

/** Foto, dirección exacta y barrio, con el estado y el código del contrato. */
export function EncabezadoAlquiler({ contrato }: FichaProps) {
  const foto = useFotoConRespaldo(contrato.propiedad.photoSrc ?? '')
  return (
    <section className={styles.fichaPropiedad} aria-label="La propiedad" data-testid="mi-alquiler-propiedad">
      <div className={styles.fichaFoto}>
        {contrato.propiedad.photoSrc ? (
          <Image src={foto.src} onError={foto.onError} alt="" fill sizes="(max-width: 640px) 100vw, 220px" unoptimized className={styles.fichaFotoImg} />
        ) : (
          <HomeOutlined aria-hidden className={styles.fichaFotoVacia} />
        )}
      </div>
      <div className={styles.fichaPropiedadDatos}>
        <span className={styles.fichaDireccion} data-testid="mi-alquiler-direccion">
          {contrato.propiedad.address}
        </span>
        <span className={styles.valorSecundario}>{contrato.propiedad.neighborhoodName ? `${contrato.propiedad.neighborhoodName}, Córdoba` : 'Córdoba'}</span>
        <span className={styles.fichaEstado}>
          <StatusTag domain="contrato" status={contrato.status} data-testid="mi-alquiler-estado" />
          <span className={styles.valorSecundario} data-testid="mi-alquiler-codigo">
            {contrato.code ?? 'Sin código'}
          </span>
        </span>
      </div>
    </section>
  )
}

/** "Lo que viene" (US-27): próximo pago, próximo ajuste y fin, con los días que faltan. */
export function LoQueVieneAlquiler({ contrato }: FichaProps) {
  const { condiciones } = contrato
  const hoyIso = hoy().format('YYYY-MM-DD')
  const { pago, ajuste, fin } = loQueViene({
    hoyIso,
    inicio: condiciones.startDate,
    fin: contrato.endDate,
    diaPago: condiciones.paymentDueDay,
    indice: condiciones.adjustmentIndex,
    cadaMeses: contrato.ajusteCadaMeses,
  })
  return (
    <section className={styles.tarjeta} aria-labelledby="mi-alquiler-viene-titulo" data-testid="mi-alquiler-lo-que-viene">
      <h2 id="mi-alquiler-viene-titulo" className={styles.tarjetaTitulo}>
        Lo que viene
      </h2>
      <ul className={styles.viene}>
        <li className={styles.vieneItem} data-testid="mi-alquiler-proximo-pago">
          <span className={styles.vieneTitulo}>Próximo vencimiento de pago</span>
          {pago ? (
            <span>
              <strong>{fechaCorta(pago.fecha)}</strong> · {textoFaltan(pago.dias)}
            </span>
          ) : (
            <span className={styles.valorSecundario}>{condiciones.paymentDueDay ? 'No quedan pagos en este contrato.' : 'Sin dato del día de pago.'}</span>
          )}
        </li>
        {/* US-27: "contrato sin ajuste → no se muestra la fecha de próximo ajuste". */}
        {condiciones.adjustmentIndex !== 'sin_ajuste' && (
          <li className={styles.vieneItem} data-testid="mi-alquiler-proximo-ajuste">
            <span className={styles.vieneTitulo}>Próximo ajuste</span>
            {ajuste ? (
              <span className={styles.ajuste}>
                <strong>{fechaCorta(ajuste.fecha)}</strong> · {textoFaltan(ajuste.dias)} · <IndexBadge index={condiciones.adjustmentIndex} />
                <span className={styles.valorSecundario}>Monto: a definir</span>
              </span>
            ) : (
              <span className={styles.valorSecundario}>No quedan ajustes antes del fin del contrato.</span>
            )}
          </li>
        )}
        <li className={styles.vieneItem} data-testid="mi-alquiler-fin">
          <span className={styles.vieneTitulo}>Fin del contrato</span>
          {fin ? (
            <span>
              <strong>{fechaCorta(fin.fecha)}</strong> · {textoFaltan(fin.dias)}
            </span>
          ) : (
            <span className={styles.valorSecundario}>Sin dato</span>
          )}
        </li>
      </ul>
    </section>
  )
}

/** Las condiciones del contrato (US-27). */
export function CondicionesAlquiler({ contrato }: FichaProps) {
  const { condiciones, propiedad } = contrato
  const vigencia = condiciones.startDate && contrato.endDate ? `Desde el ${fechaCorta(condiciones.startDate)} hasta el ${fechaCorta(contrato.endDate)}` : 'Sin dato'
  const medios = propiedad.cobro.paymentMethods.map((medio) => MEDIO_PAGO_CORTO[medio.method] + (medio.surchargePct > 0 ? ` (+${medio.surchargePct} %)` : ''))
  const sinRegistro = !contrato.firmasRegistradas && contrato.garantes.length === 0
  const items = [
    { label: 'Vigencia', value: vigencia },
    { label: 'Monto actual', value: contrato.montoActual === null ? 'Sin dato' : <MoneyAmount amount={contrato.montoActual} emphasis /> },
    { label: 'Depósito', value: condiciones.deposit === null ? 'Sin dato' : <MoneyAmount amount={condiciones.deposit} /> },
    {
      label: 'Ajuste',
      value: (
        <span className={styles.ajuste}>
          <IndexBadge index={condiciones.adjustmentIndex} />
          {condiciones.adjustmentIndex !== 'sin_ajuste' ? cadaTexto(contrato.ajusteCadaMeses) : null}
        </span>
      ),
    },
    { label: 'Día de pago', value: condiciones.paymentDueDay === null ? 'Sin dato' : `Día ${condiciones.paymentDueDay} de cada mes` },
    { label: 'Medios de pago', value: medios.length === 0 ? 'Sin dato' : medios.join(' · ') },
    {
      label: contrato.garantes.length === 1 ? 'Garante' : 'Garantes',
      value:
        contrato.garantes.length === 0 ? (
          sinRegistro ? 'Sin dato' : 'Sin garantes'
        ) : (
          <span className={styles.valorCompuesto}>
            {contrato.garantes.map((garante) => (
              <span key={garante.key}>
                {garante.fullName}
                {garante.dni ? ` · DNI ${dniParaMostrar(garante.dni)}` : ''}
              </span>
            ))}
          </span>
        ),
    },
  ]
  return (
    <section className={styles.tarjeta} data-testid="mi-alquiler-condiciones">
      <DetailList title="Condiciones" items={items} />
    </section>
  )
}

/** El locador con su contacto (US-27: "nombre y datos de contacto del locador"). */
export function LocadorAlquiler({ contrato }: FichaProps) {
  const { locador } = contrato
  return (
    <section className={styles.tarjeta} aria-labelledby="mi-alquiler-locador-titulo" data-testid="mi-alquiler-locador">
      <h2 id="mi-alquiler-locador-titulo" className={styles.tarjetaTitulo}>
        Locador
      </h2>
      <span className={styles.valorCompuesto}>
        <strong>{nombreDe(locador) || 'Sin dato'}</strong>
        {locador.email && (
          <a href={`mailto:${locador.email}`} className={styles.contacto} data-testid="mi-alquiler-locador-email">
            {locador.email}
          </a>
        )}
        {locador.telefono && (
          <a href={`tel:${locador.telefono}`} className={styles.contacto} data-testid="mi-alquiler-locador-telefono">
            {telefonoParaMostrar(locador.telefono)}
          </a>
        )}
      </span>
    </section>
  )
}
