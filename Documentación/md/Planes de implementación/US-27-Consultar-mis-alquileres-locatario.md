# Plan de implementación: US-27 Consultar mis alquileres como locatario

## Objetivo y alcance

Implementar la consulta autenticada de los contratos en los que el usuario actual es locatario, con filtros por estado y datos suficientes para construir el listado y la ficha del alquiler. Se mantiene la arquitectura actual de la API: ruta versionada, controller, service, repository, DTOs y documentación OpenAPI.

La implementación del backend contempla:

- `GET /api/v1/alquileres-locatario`: lista los contratos del usuario autenticado y acepta un filtro opcional por estado.
- `GET /api/v1/alquileres-locatario/:idContrato`: entrega los datos completos de un contrato solo si el usuario autenticado figura como locatario de ese contrato. Un contrato inexistente y uno ajeno deben producir la misma respuesta 404: `No encontramos este alquiler`.

El listado ordena los contratos pendientes de firma, luego los vigentes y finalmente los finalizados. El endpoint de detalle no acepta un `idUsuario`: la identidad siempre se toma del contexto establecido por `authenticateGateway`.

Este plan cubre los endpoints de lectura. La pantalla, el menú y la selección entre `/panel/alquiler` y `/panel/alquileres` pertenecen al frontend y no forman parte de esta primera implementación.

## Situación actual comprobada

- `GET /api/v1/mis-alquileres` ya está montado para el locador. Está protegido por `authenticateGateway` y `requireRole('locador')`, y consulta propiedades mediante `InmuebleRepository.findByLocadorId`.
- La relación usuario-contrato existe en `contrato_x_usuario`; `tipo_firmante = 2` corresponde a `Locatario principal`, y `tipo_firmante = 3` a `Garante`.
- El contrato guarda su estado como ID de `estado_contrato`. Los estados sembrados son `vigente = 2` y `finalizado = 3`; la migración `20261021120000_agregar_estado_pendiente_firma.sql` agrega `pendiente de firma = 4`. El estado `disponible = 1` es un estado de oferta y no debe incluirse en los alquileres del locatario.
- `ContratoRepository.findByInmuebleId` selecciona un solo contrato (prefiere uno no finalizado). No sirve para listar el historial de contratos del usuario: la consulta nueva debe recuperar cada relación de locatario con su contrato, sin perder contratos finalizados.
- `ContratoRepository.getLocatarioByContratoId` ya usa `contrato_x_usuario` y el tipo de firmante, y puede servir como referencia de la relación, pero el endpoint necesita resolver todos los contratos del usuario en una consulta agrupada, no hacer una consulta por propiedad.
- El esquema actual ya tiene `contrato.fecha_inicio_contrato`, condiciones, medios de pago y participantes. Aún no tiene día de vencimiento ni referencia al PDF; `contrato_x_usuario` tampoco registra estado ni fecha de firma. No existe una tabla histórica de ajustes. El rol de garante está representado por `contrato_x_usuario`, por lo que sus datos deben limitarse a los usuarios asociados al mismo contrato.

## Contrato HTTP propuesto

### `GET /api/v1/alquileres-locatario`

Autenticación Bearer obligatoria. No recibe el ID del usuario como parámetro ni en query. La consulta siempre utiliza `req.user.id`.

Query param:

| Nombre | Tipo | Valores | Comportamiento |
|---|---|---|---|
| `estado` | string | `pendiente_firma`, `vigente`, `finalizado` | Opcional. Sin valor devuelve los tres estados en el orden de la US-27. Un valor válido limita los resultados a ese estado. Un valor no reconocido responde 400. |

El estado de la API se expresa con nombres estables (`pendiente_firma`, `vigente`, `finalizado`) y el repository lo traduce a los IDs del catálogo. Evitar aceptar IDs del catálogo como filtro público: son detalles de persistencia y no parte del contrato HTTP.

Respuesta exitosa con sobre estándar `{ success, message, data }`; `data` es un arreglo, incluso si está vacío. Cada elemento incluye el estado normalizado y los datos de contrato y propiedad necesarios para el listado y para navegar a la ficha. No se agrega paginación en esta primera versión porque la US-27 no la requiere y el endpoint existente de locador tampoco pagina.

