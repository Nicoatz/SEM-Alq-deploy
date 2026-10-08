---
name: RentAR
description: Design system de RentAR — tokens, componentes y reglas de uso, implementados en @rentar/ui
package: "@rentar/ui"
colors:
  brand-blue: "#004D98"
  brand-blue-dark: "#003B74"
  brand-gold: "#D7B15D"
  brand-gold-ink: "#8C6B1D"
  brand-sky: "#A0D1EF"
  brand-sky-light: "#E3F2FB"
  ink: "#12202E"
  paper: "#F7F9FB"
  surface: "#FFFFFF"
semantic:
  success: "#166534"
  warning: "#92400E"
  error: "#9F1239"
  info: "#004D98"
  neutral: "rgba(18, 32, 46, 0.5)"
  money: "#D7B15D"
typography:
  display:
    fontFamily: "League Spartan, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  display-hero:
    fontFamily: "League Spartan, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "League Spartan, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "League Spartan, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "League Spartan, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "League Spartan, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
radii:
  pill: "9999px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
spacing:
  xs: "0.5rem"
  sm: "1rem"
  md: "1.5rem"
  lg: "2.5rem"
  xl: "4rem"
  "2xl": "6rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.surface}"
    rounded: "{radii.pill}"
  button-primary-hover:
    backgroundColor: "{colors.brand-blue-dark}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{radii.pill}"
    height: "2.25rem"
    padding: "0 1rem"
  chip-selected:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.surface}"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{radii.sm}"
    height: "2.5rem"
  card-property:
    backgroundColor: "{colors.surface}"
    rounded: "{radii.lg}"
  hero-search-tray:
    rounded: "{radii.xl}"
    padding: "0.5rem"
  hero-search-core:
    backgroundColor: "{colors.surface}"
    rounded: "{radii.lg}"
    padding: "0.25rem"
  hero-search-cell-focus:
    backgroundColor: "{colors.brand-sky-light}"
    rounded: "{radii.md}"
---

# Design System: RentAR

Implementado en código en `packages/ui` (paquete `@rentar/ui`), consumido por `apps/web`.
Catálogo vivo, interactivo, con toggle de tema claro/oscuro: `/design-system`. Este documento es
la referencia en prosa de las mismas decisiones — si algo acá y el código en vivo no coinciden, el
código manda y este documento está desactualizado.

## Overview

**Creative North Star: "El trato directo"**

Todo el lenguaje visual de RentAR existe para que una cosa se sienta cierta a simple vista: estás
tratando con un dueño real, no con el mostrador de una inmobiliaria. Cada superficie se mantiene
cercana, cálida y legible en vez de corporativa o brillosa — un azul institucional profundo da la
confianza de un trámite bien hecho, un dorado cálido marca el momento en que se mueve la plata, y
un celeste suave mantiene la página liviana en vez de burocrática. Nada en el sistema busca
parecerse a un portal inmobiliario grande; parece un escritorio honesto, bien llevado.

El sistema es callado por default. La landing abre con un instrumento, no con una foto: el
buscador (`HeroSearch`, "La consola") es el hero, bajo una promesa de una línea. El único gesto
ruidoso es el proceso mismo: el diagrama circular animado de "Cómo funciona" (Buscá → Postulate →
Firmá → Pagá), sincronizado con la lista de pasos que tiene al lado. Todo lo demás se mueve solo lo
justo para responder al scroll, al hover o al toque. Las tarjetas son planas y densas en
información en vez de decoradas; el único adorno recurrente es la forma pill, usada
consistentemente para cualquier cosa accionable.

Rechazo confirmado: ningún label tipo "kicker" en mayúsculas arriba de un heading en todo el
sistema — los headings cargan su propio peso. Ningún patrón de tarjeta ícono+heading+texto como
default de estructura de página ("Cómo funciona" usa una lista numerada conectada; los
diferenciales, una franja tipográfica con hairlines). Ningún hero con foto de fondo y buscador
flotante al estilo de los portales.

**Key Characteristics:**
- Azul institucional profundo como único hue "fuerte" para lo interactivo; dorado reservado
  específicamente para dinero/valor.
- Redondeo grande y consistente (botones pill, contenedores `radii.lg`/`radii.xl`, doble borde
  concéntrico en la bandeja del buscador) — nunca esquinas rectas.
- Tarjetas blancas suavemente elevadas sobre una página apenas fuera de blanco.
- Un momento de movimiento autoral por vista (el loop de "Cómo funciona"), nunca decoración
  dispersa; el resto del movimiento es respuesta (foco, hover, presión) o una aparición única al
  entrar en pantalla.
- League Spartan en todo el sistema — ninguna tipografía secundaria, nunca.
- **Todo tokenizado.** Ningún componente nuevo hardcodea un color, radio, sombra, tamaño de
  espaciado, duración o curva — todo sale de `@rentar/ui` (`packages/ui/src/tokens/`). Ver "Cómo se
  implementan los tokens" más abajo.

## Cómo se implementan los tokens

Dos capas, cada una con un trabajo distinto:

