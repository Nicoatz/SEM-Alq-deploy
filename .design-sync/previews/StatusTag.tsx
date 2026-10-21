import { StatusTag, ThemeProvider } from '@rentar/ui'

const stackStyle = { display: 'flex', flexDirection: 'column' as const, gap: 14 }
const rowStyle = { display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'center' }
const labelStyle = { margin: '0 0 8px', fontWeight: 600, fontSize: 13 }

const dominios = [
  { domain: 'propiedad', label: 'Propiedad', estados: ['publicada', 'pausada', 'alquilada', 'alquilada_publicada'] },
  { domain: 'contrato', label: 'Contrato', estados: ['borrador', 'pendiente_firma', 'vigente', 'finalizado', 'rescindido'] },
  { domain: 'firma', label: 'Firma', estados: ['pendiente', 'firmado', 'rechazado'] },
  { domain: 'cobro', label: 'Cobro', estados: ['pendiente', 'pagado', 'vencido', 'anulado', 'parcial'] },
  { domain: 'reclamo', label: 'Reclamo', estados: ['abierto', 'en_proceso', 'resuelto', 'cerrado'] },
  { domain: 'suscripcion', label: 'Suscripción', estados: ['activa', 'vencida', 'cancelada'] },
  { domain: 'solicitud', label: 'Solicitud', estados: ['pendiente', 'aceptada', 'rechazada', 'cancelada'] },
  { domain: 'usuario', label: 'Usuario', estados: ['activo', 'suspendido', 'sin_verificar'] },
  { domain: 'factura', label: 'Factura', estados: ['pagada', 'rechazada'] },
] as const

/**
 * Todos los estados de los 9 dominios, uno debajo del otro — el set completo para comparar los
 * colores entre sí de un vistazo. Contrato incluye "Borrador"; propiedad no tiene borrador (fuera del MVP).
 * `as never` en `status`: acá el par domain/status sale de una tabla, y el genérico
 * `StatusTag<D>` no puede correlacionar las dos claves del `.map`.
 */
function DomainGrid() {
  return (
    <div style={stackStyle}>
      {dominios.map((d) => (
        <div key={d.domain}>
          <p style={labelStyle}>{d.label}</p>
          <div style={rowStyle}>
            {d.estados.map((e) => (
              <StatusTag key={e} domain={d.domain} status={e as never} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Tema claro — el par fondo/tinta/borde por `colorKey` de `--rentar-status-*`. */
export function Dominios() {
  return <DomainGrid />
}

/** Mismo set en tema oscuro — mismo par invertido bajo `[data-rentar-theme='dark']`, no una paleta distinta. */
export function DominiosOscuro() {
  return (
    <ThemeProvider dark>
      <div
        data-rentar-theme="dark"
        style={{
          background: 'var(--rentar-color-bg-page)',
          color: 'var(--rentar-color-text-primary)',
          padding: 16,
          borderRadius: 12,
        }}
      >
        <DomainGrid />
      </div>
    </ThemeProvider>
  )
}