### `GET /api/v1/alquileres-locatario/:idContrato`

Autenticación Bearer obligatoria. Devuelve los datos completos del mismo contrato y sus relaciones permitidas solo cuando existe una fila de `contrato_x_usuario` con `id_usuario = req.user.id` y `tipo_firmante = 2`.

Si el ID no es un entero positivo, responde 400. Si el contrato no existe, está fuera de los estados visibles, o el usuario no es su locatario, responde el mismo 404 y el mismo texto: `No encontramos este alquiler`. No consultar primero por ID sin aplicar simultáneamente la pertenencia para evitar diferencias observables entre contrato ajeno e inexistente.

## Reglas de consulta, filtro y orden

1. La fuente de autorización es la relación `contrato_x_usuario`, no `inmueble.id_locador`, el rol activo de la interfaz ni un ID enviado por el cliente.
2. La consulta incluye únicamente relaciones cuyo `tipo_firmante` sea el de locatario principal y contratos en estado pendiente de firma, vigente o finalizado.
3. La colección por defecto ordena por prioridad de estado: pendiente de firma, vigente y finalizado. Dentro de cada grupo se ordena por fecha de inicio descendente y, como desempate estable, por ID de contrato descendente. Si una fecha no existe, se usa el desempate por ID.
4. El filtro `estado` es opcional y estricto. No debe interpretarse un valor inválido como ausencia de filtro.
5. El detalle reusa la misma regla de estado visible y pertenencia. Un usuario que sea locador de la propiedad, pero no locatario del contrato, no obtiene acceso.
6. El armado de la respuesta consulta exclusivamente el inmueble, locador, condiciones, fotos, índice, medios de pago y firmantes asociados al contrato solicitado. No devuelve otras propiedades del locador, solicitudes de terceros ni candidatos ajenos.
7. No excluir automáticamente un contrato finalizado por `inmueble.activo = false`: la consulta debe preservar el historial requerido por la US-27. La política sobre propiedades dadas de baja debe quedar alineada con la regla de eliminación lógica antes de agregar filtros de actividad.

## DTOs y respuesta

Agregar DTOs de API locales, sin reutilizar `MisAlquileresItem`, porque ese modelo describe la vista del locador y mezcla reclamos y estado de publicación:

- `EstadoContratoLocatarioDTO`: `pendiente_firma | vigente | finalizado`.
- `FiltrosMisAlquileresLocatarioDTO`: `{ estado?: EstadoContratoLocatarioDTO }`.
- `MisAlquileresLocatarioItemDTO`: identificador del contrato, estado, código disponible del contrato (por ahora el ID si el dominio no define otro código), resumen del inmueble (dirección, piso, barrio y foto principal), datos mínimos del locador, monto actual, fechas de vigencia, depósito, índice y frecuencia de ajuste, fecha calculada del próximo ajuste, medios de pago y datos de garantes del mismo contrato.
- `DetalleAlquilerLocatarioDTO`: los campos del item más dirección completa, condiciones, plazo de pago en días, URL temporal de descarga del PDF, estado/fecha de conformidad y estado/fecha de firma de locador y locatario, última fecha efectiva de ajuste y fechas de próximos hitos.

El DTO debe representar como `null` o campo ausente la información no disponible; no se deben generar datos ficticios. La API devuelve fechas ISO (`fecha_proximo_vencimiento_pago`, `fecha_proximo_ajuste`, `fecha_fin_contrato`), pero no campos como `dias_restantes`: el frontend calcula los días que faltan. En esta iteración no se calcula interés por mora. El PDF se resuelve como URL temporal después de autorizar al locatario; no se expone una URL pública permanente.

## Propuesta de cambios en la base de datos

La fecha inicial (`contrato.fecha_inicio_contrato`) ya existe y debe conservarse como dato base del contrato. La fecha del próximo ajuste se calcula desde esa fecha si todavía no hubo ajustes efectivos; luego se calcula desde la fecha efectiva del último ajuste registrado.

### Vencimiento y PDF en `contrato`

Agregar mediante una migración:

