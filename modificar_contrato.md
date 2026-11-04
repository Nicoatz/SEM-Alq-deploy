# Modificar contrato (US-06) y modificar la oferta (US-03) — guía para el front

Cómo funcionan los endpoints para modificar lo que el locador publica (la **oferta**) y lo que negocia
con un locatario (el **contrato**). Contrato de la API completo: [`api-endpoints.md`](docs/api-endpoints.md),
sección "Contratos". Swagger: `http://localhost:3000/api/v1/docs` (secciones **Inmuebles** y **Contratos**).
Detalle del modelo de datos: [`registrar_contrato_desarrollo.md`](registrar_contrato_desarrollo.md).

Todas las rutas llevan `Authorization: Bearer <token>` y rol `locador` (solo el dueño).

## 1. Dos cosas distintas, una sola pantalla

Para el usuario "modificar" es una sola idea. En la base son **dos filas distintas** de la tabla `contrato`:

| | Oferta | Contrato en curso |
|---|---|---|
| Qué es | Las condiciones comerciales de la publicación (precio, expensas, índice, medios de pago…) | Lo que se negocia, se firma y rige el alquiler con un locatario |
| Quién la ve | El público (listado y detalle de la propiedad) | El locador y el locatario |
| Cómo se modifica | `PUT /inmuebles/:id` (junto con la propiedad, o sola) | `POST /contratos/:id/reabrir` + `PATCH /contratos/:id` |
| Cuándo se puede | Mientras la propiedad **no esté alquilada** | Solo en **borrador**; un pendiente de firma se reabre antes |

**Regla de oro:** modificar la oferta **nunca** cambia un contrato que ya se inició, y modificar el
contrato **nunca** cambia lo publicado. Si el locador baja el precio de la publicación, los contratos en
negociación conservan el monto que ya tenían.

---

## 2. Modificar la propiedad y/o la oferta — `PUT /inmuebles/:id`

Es el endpoint de US-03, ahora con un bloque opcional `condiciones_contrato`. Todo se guarda en **una
sola transacción**: si algo falla, no se guarda nada.

Tres formas de usarlo, según lo que cambió el usuario:

```jsonc
// a) Solo datos de la propiedad (como siempre)
{ "descripcion": "Con balcón", "ambientes": 3 }

// b) Solo la oferta
{ "condiciones_contrato": { "expensas": 45000, "medios_pago": [1, 3] } }

// c) Las dos a la vez
{ "barrio": "Nueva Córdoba",
  "precio_publicado": 380000,
  "condiciones_contrato": { "expensas": 45000 } }
```

### Campos de `condiciones_contrato` (todos opcionales)

Solo se cambia lo que viene; lo que se omite conserva su valor. Mandá **solo lo que el usuario cambió**.

| Campo | Regla |
|---|---|
| `monto_alquiler` | Número mayor a 0 |
| `expensas` | Número mayor o igual a 0 |
| `indice_aumento` | Id de `tipo_indice`; `null` = sin ajuste |
| `frecuencia_ajuste` | Texto; `null` la borra |
| `duracion_meses` | Entero mayor a 0, o `null` |
| `deposito` | Mayor o igual a 0, o `null` |
| `interes_por_dia` | Número, o `null`. **Si es mayor a 0 tienen que estar los `dias_gracia`** (los que llegan o los ya guardados) |
| `dias_gracia` | Entero, o `null` |
| `medios_pago` | Lista de ids, **mínimo 1**. Si se envía, **reemplaza la lista completa** |

### `monto_alquiler` y `precio_publicado` son el mismo dato

La publicación muestra el precio de la oferta, así que los dos se mantienen iguales:

- Si llega solo uno, el otro se actualiza solo.
- Si llegan los dos con valores distintos → **400**. Mandá solo uno, o el mismo valor en ambos.

### Respuestas

| Status | Cuándo |
|---|---|
| **200** | Guardado. `data` es el **inmueble** actualizado; **no incluye la oferta** → para mostrarla, volvé a pedir el detalle de la propiedad |
| **400** | Dato inválido (monto ≤ 0, expensas negativas, `medios_pago` vacío, interés sin días de gracia, índice inexistente, montos distintos…). El motivo está en `error` |
| **401 / 403 / 404** | Sin sesión / no es el dueño / no existe o está dada de baja |
| **409** | La propiedad está **alquilada** (o publicada/alquilada): no se puede modificar ni ella ni su oferta. "No se puede modificar una propiedad que está alquilada." |