1. **`packages/ui/src/tokens/*.ts`** — la fuente de verdad en TypeScript. `primitives.ts` tiene los
   colores semilla y las escalas de 10 pasos generadas con el algoritmo oficial de antd
   (`@ant-design/colors`, no elegidas a mano), tipografía, radios, espaciado, breakpoints, layout,
   movimiento, sombras con nombre y z-index. `semantic.ts` tiene los colores con significado
   (`light`/`dark`). `status-meta.ts` tiene el mapa completo de estado→label/color/ícono. Se
   consumen como constantes de TS en cualquier `.tsx` (`import { seed, radii, motion } from
   '@rentar/ui'`) — es la forma correcta de tokenizar valores usados en lógica de componente (el
   `color` de un `<Tag>`, o la duración de un cierre animado que se espera desde JS).
2. **`packages/ui/src/tokens/css-vars.css`** — variables `--rentar-*` en `:root`, consumidas por
   los `.module.css` de cualquier componente. **No** son las mismas que `var(--ant-*)`: el modo
   `cssVar` de antd (activado en `theme.ts`) declara esas variables por instancia de componente de
   antd, no en `:root`, así que solo están disponibles dentro del árbol DOM de un
   `<Button>`/`<Card>`/etc. — no sirven para CSS propio de un `<header>` o una `<section>`.
   `--rentar-*` sí vive en `:root` y por eso es la forma confiable de tokenizar CSS de layout en
   cualquier parte del árbol. Además de colores, radios, sombras y espaciado, expone los tamaños de
   la escala tipográfica (`--rentar-font-size-display|headline|title|body|label`), el ancho del
   contenido (`--rentar-container-max`) y el movimiento (`--rentar-motion-*`).

Opacidades puntuales que no encajan en un token semántico (`rgba(18,32,46,0.055)`, por ejemplo) se
expresan como `rgba(var(--rentar-color-ink-rgb), 0.055)` — el color queda tokenizado, el número de
opacidad es un valor de diseño legítimo, no un color hardcodeado. Ojo: `--rentar-color-sky-rgb`
vale el celeste **claro** (`#E3F2FB`), no el celeste (`#A0D1EF`); está anotado en `css-vars.css`.

Los breakpoints no pueden ser variables CSS (las media queries no las leen): en los `.module.css`
se escriben como literal con un comentario que nombra el token (`@media (min-width: 768px)` →
`breakpoints.md`; los cortes "hasta" usan `767.98px`).

## Colores

La paleta es chica y está codificada por función: el azul lleva toda acción clicable/primaria, el
dorado aparece solo donde se comunica dinero o valor, el celeste es atmósfera (fondos, dividers,
hover, foco) y, sobre el azul, la tinta clara.

### Primitivos (marca)
- **Azul Escribanía** (`seed.blue` / `--rentar-color-blue`): el único color usado para botones
  primarios, links, estados activos de filtros y chips, foco, trazos de ícono del motivo y los
  números de los pasos de "Cómo funciona". Si es clicable e importante, es este azul. También es la
  superficie de las tres piezas de peso de la landing: el hero (con la ciudad ilustrada en la base),
  la baldosa del motivo (en degradé con el oscuro) y el panel de cierre para locadores.
- **Azul Escribanía Oscuro** (`seed.blueDark`): hover/activo del azul de arriba, y el tono medio del
  degradé de la baldosa del motivo. Nunca en reposo sobre un control.
- **Dorado Trámite** (`seed.gold`, tinta de texto `seed.goldInk`): reservado para dinero — la línea
  de precio de cada tarjeta, `MoneyAmount`, `PlanCard`. Dos excepciones documentadas, ninguna de
  contenido: el highlight de selección de texto (`::selection`) y el punto que recorre el loop de
  "Cómo funciona". `goldInk` es el único dorado apto para texto (≥4.5:1 sobre blanco/paper); el
  dorado crudo nunca lleva texto chico — ver la Regla de Contraste.
- **Celeste Cordobés** (`seed.sky`, tinte `seed.skyLight`): atmósfera — la banda de "Cómo funciona", la celda con foco del buscador, "Más
  filtros" abierto, la opción elegida del panel, el fondo de las fotos mientras cargan, el anillo y
  los nodos del motivo. Sobre superficie clara nunca es texto ni ícono. Sobre el azul es la tinta:
  el titular, el subtítulo y los chips del hero, el titular y el botón del panel para locadores y el
  número del paso activo usan celeste claro.
- **Ink** (`seed.ink`): todo el texto de cuerpo, siempre a 70% de opacidad o más (ver Regla de
  Contraste). También el casi-negro usado a baja opacidad para hairlines y para el fondo de la hoja
  móvil (`ink/45`).
- **Paper** (`seed.paper`): fondo de página y de los campos (sensación de inset). Las tarjetas se
  apoyan encima en blanco sólido (`surface`) para leerse un escalón "arriba".

### Escalas generadas
`colorScales.{blue,gold,sky}` — 10 pasos por color (`50` el más claro, `900` el más oscuro),
generados con `@ant-design/colors` a partir de los mismos hex de marca. Se usan para variantes de
hover/fondo de componentes nuevos que necesiten un tinte intermedio — **nunca** para el texto
principal o las superficies ya definidas arriba, que siguen usando los hex de marca literales sin
pasar por el algoritmo (para no introducir una diferencia imperceptible pero real frente a lo ya
validado).

