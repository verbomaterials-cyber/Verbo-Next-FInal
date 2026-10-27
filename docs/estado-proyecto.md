# Auditoría de Verbo NEXT

Fecha: 23 de octubre de 2026. Revisión del código local, historial de Git,
instrucciones del repositorio y memorias de Claude Code asociadas a este proyecto.

## Diagnóstico

Existe una base considerable para administrar alumnos y ofrecer práctica de
inglés. Todavía no es una plataforma terminada de simuladores fieles a los
exámenes oficiales actuales. El principal trabajo pendiente está en el motor
del examen, sus interacciones, la evaluación y el contenido, además de recuperar
la conexión con la base de datos.

No hace falta descartar todo el proyecto. La administración, autenticación,
modelos y carga de contenido pueden aprovecharse. La fidelidad debe determinar
qué partes del motor se reutilizan y cuáles requieren componentes específicos.

## Instrucciones que frenaban el avance

- No había un `SKILL.md` restrictivo en el repositorio. Se eliminaron de las
  instrucciones y memorias activas las referencias al antiguo skill de negocio
  que introducía limitaciones ajenas al desarrollo de la plataforma.
- `preferencias-jaret.md` mantenía una regla de construir una capa, esperar
  aprobación o commit y después continuar. Esa instrucción sí explica las pausas
  descritas por el usuario, aunque no permite atribuir todos los problemas a un
  único skill.
- Otra memoria imponía que nada específico de un examen se implementara en código.
  El README repetía esa restricción y prometía incorporar exámenes sin modificar
  el motor, algo que la implementación actual no garantiza.

Se retiraron de las memorias de este proyecto las pausas obligatorias y la
prohibición de componentes específicos. Se actualizaron su índice, `AGENTS.md` y
el README. Las referencias a fases describen pendientes y no son prohibiciones.
Se conserva la regla de consultar las guías locales de Next.js: evita utilizar
APIs incompatibles y no limita el alcance del producto.

## Qué está implementado

La siguiente tabla describe código existente; no implica que cada flujo haya
sido validado ahora contra datos reales.

| Área | Implementación encontrada |
| --- | --- |
| Acceso | Login con correo y contraseña, bcrypt, sesión JWT, roles de administrador y alumno, protección de rutas y acciones administrativas. |
| Administración de alumnos | Crear, editar, eliminar y restablecer contraseña; accesos por examen, códigos, bloqueo, límite de intentos y versiones desbloqueadas. |
| Catálogo | Crear exámenes, secciones, tipos de pregunta y versiones; publicar y configurar feedback. |
| Preguntas | Captura por formularios dinámicos e importación masiva JSON, incluyendo selección de varios archivos. Contrato documentado en `docs/carga-masiva.md`. |
| Alumno | Ver exámenes asignados, validar código, iniciar o retomar un intento y consultar resultados. |
| Motor | Preguntas por orden, temporizador por pregunta o sección, navegación configurable, marca de duda, audio, texto, imágenes y captura de respuestas. |
| Speaking | Solicita micrófono e inicia MediaRecorder; guarda únicamente indicadores de grabación y duración. |
| Calificación | Comparaciones de respuestas cerradas, conversión de aciertos a escalas, subscores, revisión humana de abiertas y notificaciones. |
| Métricas | Resultados por examen/alumno, comparación de versiones y preguntas marcadas como duda. |

Stack encontrado: Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind CSS 4,
NextAuth 4, Prisma 6 y PostgreSQL configurado para Neon. El build incluye
generación del cliente Prisma y despliegue de migraciones.

El historial muestra la base funcional construida el 5 de julio de 2026 y mejoras
de UI, importación y preparación de build el 13 de agosto. Hay cinco archivos
con cambios previamente preparados en Git: alumnos, panel, inicio, componentes
compartidos y acciones de alumnos. Esos cambios se preservaron.

## Catálogo y contenido disponible en el repositorio

