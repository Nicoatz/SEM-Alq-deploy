| **Consultar cobro** |
| - |
| Como locador o locatario, quiero consultar los cobros para conocer la información y el estado de los pagos del alquiler. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión. |
| - El locador accede desde el ítem "Cobros" de su menú (/panel/cobros) y ve solo los cobros de sus propiedades. |
| - El locatario accede desde el ítem "Mis pagos" de su menú (/panel/pagos) y ve solo los pagos de los contratos en los que es locatario. |
| - Si el usuario intenta acceder por URL a un período que no es suyo, se debe mostrar "No encontramos este cobro", sin distinguir si existe. |
| *Cobros del locador (/panel/cobros)* |
| - Se deben mostrar indicadores del mes elegido: cobrado y vencido. |
| - Se debe mostrar una fila por período y por propiedad, con propiedad, locatario, período, monto, estado y la acción "Ver detalle". |
| - Se pueden filtrar los cobros por propiedad, por mes y por estado (todos, vencidos y pagados). Cada filtro de estado muestra su cantidad. |
| - Por defecto, el listado muestra primero los vencidos, después los pagados. Dentro de cada grupo, el período más viejo primero. El filtro por propiedad no cambia el orden. |
| - Si el locador no tiene contratos vigentes, se debe mostrar un mensaje con acceso a Contratos. |
| *Detalle del período (/panel/cobros/[id])* |
| - Se deben mostrar la propiedad, el locatario, el código del contrato con acceso al contrato, el período y su fecha de vencimiento. |
| - Se deben mostrar los cargos línea por línea (alquiler del período e intereses por mora), el total, lo cobrado y el saldo. |
| - Se deben mostrar los cobros registrados, con fecha, monto, medio, quién lo cargó y acceso a su comprobante (US-10). |
| - Se debe mostrar el comprobante adjunto de cada cobro, si lo tiene. |
| - Se debe mostrar el historial del período con fecha y hora. |
| - El locador ve las acciones "Registrar un pago a mano" (US-08)sobre cada cobro. El locatario ve el mismo detalle sin esas acciones. |
| *Mis pagos del locatario (/panel/pagos)* |
| - Arriba y separado del historial, se debe mostrar el período pendiente o vencido, con su monto, su fecha de vencimiento y acceso a su detalle. |
| - Se deben mostrar indicadores del año: total pagado, pagos a término y recargos pagados. |
| - El historial muestra las mismas columnas que Cobros del locador: período, monto, medio, fecha de pago, estado y comprobante. Se ordena del período más nuevo al más viejo. |
| - Si un pago tuvo intereses por mora, se debe mostrar el recargo aparte del monto del alquiler y los días de atraso junto a la fecha de pago (por ejemplo, "14/07/2026 · +4 días"). |
| - Se pueden filtrar los pagos por año, por estado y por medio. |
| - Con dos o más contratos, la propiedad se muestra como primera columna. |
| - Si el locatario no tiene pagos, se debe mostrar un mensaje que lo indique. |
| *General* |
| - En móvil, cada fila del listado se muestra como una tarjeta. |
| - Si no se pueden traer los datos, se debe mostrar un mensaje de error con la opción de reintentar. |
| **Pruebas de usuario:** |
| - Probar consultar los cobros sin haber iniciado sesión (falla). |
| - Probar consultar Cobros como locador y verificar que solo se muestren los períodos de sus propiedades (pasa). |
| - Probar consultar Mis pagos como locatario y verificar que solo se muestren sus pagos (pasa). |
| - Probar acceder por URL al detalle de un período de otro usuario y verificar que se muestre "No encontramos este cobro" (pasa). |
| - Probar verificar que cada fila muestre propiedad, locatario, período, monto, estado y "Ver detalle" (pasa). |
| - Probar verificar el orden por defecto: vencidos, pendientes y pagados, y dentro de cada grupo el más viejo primero (pasa). |
| - Probar verificar que un período vencido muestre los días de atraso (pasa). |
| - Probar filtrar por cada estado y verificar los resultados y las cantidades (pasa). |
| - Probar filtrar por propiedad y por mes (pasa). |
| - Probar copiar la URL con filtros, abrirla en otra pestaña y verificar que se mantengan los filtros (pasa). |
| - Probar un filtro sin resultados y limpiarlo (pasa). |
| - Probar consultar Cobros con un locador sin contratos vigentes y verificar el mensaje con acceso a Contratos (pasa). |
| - Probar abrir el detalle de un período y verificar cargos, total, cobrado, saldo, cobros registrados e historial (pasa). |
| - Probar abrir el detalle como locatario y verificar que no aparezca "Registrar un pago a mano" (pasa). |
| - Probar verificar que en Mis pagos el período pendiente se muestre arriba y separado del historial (pasa). |
| - Probar verificar que un pago con mora muestre el recargo aparte y los días de atraso (pasa). |
| - Probar filtrar Mis pagos por año, estado y medio (pasa). |
| - Probar consultar Mis pagos con un locatario sin pagos y verificar el mensaje (pasa). |
| - Probar consultar los listados en un ancho de 390 px y verificar que se muestren como tarjetas (pasa). |
| - Probar simular un error al traer los datos y reintentar (pasa). |
