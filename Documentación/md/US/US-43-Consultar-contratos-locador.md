| **Consultar contratos locador** |
| - |
| Como locador, quiero consultar los contratos de cada una de mis propiedades, el actual y los anteriores, para conocer su estado y acceder a cada uno. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión con el usuario locador dueño de la propiedad. |
| - Los contratos se consultan únicamente desde el detalle de la propiedad (/panel/propiedades/[id]), en la pestaña "Contratos". No existe un listado con los contratos de todas las propiedades del locador. |
| - En la pestaña solo se muestran los contratos de esa propiedad. |
| - Si la propiedad no existe o no es del usuario, se debe mostrar "No encontramos esta propiedad", sin distinguir entre los dos casos. |
| *Contrato actual* |
| - El contrato actual es el que está en borrador, pendiente de firma o vigente. Una propiedad puede tener como máximo un contrato actual, y se muestra primero. |
| - Se deben mostrar el código del contrato, el estado, el nombre del locatario, la vigencia (dd/mm/aaaa → dd/mm/aaaa), el alquiler actual y el próximo ajuste con su índice. |
| - Si el contrato es "Sin ajuste", se debe indicar así en lugar de la fecha del próximo ajuste. |
| - Si es un borrador sin código, se debe mostrar "Borrador sin código" en su lugar. Los datos que el borrador todavía no tiene se deben mostrar como "—". |
| - Si está pendiente de firma, se debe indicar quién firmó (con fecha y hora) y quién falta firmar. |
| - Si está vigente, se debe indicar la fecha de firma ("Firmado el dd/mm/aaaa"). |
| - Se debe poder descargar el contrato en PDF, salvo que sea un borrador. |
| - Accesos según el estado: |
|   - Borrador: "Continuar", que retoma el alta en el paso en que quedó, y "Eliminar", que descarta el borrador previa confirmación (US-06). |
|   - Pendiente de firma y vigente: "Ver contrato completo", que abre el detalle del contrato (US-42). |
| *Sin contrato actual* |
| - Si la propiedad no tiene contrato actual, se debe mostrar el mensaje "Esta propiedad todavía no tiene contrato". |
| - Si la propiedad tiene una solicitud aceptada que todavía no originó un contrato, se debe mostrar el acceso "Iniciar contrato" (US-05). Si no la tiene, se debe mostrar el acceso a las solicitudes de la propiedad. |
| *Contratos anteriores* |
| - Se deben mostrar al final de la pestaña los contratos finalizados de la propiedad, con su cantidad. |
| - La lista de contratos anteriores se muestra plegada y se puede desplegar. |
| - Cada contrato anterior ocupa una línea con el nombre del locatario, la vigencia y el estado final (finalizado). |
| - Los contratos anteriores se ordenan por fecha de inicio, del más reciente al más antiguo. |
| - Cada contrato anterior tiene el acceso "Ver contrato", que abre su detalle (US-42) en modo de solo consulta. |
| - Si la propiedad no tuvo contratos anteriores, no se muestra la sección. |
| *General* |
| - En la pestaña nunca se muestran el DNI ni los datos de contacto del locatario o de los garantes; esos datos están solo en el detalle del contrato (US-42). |
| - Si no se pueden obtener los contratos, el error se debe mostrar dentro de la pestaña con la opción de reintentar. El encabezado y las demás pestañas de la propiedad siguen funcionando. |
| - En móvil, las pestañas se desplazan horizontalmente y el contrato actual y los anteriores se muestran en una columna. |
| **Pruebas de usuario:** |
| - Probar consultar los contratos de una propiedad sin haber iniciado sesión (falla). |
| - Probar consultar por URL los contratos de una propiedad de otro locador y verificar que se muestre "No encontramos esta propiedad" (pasa). |
| - Probar consultar por URL una propiedad inexistente y verificar que se muestre el mismo mensaje (pasa). |
| - Probar verificar que no exista un listado de contratos de todas las propiedades en el menú del locador (pasa). |
| - Probar verificar que en la pestaña solo aparezcan los contratos de esa propiedad (pasa). |
| - Probar consultar una propiedad con un contrato vigente y verificar código, estado, locatario, vigencia, alquiler actual, próximo ajuste con su índice y fecha de firma (pasa). |
| - Probar consultar un contrato "Sin ajuste" y verificar que se indique así (pasa). |
| - Probar consultar un contrato pendiente de firma y verificar quién firmó, con fecha y hora, y quién falta (pasa). |
| - Probar consultar un borrador sin código y verificar que se muestre "Borrador sin código" y que no se ofrezca el PDF (pasa). |
| - Probar "Continuar" en un borrador y verificar que se retome el alta en el paso en que quedó (pasa). |
| - Probar "Eliminar" un borrador confirmando la acción y verificar que la propiedad quede sin contrato actual (pasa). |
| - Probar "Eliminar" un borrador y cancelar la confirmación (pasa: el borrador se mantiene). |
| - Probar descargar el PDF de un contrato pendiente de firma y de uno vigente (pasa). |
| - Probar "Ver contrato completo" y verificar que se abra el detalle del contrato (pasa). |
| - Probar consultar una propiedad sin contrato actual y con una solicitud aceptada, y verificar el mensaje y el acceso "Iniciar contrato" (pasa). |
| - Probar consultar una propiedad sin contrato actual y sin solicitudes aceptadas, y verificar el mensaje y el acceso a las solicitudes (pasa). |
| - Probar consultar una propiedad con contratos anteriores, desplegar la lista y verificar locatario, vigencia, estado final y el orden del más reciente al más antiguo (pasa). |
| - Probar abrir un contrato anterior y verificar que el detalle no ofrezca modificar ni firmar (pasa). |
| - Probar consultar una propiedad sin contratos anteriores y verificar que no se muestre la sección (pasa). |
| - Probar verificar que en la pestaña no aparezcan el DNI ni los datos de contacto del locatario o de los garantes (pasa). |
| - Probar consultar la pestaña en móvil y verificar que el contrato actual y los anteriores se muestren en una columna (pasa). |