> Una propiedad `pausada` o `publicada` sí se puede modificar, aunque tenga un contrato en borrador o
> pendiente de firma: ese contrato no se toca.

---

## 3. Modificar un contrato

El contrato pasa por estados: **borrador** → **pendiente de firma** → **vigente** → **finalizado**.
Solo se edita en **borrador**.

| Estado | ¿Se puede modificar? | Cómo |
|---|---|---|
| Borrador | Sí | Directo, con `GET` y `PATCH` (sección 3.3) |
| Pendiente de firma, **sin** la firma del locatario | Sí | Primero `reabrir` (sección 3.2), después como un borrador |
| Pendiente de firma, **con** la firma del locatario | No | 409 `CONTRATO_FIRMADO_POR_LOCATARIO` |
| Vigente | No | 409 `CONTRATO_VIGENTE` |
| Finalizado | No | 409 `CONTRATO_FINALIZADO` |

### 3.1 Saber si mostrar el botón "Modificar" — `GET /contratos/:id/detalle`

El detalle ya trae las acciones disponibles. Mostrá "Modificar" solo si:

```json
"acciones": { "modificar": true, "firmar": true, "descargar_pdf": true }
```

`modificar: true` significa **pendiente de firma y sin la firma del locatario**. Con un borrador, el
detalle responde 409 `CONTRATO_BORRADOR`: ahí no hay detalle, el botón del listado lleva directo a editar
(sección 3.3).

### 3.2 Volver a borrador — `POST /contratos/:id/reabrir`

Sin body. Para un contrato **pendiente de firma**. Qué hace, todo en una transacción:

1. Cancela el envío a firmar.
2. **Borra las firmas registradas** (locador, locatario y garantes) y anula los enlaces de firma de los garantes.
3. Lo pasa a **borrador** y **conserva su código** `CT-AAAA-NNNN`.
4. La propiedad y la oferta no cambian.

> **El front tiene que pedir confirmación antes de llamarlo**, avisando las tres consecuencias:
> *"Se cancela el envío, se borran las firmas registradas y el contrato vuelve a borrador."*
> Si el usuario cancela, **no se llama al endpoint** y el contrato sigue pendiente con sus firmas.

**200** → el contrato completo (mismo formato que `GET /contratos/:id`), ya en `estado: "borrador"` y con
`ultimo_paso: 1`. Con eso se abre el formulario de edición.

| Status | `codigo` | Cuándo |
|---|---|---|
| 404 | — | No existe o es de otro locador ("No encontramos este contrato.", sin distinguir) |
| 409 | `CONTRATO_FIRMADO_POR_LOCATARIO` | El locatario ya firmó **o dio su conformidad** |
| 409 | `CONTRATO_VIGENTE` | Ya lo firmaron todos |
| 409 | `CONTRATO_FINALIZADO` | Terminó |
| 409 | `CONTRATO_YA_EN_BORRADOR` | Ya es borrador: no hay nada que reabrir, usá `GET` y `PATCH` |

Mostrale al usuario el `message` del 409: explica el motivo ("se debe explicar el motivo" de la US).

### 3.3 Editar — los mismos endpoints del alta (US-05)

Un contrato reabierto es **un borrador más**: se edita con los 4 pasos y las mismas validaciones del alta.

| Para… | Endpoint |
|---|---|
| Cargar el contrato precargado y abrirlo en el paso donde quedó | `GET /contratos/:id` (`ultimo_paso`) |
| Guardar garantes y condiciones, desde cualquier paso | `PATCH /contratos/:id` con `{ paso?, condiciones?, garantes? }` |
| Cargar o reemplazar el PDF (paso 3) | `POST /contratos/:id/pdf/url-subida` y `PUT /contratos/:id/pdf` |

Lo que **se puede** modificar: garantes, condiciones (fecha de inicio, duración, monto, depósito, plazo de
vencimiento, índice, periodicidad) y el PDF. Lo que **no**: la propiedad y el locatario vienen de la
solicitud de origen. Si el `PATCH` trae `id_inmueble`, `inmueble`, `locatario`, `id_locatario`, `locador`,
`id_locador` o `id_solicitud`, responde **400**. En la pantalla, mostrá esos datos de solo lectura.

Validaciones del `PATCH` (todas 400): hasta 3 garantes, con nombre, apellido, DNI de 7 u 8 dígitos y correo;
sin repetir DNI ni correo; un garante no puede ser el locador ni el locatario; fecha de inicio `AAAA-MM-DD`
y no anterior a hoy; duración entera > 0; monto entero > 0 (sin decimales, ni 0); depósito entero ≥ 0;
plazo de vencimiento de 1 a 28 días.

