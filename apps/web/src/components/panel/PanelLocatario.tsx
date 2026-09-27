'use client'

/**
 * PanelLocatario.tsx — `/panel` del locatario, versión mínima.
 *
 * Diseño: Claude Design, "Panel de inicio" · 05b ("Locatario · Versión
 * mínima"): lo que ve toda cuenta recién creada, buscar o publicar. Saludo
 * con `PageHeader` y dos `EmptyState`: "Buscar propiedades" (principal) y
 * "¿Tenés una propiedad para alquilar? Publicala" (secundario).
 * Cubre: sin US en Sprint 0 (panel del locatario, mapa A3). El panel completo
 * del locatario (US-11, US-12: próximo pago, contrato, reclamos) es de otro
 * sprint.
 *
 * NOTA: regla del equipo (27/09/2026): cualquier usuario con sesión puede
 * publicar, y al publicar la primera propiedad la cuenta pasa a ser también
 * locadora. Por eso el locatario tiene "Publicar propiedad" acá (y en el
 * encabezado del panel).
 *
 * De dónde saca los datos: solo el nombre, de `useAuth()` (lo pasa la página).
 * Quién lo usa: `app/(app)/panel/page.tsx`, con el rol activo locatario.
 */
import { HomeOutlined, SearchOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useRouter } from 'next/navigation'
import { EmptyState, PageHeader } from '@rentar/ui'
import styles from './PanelLocatario.module.css'

interface PanelLocatarioProps {
  /** Nombre de pila, para el saludo ("Hola, Julieta"). */
  nombre: string
}

/** Inicio mínimo del locatario: buscar o publicar. */
export function PanelLocatario({ nombre }: PanelLocatarioProps) {
  const router = useRouter()

  return (
    <div className={styles.page} data-testid="panel-locatario">
      <PageHeader title={`Hola, ${nombre}`} subtitle="¿Qué querés hacer hoy en RentAR?" />
      <div className={styles.cards}>
        <div className={styles.card}>
          <EmptyState
            icon={<SearchOutlined />}
            title="Buscar propiedades"
            description="Departamentos y casas en alquiler en Córdoba. Filtrá por barrio, precio y ambientes."
            action={
              <Button type="primary" size="large" className={styles.action} onClick={() => router.push('/buscar')} data-testid="panel-locatario-buscar">
                Buscar propiedades
              </Button>
            }
          />
        </div>
        <div className={styles.card}>
          <EmptyState
            icon={<HomeOutlined />}
            title="¿Tenés una propiedad para alquilar? Publicala"
            description="Cargala en unos minutos. Al publicar la primera, se activa tu panel de locador."
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
