/**
 * ActivityTimeline.tsx — línea de tiempo de eventos (historial de un cobro, un contrato, un
 * reclamo).
 *
 * Quién lo usa: el historial del contrato (`apps/web`, US-07, con `dateFormat="absolute"`) y el
 * catálogo `/design-system`.
 */
import { Timeline } from 'antd'
import type { SemanticColorKey } from '../../tokens/semantic'
import { formatDate, formatRelative } from '../../utils/formatDate'

interface ActivityEvent {
  id: string
  title: string
  description?: string
  date: string | Date
  /** Color del punto del evento. @default 'info' */
  colorKey?: SemanticColorKey
}

/** Props de {@link ActivityTimeline}. */
interface ActivityTimelineProps {
  events: ActivityEvent[]
  /**
   * Cómo se muestra la fecha de cada evento: `'relative'` ("hace 2 horas") o
   * `'absolute'` ("22/09/2026 a las 11:40"), para cuando la fecha y la hora
   * exactas importan (ej. el historial de firmas de un contrato, US-07).
   * @default 'relative'
   */
  dateFormat?: 'relative' | 'absolute'
  'data-testid'?: string
}

const DOT_COLOR: Record<SemanticColorKey, string> = {
  success: 'green',
  warning: 'orange',
  error: 'red',
  info: 'blue',
  neutral: 'gray',
  money: 'gold',
}

/**
 * Historial de eventos de un contrato, cobro o reclamo — cada ítem muestra
 * título, fecha (relativa con `formatRelative`, o absoluta con
 * `dateFormat="absolute"`) y descripción opcional.
 */
export function ActivityTimeline({ events, dateFormat = 'relative', ...rest }: ActivityTimelineProps) {
  return (
    <Timeline
      {...rest}
      items={events.map((event) => ({
        key: event.id,
        color: DOT_COLOR[event.colorKey ?? 'info'],
        content: (
          <>
            <p style={{ margin: 0, fontWeight: 600 }}>{event.title}</p>
            {/*
              suppressHydrationWarning: el texto relativo ("hace 2 minutos")
              se recalcula en cada render — casi siempre difiere entre lo que
              generó el server y el momento en que el cliente hidrata, así
              que un mismatch acá es esperable y no un bug real.
            */}
            <p
              suppressHydrationWarning
              style={{ margin: '0.125rem 0 0', fontSize: '0.8125rem', color: 'var(--rentar-color-text-tertiary)' }}
            >
              {dateFormat === 'absolute' ? formatDate(event.date, 'DD/MM/YYYY [a las] HH:mm') : formatRelative(event.date)}
            </p>
            {event.description && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>{event.description}</p>
            )}
          </>
        ),
      }))}
    />
  )
}
