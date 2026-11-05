'use client'

/**
 * PanelLocatario.tsx — `/panel` del locatario.
 *
 * Cubre: US-12 Consultar el monto del alquiler, "Panel del locatario":
 * - La tarjeta "Tu próximo alquiler" (`TarjetaProximoAlquiler`).
 * - "Con dos o más contratos vigentes, se debe mostrar el monto de cada contrato
 *   con su propiedad, y el total del mes."
 * - Los últimos 3 pagos, con acceso al historial completo.
 * - "Cada bloque del panel carga y falla por separado."
 * - Sin contrato: "Todavía no tenés un contrato activo" con acceso a buscar
 *   propiedades. Es la versión mínima del diseño ("Panel de inicio" · 05b).
 *
 * NOTA: no se implementa aunque esté dibujado: el botón Pagar (US-13), reclamos y
 * mensajes. La variación del monto (US-11) vive en Mi alquiler.
 * NOTA: regla del equipo (27/09/2026): cualquier usuario con sesión puede publicar,
 * y al publicar la primera propiedad la cuenta pasa a ser también locadora. Por eso
 * el locatario tiene "Publicar propiedad" acá.
 *
 * De dónde saca los datos: `cobros.service#getProximoAlquiler` y `#getUltimosPagos`;
 * el nombre, de `useAuth()` (lo pasa la página).
 * Quién lo usa: `app/(app)/panel/page.tsx`, con el rol activo locatario.
 */
import { HomeOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Skeleton } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PagoFila } from '@rentar/shared-types'
import { EmptyState, formatDate, formatPeriod, MoneyAmount, PageHeader, StatusTag } from '@rentar/ui'
import { TarjetaProximoAlquiler } from '@/components/cobros/TarjetaProximoAlquiler'
import { ETIQUETA_MEDIO } from '@/lib/cobros/medios'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { getProximoAlquiler, getUltimosPagos } from '@/services/cobros.service'
import styles from './PanelLocatario.module.css'

interface PanelLocatarioProps {
  /** Nombre de pila, para el saludo ("Hola, Julieta"). */
  nombre: string
}

/** Segunda línea de un pago, con el recargo aparte. */
function detallePago(pago: PagoFila): string {
  const base = `Pagado el ${formatDate(pago.fechaPago, 'DD/MM')} · ${ETIQUETA_MEDIO[pago.medio]}`
  return pago.diasAtraso > 0 ? `${base} · con ${pago.diasAtraso === 1 ? '1 día' : `${pago.diasAtraso} días`} de atraso` : base
}

/** Bloque "Últimos pagos": carga y falla solo. */
function UltimosPagos() {
  const carga = useServiceCall(getUltimosPagos)

  return (
    <section className={styles.bloque} data-testid="panel-ultimos-pagos">
      <div className={styles.bloqueEncabezado}>
        <h2 className={styles.bloqueTitulo}>Últimos pagos</h2>
        <Link href="/panel/pagos" data-testid="panel-ver-historial">
          Ver historial
        </Link>
      </div>
      {carga.status === 'cargando' && <Skeleton active paragraph={{ rows: 3 }} />}
      {carga.status === 'error' && (
        <div className={styles.bloqueError} role="alert" data-testid="panel-ultimos-pagos-error">
          <span>No pudimos traer tus últimos pagos.</span>
          <Button size="small" onClick={carga.reintentar} data-testid="panel-ultimos-pagos-reintentar">
            Reintentar
          </Button>
        </div>
      )}
      {carga.status === 'listo' && carga.data.length === 0 && <p className={styles.secundario}>Todavía no tenés pagos registrados.</p>}
      {carga.status === 'listo' && carga.data.length > 0 && (
        <ul className={styles.pagos}>
          {carga.data.map((pago) => (
            <li key={pago.id} className={styles.pago} data-testid="panel-ultimo-pago">
              <span className={styles.pagoDatos}>
                <strong>{formatPeriod(`${pago.periodo}-01`)}</strong>
                <span className={styles.secundario}>{detallePago(pago)}</span>
              </span>
              <span className={styles.pagoMonto}>
                <MoneyAmount amount={pago.monto} size="sm" />
                <StatusTag domain="cobro" status="pagado" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Inicio del locatario: el monto a pagar y los últimos pagos, o buscar y publicar. */
export function PanelLocatario({ nombre }: PanelLocatarioProps) {
  const router = useRouter()
  const carga = useServiceCall(getProximoAlquiler)

  if (carga.status === 'listo' && carga.data.items.length === 0) {
    return (
      <div className={styles.page} data-testid="panel-locatario">
        <PageHeader title={`Hola, ${nombre}`} subtitle="¿Qué querés hacer hoy en RentAR?" />
        <div className={styles.cards}>
          <div className={styles.card}>
            <EmptyState
              icon={<SearchOutlined />}
              title="Todavía no tenés un contrato activo"
              description="Departamentos y casas en alquiler en Córdoba. Filtrá por barrio, precio y ambientes."
              actionBlock
              action={
                <Button type="primary" size="large" className={styles.action} onClick={() => router.push('/buscar')} data-testid="panel-locatario-buscar">
                  Buscar propiedades
                </Button>
              }
              data-testid="proximo-alquiler-sin-contrato"
            />
          </div>
          <div className={styles.card}>
            <EmptyState
              icon={<HomeOutlined />}
              title="¿Tenés una propiedad para alquilar? Publicala"
              description="Cargala en unos minutos. Al publicar la primera, se activa tu panel de locador."
              actionBlock
              action={
                <Button size="large" className={styles.action} onClick={() => router.push('/panel/propiedades/nueva')} data-testid="panel-locatario-publicar">
                  Publicar propiedad
                </Button>
              }
            />
          </div>
        </div>
      </div>
    )
  }

  const varios = carga.status === 'listo' && carga.data.totalMes !== null

  return (
    <div className={styles.page} data-testid="panel-locatario">
      <PageHeader title={`Hola, ${nombre}`} />

      {carga.status === 'cargando' && (
        <div className={styles.bloque} data-testid="proximo-alquiler-cargando">
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      )}

      {carga.status === 'error' && (
        <div className={styles.bloqueError} role="alert" data-testid="proximo-alquiler-error">
          <span>{carga.message}</span>
          <Button size="small" onClick={carga.reintentar} data-testid="proximo-alquiler-reintentar">
            Reintentar
          </Button>
        </div>
      )}

      {carga.status === 'listo' && (
        <div className={varios ? styles.tarjetasVarias : styles.tarjetas}>
          {carga.data.items.map((item) => (
            <TarjetaProximoAlquiler key={item.contratoId} item={item} destacado={!varios} conPropiedad={carga.data.items.length > 1} />
          ))}
        </div>
      )}

      {carga.status === 'listo' && carga.data.totalMes !== null && (
        <section className={styles.totalMes} data-testid="proximo-alquiler-total-mes">
          <span>Total del mes</span>
          <MoneyAmount amount={carga.data.totalMes} size="lg" emphasis />
        </section>
      )}

      <UltimosPagos />
    </div>
  )
}
