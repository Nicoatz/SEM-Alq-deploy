# Ilustraciones de la landing — procedencia

Las seis ilustraciones de la franja "Buscá por barrio" de la landing (`/`), en
`barrios/<slug>.webp`. Las usa `apps/web/src/lib/catalogs/barriosLanding.ts`.

- **Qué son:** ilustraciones generadas con IA, decorativas (`alt=""`: el nombre del barrio ya es el
  texto del link). Muestran escenas genéricas con la paleta de la marca: ningún edificio ni monumento
  real reconocible (pedido del PO).
- **Qué no son:** fotos de propiedades. No se usan como fotos de publicaciones ni de barrios reales.
- **Aprobadas por el PO:** 01/10/2026.

## Cómo se generaron

| Dato | Valor |
|---|---|
| Servicio | Pollinations (`gen.pollinations.ai`), herramienta `generateImage` |
| Modelo | `black-forest-labs/flux.2-klein-4b` |
| Semilla | `2026` (la misma en las seis) |
| Tamaño de origen | 960 × 1200 px (4:5), JPEG |
| Imagen de referencia | Ninguna (ver "Descartadas") |
| Post-proceso | `sharp`: recorte `cover` a 480 × 600 px (el doble del recuadro más ancho, 229 px en 768) y WebP calidad 72, `effort` 6 |
| Fecha | 01/10/2026 |

Cada prompt es el bloque de estilo B seguido de la escena del barrio (`Scene: …`), en inglés, tal
como se mandó al modelo.

### Bloque de estilo B (el mismo en las seis)

> Editorial flat illustration with subtle risograph grain, crisp geometric shapes and thin navy
> (#12202E) linework. Strict two-hue palette: everything is drawn only in blues and off-white. Deep
> cobalt blue #004D98, sky blue #A0D1EF, pale sky #E3F2FB and off-white paper #F7F9FB; trees, foliage
> and grass are rendered in these same blues (no green anywhere); building facades are off-white paper
> and pale sky (no cream, no beige). Small warm gold #D7B15D accents only on a few sunlit edges and
> windows. Soft late-afternoon light from the upper left, long gentle shadows, calm and warm mood.
> Generic Argentine city neighborhood: no recognizable real buildings, landmarks or monuments. No
> text, no letters, no numbers, no signs, no logos. People only as small faceless silhouettes.
> Vertical 4:5 composition, subject in the lower two thirds, quiet negative space in the upper third.

### Escena de cada barrio

| Archivo | Escena (`Scene: …`) | Origen | Peso |
|---|---|---|---|
| `barrios/nueva-cordoba.webp` | a tree-lined street of mid-rise apartment buildings with long balconies and plants, opening onto the edge of a large park with tall trees; two bicycles parked at the corner. | https://media.pollinations.ai/d9160c58-e76a-4c38-8005-d67cd4b93e7f | 30 KB |
| `barrios/guemes.webp` | a narrow street of old one-story houses with tall wooden doors and wrought-iron window grilles, and an open-air artisan fair of small canvas stalls under strings of warm lights at dusk. | https://media.pollinations.ai/dfb50d81-2a95-4781-afbe-a9aa621c8ed9 | 27 KB |
| `barrios/centro.webp` | a pedestrian street lined with older two- and three-story facades with cornices and shop awnings, a few people walking, a street lamp in the foreground; no domes or church towers. | https://media.pollinations.ai/6e090ccf-8211-4e6b-9273-f336d3ab70b0 | 26 KB |
| `barrios/general-paz.webp` | a quiet square with large trees and benches, surrounded by old low houses and a corner café with small tables on the sidewalk. | https://media.pollinations.ai/d68c880f-85ff-45c3-aae4-46b18a340e82 | 23 KB |
| `barrios/cofico.webp` | a calm residential block of small houses with front gardens and low fences, and a narrow passage with potted plants leading to an inner courtyard. | https://media.pollinations.ai/9d457226-03c9-4bbe-9780-d6180bf59ae8 | 23 KB |
| `barrios/alta-cordoba.webp` | a traditional residential street of old houses with ornate facades and small balconies, with railway tracks and a simple generic platform canopy at the end of the street. | https://media.pollinations.ai/73a8a00a-ac51-4263-9458-ba30318e98c1 | 34 KB |

## Descartadas (se generaron y no se usan)

Todas con el mismo modelo, la semilla `2026` y 960 × 1200 px.

1. **Nueva Córdoba con el bloque de estilo A** (el aprobado en el paso 3: "Strict limited palette",
   sin la regla de "two-hue" ni la de "no green"), con la misma escena:
   https://media.pollinations.ai/0d98b828-5b90-4d23-8603-0fdaec95fbd4. El PO eligió la variante B
   (paleta azul estricta) y el bloque de estilo se actualizó para las seis.
2. **Las otras cinco con la ilustración B de Nueva Córdoba como imagen de referencia** (el plan
   original): con la referencia, el modelo devolvía casi la misma calle de Nueva Córdoba para todos
   los barrios, así que se descartaron y las cinco se generaron de nuevo solo con el bloque de estilo B
   y la semilla, sin referencia.
   - Güemes: https://media.pollinations.ai/41d62c9b-e581-4dc2-9a0f-d94eeefb6221
   - Centro: https://media.pollinations.ai/df9dff70-06ab-4e38-bd3f-2c27f9399185
   - General Paz: https://media.pollinations.ai/d560d1e8-2426-4104-9231-9f32ace61f07
   - Cofico: https://media.pollinations.ai/ea4084a0-7160-471d-ae9b-f558cfc13b21
   - Alta Córdoba: https://media.pollinations.ai/f5e3f129-30ab-4c39-b7af-591f83424cd9

## Si hay que regenerarlas

Mismo modelo, semilla y tamaño, el bloque de estilo B y la escena del barrio, sin imagen de
referencia. Después, el mismo post-proceso (480 × 600 px, WebP calidad 72) y actualizar esta tabla.
Una ilustración nueva se muestra al PO antes de integrarla.