- `dias_para_vencimiento SMALLINT NULL`, con `CHECK (dias_para_vencimiento > 0)`. Representa el plazo calendario desde la fecha en que el monto del período queda disponible, no un día fijo del mes. La fecha se calcula como `fecha_disponibilidad_monto + dias_para_vencimiento`; si el conteo atraviesa el fin de mes, los días sobrantes continúan en el mes siguiente. Para el ciclo mensual se usa el primer día del período; si hubo un ajuste efectivo posterior durante ese período, la fecha efectiva del último ajuste es la nueva disponibilidad del monto y pasa a ser la base. Se mantiene nullable durante el backfill y para contratos/ofertas sin condiciones definitivas.
- `pdf_storage_path TEXT NULL`, con la ruta del objeto en un bucket privado de Supabase Storage. No guardar una URL firmada, porque expira, ni publicar contratos con una URL anónima: el endpoint primero autoriza al locatario y luego genera una URL firmada de corta duración. Si el repositorio decide guardar una URL permanente, el bucket y sus políticas deben seguir siendo privados y la API no debe devolverla directamente.
- `pdf_sha256 CHAR(64) NULL`, hash del contenido vigente para comprobar integridad e identificar la versión exacta del documento.

La creación y actualización de contratos debe persistir estos valores; agregar columnas sin actualizar los flujos de escritura dejaría los campos siempre vacíos. El PDF debe corresponder a una versión concreta del contrato.

### Estado y fecha de firma por participante

Cada fila de `contrato_x_usuario` ya identifica un participante de un contrato. Separar la conformidad con las condiciones de la firma del PDF: una persona puede estar de acuerdo antes de que ambas partes habiliten la firma. Locador, único locatario y garantes pueden firmar, así que el estado y la fecha de firma aplican a cada participante de esos tipos. La conformidad compartida que habilita el documento se mantiene para locador y locatario. Agregar:

- `fecha_conformidad TIMESTAMPTZ NULL`, asentada por el servidor cuando la parte acepta lo pactado. Es un evento irreversible: no se admite una transición que la borre o vuelva a estado pendiente.
- `hash_documento_conforme CHAR(64) NULL`, hash SHA-256 del documento/condiciones exactos aceptados por esa parte.
- `estado_firma VARCHAR(20) NOT NULL`, limitado con `CHECK` a `pendiente`, `firmado`, `rechazado` o `desconocido` para relaciones históricas sin evidencia.
- `fecha_firma TIMESTAMPTZ NULL`, establecida cuando pasa a `firmado`.
- `hash_documento_firmado CHAR(64) NULL`, copia del hash del PDF que firmó ese participante.
- Una restricción que exija `fecha_firma IS NOT NULL` y hash no nulo para `firmado`; para `pendiente`, ambos quedan nulos.

La fecha debe guardarse con zona horaria (`TIMESTAMPTZ`) y asignarse en servidor al registrar conformidad o firma, nunca confiar en timestamps enviados por el cliente. Las conformidades deben guardar el hash del contenido aceptado; solo si locador y locatario tienen el mismo hash se habilita la firma. El PDF definitivo se genera y queda inmutable cuando ambas partes dieron conformidad. Para cumplir la irreversibilidad, impedir mediante la operación transaccional o un trigger que `fecha_conformidad`/su hash se borren o cambien; además, bloquear cambios de condiciones y del documento una vez registrada la primera conformidad. Para filas existentes no se debe inferir conformidad ni firma: dejarlas sin conformidad hasta una conciliación verificable. Las nuevas asociaciones comienzan sin conformidad y con firma pendiente; los garantes se representan como firmantes, no como `no_requerido`.

La acción de firmar se habilita para el locatario solo cuando el contrato está pendiente de firma, el locador y el locatario tienen `fecha_conformidad`, ambos hashes de conformidad coinciden, y la fila del locatario conserva `estado_firma = pendiente`. Por ahora se modela un solo locatario por contrato; no agregar manejo de co-locatarios.

La acción de firma del GET US-27 sigue siendo específica del locatario: se habilita cuando el contrato está pendiente, locador y locatario conformaron el mismo hash, y el locatario aún no firmó. El detalle debe mostrar también el estado/fecha de firma de cada garante, pero esta implementación no agrega endpoints de firma.

