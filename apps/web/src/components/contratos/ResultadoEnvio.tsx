'use client'

/**
 * ResultadoEnvio.tsx — el resultado del alta: "Enviaste el contrato a firmar".
 *
 * Cubre: US-05 Registrar contrato de alquiler ("Al enviarlo, el contrato
 * pasa al estado 'pendiente de firma', recibe un código con formato
 * CT-AAAA-NNNN y no se puede editar"). Decisión del PO: el resultado va
 * dentro del alta (código, quiénes firman —locador, locatario y garantes, US-07— e
 * "Ir a los contratos de la propiedad"). Desde "Ver contrato y firmar", el locador firma
 * y genera el enlace de cada garante.
 * Quién lo usa: `AltaContrato.tsx`.
 */
import { CheckCircleFilled } from '@ant-design/icons'
import { Button } from 'antd'
import { useRouter } from 'next/navigation'
import type { ContratoEnviado } from '@rentar/shared-types'
import { StatusTag } from '@rentar/ui'
import { contratosDePropiedadHref } from '@/lib/contratos/rutas'
import styles from './AltaContrato.module.css'

/** Props de {@link ResultadoEnvio}. */
interface ResultadoEnvioProps {
  enviado: ContratoEnviado
  /** Dirección de la propiedad, para el texto. */
  direccion: string
  /** Para volver a la pestaña Contratos de la propiedad (US-43). */
  propiedadId: string
}

/** "Enviaste el contrato a firmar", con el código y los firmantes. */
export function ResultadoEnvio({ enviado, direccion, propiedadId }: ResultadoEnvioProps) {
  const router = useRouter()
  // US-07: el locador, el locatario y cada garante ("A, B y C").
  const nombres = enviado.firmantes.map((firmante) => `${firmante.nombre} (${firmante.rol})`)
  const firmantes = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : (nombres[0] ?? '')
  return (
    <div className={styles.resultado} role="status" data-testid="contrato-enviado">
      <CheckCircleFilled className={styles.resultadoIcono} aria-hidden />
      <h2 className={styles.resultadoTitulo}>Enviaste el contrato a firmar</h2>
      <p className={styles.resultadoCodigo}>
        <span data-testid="contrato-enviado-codigo">{enviado.code}</span> <StatusTag domain="contrato" status={enviado.status} />
      </p>
      <p className={styles.referencia} data-testid="contrato-enviado-firmantes">
        Lo firman {firmantes}. Ya no se puede editar. {direccion} sigue publicada mientras el contrato está pendiente de firma.
      </p>
      <span className={styles.acciones}>
        {/* US-07: desde el detalle, el locador firma y sigue las firmas. */}
        <Button type="primary" onClick={() => router.push(`/panel/contratos/${encodeURIComponent(enviado.id)}`)} data-testid="contrato-enviado-ver">
          Ver contrato y firmar
        </Button>
        <Button onClick={() => router.push(contratosDePropiedadHref(propiedadId))} data-testid="contrato-enviado-ir-contratos">
          Ir a los contratos de la propiedad
        </Button>
      </span>
    </div>
  )
}
