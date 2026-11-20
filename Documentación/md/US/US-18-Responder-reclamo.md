| **Responder reclamo** |
| - |
| Como locador, quiero responder a un reclamo realizado sobre una de mis propiedades, para iniciar su atención y comunicarme con el locatario a fin de resolverlo. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión como el locador dueño de la propiedad asociada al reclamo. |
| - Solo se puede responder a un reclamo que se encuentre en estado "abierto" o "en proceso". |
| - Se debe redactar un mensaje de respuesta no vacío (ni compuesto únicamente por espacios en blanco) para enviar la respuesta inicial. |
| - Al responder el reclamo, su estado debe cambiar automáticamente de "abierto" a "en proceso". |
| - Responder a un reclamo debe crear e iniciar una nueva conversación (chat) vinculada exclusivamente a dicho reclamo entre el locador y el locatario que lo registró. |
| - Al inicio de la conversación del reclamo se debe mostrar de forma fija o destacada el mensaje original del reclamo junto con todas las fotografías adjuntadas por el locatario al registrarlo. |
| - El mensaje original del reclamo y sus fotografías adjuntas deben permanecer siempre accesibles y visibles en el chat del reclamo, incluso si la conversación supera el límite de retención de 100 mensajes regulares. |
| - El mensaje inicial de respuesta enviado por el locador debe quedar registrado en la conversación con su fecha y hora exacta de envío. |
| - Si el reclamo ya se encuentra en proceso, al responder se debe mostrar la conversación ya existente. |
| **Pruebas de usuario:** |
| - Probar responder a un reclamo sin haber iniciado sesión (falla). |
| - Probar responder a un reclamo siendo un usuario que no es el locador de la propiedad asociada (falla). |
| - Probar responder a un reclamo con estado "abierto" ingresando un mensaje válido y verificar que el estado del reclamo pase a "en proceso" (pasa). |
| - Probar responder a un reclamo intentando enviar un mensaje vacío o compuesto solo por espacios en blanco (falla). |
| - Probar responder a un reclamo en estado "abierto" y verificar que se inicie una nueva conversación vinculada al reclamo con el locatario correspondiente (pasa). |
| - Probar responder a un reclamo en estado "en proceso" y verificar que se muestre la conversación ya existente para ese reclamo (pasa). |
| - Probar ingresar a la conversación creada al responder un reclamo y verificar que al inicio se visualicen el mensaje original del reclamo y las fotografías adjuntas (pasa). |
| - Probar enviar más de 100 mensajes en el chat de un reclamo y verificar que el mensaje original del reclamo y sus fotografías sigan visibles y disponibles al inicio de la conversación (pasa). |