| Examen | Configuración incluida | Alcance real comprobado |
| --- | --- | --- |
| Duolingo English Test | 3 secciones, 15 tipos, diagnóstico y 3 simuladores. | Catálogo parcial y desactualizado; no hay selección adaptativa real. |
| TOEFL iBT | 4 secciones, 5 tipos, diagnóstico y 3 simuladores. | Mezcla tareas de 2026 con tiempos y estructura que no corresponden al formato vigente. |
| Cambridge | Puede crearse un examen mediante el administrador. | No hay catálogo, contenido, flujos ni evaluación específicos incluidos. |

El seed contiene 7 preguntas DET y 5 TOEFL para los diagnósticos. Los audios de
ejemplo son tonos generados, no conversaciones o instrucciones de examen.
Los simuladores 1–3 se crean publicados, pero el seed no les agrega preguntas.
Esto describe los archivos de ejemplo: no se pudo contar el contenido que pudiera
haberse importado posteriormente a Neon.

## Diferencias con los formatos oficiales vigentes

Verificación realizada con fuentes oficiales el 23 de octubre de 2026.

### TOEFL iBT

ETS describe actualmente Reading, Listening, Writing y Speaking, con tiempos
base aproximados de 30, 29, 23 y 8 minutos; el tiempo y número de reactivos pueden
variar por la adaptación. El seed configura 35, 36, 16 y 29 minutos, con Speaking
antes de Writing. Omite, entre otras interacciones, Build a Sentence y Listen
and Repeat, y agrupa Reading/Listening en tipos genéricos.

La escala oficial principal es 1–6 y el total comparable 0–120 se proporciona
durante la transición. La conversión lineal de aciertos de la app no reproduce
el método oficial de evaluación.

