# Verbo NEXT

Plataforma privada de simuladores de examen de **Verbo Consulting** — práctica para
certificaciones internacionales de inglés (Duolingo English Test, TOEFL iBT y más).
Es un complemento a las sesiones en vivo de Verbo NEXT: los alumnos se aclimatan al
formato real de cada examen antes de presentarlo.

No es un producto público: sin registro abierto, sin SEO, sin pagos en línea. El
acceso lo otorga el administrador por credenciales.

## Principio de diseño

El sistema tiene una **base compartida y configurable por examen**: secciones,
tipos de pregunta, tiempos, subscores, escala e identidad visual se definen en
datos. La meta es reproducir fielmente la experiencia del examen oficial vigente.
Si una interacción o flujo requiere componentes específicos, se implementan;
la configuración no debe limitar la fidelidad. Agregar un examen nuevo requiere
validar que el motor cubra sus interacciones, reglas y evaluación.

Dos contratos sostienen esa extensibilidad (`src/lib/exam-config.ts`):

- **`adminFieldSchema`** — define dinámicamente el formulario de captura de preguntas
  del admin y el renderer genérico del alumno.
- **`themeConfig`** — dirige el motor de examen: paleta, tipografía, timer, progreso,
  navegación y firma visual, para que cada examen tenga su propia identidad sin
  duplicar componentes.

## Stack

- Next.js (App Router) + React + TypeScript + Tailwind CSS
- PostgreSQL local o remoto + Prisma
- NextAuth (Credentials Provider, roles ADMIN / STUDENT)
- MediaRecorder API nativa para las tareas de speaking

## Funcionalidad

- **Panel de administración**: catálogo de exámenes, CRUD de estructura (secciones y
  tipos de pregunta), captura dinámica y carga masiva por JSON, versiones
  (Diagnóstico + Simuladores), gestión de accesos por alumno y métricas.
- **Panel del alumno**: exámenes asignados, código de acceso por examen, motor de
  examen dirigido por datos (timer, flag de duda, audio, grabación) y resultados.
- **Calificación**: automática para reactivos cerrados; las respuestas abiertas
  (writing/speaking) pasan a revisión humana (`PENDING_REVIEW`) para la sesión en vivo.

## Desarrollo

Para usar la base local ya preparada en esta computadora, abre
`INICIAR-VERBO.cmd`. Cuentas, contraseñas y comandos están explicados en
[Desarrollo local](docs/desarrollo-local.md).

```bash
npm install
npx prisma migrate dev      # requiere DATABASE_URL en .env
npx prisma db seed          # crea admin + catálogo DET/TOEFL + datos de ejemplo
npm run dev
```

Variables de entorno en `.env.local` (no versionado): `DATABASE_URL`,
`DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. En desarrollo local,
`DIRECT_URL` tiene el mismo valor que `DATABASE_URL`.

La publicación en `next.verboacademic.com` utiliza una base Supabase exclusiva
de Next. Ver [configuración de producción](docs/produccion.md).

## Estado

Actualización del 25 de octubre de 2026: se agregó PostgreSQL local, persistencia
de avance y plazos, navegación transaccional, autoguardado, filtrado de soluciones
y almacenamiento/reproducción de audio. TOEFL incluye una interfaz propia,
preparación de sonido y micrófono, y un diagnóstico de doce tareas originales
del formato 2026. Los tres simuladores tienen bancos distintos de 120 reactivos
por recorrido, rutas adaptativas de práctica en Reading/Listening y revisión
de respuestas abiertas mediante rúbricas de 0 a 5. Los simuladores 2 y 3 añaden
100 audios con cuatro voces estadounidenses y británicas. Alumnos y profesores
pueden comparar resultados por sección. Ver [Desarrollo local](docs/desarrollo-local.md).
La auditoría enlazada abajo describe el estado previo a estos cambios.

DET tiene diagnóstico y tres simuladores del formato vigente: 72 pantallas por
recorrido, los 13 grupos de tareas, 536 registros de banco con tres dificultades
para las tareas cortas, 144 audios de voz y cuatro fotografías locales compartidas.
El diseño se contrastó con capturas oficiales. Incluye lecturas y conversaciones
con reloj compartido, escritura en dos pasos, seis preguntas de Interactive
Speaking y muestras finales. Sus rúbricas e índice 0–100 son de práctica; las
paráfrasis no reconocidas se revisan por una persona. Ver
[DET 2026: formato y verificación](docs/det-2026.md).

El portal incluye bienvenida pública, acceso con identidad Verbo, navegación
adaptable, panel con actividad real, perfil editable e historial filtrable de
intentos. El rediseño y sus verificaciones están en
[Experiencia Verbo NEXT](docs/interfaz-verbo-next.md).

Pendientes: validación con alumnos y profesor, calibración del puntaje y seguir
afinando la fidelidad de interfaces y flujos, ampliar las fotografías DET y el formato específico de Cambridge.
El umbral adaptativo y las bandas de
práctica son internos; no reproducen algoritmos de puntuación reservados de ETS o Duolingo.

Ver [la auditoría del 23 de octubre de 2026](docs/estado-proyecto.md) para el
inventario, los problemas concretos, las verificaciones y el orden recomendado
de trabajo. Los pendientes no requieren detener el desarrollo entre capas;
la forma de trabajo vigente está en [AGENTS.md](AGENTS.md).
