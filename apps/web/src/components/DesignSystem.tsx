'use client'

/**
 * DesignSystem.tsx — el catálogo vivo de `@rentar/ui` (`/design-system`).
 *
 * Qué es: una ficha por token y por componente, con ejemplos en vivo y sus
 * variantes (vacío, cargando, error, móvil). No es una pantalla del producto.
 * NOTA: es la única excepción a "los mocks solo los usan los services":
 * muestra datos del elenco para que los ejemplos sean realistas.
 * Quién lo usa: `app/design-system/page.tsx`.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Button, ConfigProvider, Input, Segmented, Select, Slider, Switch, Tag } from 'antd'
import {
  BankOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons'
import type { StatusDomain, StatusDomainMap } from '@rentar/shared-types'
import {
  ActivityTimeline,
  AppShell,
  AuthLayout,
  ConfirmActionModal,
  DataTable,
  DetailList,
  EmptyState,
  FileDropzone,
  FilterBar,
  FormSection,
  IndexBadge,
  MoneyAmount,
  MoneyInput,
  PasswordStrengthMeter,
  SearchSidebarFilters,
  NotificationBell,
  OnboardingChecklist,
  PhotoGallery,
  PlanCard,
  PropertyCard as PropertyCardUI,
  RoleContextSwitcher,
  SearchFilters,
  SimulatedFeatureNotice,
  StatCard,
  StatusTag,
  UserMenu,
  WizardLayout,
  antdTheme,
  antdThemeDark,
  colorScales,
  type DataTableColumn,
  type NotificationItem,
  type UserMenuItem,
  type UserMenuRoleOption,
} from '@rentar/ui'
import PropertyCard from './PropertyCard'
import SearchBar from './SearchBar'
import ProcessLoopMotif from './ProcessLoopMotif'
import HowItWorks from './HowItWorks'
import type { PropiedadResumen } from '@rentar/shared-types'
import { characteristicOptions } from '@/lib/catalogs/characteristics'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
// NOTA: excepción documentada a "las páginas no importan mocks": este es el
// catálogo del design system (solo desarrollo), no una pantalla del
// producto. Toma datos del elenco para que las demos se vean reales.
import { propiedades } from '@/lib/mocks'
import { fuerzaPassword, requisitosPassword } from '@/lib/validation/usuario.rules'
import { FILTROS_INICIALES, ubicacionesDe } from '@/lib/search/busqueda'
import { isSearchable, propiedadMockToResumen } from '@/services/adapters/propiedad-mock.adapter'
import { defaultFilters, MAX_PRICE_CEILING } from '@/lib/types/filters'
import { formatMonthlyPrice } from '@/lib/utils/format'
import { navItemsByRole } from '@/lib/navigation/navConfig'
import styles from './DesignSystem.module.css'

interface SectionLink {
  id: string
  label: string
}

const sections: SectionLink[] = [
  { id: 'vision-general', label: 'Visión general' },
  { id: 'colores', label: 'Colores' },
  { id: 'tipografia', label: 'Tipografía' },
  { id: 'espaciado', label: 'Espaciado' },
  { id: 'sombras', label: 'Sombras y elevación' },
  { id: 'formas', label: 'Formas y radios' },
  { id: 'estados', label: 'Estados de dominio' },
  { id: 'botones', label: 'Botones' },
  { id: 'dropdowns', label: 'Dropdowns' },
  { id: 'slider', label: 'Barra deslizable' },
  { id: 'chips', label: 'Chips' },
  { id: 'tarjetas', label: 'Tarjetas' },
  { id: 'campos', label: 'Campos y buscador' },
  { id: 'navegacion', label: 'Navegación' },
  { id: 'insignia', label: 'Componente insignia' },
  { id: 'layouts', label: 'Layouts' },
  { id: 'datos', label: 'Componentes de datos' },
  { id: 'formularios', label: 'Formularios' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'como-usar', label: 'Cómo usar' },
  { id: 'reglas', label: "Do's y Don'ts" },
]

interface ColorSwatch {
  name: string
  hex: string
  text: string
  usage: string
}

const colors: ColorSwatch[] = [
  {
    name: 'Azul Escribanía',
    hex: '#004D98',
    text: '#ffffff',
    usage: 'Botones primarios, links, estados activos de filtros, foco, íconos dentro de nodos blancos.',
  },
  {
    name: 'Azul Escribanía Oscuro',
    hex: '#003B74',
    text: '#ffffff',
    usage: 'Hover/activo del azul primario. Nunca se usa en reposo.',
  },
  {
    name: 'Dorado Trámite',
    hex: '#D7B15D',
    text: '#12202E',
    usage: 'Atmósfera: selección de texto, trazo del anillo guía del hero. Nunca para texto pequeño.',
  },
  {
    name: 'Dorado Trámite (texto)',
    hex: '#8C6B1D',
    text: '#ffffff',
    usage: 'Único dorado apto para texto — el precio en las tarjetas de propiedad, MoneyAmount con emphasis.',
  },
  {
    name: 'Celeste Cordobés',
    hex: '#A0D1EF',
    text: '#12202E',
    usage: 'Atmósfera: fondos de sección, degradé del buscador. Nunca para texto ni íconos.',
  },
  {
    name: 'Celeste Cordobés Claro',
    hex: '#E3F2FB',
    text: '#12202E',
    usage: 'Hover de botones secundarios, chips y fondo de "Cómo funciona".',
  },
  {
    name: 'Ink',
    hex: '#12202E',
    text: '#ffffff',
    usage: 'Texto de cuerpo, siempre a 70% de opacidad o más. También hairlines a baja opacidad.',
  },
  {
    name: 'Paper',
    hex: '#F7F9FB',
    text: '#12202E',
    usage: 'Fondo de página. Las tarjetas se apoyan encima en blanco sólido.',
  },
]

interface SemanticSwatch {
  name: string
  hex: string
  text: string
  usage: string
}

const semanticColors: SemanticSwatch[] = [
  { name: 'Success', hex: '#166534', text: '#ffffff', usage: 'publicada, vigente, firmado, pagado, resuelto, activa.' },
  { name: 'Warning', hex: '#92400E', text: '#ffffff', usage: 'pausada, pendiente_firma, pendiente, en_proceso.' },
  { name: 'Error', hex: '#9F1239', text: '#ffffff', usage: 'rescindido, rechazado, vencido, abierto, vencida.' },
  { name: 'Info', hex: '#004D98', text: '#ffffff', usage: 'alquilada, alquilada_publicada, finalizado — reusa el azul de marca.' },
  { name: 'Neutral', hex: 'rgba(18,32,46,0.5)', text: '#ffffff', usage: 'anulado, cerrado, cancelada.' },
  { name: 'Money', hex: '#8C6B1D', text: '#ffffff', usage: 'MoneyAmount con emphasis, nunca para estados.' },
]

const colorScaleGroups: { name: string; scale: typeof colorScales.blue }[] = [
  { name: 'blue', scale: colorScales.blue },
  { name: 'gold', scale: colorScales.gold },
  { name: 'sky', scale: colorScales.sky },
]

interface TypeSpecimen {
  name: string
  sample: string
  style: CSSProperties
  spec: string[]
  usage: string
}

const typeSpecimens: TypeSpecimen[] = [
  {
    name: 'Display',
    sample: 'Alquilá directo, sin inmobiliaria',
    style: { fontSize: 'clamp(2.25rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.025em' },
    spec: ['700', '36–48px', 'line-height 1.05', 'tracking -0.025em'],
    usage: 'H1 del hero únicamente.',
  },
  {
    name: 'Headline',
    sample: 'De la búsqueda a las llaves, sin intermediarios',
    style: { fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.015em' },
    spec: ['700', '24–36px', 'line-height 1.2', 'tracking -0.015em'],
    usage: 'H2 de sección.',
  },
  {
    name: 'Title',
    sample: 'Monoambiente luminoso a metros de Plaza España',
    style: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
    spec: ['600', '18px', 'line-height 1.4'],
    usage: 'Títulos de tarjeta, H3 de pasos del timeline.',
  },
  {
    name: 'Body',
    sample: 'Filtrá por zona, precio y tipología entre publicaciones directas de dueños.',
    style: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5 },
    spec: ['400', '16px', 'line-height 1.5'],
    usage: 'Párrafos cortos (2–3 líneas), no de artículo.',
  },
  {
    name: 'Label',
    sample: 'Dormitorios · m² · Ajuste por ICL',
    style: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4 },
    spec: ['600', '14px', 'line-height 1.4'],
    usage: 'Nav, labels de formulario, texto de botón, metadatos de tarjeta.',
  },
]

interface SpacingStep {
  name: string
  value: string
  px: number
}

const spacing: SpacingStep[] = [
  { name: 'xs', value: '0.5rem', px: 8 },
  { name: 'sm', value: '1rem', px: 16 },
  { name: 'md', value: '1.5rem', px: 24 },
  { name: 'lg', value: '2.5rem', px: 40 },
  { name: 'xl', value: '4rem', px: 64 },
]

const doList: string[] = [
  'Mantener el dorado (#D7B15D / #8C6B1D) atado solo a dinero/valor: MoneyAmount, la línea de precio, el highlight de selección — nunca un estado de StatusTag.',
  'Usar rounded-full en todo botón/badge/chip y rounded-2xl/rounded-3xl en contenedores — ningún otro radio.',
  'Consumir los componentes de @rentar/ui antes de escribir uno nuevo — si algo parecido ya existe, extenderlo en vez de duplicarlo.',
  'Tokenizar cualquier color/radio/sombra nuevo en packages/ui/src/tokens, nunca hardcodeado en un .module.css.',
]

const dontList: string[] = [
  'Poner un "kicker" en mayúsculas justo arriba de un H1/H2/H3 — nunca, por más tentador que sea.',
  'Construir una sección nueva como una fila de tarjetas idénticas ícono + título + párrafo.',
  'Usar ink/60, ink/50 o el dorado crudo para texto de cualquier tamaño — caen debajo del piso de contraste 4.5:1.',
  'Sumar una segunda tipografía, un acento de borde de color, texto en degradé o una sombra dura tipo neobrutalista.',
]

/** Observa qué sección de `ids` está actualmente en el viewport (scroll-spy de la barra lateral). */
function useScrollSpy(ids: string[]): string | undefined {
  const [activeId, setActiveId] = useState<string | undefined>(ids[0])

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return activeId
}

