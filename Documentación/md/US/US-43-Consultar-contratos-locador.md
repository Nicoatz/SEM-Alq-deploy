| **Consultar contratos locador** |
| - |
| Como locador, quiero consultar el listado de mis contratos para conocer su estado y acceder a cada uno. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión con un usuario locador. |
| - Se accede desde el ítem "Contratos" del menú del locador, en /panel/contratos. |
| - Solo se muestran los contratos de las propiedades del usuario. |
| *Listado* |
| - Para cada contrato se deben mostrar la propiedad, el código, el nombre del locatario, el estado, el monto actual, la vigencia y la fecha del próximo ajuste con su índice. |
| - En el listado nunca se muestran el DNI ni los datos de contacto del locatario o de los garantes. |
| - Cada contrato tiene un acceso según su estado: "Continuar" (borrador), "Ver firmas" (pendiente de firma), "Ver contrato" (vigente) y "Ver historial" (finalizado). |
| - Un borrador todavía no tiene código: se debe mostrar "Borrador" en su lugar. |
| - Por defecto, el listado muestra primero los pendientes de firma, después los borradores y al final el resto, ordenado por fecha de fin. |
| *Filtros y búsqueda* |
| - Se pueden filtrar los contratos por estado: todos, borradores, pendientes de firma, vigentes, por vencer y finalizados. "Por vencer" son los vigentes que terminan en los próximos 60 días. |
| - Se debe mostrar la cantidad de contratos de cada filtro. |
| - Se pueden buscar contratos por dirección de la propiedad o por nombre del locatario. |
| - Si un filtro o una búsqueda no tiene resultados, se debe indicar y ofrecer limpiar el filtro. |
| *Sin contratos* |
| - Si el locador no tiene contratos, se debe mostrar un mensaje con acceso a las solicitudes aceptadas. |
| **Pruebas de usuario:** |
| - Probar consultar los contratos sin haber iniciado sesión (falla). |
| - Probar consultar los contratos con un usuario que solo es locatario (falla). |
| - Probar verificar que solo se muestren los contratos de las propiedades del usuario (pasa). |
| - Probar verificar que cada contrato muestre propiedad, código, locatario, estado, monto actual, vigencia y próximo ajuste (pasa). |
| - Probar verificar que en el listado no aparezcan el DNI ni los datos de contacto (pasa). |
| - Probar verificar el orden por defecto: pendientes de firma, borradores y el resto por fecha de fin (pasa). |
| - Probar filtrar por cada estado y verificar los resultados y las cantidades (pasa). |
| - Probar filtrar "Por vencer" con un contrato que termina en 30 días y otro en 90, y verificar que solo aparezca el primero (pasa). |
| - Probar buscar un contrato por la dirección de la propiedad (pasa). |
| - Probar buscar un contrato por el nombre del locatario (pasa). |
| - Probar una búsqueda sin resultados y limpiar el filtro (pasa). |
| - Probar entrar a un contrato desde su acceso y verificar que se abra el alta (borrador) o el detalle (resto) (pasa). |
| - Probar consultar con un locador sin contratos y verificar el mensaje con acceso a las solicitudes aceptadas (pasa). |