`darkColorScales` existe para el mismo propósito en modo oscuro — con una salvedad: en la escala
que devuelve `generate(color, { theme: 'dark' })`, el índice va de oscuro (paso `50`) a claro (paso
`900`), al revés que en la escala clara. Es el propio algoritmo de antd optimizando para fondos
oscuros con acentos claros, no un error — pero hay que tenerlo presente al usarla.

### Semánticos (`light` / `dark`)
Cinco roles con significado, consumidos por `StatusTag` (vía `getStatusMeta`) y por cualquier
componente que necesite comunicar estado — nunca elegidos "a ojo" por pantalla.

| Rol | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `success` | `#166534` | `#4ADE80` | publicada, vigente, firmado, pagado, resuelto, activa |
| `warning` | `#92400E` | `#FBBF24` | pausada, pendiente_firma, pendiente, en_proceso |
| `error` | `#9F1239` | `#FB7185` | rescindido, rechazado, vencido, abierto, vencida |
| `info` | `#004D98` (reusa el azul de marca) | `#1B65A6` | alquilada, alquilada_publicada, finalizado |
| `neutral` | `ink/50` | `paper/50` | anulado, cerrado, cancelada |
| `money` | `#D7B15D` / `#8C6B1D` | igual — no cambia en dark | `MoneyAmount` con `emphasis`, nunca un estado |

### Named Rules
**La regla del dinero-es-dorado.** El dorado aparece exactamente donde hay moneda (la línea de
precio, `MoneyAmount`) y en ningún otro lugar como color de contenido — nunca en un `StatusTag`,
por más que un estado sea "positivo" (ver el color `info` para "alquilada"/"finalizado", que
podrían tentar a usar dorado y no lo hacen). Las únicas excepciones son `::selection` y el punto
del loop, y ninguna lleva información.

**La regla de contraste.** Ningún texto sobre superficie clara baja de `ink/70` (≈6.1:1 sobre
blanco/paper) o de `goldInk` para texto dorado (≈4.96:1). `ink/60`, `ink/50` y el dorado crudo son
correctos para rellenos decorativos grandes, pero nunca para texto chico. Sobre el azul, el texto
es celeste: el celeste claro `#E3F2FB` da 7,3:1 sobre `#004D98` (títulos, botón y número del paso
activo), al 85% da 5,7:1 (texto de apoyo del panel para locadores) y el Celeste Cordobés `#A0D1EF`
da 5,1:1; los tres pasan AA para texto normal (4,5:1). Sobre el azul oscuro del degradé el
contraste sube (celeste claro sobre `#003B74`: 9,8:1).

**Excepción: el hero en azul** (02/10/2026, junto a la del panel para locadores). El hero de la
landing es azul y usa los mismos tonos que el panel, medidos sobre `#004D98`:
- Titular en celeste claro: **7,3:1**.
- Subtítulo y "Buscar en" en celeste claro al 85%: **5,7:1**.
- Texto de los chips (celeste claro sobre su fondo, celeste claro al 8%): **6,1:1**.
- Anillo de foco de los chips en celeste claro: **7,3:1** contra el azul (el mínimo para un
  indicador de foco es 3:1). El anillo azul global no se vería; lo de adentro de la tarjeta blanca
  del buscador sigue con el anillo azul.
La ciudad ilustrada de la base no baja estos números: va multiplicada sobre el azul, así que solo
lo oscurece, y queda debajo de los chips.

## Tipografía

**Fuente de Display/Cuerpo:** League Spartan, con `system-ui, sans-serif` como respaldo — una sola
familia para todo el sistema, en distintos pesos y tamaños únicamente.

**Carácter:** un sans geométrico y confiado haciendo todo el trabajo: bold y de tracking ajustado
en tamaño display para headlines, peso regular para texto de cuerpo. Sin serif, sin mono, sin una
segunda tipeface de display — la "voz única" es deliberada. Los números de precio y de filtros van
con `font-variant-numeric: tabular-nums`.

### Jerarquía
Los escalones están en `typography` (TS) y en `--rentar-font-size-*` (CSS), con los mismos
valores. En CSS propio se usa la variable, nunca el `clamp()` copiado.
- **Display hero** (`displayHero`, `--rentar-font-size-display-hero`: 700, line-height 1.05,
  tracking -0.025em, hasta 4rem): el H1 de la landing desde 768 px, para que la promesa se separe
  de los títulos de sección; entra en una línea desde 768 px. Aprobado por el PO (02/10/2026).
- **Display** (700, line-height 1.05, tracking -0.025em): el H1 de la landing en móvil y cualquier
  otro titular de pantalla.
- **Headline** (700, line-height 1.2, tracking -0.015em): H2 de sección, con `text-wrap: balance`.
- **Title** (600): títulos de tarjeta, de los diferenciales y de los pasos; el subtítulo del hero
  desde 768 px; el título de la hoja de "Más filtros".
- **Body** (400, 1.5): texto de párrafo y valor de los campos; se mantiene corto (2–3 líneas, hasta
  ~44ch en las listas) en vez de largo — esto es una landing/panel, no un artículo.
- **Label** (600): links de nav, labels de formulario, texto de botón y de chip, contadores, filas
  de metadata de tarjeta (dormitorios · m² · índice). Es el paso más chico de la escala.

