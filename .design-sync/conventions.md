# Convenciones de @rentar/ui

- **Envoltorio de marca**: envolvé cualquier composición en `<ThemeProvider>` (grupo `general`)
  para que los componentes de antd (Button, Input, Select, Tag, Card...) usen la paleta y
  tipografía de RentAR en vez del tema default de antd. Sin `ThemeProvider`, los botones salen
  azul genérico de antd, no el azul institucional de marca.

  ```tsx
  import { ThemeProvider, PropertyCard, MoneyAmount } from '@rentar/ui'

  <ThemeProvider>
    <PropertyCard
      title="Monoambiente en Nueva Córdoba"
      neighborhoodName="Nueva Córdoba"
      propertyType="departamento"
      priceMonthly={470000}
      bedrooms={1}
      areaM2={38}
      adjustmentIndex="ICL"
      imageSrc="https://..."
      href="#"
    />
  </ThemeProvider>
  ```

  `dark` (prop de `ThemeProvider`, default `false`) aplica el tema oscuro — reservado a paneles
  autenticados, nunca a páginas públicas.

- **Paleta**: azul institucional (`#004D98`) es el único color "fuerte" para lo interactivo
  (botones primarios, links, foco). El dorado (`#D7B15D` texto `#8C6B1D`) está reservado
  exclusivamente a dinero/valor — `MoneyAmount` con `emphasis`, la línea de precio de
  `PropertyCard`/`PlanCard` — nunca a un estado de `StatusTag`, por más "positivo" que sea. El
  celeste (`#A0D1EF` / `#E3F2FB`) es atmósfera: fondos, hover, dividers — nunca texto ni íconos.

- **Tipografía**: League Spartan en todo el sistema (pesos 400–800), sin una segunda familia.

- **Radios**: `9999px` (pill) en todo botón, badge, chip y `StatusTag`. Contenedores/tarjetas usan
  `12px` o `16px` — nunca una esquina recta ni un radio intermedio distinto de esos tres pasos.

- **`StatusTag`** resuelve label, color e ícono por `domain` + `status` internamente — nunca se le
  pasa un color a mano. Dominios disponibles: `propiedad`, `contrato`, `firma`, `cobro`,
  `reclamo`, `suscripcion`, `solicitud`, `usuario`, `factura`. Ejemplo:
  `<StatusTag domain="cobro" status="pagado" />`.

- **Componentes de negocio ya resueltos, preferilos a armar la UI a mano**: `PropertyCard`
  (tarjeta de propiedad completa), `PlanCard` (plan de suscripción), `PhotoGallery` (galería +
  lightbox), `HeroSearch` (buscador de la landing), `SearchSidebarFilters` (filtros de
  `/buscar`), `FilterBar` (filtros de listados), `OnboardingChecklist`
  (checklist de pasos — nunca como fila de tarjetas ícono+heading+párrafo, ese patrón está
  rechazado en este sistema), `AppShell` (layout de panel autenticado, con slot `contextSwitcher`
  y `variant="admin"` para header oscuro), `AuthLayout`/`PublicLayout` (layouts de auth/público).

- **React 18**: los componentes de @rentar/ui no usan APIs exclusivas de React 19
  (`useEffectEvent`, `use`, `ref` como prop común sin `forwardRef`, etc.): las plantillas de
  Claude Design corren con React 18.3.1. Lo mismo vale para el código que armes alrededor.

- **Dónde está la verdad**: `styles.css` (importa `_ds_bundle.css`, que ya trae los tokens
  `--rentar-*` embebidos) y el `.prompt.md` de cada componente para su API exacta. Los nombres de
  props siguen siempre una interfaz explícita — nunca `any`.