Este diseño en `contrato_x_usuario` es adecuado si interesa conocer el estado y la fecha actuales de cada participante. Si se requiere auditoría legal de reintentos, revocaciones o cambios de documento, agregar además una tabla append-only `firma_contrato_evento` con `id_contrato_x_usuario`, tipo de evento, fecha, actor y versión/hash del PDF; no sobrescribir eventos anteriores. Como mínimo, el estado actual debe quedar asociado al participante y al documento exacto que firmó.

### Historial de ajustes

No recomiendo reemplazar `fecha_inicio_contrato` por una fecha móvil ni actualizarla cuando se aplica un aumento. Debe permanecer como el inicio original del contrato. Para conservar la última fecha efectiva y el historial, agregar una tabla `ajuste_contrato` con una fila por ajuste aplicado:

| Columna | Tipo sugerido | Uso |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | Identificador del evento. |
| `id_contrato` | `INT NOT NULL REFERENCES contrato(id)` | Contrato al que pertenece. |
| `fecha_efectiva` | `DATE NOT NULL` | Desde cuándo rige el nuevo monto; es la fecha usada para calcular el siguiente ajuste. |
| `monto_anterior` / `monto_nuevo` | `NUMERIC(12,2) NOT NULL` | Trazabilidad y monto vigente después del evento. |
| `indice_aplicado` | `INT NULL REFERENCES tipo_indice(id)` | Índice usado en este ajuste, como snapshot de la regla aplicada. |
| `porcentaje_aplicado` | `NUMERIC(8,4) NULL` | Porcentaje/variación aplicada, si el cálculo lo produce. |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Momento de registro, separado de la fecha efectiva. |

La escritura de un ajuste debe ser transaccional: insertar el evento y actualizar `contrato.monto_alquiler` en la misma operación. La última actualización se obtiene por `fecha_efectiva DESC, id DESC`; no se mantiene manualmente una segunda fecha mutable en `contrato`. Para obtener la próxima fecha: usar `fecha_inicio_contrato + frecuencia_ajuste` si no hay eventos; si existe uno, usar `último_ajuste.fecha_efectiva + frecuencia_ajuste`. Si el resultado supera `fecha_fin_contrato`, devolver la fecha de fin como límite. La frecuencia se interpreta con una función única y testeada (por ejemplo, `Semestral` equivale a seis meses), con regla explícita para fechas de fin de mes.

La tabla registra ajustes realmente aplicados, no futuros estimados. El importe del próximo aumento sigue siendo `a definir`, y no se crea una fila hasta que el nuevo monto tenga fecha efectiva.

### Migración y compatibilidad

Crear una migración versionada que agregue las columnas y tablas, índices por `contrato_x_usuario(id_usuario, tipo_firmante, id_contrato)` y `ajuste_contrato(id_contrato, fecha_efectiva DESC)`, y las restricciones descritas. Mantener la migración compatible con contratos existentes: `fecha_inicio_contrato` ya existe y no debe hacerse globalmente `NOT NULL` sin separar primero los contratos de oferta (`estado = disponible`) de los contratos formalizados. Al pasar a pendiente de firma o vigente, validar que la fecha inicial y las condiciones requeridas estén completas.

Para contratos históricos, no inventar plazos de pago, rutas de PDF, fechas de conformidad/firma ni aumentos pasados. Dejar los nuevos valores nulos o cargar únicamente datos verificados. Si ya hay firmas o ajustes documentados fuera de la base, preparar una carga de backfill revisable antes de declarar la migración completa.

El endpoint no debe inferir la firma de cada participante a partir de `contrato.estado`: son estados distintos. Tampoco debe calcular un monto futuro de aumento; la UI muestra `a definir`.

Los garantes pueden exponerse como datos mínimos de contacto únicamente si están asociados al mismo `id_contrato` mediante `tipo_firmante = 3`. No devolver información de legajos o postulaciones.

## Cambios por capa

### DTOs

Agregar los DTOs anteriores en `apps/api/src/dtos/`, exportarlos desde el índice y tipar tanto la respuesta del listado como la del detalle. Mantener `MisAlquileresDTO` y `FiltrosMisAlquileresDTO` actuales para el flujo del locador sin cambios.

### Repository

Extender `ContratoRepository` (o crear un repository de lectura de alquileres si la forma del join no cabe claramente en su responsabilidad) con operaciones equivalentes a:

- `findByLocatarioId(locatarioId, filtros)`: consulta `contrato_x_usuario` con filtro de usuario y firmante locatario, join de contrato e inmueble, y filtro opcional por estado. Debe recuperar todos los contratos visibles, no solo el último contrato por inmueble.
- `findByIdAndLocatarioId(idContrato, locatarioId)`: aplica ID de contrato, usuario, rol de firmante y estado visible dentro de la misma consulta; devuelve `null` si no existe coincidencia.
- Enriquecimiento asociado por contrato: locador, foto principal, índice, medios de pago y participantes garantes. Usar joins o consultas por lote; evitar N+1 por fila.

El repository traduce los estados semánticos a IDs del catálogo usando una única constante o mapa documentado. Si en el futuro los IDs dejan de ser estables, resolverlos por descripción de catálogo en lugar de hardcodearlos dispersos.

### Service

Crear un service específico de consulta para locatario, o agregar métodos claramente separados en un service de contratos. El service:

- recibe el usuario autenticado y filtros ya validados;
- transforma filas relacionales a los DTOs de salida, sin filtrar por el rol activo de la UI;
- normaliza los estados del catálogo a la unión de dominio;
- aplica el orden de estados y desempates definido;
- calcula fechas derivables con utilidades testeables y sin depender del reloj del sistema cuando las pruebas necesiten una fecha fija;
- mapea la ausencia del detalle autorizado a un único resultado no encontrado.

Mantener la inyección de dependencias que ya usa `InmuebleService` para que las pruebas unitarias puedan usar repositorios falsos. No hacer consultas a tablas desde controllers.

### Controller y rutas

Crear un router separado y montarlo en `apps/api/src/routes/v1/index.ts` como `/alquileres-locatario`; no mezclarlo con `/mis-alquileres`, que ya corresponde al locador. Dentro del router registrar la colección antes de `/:idContrato` y aplicar `authenticateGateway` a ambas rutas. La US exige sesión; no agregar una barrera de rol que impida consultar a una cuenta válida por un detalle de cómo la interfaz selecciona el rol activo. La pertenencia como locatario del contrato es la autorización efectiva.

El controller valida `estado` contra la lista cerrada; responde 400 ante valores inválidos, 200 con `data: []` cuando no hay resultados y 404 genérico para detalle ajeno/inexistente. No aceptar `idUsuario` ni un filtro que permita ampliar el conjunto de contratos propio.

### OpenAPI

Documentar ambas operaciones junto a las rutas de `mis-alquileres`:

- `GET /api/v1/alquileres-locatario`: seguridad Bearer, parámetro `estado` opcional con enum, esquema completo del sobre y de cada item, respuestas 200, 400 y 401.
- `GET /api/v1/alquileres-locatario/{idContrato}`: parámetro path entero positivo, seguridad Bearer, esquema del detalle y respuestas 200, 400, 401 y 404 genérico.

Usar el nombre real del esquema de seguridad declarado en `apps/api/src/config/swagger.ts` (`SupabaseBearerAuth`) para no introducir una referencia inválida.

## Pruebas unitarias

Agregar pruebas unitarias aisladas del acceso a Supabase, con repositorios falsos y fecha fija. La configuración actual de Jest restringe `testMatch` a `solicitudes.test.ts`; ampliar la configuración para incluir la nueva carpeta de unit tests sin ejecutar los tests API existentes que escriben en la base.

Casos mínimos del service:

- Devuelve todos y solo los contratos asociados al usuario como locatario principal; excluye disponibles, contratos de otros usuarios y asociaciones donde participa solo como locador o garante.
- Filtro individual de cada estado y rechazo/validación previa de estados inválidos.
- Orden pendiente de firma → vigente → finalizado; orden estable dentro del estado.
- Usuario sin contratos produce lista vacía.
- El DTO incluye solo propiedad, locador, medios de pago y garantes pertenecientes al contrato consultado.
- Próximo ajuste calculado desde `fecha_inicio_contrato` cuando no hay historial y desde el último `fecha_efectiva` cuando sí hay; sin índice/frecuencia configurados devuelve `null`.
- Fecha de vencimiento = fecha de disponibilidad del monto del período + plazo almacenado; al cruzar de mes, los días se cuentan de forma continua.
- La API devuelve fechas, no días restantes; estos se derivan en el frontend. No se calcula mora en esta iteración.
- La firma del locatario solo se habilita cuando locador y locatario dieron conformidad al mismo documento y el locatario aún no firmó.
- Estado y fecha de firma independientes para locador y único locatario; no se implementan co-locatarios en esta iteración.
- Cada ajuste aplicado actualiza el monto del contrato y crea historial; no se cambia la fecha inicial.
- Detalle accesible para el locatario correcto; mismo resultado `null` para ID inexistente y contrato perteneciente a otra persona.
- Los datos de plazo, PDF, conformidad y firma salen de persistencia; no se infieren del estado general del contrato.