### Named Rules
**La regla de no-eyebrow.** Ningún label chico en mayúsculas/tracking se sienta directamente
arriba de un heading como kicker. Si un heading necesita una categoría o marcador de contexto, va
*debajo* del heading (ver la línea de barrio/tipología de `PropertyCard`) o se pliega dentro de las
palabras del heading mismo.

## Layout

Página de una sola columna. El contenido de la zona pública mide como máximo
`--rentar-container-max` (75rem, 1200 px: arquetipo A1) y cada contenedor suma su margen lateral
afuera de ese ancho: `spacing.sm` (16 px) por debajo de 992 px y `spacing.md` (24 px) desde 992 px
(`max-width: calc(var(--rentar-container-max) + 2 * var(--rentar-spacing-md))`). Header, Footer,
cada sección de la landing y `/buscar` comparten este mismo modelo, así los bordes del contenido
quedan alineados de arriba abajo.

El ritmo de sección es generoso y consistente: `spacing.xl` (4rem) de padding vertical por sección,
`spacing.2xl` (6rem) en escritorio para la banda de "Cómo funciona" y el respiro de "Recién
publicadas". Dentro de una sección, `spacing.md`/`spacing.lg` separan el heading del contenido.

Breakpoints (`breakpoints`, los mismos de la grilla de antd para que el CSS propio y los `Col`
cambien en el mismo ancho): `sm` 576, `md` 768, `lg` 992, `xl` 1200. Mobile-first:
- **Móvil** (default): una columna; listas separadas por hairlines horizontales.
- **768 (`md`)**: grillas de 2–3 columnas (diferenciales en 3 con hairlines verticales, barrios en
  3×2, "Cómo funciona" con el motivo a la izquierda y los pasos a la derecha).
- **992 (`lg`)**: nav completo del Header (por debajo, hamburguesa), margen lateral de escritorio,
  barrios en una fila de 6.
- Cuando un componente tiene que reaccionar a su propio ancho y no al de la pantalla, usa una
  container query (el buscador pasa a una sola fila cuando él mide 70rem o más).

### Primer viewport de la landing
El bloque del hero (titular, buscador, chips "Buscar en") queda centrado verticalmente entre el
Header y la franja de diferenciales, que cierra el viewport desde 768 px. El alto se calcula como
`100svh` menos el Header y el respiro de la sección siguiente, con un tope de 52rem. El hero es
azul, con una ciudad ilustrada apoyada en su base: desde 768 px ocupa el hueco entre los chips y la
franja, detrás del bloque; en móvil va debajo de los chips, así no empuja el buscador. El borde del
azul cierra el hero (la franja no lleva hairline arriba). El LCP es la ilustración (en móviles
bajos, el titular): va primera en el HTML con `fetchpriority="high"`. El titular no tiene animación
de entrada y las fotos de "Recién publicadas" empiezan debajo del pliegue (en 1440×900).

## Elevación y profundidad

Suavemente elevado. La profundidad se usa con moderación y para separar una superficie de la página,
nunca para llamar la atención sobre sí misma: las tarjetas blancas llevan una sombra chica y suave
en reposo (`shadows.resting`) más un hairline `ink/10`, y suman `shadows.lifted` en hover. Los
botones primarios llevan una sombra de color propio (`shadows.button`, teñida de azul) en vez de una
sombra gris genérica.

### Vocabulario de sombras (`shadows.*`, `--rentar-shadow-*`)
- **`resting`**: `PropertyCard` en reposo.
- **`lifted`**: `PropertyCard` en hover (el único cambio de elevación interactivo del sistema) y las
  superficies flotantes: el panel de "Más filtros" desde 768 px, `UserMenu`, `NotificationBell`,
  la tarjeta de `AuthLayout`.
- **`button`**: CTAs primarios.
- **`deep`**: la baldosa azul de `ProcessLoopMotif` (elevación por peso visual, no por separación) y
  la hoja modal de "Más filtros" en móvil, que se apoya sobre toda la página.
- **`form`**: el núcleo blanco de la bandeja de `HeroSearch`.

### Named Rules
**La regla de sombra-ganada.** Una sombra solo aparece sobre algo que el usuario puede accionar
(una tarjeta, un botón), sobre una superficie que flota encima de otra (panel, menú, hoja) o sobre
la pieza insignia (el motivo). Los bloques de contenido estático (headings, párrafos, el panel para
locadores, el paso resaltado de "Cómo funciona", el footer) quedan planos.

**La regla de la capa.** Una sombra o un relleno que aparece por estado no se anima sobre la
propiedad misma: va en una capa aparte (`::before`/`::after`) que solo cambia de `opacity`. Así se
hacen la sombra `lifted` del hover de tarjeta, el celeste de la celda con foco del buscador, el
resalte blanco del paso activo y el número relleno de azul.

## Formas

El redondeo es grande y consistente, nunca filoso: `radii.pill` para todo botón, badge, chip y
contador; `radii.sm` (8px) para los campos; `radii.md` (12px) para piezas internas de un contenedor
(la celda con foco del buscador, las opciones del panel de filtros); `radii.lg` (16px) para
tarjetas, el núcleo del buscador, el panel flotante, los recuadros de barrio y los pasos;
`radii.xl` (24px) para las superficies más grandes — la bandeja del buscador, la baldosa del motivo,
el panel para locadores y las esquinas superiores de la hoja móvil.

