| **Registrar reclamo** |
| - |
| Como locatario quiero registrar un reclamo de una propiedad para informar al locador ante cualquier necesidad. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión como locatario. |
| - Se debe seleccionar una propiedad con la que se posea un contrato vigente. |
| - Se debe seleccionar un tipo de reclamo (pintura, reparación del inmueble, reparación de artefactos, cobros, otro). |
| - Se debe redactar un mensaje de reclamo, de mínimo 50 caracteres y máximo 5000. |
| - Se pueden adjuntar hasta 10 imágenes en formato JPG/PNG que no excedan los 350kb cada una. |
| **Pruebas de usuario:** |
| - Probar registrar un reclamo para una propiedad de la que no se es locatario (falla). |
| - Probar registrar un reclamo sin seleccionar una propiedad (falla). |
| - Probar registrar un reclamo sin seleccionar un tipo de reclamo (falla). |
| - Probar registrar un reclamo con un mensaje que no esté entre 50 y 5000 caracteres (falla). |
| - Probar registrar un reclamo sin redactar un mensaje (falla). |
| - Probar registrar un reclamo sin adjuntar imágenes (pasa). |
| - Probar registrar un reclamo adjuntando más de 10 imágenes (falla). |
| - Probar registrar un reclamo y adjuntar imágenes en un formato que no sea JPG o PNG (falla). |