Casos mínimos de controller/rutas:

- Sin Bearer: 401.
- `estado` válido se pasa al service; inválido responde 400.
- Lista vacía responde 200 con arreglo vacío.
- Detalle ajeno e inexistente responden el mismo 404 y mensaje.

No usar `apps/api/tests/api/` como prueba de este cambio: la guía del repo advierte que los tests API actuales usan un mecanismo de identidad obsoleto y pueden escribir en la base.

## Archivos previstos

- `apps/api/src/routes/v1/alquileres-locatario.routes.ts` y `apps/api/src/routes/v1/index.ts` para el montaje del router.
- `apps/api/src/controllers/` (controller de alquiler del locatario, separado del controller del locador).
- `apps/api/src/services/` (service de consulta del locatario).
- `apps/api/src/repositories/contrato.repository.ts` o nuevo repository de lectura de alquileres.
- `apps/api/src/dtos/` y `apps/api/src/dtos/index.ts`.
- `apps/api/src/routes/v1/alquileres-locatario.routes.ts` para anotaciones Swagger.
- `supabase/migrations/` para vencimiento, ruta privada del PDF, firma por participante e historial de ajustes.
- Flujos de escritura de contrato/firma/ajuste para mantener los nuevos datos; revisar el RPC de registro completo si forma parte de la creación de estos contratos.
- `apps/api/jest.config.cjs` y `apps/api/tests/unit/` para habilitar y agregar las pruebas unitarias.
- `docs/api-endpoints.md` y `docs/HANDOFF-BACKEND.md` para registrar el nuevo endpoint y el estado de implementación.

La implementación completa de la ficha depende de migrar la base y actualizar los flujos de escritura descritos arriba. El listado básico puede implementarse antes; mientras falten las migraciones, esos campos deben ser `null`/no disponibles, nunca simulados.

## Secuencia de implementación

1. Acordar semántica de estados de firma, transición de contratos, calendario de ajustes y almacenamiento privado de PDFs.
2. Crear la migración y los flujos transaccionales para vencimiento, PDF, firma de cada participante e historial de ajustes; preservar `fecha_inicio_contrato` como fecha original.
3. Definir y exportar los DTOs y el enum público de estado.
4. Implementar las consultas del repository para colección y detalle, verificando que el filtro de pertenencia se aplique en base de datos.
5. Implementar el service con traducción de estados, enriquecimiento por lote, ordenamiento, URL firmada y cálculo de fechas desde el historial.
6. Agregar controller y rutas autenticadas, validación del query param y respuestas uniformes.
7. Documentar ambas operaciones en Swagger y actualizar el catálogo de endpoints/handoff.
8. Incorporar unit tests con repositorios falsos y ejecutarlos junto al typecheck/build de API, sin ejecutar las pruebas API legacy.
9. Validar manualmente en una base de prueba los casos de un usuario sin contratos, contratos en cada estado, conformidad de ambas partes, firma pendiente del locatario, ajustes previos, cálculo de vencimiento que cruza de mes y acceso cruzado entre usuarios.

## Criterio de cierre del backend

La implementación queda lista cuando el listado filtra correctamente por `estado`, el resultado por defecto respeta el orden de la US-27, solo devuelve contratos donde el token autenticado está asociado como locatario principal, y el detalle de contratos ajenos e inexistentes es indistinguible. DTOs, Swagger, unit tests y documentación deben reflejar el mismo contrato. Los datos no disponibles en el esquema quedan documentados como brecha y no se fabrican.