**La regla del doble borde.** Cuando un contenedor envuelve a otro, los radios son concéntricos: la
bandeja (`xl`, padding `spacing.xs`, fondo `blue/5` con hairline `blue/8`) contiene al núcleo blanco
(`lg`). Un radio interior que toca un borde de 1 px resta ese píxel (la foto de la tarjeta).

Los bordes son hairlines únicamente (`ink/10` en campos, tarjetas, separadores y celdas; `blue/15`
a `blue/25` en el conector y los números de los pasos) — nunca un borde grueso o de color, y nunca
un acento de borde-izquierdo/derecho de color.

## Modo oscuro

Implementado (`antdThemeDark` en `theme.ts` + overrides `[data-rentar-theme="dark"]` en
`css-vars.css`), pero **acotado a `/design-system` y a los paneles autenticados futuros
(`AppShell`)**. La landing pública nunca activa este tema — su `ConfigProvider` usa siempre
`antdTheme` (claro), a propósito, para que la landing quede pixel-igual sin importar qué se toque
en el sistema de tokens. Lo que vive sobre el azul (el motivo, el panel para locadores) usa celeste
claro, que no cambia con el tema, así se ve igual en los dos.

El toggle de `/design-system` envuelve toda la página en un `<ConfigProvider theme={isDark ?
antdThemeDark : antdTheme}>` anidado y setea `data-rentar-theme="dark"` en el elemento raíz de la
página — ambos cambian juntos, así los componentes de antd (vía `cssVar`) y el CSS propio (vía
`--rentar-*`) quedan sincronizados.

## Estados de dominio

Cada estado de cada dominio de negocio (ver `@rentar/shared-types`) tiene un label en español, un
color semántico y un ícono, decididos una sola vez en `packages/ui/src/tokens/status-meta.ts` y
resueltos por `getStatusMeta(domain, status)` / `<StatusTag domain status />`. Ningún componente de
pantalla debería volver a decidir esto.

| Dominio | Estados | Color asignado |
| --- | --- | --- |
| `propiedad` | publicada, pausada, alquilada, alquilada_publicada | success, warning, info, info |
| `contrato` | pendiente_firma, vigente, finalizado, rescindido | warning, success, info, error |
| `firma` | pendiente, firmado, rechazado | warning, success, error |
| `cobro` | pendiente, pagado, vencido, anulado, parcial | warning, success, error, neutral, warning |
| `reclamo` | abierto, en_proceso, resuelto, cerrado | error, warning, success, neutral |
| `suscripcion` | activa, vencida, cancelada | success, error, neutral |
| `solicitud` | pendiente, aceptada, rechazada, cancelada | warning, success, error, neutral |
| `usuario` | activo, suspendido, sin_verificar | success, error, warning |
| `factura` | pagada, rechazada | success, error |

`UserRole` (`locador`/`locatario`/`garante`/`admin`) queda fuera de este mapa a propósito: un rol
es identidad, no un estado de ciclo de vida — se muestra con un tag neutro simple en `UserMenu`,
no con `StatusTag`.

## Inventario de componentes (`@rentar/ui`)

Todos con props tipadas (interface explícita, sin `any`), JSDoc en español, `data-testid`
configurable en las acciones clave, y sin valores visuales hardcodeados.

**Zona pública**
- `Header`, `Footer` — usados por la landing y por `PublicLayout`, con el contenedor de 1200 px +
  margen lateral (ver Layout).

**Layouts** — cuándo usar cada uno:
- `PublicLayout`: cualquier página pública nueva (Header + contenido + Footer).
- `AuthLayout`: login, registro, recuperar contraseña — tarjeta centrada con marca. Prop `compact`
  para previsualizarlo en un contenedor acotado (lo usa el catálogo).
- `AppShell`: cualquier pantalla autenticada del panel (locador, locatario, garante, admin) —
  sidebar + header con notificaciones/usuario + contenido. La navegación se recibe por props
  (`navConfig` por rol vive en `apps/web`, no en el paquete). Prop `compact` con el mismo propósito
  que en `AuthLayout`. Slot `contextSwitcher` en el header (para `RoleContextSwitcher`, solo
  cuentas con más de un rol) y `variant="admin"` para el header oscuro de `/admin/*` — reusa la
  paleta dark de `tokens/css-vars.css` (`data-rentar-theme="dark"` sobre el header), no tokens
  nuevos. `userMenuItems` pasa a través a `UserMenu`.

**Navegación**
- `PageHeader`: encabezado estándar de una pantalla del panel (breadcrumb + título + acciones).
- `FilterBar`: buscador + chips de estado (`aria-pressed`) + acción, del arquetipo A4 — reemplaza
  el patrón que se repetía dibujado a mano en varios listados del panel.

**Datos**
- `StatusTag`: estado de dominio (ver arriba).
- `MoneyAmount`: monto en pesos argentinos; `emphasis` lo pinta de dorado — usar en el monto
  principal de una vista, no en cada número de una tabla.