/** Demo en vivo de los dropdowns "Zona" y "Tipología" del buscador, con estado propio de solo lectura. */
function DropdownsDemo() {
  const [neighborhoodSlug, setNeighborhoodSlug] = useState('todos')
  const [type, setType] = useState('todos')

  return (
    <div className={styles.chipDemoCard}>
      <div className={styles.fieldGrid}>
        <div className={styles.fieldGroup}>
          <label htmlFor="ds-filtro-barrio" className={styles.fieldLabel}>
            Zona
          </label>
          <Select
            id="ds-filtro-barrio"
            className={styles.fieldControl}
            value={neighborhoodSlug}
            onChange={(value: string) => setNeighborhoodSlug(value)}
            options={[
              { value: 'todos', label: 'Todos los barrios' },
              ...neighborhoods.map((n) => ({ value: n.slug, label: n.name })),
            ]}
          />
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="ds-filtro-tipologia" className={styles.fieldLabel}>
            Tipología
          </label>
          <Select
            id="ds-filtro-tipologia"
            className={styles.fieldControl}
            value={type}
            onChange={(value: string) => setType(value)}
            options={[
              { value: 'todos', label: 'Todas' },
              { value: 'departamento', label: 'Departamento' },
              { value: 'casa', label: 'Casa' },
              { value: 'ph', label: 'PH' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

/** Demo en vivo del slider de precio máximo. */
function SliderDemo() {
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE_CEILING)

  return (
    <div className={styles.chipDemoCard}>
      <label htmlFor="ds-filtro-precio" className={styles.fieldLabel}>
        Precio máximo: <span className={styles.fieldLabelValue}>{formatMonthlyPrice(maxPrice)}</span>
      </label>
      <Slider
        id="ds-filtro-precio"
        min={400000}
        max={MAX_PRICE_CEILING}
        step={5000}
        value={maxPrice}
        onChange={(value) => {
          if (Array.isArray(value)) return
          setMaxPrice(value)
        }}
        tooltip={{ formatter: (value) => formatMonthlyPrice(value ?? 0) }}
      />
    </div>
  )
}

/** Demo en vivo de las chips de características (multi-select). */
function ChipsDemo() {
  const [selected, setSelected] = useState<string[]>(['amoblado'])
  const options = [
    { value: 'amoblado', label: 'Amoblado' },
    { value: 'mascotas', label: 'Acepta mascotas' },
    { value: 'cochera', label: 'Cochera' },
    { value: 'balcon', label: 'Balcón' },
  ]

  return (
    <div className={styles.chipDemoCard}>
      <Tag.CheckableTagGroup multiple options={options} value={selected} onChange={setSelected} />
    </div>
  )
}

/** Grupo de `StatusTag` de un dominio — genérico en `D` para que `statuses` quede tipado contra ese dominio puntual. */
function StatusGroup<D extends StatusDomain>({
  domain,
  label,
  statuses,
}: {
  domain: D
  label: string
  statuses: StatusDomainMap[D][]
}) {
  return (
    <div className={styles.statusGroup}>
      <p className={styles.statusGroupTitle}>{label}</p>
      <div className={styles.statusTagRow}>
        {statuses.map((status) => (
          <StatusTag key={status} domain={domain} status={status} />
        ))}
      </div>
    </div>
  )
}

/** Propiedades buscables del elenco, ya como tipo de vista, para las demos. */
const properties: PropiedadResumen[] = propiedades.filter(isSearchable).map(propiedadMockToResumen)

/** Ubicaciones de esas propiedades, para la demo de SearchSidebarFilters. */
const ubicacionesDemo = ubicacionesDe(properties)

const demoTableColumns: DataTableColumn<PropiedadResumen>[] = [
  { key: 'title', title: 'Propiedad', render: (p) => p.title },
  { key: 'neighborhood', title: 'Barrio', render: (p) => p.neighborhoodName },
  { key: 'price', title: 'Precio', render: (p) => <MoneyAmount amount={p.priceMonthly} size="sm" /> },
  { key: 'status', title: 'Estado', render: () => <StatusTag domain="propiedad" status="publicada" /> },
]

const demoNotifications: NotificationItem[] = [
  { id: '1', title: 'Nuevo mensaje de un locatario interesado', date: new Date(Date.now() - 1000 * 60 * 30), read: false },
  { id: '2', title: 'Cobro vencido: Depto Nueva Córdoba', date: new Date(Date.now() - 1000 * 60 * 60 * 5), read: true },
]

/** Mismos ítems que arma `(app)/panel/layout.tsx`. El cambio de rol va aparte, en "Viendo como". */
const demoUserMenuItems: UserMenuItem[] = [
  { key: 'perfil', label: 'Mi perfil y legajo', href: '/panel/perfil' },
  { key: 'notificaciones', label: 'Mis notificaciones', href: '/panel/notificaciones' },
]

/** Filas de "Viendo como" para una cuenta con dos roles (Cambio de rol · 04; datos de Sofía del elenco). */
const demoRoleOptions: UserMenuRoleOption[] = [
  { role: 'locador', label: 'Locador', description: '1 propiedad · 1 cobro vencido', badgeCount: 1 },
  { role: 'locatario', label: 'Locatario', description: 'Obispo Trejo 1250 · 1 contrato' },
]

const demoActivityEvents = [
  { id: '1', title: 'Contrato firmado por el garante', date: new Date(Date.now() - 1000 * 60 * 60 * 48), colorKey: 'success' as const },
  { id: '2', title: 'Recordatorio de pago enviado', date: new Date(Date.now() - 1000 * 60 * 60 * 24), colorKey: 'info' as const },
  { id: '3', title: 'Pago registrado', date: new Date(), colorKey: 'success' as const },
]

// Solo locador/locatario: son los dos únicos roles con panel propio
// (navItemsByRole) — garante nunca tiene sesión y admin usa su propio
// AppShell (variant="admin"), demostrado aparte más abajo.
const ROLE_SWITCHER_OPTIONS: { label: string; value: 'locador' | 'locatario' }[] = [
  { label: 'Locador', value: 'locador' },
  { label: 'Locatario', value: 'locatario' },
]

const wizardSteps = [
  { key: 'datos', title: 'Datos del contrato', content: <p>Paso 1: fechas, propiedad y monto inicial.</p> },
  { key: 'firmantes', title: 'Firmantes', content: <p>Paso 2: datos del locatario y del garante.</p> },
  { key: 'revision', title: 'Revisión', content: <p>Paso 3: confirmar y enviar a firma electrónica.</p> },
]

/**
 * Página `/design-system`: referencia visual e interactiva de los tokens y
 * componentes de @rentar/ui (ver docs/DESIGN.md), armada con los mismos
 * componentes que se usan en producción. Soporta un toggle de tema
 * claro/oscuro acotado a esta página — la landing pública nunca lo usa.
 */
export default function DesignSystem() {
  const activeId = useScrollSpy(sections.map((s) => s.id))
  const demoProperty = properties[0]
  const [isDark, setIsDark] = useState(false)
  const [demoRole, setDemoRole] = useState<'locador' | 'locatario'>('locador')
  const [wizardStep, setWizardStep] = useState(0)
  const [searchFiltersValue, setSearchFiltersValue] = useState(defaultFilters)
  const [filterBarSearch, setFilterBarSearch] = useState('')
  const [filterBarStatus, setFilterBarStatus] = useState('todos')
  const [moneyValue, setMoneyValue] = useState(450000)
  const [demoPassword, setDemoPassword] = useState('Rentar2026')
  const [sidebarFilters, setSidebarFilters] = useState(FILTROS_INICIALES)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <ConfigProvider theme={isDark ? antdThemeDark : antdTheme}>
      <div className={styles.page} data-rentar-theme={isDark ? 'dark' : undefined}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <p className={styles.topbarTitle}>Sistema de Diseño</p>
            <span className={styles.badge}>RentAR</span>
          </div>
          <div className={styles.topbarRight}>
            <label className={styles.themeToggle}>
              <Switch
                checked={isDark}
                onChange={setIsDark}
                checkedChildren="Oscuro"
                unCheckedChildren="Claro"
                data-testid="design-system-theme-toggle"
              />
            </label>
            <Link href="/" className={styles.backLink}>
              ← Volver al sitio
            </Link>
          </div>
        </header>

        <div className={styles.layout}>
          <nav className={styles.sidebar} aria-label="Secciones del sistema de diseño">
            <ul className={styles.sidebarList}>
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={`${styles.sidebarLink} ${activeId === section.id ? styles.sidebarLinkActive : ''}`}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <main className={styles.content}>
            <div id="vision-general" className={styles.intro}>
              <h1 className={styles.eyebrowless}>Sistema de Diseño de RentAR</h1>
              <p className={styles.lead}>
                Referencia visual e interactiva de los tokens y componentes que arman la landing y
                el panel de la app: colores, tipografía, espaciado, sombras, formas, estados de
                dominio y los patrones de uso reales, tomados directamente de los componentes en
                producción.
              </p>

              <div className={styles.quoteCard}>
                <p className={styles.quoteLabel}>Norte creativo</p>
                <p className={styles.quoteText}>&ldquo;El trato directo&rdquo;</p>
                <p className={styles.sectionLead} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  Todo el lenguaje visual de RentAR existe para que una cosa se sienta cierta a
                  simple vista: estás tratando con un dueño real, no con el mostrador de una
                  inmobiliaria. Ninguna superficie busca parecer un portal inmobiliario grande;
                  parece un escritorio honesto, bien llevado.
                </p>
                <ul className={styles.characteristicsList}>
                  <li>Azul institucional profundo como único color &quot;fuerte&quot; para lo interactivo; dorado reservado para dinero/valor.</li>
                  <li>Redondeo grande y consistente — pill buttons, contenedores rounded-2xl/3xl — nunca esquinas rectas.</li>
                  <li>Tarjetas blancas suavemente elevadas sobre una página apenas fuera de blanco.</li>
                  <li>Un solo momento de movimiento autoral por vista (loop del hero; timeline con scroll-reveal).</li>
                  <li>League Spartan en todo el sistema — nunca una tipografía secundaria.</li>
                </ul>
              </div>
            </div>

            {/* Colores */}
            <section id="colores" className={styles.section}>
              <h2 className={styles.sectionHeading}>Colores</h2>
              <p className={styles.sectionLead}>
                La paleta es chica y está codificada por función: el azul lleva toda acción
                clicable/primaria, el dorado aparece solo donde se comunica dinero o valor, el
                celeste es atmósfera (fondos, dividers, hover) y nunca texto.
              </p>
              <div className={styles.colorGrid}>
                {colors.map((color) => (
                  <div key={color.hex} className={styles.swatchCard}>
                    <div className={styles.swatchColor} style={{ background: color.hex, color: color.text }}>
                      {color.hex}
                    </div>
                    <div className={styles.swatchMeta}>
                      <p className={styles.swatchName}>{color.name}</p>
                      <p className={styles.swatchUsage}>{color.usage}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className={styles.subheading}>Colores semánticos</p>
              <p className={styles.sectionLead} style={{ marginBottom: '1rem' }}>
                Cinco roles con significado, usados por <code>StatusTag</code> y por cualquier
                componente que necesite comunicar estado — nunca elegidos &quot;a ojo&quot; por pantalla.
              </p>
              <div className={styles.colorGrid}>
                {semanticColors.map((color) => (
                  <div key={color.name} className={styles.swatchCard}>
                    <div className={styles.swatchColor} style={{ background: color.hex, color: color.text }}>
                      {color.name}
                    </div>
                    <div className={styles.swatchMeta}>
                      <p className={styles.swatchName}>{color.name}</p>
                      <p className={styles.swatchUsage}>{color.usage}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className={styles.subheading}>Escalas generadas</p>
              <p className={styles.sectionLead} style={{ marginBottom: '1rem' }}>
                10 pasos por color, generados con el algoritmo oficial de antd
                (<code>@ant-design/colors</code>) a partir del hex de marca — no elegidos a mano.
                Se usan para variantes de hover/fondo de componentes nuevos, nunca para el texto
                principal de la landing (que sigue usando los hex de marca de arriba, tal cual).
              </p>
              <div className={styles.componentStack}>
                {colorScaleGroups.map((group) => (
                  <div key={group.name} className={styles.colorScaleRow}>
                    {Object.entries(group.scale).map(([step, hex]) => (
                      <div
                        key={step}
                        className={styles.colorScaleStep}
                        style={{ background: hex, color: Number(step) >= 500 ? '#ffffff' : '#12202E' }}
                      >
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className={styles.ruleCallout}>
                <strong>La regla del dinero-es-dorado.</strong> El dorado aparece exactamente donde
                hay moneda (la línea de precio, <code>MoneyAmount</code>) y en ningún otro lugar
                como color de contenido — nunca en un <code>StatusTag</code>, por más que un
                estado sea &quot;positivo&quot;.
              </div>
              <div className={styles.ruleCallout}>
                <strong>La regla de contraste.</strong> Ningún texto sobre superficie clara baja de
                ink/70 (≈6.1:1 sobre blanco/paper) o de brand-gold-ink para texto dorado (≈4.96:1).
                ink/60, ink/50 y el dorado crudo son correctos para rellenos decorativos grandes,
                pero nunca para texto chico.
              </div>
            </section>

            {/* Tipografía */}
            <section id="tipografia" className={styles.section}>
              <h2 className={styles.sectionHeading}>Tipografía</h2>
              <p className={styles.sectionLead}>
                League Spartan, con system-ui/sans-serif como respaldo — una sola familia para todo
                el sistema, en distintos pesos y tamaños únicamente.
              </p>
              <div>
                {typeSpecimens.map((spec) => (
                  <div key={spec.name} className={styles.typeSpecimen}>
                    <p className={styles.typeSample} style={spec.style}>
                      {spec.sample}
                    </p>
                    <div className={styles.typeMeta}>
                      <span className={styles.typeMetaName}>{spec.name}</span>
                      {spec.spec.map((s) => (
                        <code key={s}>{s}</code>
                      ))}
                      <span>{spec.usage}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Espaciado */}
            <section id="espaciado" className={styles.section}>
              <h2 className={styles.sectionHeading}>Espaciado</h2>
              <p className={styles.sectionLead}>
                Escala reducida de cinco pasos usada en paddings, gaps y márgenes de sección.
              </p>
              <div className={styles.spacingList}>
                {spacing.map((s) => (
                  <div key={s.name} className={styles.spacingRow}>
                    <span className={styles.spacingLabel}>{s.name}</span>
                    <div className={styles.spacingBar} style={{ width: `${s.px * 2}px` }} />
                    <span className={styles.spacingValue}>{s.value} · {s.px}px</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Sombras */}
            <section id="sombras" className={styles.section}>
              <h2 className={styles.sectionHeading}>Sombras y elevación</h2>
              <p className={styles.sectionLead}>
                Suavemente elevado. La profundidad separa una tarjeta de la página, nunca llama la
                atención por sí sola. Un shadow solo aparece sobre algo accionable o la pieza
                insignia del hero.
              </p>
              <div className={styles.demoGrid}>
                <div className={styles.demoCell}>
                  <div className={`${styles.demoBox} ${styles.shadowResting}`} />
                  <span className={styles.demoCaption}>Tarjeta en reposo</span>
                  <p className={styles.demoSub}>shadow-sm + ring-black/5</p>
                </div>
                <div className={styles.demoCell}>
                  <div className={`${styles.demoBox} ${styles.shadowLifted}`} />
                  <span className={styles.demoCaption}>Tarjeta en hover</span>
                  <p className={styles.demoSub}>shadow-lg + -translate-y-1</p>
                </div>
                <div className={styles.demoCell}>
                  <div className={`${styles.demoBox} ${styles.shadowButton}`} />
                  <span className={styles.demoCaption}>Sombra de botón</span>
                  <p className={styles.demoSub}>shadow-brand-blue/20</p>
                </div>
                <div className={styles.demoCell}>
                  <div className={`${styles.demoBox} ${styles.shadowDeep}`} />
                  <span className={styles.demoCaption}>Contenedor profundo</span>
                  <p className={styles.demoSub}>shadow-2xl shadow-brand-blue/20</p>
                </div>
                <div className={styles.demoCell}>
                  <div className={`${styles.demoBox} ${styles.shadowForm}`} />
                  <span className={styles.demoCaption}>Panel de formulario</span>
                  <p className={styles.demoSub}>shadow-2xl shadow-brand-blue/10 (SearchBar)</p>
                </div>
              </div>
            </section>

            {/* Formas */}
            <section id="formas" className={styles.section}>
              <h2 className={styles.sectionHeading}>Formas y radios</h2>
              <p className={styles.sectionLead}>
                El redondeo es grande y consistente, nunca filoso. Los bordes son hairlines
                únicamente — nunca un borde grueso o de color.
              </p>
              <div className={styles.demoGrid}>
                <div className={styles.demoCell}>
                  <div className={`${styles.radiusBox} ${styles.radiusPill}`} />
                  <span className={styles.demoCaption}>Pill · 9999px</span>
                  <p className={styles.demoSub}>Botones, badges, chips</p>
                </div>
                <div className={styles.demoCell}>
                  <div className={`${styles.radiusBox} ${styles.radiusMd}`} />
                  <span className={styles.demoCaption}>Medium · 1rem</span>
                  <p className={styles.demoSub}>Tarjetas, panel del buscador</p>
                </div>
                <div className={styles.demoCell}>
                  <div className={`${styles.radiusBox} ${styles.radiusLg}`} />
                  <span className={styles.demoCaption}>Large · 1.5rem</span>
                  <p className={styles.demoSub}>Motivo del hero, la superficie más grande</p>
                </div>
              </div>
            </section>

            {/* Estados de dominio */}
            <section id="estados" className={styles.section}>
              <h2 className={styles.sectionHeading}>Estados de dominio</h2>
              <p className={styles.sectionLead}>
                Cada estado de cada dominio de negocio, resuelto por <code>StatusTag</code> vía{' '}
                <code>getStatusMeta</code> — label, color e ícono ya decididos, ningún componente
                de pantalla tiene que elegirlos de nuevo.
              </p>
              <div className={styles.grid2}>
                <StatusGroup domain="propiedad" label="Propiedad" statuses={['publicada', 'pausada', 'alquilada', 'alquilada_publicada']} />
                <StatusGroup
                  domain="contrato"
                  label="Contrato"
                  statuses={['pendiente_firma', 'vigente', 'finalizado', 'rescindido']}
                />
                <StatusGroup domain="firma" label="Firma" statuses={['pendiente', 'firmado', 'rechazado']} />
                <StatusGroup domain="cobro" label="Cobro" statuses={['pendiente', 'pagado', 'vencido', 'anulado', 'parcial']} />
                <StatusGroup domain="reclamo" label="Reclamo" statuses={['abierto', 'en_proceso', 'resuelto', 'cerrado']} />
                <StatusGroup domain="suscripcion" label="Suscripción" statuses={['activa', 'vencida', 'cancelada']} />
                <StatusGroup domain="solicitud" label="Solicitud" statuses={['pendiente', 'aceptada', 'rechazada', 'cancelada']} />
                <StatusGroup domain="usuario" label="Usuario" statuses={['activo', 'suspendido', 'sin_verificar']} />
                <StatusGroup domain="factura" label="Factura" statuses={['pagada', 'rechazada']} />
              </div>
            </section>

            {/* Botones */}
            <section id="botones" className={styles.section}>
              <h2 className={styles.sectionHeading}>Botones</h2>
              <p className={styles.sectionLead}>
                Forma pill siempre — ningún botón cuadrado o levemente redondeado en todo el
                sistema.
              </p>
              <div className={styles.buttonRow}>
                <Button type="primary" size="large">
                  Publicar propiedad
                </Button>
                <Button className={styles.secondaryButton} size="large">
                  Ver cómo funciona
                </Button>
                <Button type="text" style={{ color: 'var(--rentar-color-blue)', fontWeight: 600 }}>
                  Iniciar sesión
                </Button>
                <Button disabled>Deshabilitado</Button>
              </div>
              <p className={styles.placeholderNote + ' ' + styles.demoSub}>
                El hover del primario oscurece a Azul Escribanía Oscuro; el foco siempre usa un
                contorno de 2px en Azul Escribanía con 2px de offset.
              </p>
            </section>

            {/* Dropdowns */}
            <section id="dropdowns" className={styles.section}>
              <h2 className={styles.sectionHeading}>Dropdowns</h2>
              <p className={styles.sectionLead}>
                Fondo paper (no blanco) para sensación de inset dentro de la tarjeta blanca, borde
                hairline y radio pequeño (rounded-lg). El foco cambia el borde a azul, sin glow. Es
                el mismo componente que arma los selects &quot;Zona&quot; y &quot;Tipología&quot; del buscador.
              </p>
              <DropdownsDemo />
            </section>

            {/* Slider */}
            <section id="slider" className={styles.section}>
              <h2 className={styles.sectionHeading}>Barra deslizable (slider)</h2>
              <p className={styles.sectionLead}>
                Input nativo estilizado con accent-brand-blue. El valor actual siempre se repite en
                el texto del label — nunca queda escondido detrás de la posición del thumb.
              </p>
              <SliderDemo />
            </section>

            {/* Chips */}
            <section id="chips" className={styles.section}>
              <h2 className={styles.sectionHeading}>Chips</h2>
              <p className={styles.sectionLead}>
                Pill, borde por default; el estado seleccionado invierte a azul sólido. Una sola
                forma de chip para filtros y para cualquier otra selección múltiple.
              </p>
              <ChipsDemo />
            </section>

            {/* Tarjetas */}
            <section id="tarjetas" className={styles.section}>
              <h2 className={styles.sectionHeading}>Tarjetas</h2>
              <p className={styles.sectionLead}>
                Fondo blanco sólido sobre la página paper, ring hairline en vez de borde visible,
                elevación solo en hover.
              </p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFrameLabel}>
                  <span className={styles.liveFrameDot} />
                  components/PropertyCard.tsx (ejemplo real, landing)
                </div>
                <div className={styles.liveFramePadded}>
                  <div className={styles.cardDemoWrap}>
                    <PropertyCard property={demoProperty} />
                  </div>
                </div>
              </div>

              <p className={styles.subheading}>PropertyCard de @rentar/ui</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Portado desde el de arriba, desacoplado de <code>PropiedadResumen</code>/
                <code>StaticImageData</code> — props primitivas + <code>useNextBridge()</code> para
                imagen/link. Es el que va a usar <code>/buscar</code> y el listado del locador.
              </p>
              <div className={styles.liveFramePadded}>
                <div className={styles.cardDemoWrap}>
                  <PropertyCardUI
                    title={demoProperty.title}
                    neighborhoodName={demoProperty.neighborhoodName}
                    propertyType={demoProperty.type}
                    priceMonthly={demoProperty.priceMonthly}
                    bedrooms={demoProperty.bedrooms}
                    areaM2={demoProperty.areaM2}
                    adjustmentIndex={demoProperty.adjustmentIndex}
                    imageSrc={demoProperty.imageSrc}
                    href="#tarjetas"
                  />
                </div>
              </div>

              <p className={styles.subheading}>PropertyCard · layout=&quot;busqueda&quot;</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                La tarjeta de <code>/buscar</code> (US-34): precio en dorado, expensas, dirección aproximada
                (calle al centenar, por privacidad), descripción en 2 líneas, disponibilidad y chips. El
                carrusel aparece solo con más de una foto.
              </p>
              <div className={styles.liveFramePadded}>
                <div className={styles.cardDemoWrap}>
                  <PropertyCardUI
                    layout="busqueda"
                    title={demoProperty.title}
                    neighborhoodName={demoProperty.neighborhoodName}
                    propertyType={demoProperty.type}
                    priceMonthly={demoProperty.priceMonthly}
                    expenses={demoProperty.expenses ?? undefined}
                    bedrooms={demoProperty.bedrooms}
                    areaM2={demoProperty.areaM2}
                    adjustmentIndex={demoProperty.adjustmentIndex}
                    imageSrc={demoProperty.imageSrc}
                    photoSrcs={properties.slice(0, 3).map((p) => p.imageSrc)}
                    address={demoProperty.address}
                    description={demoProperty.description}
                    availableFrom={demoProperty.availableFrom}
                    characteristicLabel="Cochera"
                    href="#tarjetas"
                  />
                </div>
              </div>

              <p className={styles.subheading}>PlanCard</p>
              <div className={styles.inlineDemoRow}>
                <PlanCard name="Gratis" priceMonthly={0} features={['1 propiedad publicada', 'Solicitudes y mensajería']} ctaLabel="Empezar gratis" />
                <PlanCard
                  name="Propietario"
                  priceMonthly={9990}
                  description="El plan de Nicolás Arrieta."
                  highlighted
                  features={['Propiedades ilimitadas', 'Contratos y firma electrónica', 'Cobros, comprobantes y reportes']}
                  currentPlan
                />
                <PlanCard name="Inmobiliaria" priceMonthly={29990} features={['Todo lo de Propietario', 'Múltiples usuarios de la cuenta']} ctaLabel="Elegir plan" />
              </div>
            </section>

            {/* Campos */}
            <section id="campos" className={styles.section}>
              <h2 className={styles.sectionHeading}>Campos y buscador</h2>
              <p className={styles.sectionLead}>
                Inputs sobre fondo paper (no blanco) para una sensación de inset dentro de la
                tarjeta blanca del buscador; el foco cambia el borde a azul, sin glow.
              </p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFrameLabel}>
                  <span className={styles.liveFrameDot} />
                  components/SearchBar.tsx (interactivo)
                </div>
                <div className={styles.liveFramePadded}>
                  <SearchBar filters={defaultFilters} onChange={() => {}} resultCount={properties.length} />
                </div>
              </div>
            </section>

            {/* Navegación */}
            <section id="navegacion" className={styles.section}>
              <h2 className={styles.sectionHeading}>Navegación</h2>
              <p className={styles.sectionLead}>
                Links de texto a escala label, sin subrayado en reposo ni en hover. El header
                colapsa a un menú hamburguesa por debajo de md.
              </p>
              <div className={styles.navDemo}>
                <a className={styles.navDemoLink} href="#campos">
                  Buscar propiedades
                </a>
                <a className={styles.navDemoLink} href="#insignia">
                  Cómo funciona
                </a>
                <Button type="text" style={{ color: 'var(--rentar-color-blue)', fontWeight: 600 }}>
                  Iniciar sesión
                </Button>
                <Button type="primary">Publicar propiedad</Button>
              </div>

              <p className={styles.subheading}>FilterBar</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Buscador + chips de estado + acción del arquetipo A4 — el patrón que hoy se repite
                dibujado a mano en seis listados del panel.
              </p>
              <div className={styles.liveFramePadded}>
                <FilterBar
                  searchValue={filterBarSearch}
                  onSearchChange={setFilterBarSearch}
                  searchPlaceholder="Buscar por dirección..."
                  statusOptions={[
                    { value: 'todos', label: 'Todas' },
                    { value: 'publicada', label: 'Publicadas' },
                    { value: 'alquilada', label: 'Alquiladas' },
                    { value: 'alquilada_publicada', label: 'Alquiladas · publicadas' },
                    { value: 'pausada', label: 'Pausadas' },
                  ]}
                  statusValue={filterBarStatus}
                  onStatusChange={setFilterBarStatus}
                  actions={<Button type="primary">+ Nueva propiedad</Button>}
                />
              </div>
            </section>

            {/* Componente insignia */}
            <section id="insignia" className={styles.section}>
              <h2 className={styles.sectionHeading}>Componente insignia: el loop de proceso</h2>
              <p className={styles.sectionLead}>
                Dos piezas hechas a medida llevan la única idea de movimiento autoral del sistema, y
                deliberadamente reflejan la misma estructura de 4 etapas: buscar → contactar →
                firmar → pagar.
              </p>
              <div className={styles.loopFrame}>
                <ProcessLoopMotif />
              </div>

              <p className={styles.subheading}>HowItWorks (ejemplo real, con scroll-reveal)</p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFrameLabel}>
                  <span className={styles.liveFrameDot} />
                  components/HowItWorks.tsx
                </div>
                <HowItWorks />
              </div>
            </section>

            {/* Layouts */}
            <section id="layouts" className={styles.section}>
              <h2 className={styles.sectionHeading}>Layouts</h2>
              <p className={styles.sectionLead}>
                Los tres armazones de página del sistema: público, autenticación, y panel. Cada uno
                resuelve una sola cosa y no sabe nada de las rutas reales de RentAR — reciben todo
                por props.
              </p>

              <p className={styles.subheading}>PublicLayout</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Header + contenido + Footer. Es lo que arma <code>Landing</code> — no hace falta un
                demo aparte, la landing entera es el ejemplo en vivo.
              </p>

              <p className={styles.subheading}>AuthLayout</p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFrameLabel}>
                  <span className={styles.liveFrameDot} />
                  AuthLayout (compact, para caber en este frame)
                </div>
                <div className={styles.authFrame}>
                  <AuthLayout title="Iniciar sesión" subtitle="Accedé a tu cuenta de RentAR" compact>
                    <div className={styles.componentStack}>
                      <Input placeholder="Email" data-testid="auth-demo-email" />
                      <Input.Password placeholder="Contraseña" data-testid="auth-demo-password" />
                      <Button type="primary" block>
                        Ingresar
                      </Button>
                    </div>
                  </AuthLayout>
                </div>
              </div>

              <p className={styles.subheading}>AppShell</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Elegí un rol para ver el <code>navConfig</code> de cada uno. (En una app real,{' '}
                <code>RoleSwitcher</code> se ve como acá abajo, pero como selector flotante fijo en
                toda la pantalla — dentro de este catálogo lo mostramos como control simple para no
                tapar el resto de la página.)
              </p>
              <Segmented
                value={demoRole}
                onChange={(value) => setDemoRole(value as 'locador' | 'locatario')}
                options={ROLE_SWITCHER_OPTIONS}
                style={{ marginBottom: '0.75rem' }}
                data-testid="design-system-role-switcher"
              />
              <div className={styles.liveFrame}>
                <div className={styles.liveFrameLabel}>
                  <span className={styles.liveFrameDot} />
                  AppShell (compact) — navItems reales de lib/navigation/navConfig.tsx
                </div>
                <div className={styles.appShellFrame}>
                  <AppShell
                    compact
                    navItems={navItemsByRole[demoRole]}
                    activeKey={navItemsByRole[demoRole][0]?.key ?? ''}
                    user={{ name: 'Sofía Ledesma', role: demoRole }}
                    notifications={demoNotifications}
                    userMenuItems={demoUserMenuItems}
                    mobileTitle="Mi panel"
                    activeRoleLabel={demoRole === 'locador' ? 'Locador' : 'Locatario'}
                    roleOptions={demoRoleOptions}
                    onRoleChange={(role) => setDemoRole(role as 'locador' | 'locatario')}
                    contextSwitcher={
                      <RoleContextSwitcher
                        roles={[
                          { role: 'locador', label: 'Locador' },
                          { role: 'locatario', label: 'Locatario' },
                        ]}
                        activeRole={demoRole}
                        onChange={(role) => setDemoRole(role as 'locador' | 'locatario')}
                      />
                    }
                  >
                    <div className={styles.componentStack}>
                      <div className={styles.inlineDemoRow}>
                        <StatCard title="Propiedades activas" value="4" icon={<BankOutlined />} delta={{ label: '+1 este mes', trend: 'up' }} />
                        <StatCard title="Cobros pendientes" value={<MoneyAmount amount={580000} />} delta={{ label: 'vence en 3 días', trend: 'neutral' }} />
                      </div>
                      <p className={styles.demoSub}>Contenido de la pantalla activa acá.</p>
                    </div>
                  </AppShell>
                </div>
              </div>

              <p className={styles.subheading}>AppShell — variant=&quot;admin&quot;</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Header oscuro del panel de administración (sin US en Sprint 0, mapa US-44/US-45): reusa la paleta dark ya calibrada de{' '}
                <code>tokens/css-vars.css</code> (misma que el toggle de tema de esta página), no
                tokens nuevos.
              </p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFrameLabel}>
                  <span className={styles.liveFrameDot} />
                  AppShell (compact, variant=&quot;admin&quot;)
                </div>
                <div className={styles.appShellFrame}>
                  <AppShell
                    compact
                    variant="admin"
                    navItems={[
                      { key: 'usuarios', label: 'Usuarios', href: '/admin/usuarios' },
                      { key: 'reportes', label: 'Reportes de uso', href: '/admin/reportes' },
                    ]}
                    activeKey="usuarios"
                    user={{ name: 'Equipo RentAR', role: 'admin' }}
                  >
                    <div className={styles.componentStack}>
                      <p className={styles.demoSub}>Contenido de la pantalla activa acá.</p>
                    </div>
                  </AppShell>
                </div>
              </div>
            </section>

            {/* Componentes de datos */}
            <section id="datos" className={styles.section}>
              <h2 className={styles.sectionHeading}>Componentes de datos</h2>
              <p className={styles.sectionLead}>
                Piezas para mostrar información del dominio: montos, KPIs, tablas, fichas de
                detalle, historial y estados vacíos.
              </p>

              <p className={styles.subheading}>MoneyAmount e IndexBadge</p>
              <div className={styles.chipDemoCard}>
                <div className={styles.inlineDemoRow}>
                  <MoneyAmount amount={580000} size="sm" />
                  <MoneyAmount amount={580000} size="md" emphasis />
                  <MoneyAmount amount={580000} size="lg" emphasis />
                  <IndexBadge index="ICL" />
                  <IndexBadge index="IPC" />
                </div>
              </div>

              <p className={styles.subheading}>StatCard</p>
              <div className={styles.inlineDemoRow}>
                <StatCard title="Propiedades activas" value="4" icon={<BankOutlined />} delta={{ label: '+1 este mes', trend: 'up' }} />
                <StatCard title="Cobros pendientes" value={<MoneyAmount amount={580000} />} delta={{ label: 'vence en 3 días', trend: 'neutral' }} />
                <StatCard title="Reclamos abiertos" value="1" delta={{ label: '-2 vs. mes anterior', trend: 'down' }} />
              </div>

              <p className={styles.subheading}>DataTable — vista tabla (desktop) / tarjetas (mobile, &lt;640px)</p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFrameLabel}>
                  <span className={styles.liveFrameDot} />
                  DataTable
                </div>
                <div className={styles.liveFramePadded}>
                  <DataTable columns={demoTableColumns} data={properties.slice(0, 4)} rowKey={(p) => p.id} />
                </div>
              </div>
              <p className={styles.subheading}>DataTable — fila clickeable y tarjeta móvil con cabecera y acciones</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Con <code>onRowClick</code> la fila entera abre el detalle (mouse, Tab y Enter), sin columna de
                acciones (Listado de propiedades · 02). En móvil, <code>cardHeader</code> y{' '}
                <code>cardActions</code> arman la tarjeta; las columnas con <code>hideInCard</code> no se repiten.
              </p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFramePadded}>
                  <DataTable
                    columns={demoTableColumns.map((col, index) => (index === 0 ? { ...col, hideInCard: true } : col))}
                    data={properties.slice(0, 3)}
                    rowKey={(p) => p.id}
                    onRowClick={() => {}}
                    rowLabel={(p) => `Ver detalle de ${p.title}`}
                    cardHeader={(p) => <strong>{p.title}</strong>}
                    cardActions={() => (
                      <Button type="primary" block>
                        Ver detalle
                      </Button>
                    )}
                  />
                </div>
              </div>
              <p className={styles.subheading}>DataTable — estado vacío</p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFramePadded}>
                  <DataTable columns={demoTableColumns} data={[]} rowKey={(p) => p.id} emptyDescription="Todavía no hay propiedades cargadas." />
                </div>
              </div>

              <p className={styles.subheading}>DetailList</p>
              <div className={styles.chipDemoCard}>
                <DetailList
                  title="Resumen del contrato"
                  items={[
                    { label: 'Propiedad', value: demoProperty.title },
                    { label: 'Locatario', value: 'Juan Pérez' },
                    { label: 'Índice de ajuste', value: <IndexBadge index="ICL" /> },
                    { label: 'Monto actual', value: <MoneyAmount amount={580000} emphasis /> },
                  ]}
                />
              </div>

              <p className={styles.subheading}>ActivityTimeline</p>
              <div className={styles.chipDemoCard}>
                <ActivityTimeline events={demoActivityEvents} />
              </div>

              <p className={styles.subheading}>EmptyState</p>
              <EmptyState
                title="Todavía no publicaste ninguna propiedad"
                description="Cuando publiques tu primera propiedad, va a aparecer acá."
                action={
                  <Button type="primary" size="small">
                    Publicar propiedad
                  </Button>
                }
              />

              <p className={styles.subheading}>PhotoGallery</p>
              <div className={styles.liveFramePadded}>
                <div className={styles.cardDemoWrap}>
                  <PhotoGallery
                    images={properties.slice(0, 4).map((p) => ({ src: p.imageSrc, alt: p.title }))}
                  />
                </div>
              </div>

              <p className={styles.subheading}>OnboardingChecklist</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                A propósito NO es una fila de tarjetas ícono+heading+párrafo (patrón rechazado en{' '}
                <code>docs/DESIGN.md</code>) — una sola tarjeta vertical con los pasos.
              </p>
              <div className={styles.chipDemoCard}>
                <OnboardingChecklist
                  items={[
                    { key: 'propiedad', label: 'Publicá tu primera propiedad', status: 'listo', href: '#datos' },
                    { key: 'solicitud', label: 'Recibí tu primera solicitud', status: 'activo', href: '#datos' },
                    { key: 'contrato', label: 'Firmá tu primer contrato', status: 'bloqueado', motivoBloqueo: 'Aceptá una solicitud primero' },
                  ]}
                />
              </div>
            </section>

            {/* Formularios */}
            <section id="formularios" className={styles.section}>
              <h2 className={styles.sectionHeading}>Formularios</h2>
              <p className={styles.sectionLead}>
                Agrupación de campos, formularios en pasos, montos en pesos y carga de archivos.
              </p>

              <div className={styles.chipDemoCard}>
                <FormSection title="Datos de la propiedad" description="Información básica que ve el locatario en la publicación.">
                  <div className={styles.componentStack}>
                    <MoneyInput value={moneyValue} onChange={setMoneyValue} data-testid="design-system-money-input" />
                    <FileDropzone hint="JPG o PNG, hasta 5 fotos." />
                  </div>
                </FormSection>
              </div>

              <p className={styles.subheading}>PasswordStrengthMeter</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Fuerza de la contraseña del registro (US-19): barra de 4 segmentos, etiqueta y checklist.
                El componente solo muestra; el nivel y los requisitos los calcula la app con las reglas de{' '}
                <code>lib/validation/usuario.rules.ts</code>. Escribí para probarlo.
              </p>
              <div className={styles.chipDemoCard}>
                <div className={styles.componentStack}>
                  <Input.Password
                    value={demoPassword}
                    onChange={(event) => setDemoPassword(event.target.value)}
                    aria-label="Contraseña de ejemplo"
                    data-testid="design-system-password-input"
                  />
                  <PasswordStrengthMeter
                    strength={fuerzaPassword(demoPassword)}
                    requirements={requisitosPassword(demoPassword)}
                    data-testid="design-system-password-strength"
                  />
                </div>
              </div>

              <p className={styles.subheading}>WizardLayout</p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFramePadded}>
                  <WizardLayout steps={wizardSteps} currentStep={wizardStep} onStepChange={setWizardStep} onFinish={() => setWizardStep(0)} />
                </div>
              </div>
              <p className={styles.subheading}>WizardLayout — pasos navegables, paso con error y carga</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                <code>navigableSteps</code> deja volver a un paso anterior tocándolo en el Steps;{' '}
                <code>status: &apos;error&apos;</code> lo marca en rojo; <code>loading</code> bloquea todo mientras
                se confirma. Debajo de 768px el Steps pasa a &quot;Paso N de M&quot; con barra y los botones quedan
                fijos abajo (Alta de propiedad · 09).
              </p>
              <div className={styles.liveFrame}>
                <div className={styles.liveFramePadded}>
                  <WizardLayout
                    steps={wizardSteps.map((step, index) => (index === 0 ? { ...step, status: 'error' as const } : step))}
                    currentStep={wizardStep}
                    onStepChange={setWizardStep}
                    onFinish={() => setWizardStep(0)}
                    navigableSteps
                    data-testid="design-system-wizard-navegable"
                  />
                </div>
              </div>

              <p className={styles.subheading}>SearchSidebarFilters</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Filtros de <code>/buscar</code> (US-34) como barra lateral. Trabaja sobre un borrador: la
                búsqueda se hace con &quot;Aplicar filtros&quot;. En móvil se usa con{' '}
                <code>variant=&quot;drawer&quot;</code> dentro de un Drawer.
              </p>
              <div className={styles.liveFramePadded} style={{ maxWidth: '20rem' }}>
                <SearchSidebarFilters
                  value={sidebarFilters}
                  onChange={setSidebarFilters}
                  onClear={() => setSidebarFilters(FILTROS_INICIALES)}
                  onApply={() => {}}
                  locations={ubicacionesDemo}
                  characteristics={characteristicOptions}
                  data-testid="design-system-sidebar-filters"
                />
              </div>

              <p className={styles.subheading}>SearchFilters</p>
              <p className={styles.sectionLead} style={{ marginBottom: '0.75rem' }}>
                Versión de <code>@rentar/ui</code> de <code>SearchBar</code> de la landing: recibe
                barrios/características por props en vez de importar los mocks. Para{' '}
                <code>/buscar</code> — achicá la ventana para ver el botón &quot;Filtros&quot; (Drawer) de
                mobile.
              </p>
              <div className={styles.liveFramePadded}>
                <SearchFilters
                  neighborhoods={neighborhoods}
                  characteristics={characteristicOptions}
                  value={searchFiltersValue}
                  onChange={setSearchFiltersValue}
                  resultCount={properties.length}
                />
              </div>
            </section>

            {/* Feedback */}
            <section id="feedback" className={styles.section}>
              <h2 className={styles.sectionHeading}>Feedback</h2>
              <p className={styles.sectionLead}>
                Confirmaciones, avisos de función simulada, notificaciones y menú de usuario.
              </p>

              <div className={styles.componentStack}>
                <SimulatedFeatureNotice feature="el pago" />
                <SimulatedFeatureNotice />
                {/* Con `reason`: el back está conectado pero esa función puntual no existe todavía. */}
                <SimulatedFeatureNotice feature="el email de confirmación" reason="El servidor todavía no envía emails de confirmación." />

                <div className={styles.inlineDemoRow}>
                  <Button danger onClick={() => setConfirmOpen(true)} data-testid="design-system-confirm-trigger">
                    Eliminar propiedad
                  </Button>
                  <NotificationBell notifications={demoNotifications} />
                  <UserMenu name="Sofía Ledesma" role="locador" items={demoUserMenuItems} roleOptions={demoRoleOptions} />
                </div>
              </div>

              <ConfirmActionModal
                open={confirmOpen}
                title="¿Eliminar esta propiedad?"
                description="Esta acción no se puede deshacer."
                danger
                onConfirm={() => setConfirmOpen(false)}
                onCancel={() => setConfirmOpen(false)}
              />
            </section>

            {/* Cómo usar */}
            <section id="como-usar" className={styles.section}>
              <h2 className={styles.sectionHeading}>Cómo usar</h2>
              <p className={styles.sectionLead}>
                Todo se importa desde <code>@rentar/ui</code>. Algunos snippets cortos de los
                patrones más comunes.
              </p>
              <div className={styles.componentStack}>
                <pre className={styles.codeBlock}>
{`import { StatusTag } from '@rentar/ui'

<StatusTag domain="contrato" status="vigente" />`}
                </pre>
                <pre className={styles.codeBlock}>
{`import { MoneyAmount } from '@rentar/ui'

<MoneyAmount amount={580000} emphasis />`}
                </pre>
                <pre className={styles.codeBlock}>
{`import { DataTable } from '@rentar/ui'

<DataTable
  columns={columns}
  data={contracts}
  rowKey={(c) => c.id}
/>`}
                </pre>
                <pre className={styles.codeBlock}>
{`import { AppShell } from '@rentar/ui'
import { navItemsByRole } from '@/lib/navigation/navConfig'

<AppShell
  navItems={navItemsByRole[role]}
  activeKey="propiedades"
  user={{ name, role }}
>
  {children}
</AppShell>`}
                </pre>
              </div>
            </section>

            {/* Reglas */}
            <section id="reglas" className={styles.section}>
              <h2 className={styles.sectionHeading}>Do&apos;s y Don&apos;ts</h2>
              <p className={styles.sectionLead}>
                Reglas nombradas del sistema, para juzgar casos límite sin perder la coherencia
                visual.
              </p>
              <div className={styles.rulesGrid}>
                <div className={styles.rulesCard}>
                  <p className={`${styles.rulesTitle} ${styles.rulesTitleDo}`}>
                    <CheckCircleFilled /> Hacer
                  </p>
                  <ul className={styles.rulesList}>
                    {doList.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.rulesCard}>
                  <p className={`${styles.rulesTitle} ${styles.rulesTitleDont}`}>
                    <CloseCircleFilled /> No hacer
                  </p>
                  <ul className={styles.rulesList}>
                    {dontList.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <p className={styles.footer}>
              Fuente de verdad: <code>docs/DESIGN.md</code>. Esta página se genera a partir de los
              mismos tokens y componentes usados en producción.
            </p>
          </main>
        </div>
      </div>
    </ConfigProvider>
  )
}
