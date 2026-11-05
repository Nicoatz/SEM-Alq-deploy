'use client'

/**
 * MontoAlquiler.tsx — el monto a pagar en la ficha de Mi alquiler.
 *
 * Cubre: US-12 ("se consulta … en Mi alquiler" y "verificar que coincida con el del
 * panel"): sale del mismo service y usa la misma tarjeta que `/panel`. Falla solo
 * este bloque, con su "Reintentar".
 *
 * NOTA: no va en dorado: en la ficha, el monto principal es el "Monto actual".
 * TODO(#27): en real, `proximo_periodo` es uno solo: el contrato que no lo tenga no
 * muestra este bloque.
 *
 * De dónde saca los datos: `cobros.service#getProximoAlquiler`.
 * Quién lo usa: `DetalleContrato.tsx`, en la ficha del locatario.
 */
import { Button, Skeleton } from 'antd'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { getProximoAlquiler } from '@/services/cobros.service'
import { TarjetaProximoAlquiler } from './TarjetaProximoAlquiler'
import styles from './Cobros.module.css'

/** Props de {@link MontoAlquiler}. */
interface MontoAlquilerProps {
  contratoId: string
}

/** El bloque del monto a pagar de un contrato. */
export function MontoAlquiler({ contratoId }: MontoAlquilerProps) {
  const carga = useServiceCall(getProximoAlquiler)

  if (carga.status === 'cargando') return <Skeleton active paragraph={{ rows: 2 }} />

  if (carga.status === 'error') {
    return (
      <div className={styles.errorBlock} role="alert" data-testid="mi-alquiler-monto-error">
        <span className={styles.errorTitle}>No pudimos calcular el monto a pagar</span>
        <span className={styles.errorText}>{carga.message}</span>
        <Button type="primary" onClick={carga.reintentar} data-testid="mi-alquiler-monto-reintentar">
          Reintentar
        </Button>
      </div>
    )
  }

  const item = carga.data.items.find((actual) => actual.contratoId === contratoId)
  if (!item) return null
  return (
    <div data-testid="mi-alquiler-monto">
      <TarjetaProximoAlquiler item={item} titulo="Monto a pagar" destacado={false} />
    </div>
  )
}