- `IndexBadge`: índice de ajuste (IPC/ICL) con tooltip explicativo.
- `StatCard`: KPI con título, valor, variación con flecha y color, e ícono.
- `DataTable`: en mobile (`<640px`) se convierte en lista de tarjetas (una por fila, pares
  label/valor) en vez de forzar scroll horizontal. Cubre estado de carga (`Skeleton`) y vacío
  (`Empty`).
- `DetailList`: pares label/valor para vistas de detalle (wrapper de `Descriptions`).
- `EmptyState`: sin propiedades/contratos/resultados — icono, texto, acción sugerida.
- `ActivityTimeline`: historial de eventos de un contrato, cobro o reclamo, con fecha relativa.
- `PropertyCard`: tarjeta de propiedad (foto, badge, título, barrio/tipología, dormitorios/m²/
  índice, precio en dorado). Con `layout="busqueda"` delega en `PropertyCardBusqueda` (galería,
  precio, dirección, chips): es la tarjeta de `/buscar`, de "Recién publicadas" en la landing y de
  la revisión del alta. Props primitivas (no recibe `Property` directo) + `useNextBridge()` para
  imagen/link.
- `PhotoGallery`: imagen principal + miniaturas + lightbox (`Image.PreviewGroup` de antd) —
  `/propiedad/[id]` y paso 3 del alta.
- `OnboardingChecklist`: pasos con estado listo/activo/bloqueado y contador — panel vacío de
  locador/locatario nuevos. A propósito no es una fila de tarjetas ícono+heading+párrafo (patrón
  rechazado más abajo).
- `PlanCard`: tarjeta de plan de suscripción con precio en dorado, `highlighted` para el
  recomendado y `currentPlan` para el plan activo — `/planes`, `/panel/suscripcion`.

**Formularios**
- `HeroSearch`: el buscador de la landing ("La consola", ver más abajo). Formulario GET a `/buscar`
  que funciona sin JS; con JS, el envío pasa por `onSearch`.
- `SearchSidebarFilters`: los filtros de `/buscar` (barra lateral y drawer).
- `FormSection`: agrupa campos bajo un título y descripción.
- `WizardLayout`: formulario en pasos (`Steps` + navegación Anterior/Siguiente/Confirmar). No
  valida nada por su cuenta.
- `MoneyInput`: `InputNumber` con formato de pesos argentinos ya aplicado.
- `FileDropzone`: `Upload.Dragger` para fotos/documentos. Nunca sube nada de verdad
  (`beforeUpload` siempre `false`).
- `SearchFilters`: **sin uso** en las pantallas (solo aparece en el catálogo). Lo reemplazaron
  `HeroSearch` y `SearchSidebarFilters`; candidato a borrarse (decisión del PO). No usarlo en
  pantallas nuevas.

**Feedback**
- `ConfirmActionModal`: confirmación de una acción destructiva o irreversible.
- `SimulatedFeatureNotice`: aviso de que una función (pago, firma, notificación) todavía es
  simulada — usar junto a cualquier flujo que todavía no tenga backend real detrás.
- `NotificationBell`: campanita con badge de no-leídas y panel desplegable.
- `UserMenu`: avatar, nombre, rol, ítems configurables (`items`: Mi perfil, Notificaciones, cambio
  de contexto, Administración) y cerrar sesión (siempre último, fijo).
- `RoleContextSwitcher`: selector "Viendo como..." del header del `AppShell`, para cuentas con más
  de un rol. Producto real, cablea con la sesión — distinto del `RoleSwitcher` de desarrollo de
  abajo.

**Solo desarrollo**
- `RoleSwitcher`: selector de rol flotante (`position: fixed`) para ver la app sin autenticación
  real. No renderiza nada si `NODE_ENV === 'production'`.

**De `apps/web` (no del paquete)**
- `ProcessLoopMotif` (`components/ProcessLoopMotif.tsx`): el motivo del loop, usado en "Cómo
  funciona" y en el catálogo.
- `RevealAlEntrar` (`components/landing/`): la aparición al entrar en pantalla (ver Movimiento).

## Componentes de la landing

### Botones
- **Forma:** `radii.pill`, siempre — ningún botón cuadrado o levemente redondeado en ningún lugar.
- **Primario:** `blue` de fondo / texto blanco / `shadows.button`.
- **Hover/foco:** el hover del primario oscurece a `blueDark`; todos los estados de foco de teclado
  usan el outline global de 2px en `blue` con 2px de offset (nunca un sustituto de color/glow).
- **Presión:** los controles accionables se achican a `scale(0.97)` en `:active`, en
  `motion.duration.fast`; sin escala con movimiento reducido.
- **Secundario/ghost:** fondo blanco o transparente, texto `blue`, hover a `blueDark` o relleno
  `skyLight`. "Más filtros" es este botón: texto azul, y relleno celeste claro mientras está abierto.
- **Sobre el azul** (panel para locadores): el botón invierte a celeste claro con texto azul y
  hover a blanco; el outline de foco pasa a celeste claro, porque el azul no se vería. Lo mismo vale
  para los chips del hero.