Fuente: [ETS: contenido y estructura](https://www.ets.org/toefl/test-takers/ibt/about/content.html).

### Duolingo English Test

El catálogo local conserva Read Aloud y Listen, Then Speak. Duolingo anunció la
retirada de Read Aloud y el reemplazo de Listen, Then Speak por Interactive
Speaking a partir del 1 de julio de 2025. Ese flujo no está implementado en el
catálogo del repositorio. La estructura vigente también incluye Interactive
Writing y Fill in the Blanks; hace falta revisar sus equivalencias y sus flujos,
además de las frecuencias, tiempos y presentación de los demás reactivos.

Fuentes: [estructura oficial DET](https://testcenter.zendesk.com/hc/en-us/articles/39104891663245-Test-Structure)
y [actualización oficial de speaking](https://testcenter.zendesk.com/hc/en-us/articles/36094897057421-Test-Update-New-Interactive-Speaking-questions).

## Problemas concretos encontrados

Los siguientes hallazgos provienen de lectura del código; no se reprodujeron
en una sesión autenticada contra la base de datos.

| Prioridad | Hallazgo y efecto | Evidencia |
| --- | --- | --- |
| Alta | Las credenciales configuradas para Neon son rechazadas. La compilación puede terminar correctamente y aun así los flujos con datos no funcionar. | Consulta Prisma y log del build. |
| Alta | Speaking no conserva audio: MediaRecorder se inicia, pero no se recogen sus datos ni se sube un archivo. El profesor recibe metadatos y no puede escuchar la respuesta. | `src/components/exam/audio-recorder.tsx`, panel de revisión. |
| Alta | Los relojes viven en estado del navegador, se reinician al recargar y no se validan en servidor. `startedAt` no se utiliza para reconstruir un plazo. | `exam-engine.tsx`, página del intento y acciones del alumno. |
| Alta | Al agotarse una sección se avanza una pregunta por vez con su reloj en cero; no se cierra toda la sección de forma controlada. | Intervalo y `goNext` de `exam-engine.tsx`. |
| Alta | `goNext` ignora el resultado de `persist`: puede avanzar o completar el examen aunque falle el guardado. Tampoco hay autoguardado periódico del texto en curso. | `exam-engine.tsx`. |
| Alta | `saveResponse` comprueba el propietario del intento, pero no que la pregunta pertenezca a su versión, ni aplica plazos o restricciones de navegación. | `src/lib/student/actions.ts`. |
| Alta | Datos que contienen soluciones llegan al navegador: los huecos incluyen letras correctas entre corchetes y los repeaters pueden contener `correct`. Ocultarlos en la UI no elimina esos datos del payload. | Página del intento, schema de preguntas y renderer. |
| Media | Dos solicitudes simultáneas pueden superar el cupo de intentos: se consulta el límite y el intento en curso antes de la transacción de creación. | `startAttempt` en acciones del alumno. |
| Media | La calificación es principalmente correcto/incorrecto; no usa rúbricas graduadas, pesos ni una estimación calibrada. Writing y speaking se revisan con veredictos binarios. | `grading.ts`, `review-actions.ts`. |
| Media | `hasAdaptiveLogic` y `difficultyLevel` no implementan selección adaptativa. La página carga una lista fija de preguntas. | Modelo Prisma y página del intento. |
| Media | `DRAG_SELECT` utiliza el mismo grupo de opciones que MULTIPLE_CHOICE; declarar el tipo no implementa una interacción de arrastre. | `question-renderer.tsx`. |
| Media | La identidad visual fue diseñada como DET lúdico/menta y TOEFL editorial/serif. No hay evidencia de una comparación pantalla por pantalla con las interfaces oficiales. | Temas de los seeds, `fonts.ts` y motor. |
| Media | No hay control de versión del formato oficial, snapshots del contenido del intento ni validación de completitud al publicar. Editar preguntas puede alterar referencias usadas por intentos existentes. | Modelos y acciones administrativas. |

Además, opciones como `theme.style.transition`, `timer.position` y `splitRatio`
están declaradas pero no gobiernan completamente el renderizado. El contrato de
configuración promete más control del que efectivamente aplica el motor.

El modelo contiene SUPERADMIN, pero el login convierte a cualquier AdminUser al
rol de sesión ADMIN: actualmente no existe una distinción funcional entre ambos.

## Verificaciones realizadas

- Se leyeron las guías de la versión local de Next.js para instalación, Proxy,
  Server Actions y generación de tipos antes de intervenir el proyecto.
- Se regeneraron los tipos de rutas. Un archivo generado en `.next/dev` tenía
  contenido duplicado y sintaxis inválida; se reemplazó por los tipos recién
  generados. `tsc --noEmit --incremental false` pasó sin errores.
- ESLint detectó **2 errores y 3 advertencias**: errores de actualización de
  estado dentro de efectos en el motor y en el modal compartido; advertencias
  en el grabador. No se modificó código de producto para resolverlos durante
  esta auditoría.
- `next build` terminó con código 0 al permitir acceso a Google Fonts. El primer
  intento falló al descargar fuentes por restricciones de conexión del entorno.
  La ejecución correcta registró un error de autenticación de Prisma contra
  Neon; por ello, compilar no confirma que la aplicación funcione con datos.
- No se ejecutó `npm run build`: ese script también aplica migraciones. Se
  invocó Next directamente para evitar modificar la base durante el diagnóstico.
- No se ejecutaron seeds, migraciones ni escrituras sobre datos reales. No se
  verificaron flujos autenticados en navegador ni un despliegue público.

## Orden de trabajo recomendado

1. Recuperar acceso válido a Neon y comprobar el recorrido de administrador y
   alumno con los datos existentes; resolver errores de lint.
2. Establecer el formato oficial objetivo de cada examen, su versión y una matriz
   de pantallas, tareas, tiempos, navegación y criterios de evaluación.
3. Corregir integridad del intento: plazos persistentes y comprobados por servidor,
   guardado fiable, recuperación, permisos por pregunta y cierre de secciones.
4. Implementar almacenamiento y reproducción de las grabaciones, con preparación
   y tiempo de respuesta coordinados con el examen.
5. Completar las interacciones y la interfaz de cada examen, incluidos sus flujos
   de varias etapas y su selección adaptativa de práctica.
6. Preparar bancos de preguntas y medios suficientes, implementar evaluación
   con rúbricas y verificar intentos completos antes de publicar simuladores.

Esta secuencia expresa dependencias de trabajo. No requiere pausas de aprobación
entre pasos ni limita el desarrollo a un esqueleto.
