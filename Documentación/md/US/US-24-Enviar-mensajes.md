| **Enviar mensajes** |
| - |
| Como locador o locatario, quiero enviar mensajes en una conversación con la otra parte, para comunicarme respecto a consultas sobre propiedades, solicitudes o reclamos. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión. |
| - No es necesario que exista una relación de alquiler vigente entre locador y locatario para intercambiar mensajes. |
| - Un locatario puede iniciar una conversación con un locador. |
| - Un locador no puede iniciar una conversación con un locatario, a menos que exista un contrato de alquiler vigente entre ambos. |
| - Si existe un contrato de alquiler vigente entre ambos, el locador puede iniciar una conversación con el locatario. |
| - Si un locatario ya inició una conversación, el locador puede responder y enviar mensajes dentro de esa conversación, independientemente de si existe un alquiler vigente o no. |
| - Se pueden mantener múltiples conversaciones independientes entre un mismo locador y locatario (por ejemplo, una conversación asociada a un reclamo y otra para una consulta general). |
| - Cada conversación debe conservar un historial de hasta 100 mensajes. |
| - Si una conversación alcanza los 100 mensajes y se envía uno nuevo, se debe descartar el mensaje más antiguo para conservar los últimos 100 mensajes. |
| - No se puede enviar un mensaje vacío o compuesto únicamente por espacios en blanco. |
| - Se debe registrar y mostrar la fecha y hora exacta, con precisión de minutos, en la que se envió cada mensaje. |
| - No se permite editar un mensaje una vez enviado. |
| - Se permite eliminar un mensaje propio ya enviado. |
| - Un usuario no puede eliminar mensajes enviados por el otro participante de la conversación. |
| **Pruebas de usuario:** |
| - Probar enviar un mensaje sin haber iniciado sesión (falla). |
| - Probar que un locatario inicie una conversación y envíe un mensaje a un locador sin tener un alquiler vigente con él (pasa). |
| - Probar que un locador responda un mensaje dentro de una conversación iniciada previamente por un locatario sin tener un alquiler vigente (pasa). |
| - Probar que un locador intente iniciar una nueva conversación con un locatario con el que no tiene un alquiler vigente (falla). |
| - Probar que un locador inicie una nueva conversación con un locatario con el que sí tiene un contrato de alquiler vigente (pasa). |
| - Probar crear más de una conversación independiente entre el mismo locador y locatario (por ejemplo, una por consulta y otra por reclamo) y enviar mensajes en ambas (pasa). |
| - Probar enviar un mensaje vacío (falla). |
| - Probar enviar un mensaje compuesto únicamente por espacios en blanco (falla). |
| - Probar enviar un mensaje y verificar que quede registrada y visible la hora de envío (pasa). |
| - Probar intentar editar un mensaje ya enviado (falla). |
| - Probar eliminar un mensaje propio ya enviado (pasa). |
| - Probar intentar eliminar un mensaje enviado por el otro usuario de la conversación (falla). |
| - Probar enviar mensajes hasta alcanzar el límite de 100 mensajes en una conversación y verificar que el historial conserve hasta 100 mensajes (pasa). |
