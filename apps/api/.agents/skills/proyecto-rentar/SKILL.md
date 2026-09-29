# SKILL: rentar-dev-assistant

## Descripción
Asistente técnico especializado en el desarrollo, arquitectura e implementación del proyecto **RentAR**. Su objetivo es guiarse por la arquitectura monorepo, el stack tecnológico definido y las pautas de gestión de configuración establecidas para el sistema.

---

## 1. Visión y Dominio del Proyecto
**RentAR** es una plataforma web para centralizar y administrar el ciclo de vida completo de alquileres residenciales no amueblados celebrados de forma directa entre locadores y locatarios.

**Módulos y flujos funcionales principales:**
* **Publicación y búsqueda:** Gestión de inventario de propiedades y catálogo público de búsqueda con filtros.
* **Contratación:** Flujo de solicitudes de alquiler y firma electrónica de contratos.
* **Gestión de cobros:** Procesamiento automatizado vía pasarela de pagos integrada y registro manual de pagos por transferencia bancaria directa.
* **Actualización del monto:** Cálculo automático de reajustes periódicos del valor del alquiler según índices contractuales.
* **Atención de incidencias y mensajes:** Registro, seguimiento y respuesta a reclamos entre las partes, más notificaciones y mensajería.

---

## 2. Stack Tecnológico
Todas las soluciones y fragmentos de código deben adaptarse al stack elegido por el equipo:

* **Frontend:** Next.js estructurado con la librería de componentes Ant Design (`/apps/web`).
* **Backend:** Node.js con Express y documentación integrada mediante Swagger (`/apps/api`).
* **Base de Datos e Infraestructura:** Supabase (PostgreSQL, migraciones SQL y datos de prueba `seed.sql`) desplegado sobre arquitectura serverless en Vercel.
* **Pruebas Automatizadas:** Pruebas End-to-End (E2E) con Selenium (`/tests/e2e/`).
* **Gestión del Proyecto y Código:** Metodología Scrum (sprints de 2 semanas) con backlog en Jira y control de versiones en GitHub.

---

## 3. Estructura de Monorepo y Ubicación de Archivos
Cualquier archivo, módulo o refactorización sugerida debe respetar el esquema de directorios del proyecto:

```text
/rentar
├── apps/
│   ├── web/       # NextJS + Ant Design (Frontend)
│   └── api/       # NodeJS + Express + Swagger (Backend)
├── docs/          # Documentación del proyecto
├── packages/
│   ├── shared-types/      # Interfaces y tipos TypeScript compartidos
│   └── ui/                # Componentes de UI personalizados
├── supabase/
│   ├── migrations/        # Control de versiones del esquema de base de datos
│   └── seed.sql           # Datos iniciales para entorno local/desarrollo
└── tests/
    └── e2e/               # Scripts de prueba automatizada con Selenium
```

---

## 4. Estrategia de Ramas y Gestión de Configuración
El desarrollo debe seguir los estándares de control de versiones y nomenclatura de versiones:

* **Estrategia de Ramas (Branching Strategy):**
  * `main`: Refleja exactamente el entorno de Producción. Solo recibe cambios mediante Pull Requests validadas desde `develop`.
  * `develop`: Entorno de Staging donde se integran las nuevas funcionalidades probadas.
  * `feature/nombre-funcionalidad`: Ramas efímeras para trabajar en historias de usuario específicas (ej. `feature/modulo-cobros`, `feature/firma-contrato`).
* **Regla de Líneas Base (Baselines):**
  * Se genera una nueva Línea Base al completar cada Sprint bajo el formato de nombre `rentar_vAA.mm.dd` (Año, Mes, Día).

---

## 5. Pautas Generales para la Generación de Código
1. **Compartición de Tipos:** Colocar interfaces y contratos de datos comunes entre frontend y backend en `/packages/shared-types`.
2. **Documentación de API:** Incluir anotaciones OpenAPI/Swagger en cada ruta nueva que se cree dentro de Express (`/apps/api`).
3. **Control de Cambios en BD:** Toda modificación de tablas o columnas debe generarse como un archivo SQL incremental dentro de `/supabase/migrations`.
4. **Flexibilidad en Cobros:** Al diseñar modelos o controladores de pagos, dar soporte tanto al cobro digital por pasarela como a la carga de comprobantes por transferencia manual.
5. **Pruebas E2E:** Acompañar los nuevos flujos críticos con un script de prueba de Selenium guardado en `/tests/e2e/`.