### Chips
- **Atajos ("Buscar en" del hero):** links pill de 2.25rem sobre el azul: fondo celeste claro al
  8%, borde celeste claro al 40%, texto celeste claro a escala label; hover (solo puntero fino)
  invierte a celeste claro con texto azul, y el foco es un anillo celeste claro. En móvil, una fila
  que se desliza hasta el borde de la pantalla.
- **Filtros (panel de "Más filtros"):** la misma pastilla sobre fondo `paper`; elegida, invierte a
  `blue` sólido con texto blanco. El control real es un radio/casilla nativo invisible encima de la
  pastilla, así el clic, el foco y el envío sin JS son suyos. Un solo lenguaje visual de chip en
  todo el sistema.

### Tarjetas / contenedores
- **Esquina:** `radii.lg`.
- **Fondo:** blanco sólido sobre la página `paper`.
- **Borde:** hairline `ink/10`, sin color de borde visible.
- **Sombra:** reposo `shadows.resting`; en hover (solo `(hover: hover) and (pointer: fine)`), la
  capa `lifted` aparece por opacidad y la foto hace `scale(1.04)` en `motion.duration.slow`. Con
  movimiento reducido la sombra aparece igual y la foto no se agranda.
- **Foco:** el link de la dirección se estira sobre toda la tarjeta; el outline de foco va en la
  tarjeta entera (`:focus-within`).

### Inputs / campos
- **Estilo:** 2.5rem de alto (el mismo en `/buscar` y en el buscador), fondo `paper` (no blanco)
  para sensación de inset, hairline `ink/10`, `radii.sm`, valor a escala body. Los selects nativos
  llevan la misma piel que los de antd de `/buscar`, con su chevron propio.
- **Foco:** el borde cambia a `blue`, sin glow/sombra agregada. Con el mouse alcanza el borde; con
  el teclado se suma el outline global.
- **Hover:** borde `blue`, solo con puntero fino.
- **Rangos de precio:** el valor elegido siempre se lee como texto o número, nunca solo por la
  posición de un thumb.

### Navegación
- **Estilo:** links de texto a escala label, sin cortarse en dos líneas (`nowrap`), hover a `blue`,
  sin subrayado en reposo ni en hover.
- **Responsive:** nav y acciones completas desde 992 px; por debajo, hamburguesa con un drawer que
  lista los mismos links apilados más los botones a ancho completo.

### Componente insignia: "La consola" (`HeroSearch`)
El buscador es el hero. Zona, Tipología, Precio desde/hasta, Dormitorios, "Más filtros" y "Buscar"
en una bandeja de doble borde (ver Formas) con `shadows.form` en el núcleo.
- **Celdas:** una columna en móvil (Dormitorios pasa a "Más filtros"), dos desde 768 px y una sola
  fila separada por hairlines verticales cuando el buscador mide 70rem o más (container query).
  "Más filtros" va antes que "Buscar" en todos los anchos, para que el foco siga el orden visual.
- **Interacción insignia:** la celda con foco se llena de celeste claro (capa por opacidad, radio
  `md`, `motion.duration.fast`).
- **"Más filtros":** un `<details>`. Desde 768 px, panel flotante debajo del botón (`lifted`,
  `radii.lg`, entrada por opacidad + escala 0.97, cierre en `fast`). En móvil con JS, hoja modal
  desde abajo (fondo `ink/45`, `deep`, curva `drawer`, foco atrapado, `aria-expanded`, salida
  animada). Sin JS se despliega en el lugar. Un contador pill azul muestra los filtros activos.
- **Sin JS:** es un `<form method="get">` a `/buscar` con los mismos params; se puede usar desde el
  primer frame. Los campos no son controlados, así no se pierde lo elegido antes de hidratar.
- Ningún contenedor del buscador lleva `overflow`, `transform`, `filter` ni `z-index` permanentes
  en móvil: recortarían la hoja `position: fixed`.

### Componente insignia: el loop de proceso ("Cómo funciona")
La única idea de movimiento autoral del sistema, en dos piezas que comparten la misma estructura de
4 pasos — Buscá → Postulate → Firmá → Pagá — y el mismo reloj (`--loop-duracion`, 8 s, definido en
la sección).
- **`ProcessLoopMotif`:** baldosa azul en degradé (`radii.xl`, `shadows.deep`), un anillo punteado
  celeste, 4 nodos celeste claro con íconos de trazo único azul en los puntos cardinales, y un
  punto dorado con borde celeste claro que orbita (un grupo que rota, `linear`) y pasa por detrás de
  cada nodo; el nodo late (`scale(1.12)`) en la llegada y un halo celeste marca el paso activo. Es
  el único lugar del sistema con íconos dibujados a mano. Decorativo (`aria-hidden`).
- **Lista de pasos:** números pill (borde `blue/25`, relleno azul con número celeste claro cuando
  el paso está activo) unidos por un conector `blue/15`; el paso activo se resalta con una capa
  blanca con hairline, sin sombra. Se activa en el mismo instante que el halo del nodo.
- **Cuándo corre:** solo mientras la sección está en pantalla (fuera, se congela donde estaba). Sin
  JS o con movimiento reducido queda quieto y los 4 pasos se ven iguales.

