| **Consultar mis alquileres** |
| - |
| Como locatario, quiero consultar mis alquileres para conocer el estado de mi contrato, sus condiciones y sus próximos vencimientos. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión. |
| - Se debe acceder desde el ítem "Mi alquiler" del menú del locatario. |
| - Solo se muestran los contratos en los que el usuario es locatario: pendientes de firma, vigentes y finalizados. |
| - Si el usuario intenta acceder por URL a un contrato del que no es locatario, se debe mostrar "No encontramos este alquiler", sin distinguir si el contrato existe. |
| *Uno o varios alquileres* |
| - Si el usuario tiene un solo contrato pendiente de firma o vigente, se debe mostrar directamente su ficha en /panel/alquiler. |
| - Si tiene dos o más, el ítem del menú pasa a llamarse "Mis alquileres" y se debe mostrar el listado en /panel/alquileres. |
| - El listado se ordena así: pendientes de firma, después vigentes y al final finalizados, que se muestran atenuados y sin acciones. |
| - Cada alquiler del listado debe mostrar dirección, barrio, nombre del locador, estado, monto actual, vigencia y fecha del próximo ajuste. |
| - Si el usuario no tiene contratos, se debe mostrar el mensaje "Todavía no tenés un contrato activo" con acceso a buscar propiedades. |
| *Ficha del alquiler* |
| - Se debe mostrar la propiedad: foto principal, dirección exacta, piso y barrio. |
| - Se deben mostrar el estado del contrato y su código. |
| - Se deben mostrar el nombre y los datos de contacto del locador. |
| - Se deben mostrar las condiciones del contrato: vigencia (desde y hasta), monto actual, depósito, índice y periodicidad de ajuste, día de vencimiento del pago, medios de pago aceptados y garantes. |
| - Se debe mostrar "Lo que viene": la fecha del próximo vencimiento de pago, la fecha del próximo ajuste con su índice y la fecha de fin del contrato. Cada fecha indica cuántos días faltan. |
| - El monto del próximo ajuste se debe mostrar como "a definir". |
| - Se debe poder descargar el contrato en PDF y ver el estado de las firmas. |
| - Si el contrato está pendiente de firma y falta la firma del locatario, se debe mostrar el acceso para firmar (US-07). |
| - No se deben mostrar datos de otras propiedades del locador, solicitudes de terceros ni legajos de otros postulantes. |
| **Pruebas de usuario:** |
| - Probar consultar mis alquileres sin haber iniciado sesión (falla). |
| - Probar consultar con un usuario sin contratos y verificar que se muestre el mensaje con acceso a buscar propiedades (pasa). |
| - Probar consultar con un único contrato vigente y verificar que se muestre directamente la ficha (pasa). |
| - Probar consultar con dos o más contratos y verificar que se muestre el listado, que el menú diga "Mis alquileres" y que se respete el orden por estado (pasa). |
| - Probar verificar que un contrato finalizado se muestre al final, atenuado y sin acciones (pasa). |
| - Probar verificar que la ficha muestre dirección exacta, locador, vigencia, monto, depósito, ajuste, día de pago, medios de pago y garantes (pasa). |
| - Probar verificar que "Lo que viene" muestre las fechas del próximo pago, del próximo ajuste y del fin del contrato, con los días que faltan (pasa). |
| - Probar consultar un contrato sin ajuste y verificar que no se muestre la fecha de próximo ajuste (pasa). |
| - Probar descargar el PDF del contrato (pasa). |
| - Probar consultar un contrato pendiente de firma sin la firma del locatario y verificar que aparezca el acceso para firmar (pasa). |
| - Probar acceder por URL al alquiler de otro locatario (falla). |
| - Probar consultar mis alquileres como locador de la propiedad, sin ser su locatario, y verificar que ese contrato no aparezca (pasa). |
