| **Enviar solicitud de alquiler** |
| - |
| Como locatario quiero enviar una solicitud de alquiler a una propiedad para informar al locatario mi interés en la misma. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión. |
| - Se puede adjuntar un mensaje de hasta 1000 caracteres. |
| - Se debe informar en tiempo real la cantidad de caracteres ingresados en el mensaje. |
| - Se debe generar y enviar una notificación por mail al locador, indicando el nombre del inquilino que envió la solicitud e incluyendo el mensaje opcional de hasta 1000 caracteres si lo hubiera. |
| **Pruebas de usuario:** |
| - Probar enviar una solicitud de alquiler y se genera una notificación por mail al locador (pasa). |
| - Probar enviar una solicitud de alquiler sin haber iniciado sesión (falla). |
| - Probar enviar una solicitud de alquiler sin adjuntar un mensaje (pasa). |
| - Probar enviar una solicitud de alquiler adjuntando un mensaje con más de 1000 caracteres (falla). |