### Ilustraciones de barrios
Seis ilustraciones generadas, decorativas (`alt=""`: el nombre del barrio ya es el texto del link),
en la paleta de dos hues de la marca (azules y paper, con toques dorados mínimos), recuadro 4:5 con
`radii.lg` y fondo celeste mientras cargan. Procedencia en `apps/web/public/landing/IMAGES.md`.
Nunca se usan como fotos de propiedades ni de lugares reales.

### Ciudad del hero
Una ilustración panorámica generada con el mismo bloque de estilo que los barrios: un perfil de
ciudad genérica (casas bajas, edificios medianos con balcones, árboles), sin texto ni edificios
reales. Decorativa (`alt=""`). Va multiplicada (`mix-blend-mode: multiply`) al 55% sobre el azul:
el cielo, aplanado a blanco, deja el azul igual y lo dibujado lo oscurece, así que se lee como una
ciudad en azul oscuro. Arriba se funde con el fondo por una máscara. Estática: sin parallax ni
animación. Procedencia en `apps/web/public/landing/IMAGES.md`.

### Movimiento (`motion`, `--rentar-motion-*`)
Solo se animan `transform` y `opacity`.
- **Duraciones:** `fast` (160 ms) presión, color, celdas, el contador de filtros y el cierre del
  panel flotante; `base` (240 ms) popovers, capas de hover, la entrada del hero y el cierre de la
  hoja móvil; `slow` (400 ms) apariciones, la entrada de la hoja móvil y el zoom de foto — el tope de
  una entrada completa.
- **Curvas:** `out` para entradas y feedback; `inOut` para algo que se mueve dentro de la pantalla
  (el latido del nodo); `drawer` para paneles que entran desde un borde. `stagger` (60 ms) entre
  elementos que entran juntos.
- **Entrada del hero:** subtítulo, buscador y chips escalonados; el titular no se anima.
- **Aparición al entrar en pantalla (`RevealAlEntrar`):** los bloques marcados con `data-reveal`
  aparecen **una sola vez** (fade + 12 px, `slow`, `out`, escalonados cada `stagger`). Solo se
  ocultan los que están fuera de pantalla y recién después de hidratar: sin JS, antes de hidratar
  o con movimiento reducido, todo se ve.
- **Movimiento reducido:** sin escalas, desplazamientos ni loops; a lo sumo un fade corto.

## Do's and Don'ts

### Hacer:
- Mantener el dorado (`money`/`moneyInk`) atado solo a contenido de dinero/valor (línea de precio,
  `MoneyAmount`); fuera de eso solo existe en `::selection` y en el punto del loop.
- Usar `radii.pill` para todo botón/badge/chip, `radii.sm` para campos, `radii.md` para piezas
  internas y `radii.lg`/`radii.xl` para contenedores — ningún otro radio, y concéntricos cuando un
  contenedor envuelve a otro.
- Animar estados de sombra o de relleno con una capa aparte que solo cambia de `opacity` (la regla
  de la capa).
- Hacer aparecer el contenido al entrar en pantalla una sola vez, con `RevealAlEntrar`
  (`data-reveal`), sin ocultar nada sin JS ni con movimiento reducido.
- Poner los hover detrás de `@media (hover: hover) and (pointer: fine)` y apagar escalas y
  desplazamientos con `prefers-reduced-motion`.
- Medir cada contenedor público con `--rentar-container-max` más el margen lateral (16 px / 24 px
  desde 992), igual que el Header.
- Emparejar una animación CSS `transform` solo con elementos que no tengan un atributo SVG
  `transform` en el mismo nodo — anidar un `<g>` de posicionamiento estático alrededor de un `<g>`
  interno animado en su lugar (ver `ProcessLoopMotif`; mezclar los dos hace que el navegador
  descarte el atributo silenciosamente).
- Consumir los componentes de `@rentar/ui` antes de escribir uno nuevo — si algo parecido ya
  existe, extenderlo en vez de duplicarlo.
- Tokenizar cualquier color/radio/sombra/espaciado/duración nuevo en `packages/ui/src/tokens`, nunca
  hardcodeado en un `.module.css` o un `style={{}}` inline.

### No hacer:
- Poner un label "kicker" en mayúsculas/tracking directamente arriba de un H1/H2/H3 — nunca, por
  más tentador que sea agregar contexto arriba de un heading (la regla de no-eyebrow).
- Construir una sección nueva como una fila de tarjetas idénticas ícono+heading+párrafo — ese
  default de estructura de página está explícitamente rechazado en este sistema.
- Usar `ink/60`, `ink/50` o el dorado crudo para texto de cualquier tamaño — caen debajo del piso
  de contraste 4.5:1 (la regla de contraste).
- Sumar una segunda tipografía, un acento de borde de color, texto en degradé o una sombra dura
  tipo neobrutalista — ninguno de estos pertenece a este mundo.
- Animar la entrada del titular del hero (es el LCP en móviles bajos) o de la ciudad ilustrada (es
  el LCP en el resto), o dejar contenido oculto hasta que cargue JS.
- Re-animar una sección cada vez que entra y sale de pantalla.
- Usar las ilustraciones de barrios como fotos de una propiedad o de un lugar real.
- Hardcodear un hex/rgba en un `.module.css` cuando ya existe un token equivalente en
  `@rentar/ui` — si hace falta un valor nuevo, se agrega al token, no al componente.