**Si el contrato ya no es borrador**, el `PATCH` y los endpoints del PDF responden 409
`CONTRATO_NO_EDITABLE`: hay que reabrirlo antes.

**Fecha de inicio vencida.** El `GET` y la respuesta del `PATCH` traen `fecha_inicio_vencida: true` si la
fecha guardada ya pasó. En ese caso, pedile al usuario una nueva antes de reenviar a firmar (el `PATCH`
mismo rechaza fechas pasadas, así que no se puede guardar una vencida).

### 3.4 Salir con cambios sin guardar

Lo resuelve **solo el front**: avisar si el usuario intenta salir con cambios que no mandó con el `PATCH`.
El back guarda lo que le llega, paso a paso.

### 3.5 Guardar o reenviar a firmar

- **Guardar como borrador:** es el `PATCH`; no hace falta nada más.
- **Volver a enviar a firmar** (con la casilla de revisión y la confirmación del alta): **todavía no
  existe**, es el endpoint "enviar a firmar" de US-07. Hasta entonces, el contrato queda en borrador.

### 3.6 Descartar un borrador — `DELETE /contratos/:id`

Elimina el borrador con sus garantes, partes y PDF. La **solicitud aceptada queda libre**: se puede iniciar
un contrato nuevo con `POST /contratos` y la misma `id_solicitud`.

> **Pedí confirmación antes de llamarlo.** Si el usuario cancela, no se llama y el borrador se mantiene.

| Status | Cuándo |
|---|---|
| **200** | Descartado (sin `data`) |
| 404 | No existe o es de otro locador |
| 409 `CONTRATO_NO_EDITABLE` | No es un borrador. Un pendiente de firma hay que **reabrirlo primero** y después descartarlo |

Descartar un borrador que ya había sido enviado a firmar (reabierto) **borra también su código**
`CT-AAAA-NNNN`: el contrato nuevo tendrá otro.

---

## 4. Flujos de pantalla

**Modificar un contrato pendiente de firma**

```
Detalle (GET /contratos/:id/detalle) ── acciones.modificar = true ──► botón "Modificar"
   └─ Confirmación: "se cancela el envío, se borran las firmas, vuelve a borrador"
        ├─ Cancelar ──► nada (el contrato sigue pendiente)
        └─ Aceptar ──► POST /contratos/:id/reabrir ──► 200 (borrador, mismo código)
              └─ Formulario de 4 pasos ◄── datos del contrato (la propiedad y el locatario, solo lectura)
                    └─ Cada paso: PATCH /contratos/:id   (PDF: url-subida + PUT /pdf)
```

**Retomar o descartar un borrador**

```
Listado ──► borrador ──► GET /contratos/:id ──► abre en `ultimo_paso`, con los datos precargados
                    └─► "Descartar" ──► confirmación ──► DELETE /contratos/:id ──► 200
```

**Modificar la oferta**

```
Editar propiedad ──► PUT /inmuebles/:id  { …campos de la propiedad, condiciones_contrato?: {…} }
                 └─► 200 ──► volver a pedir el detalle de la propiedad para mostrar la oferta actualizada
```

---

## 5. Tabla de errores

| Endpoint | Status | `codigo` |
|---|---|---|
| `POST /contratos/:id/reabrir` | 409 | `CONTRATO_VIGENTE`, `CONTRATO_FINALIZADO`, `CONTRATO_FIRMADO_POR_LOCATARIO`, `CONTRATO_YA_EN_BORRADOR` |
| `DELETE /contratos/:id`, `PATCH /contratos/:id`, endpoints del PDF | 409 | `CONTRATO_NO_EDITABLE` |
| `GET /contratos/:id/detalle` de un borrador | 409 | `CONTRATO_BORRADOR` |
| Cualquiera sobre un contrato ajeno o inexistente | 404 | — ("No encontramos este contrato.") |
| `PUT /inmuebles/:id` de una propiedad alquilada | 409 | — (sin `codigo`; se distingue por el status) |

Los 409 de contratos traen `codigo` en el sobre: `{ success: false, message, error, codigo }`. Usá el
`codigo` para decidir qué mostrar y el `message` como texto.

---

## 6. Para aplicar en la base (en orden)

1. `20261104000000_us06_modificar_contrato.sql` — funciones `reabrir_contrato` y `descartar_borrador_contrato`.
2. `20261104000001_us03_modificar_oferta.sql` — `actualizar_propiedad_completa` ahora también modifica la oferta.

Ambas solo las puede ejecutar la API (`service_role`).
