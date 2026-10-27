# Verbo NEXT en tu computadora

El proyecto puede trabajar con una base PostgreSQL local persistente. No requiere
Neon, Docker, una cuenta externa ni instalar un servicio de Windows.

## Abrir el proyecto

Con la configuración ya preparada en esta computadora:

1. Abre `INICIAR-VERBO.cmd` con doble clic.
2. Se inicia la base y el servidor, y se abre `http://localhost:3000`.
3. Deja abierta la ventana del servidor mientras uses la aplicación.

El iniciador detecta si Verbo NEXT ya está funcionando y reutiliza ese servidor.
Desde una terminal también puedes ejecutar `npm run dev:local`.

Las cuentas de desarrollo están en `.local/access.json`:

- Administrador: `admin@verbo.local`.
- Alumno: `alumno@verbo.local`.
- Las contraseñas se generan automáticamente y se conservan en ese archivo.
- Código de acceso TOEFL del alumno de prueba: `TOFL-2026`.
- Código de acceso DET del alumno de prueba: `DETT-2026`.

Estos usuarios solo existen en la base local. TOEFL incluye un diagnóstico corto
de doce tareas originales que recorre los doce tipos del formato 2026 y seis
audios de voz generados localmente. Las versiones sin contenido se mantienen
sin publicar. Los tres simuladores están publicados con 120 reactivos por
recorrido y bancos diferentes. Los simuladores 2 y 3 añaden 100 archivos de audio
con cuatro voces de inglés estadounidense y británico, generados sin conexión.
El diagnóstico conserva su recorrido breve y sus intentos existentes.

DET incluye ahora **Simulador DET 2026 · 1**, con 72 pantallas, los 13 grupos de
tareas vigentes, 36 audios y cuatro fotos. Tiene su propia interfaz y conserva los
datos del catálogo antiguo. Detalles de tiempos, adaptación, evaluación y límites
en [DET 2026](det-2026.md).

Antes del intento se comprueban sonido y micrófono. La prueba de micrófono solo
muestra el nivel de voz y no guarda ni envía audio. Las respuestas de speaking
dentro del intento sí se conservan para revisión del profesor.

La vista `/dev/toefl` permite revisar todas las tareas sin iniciar un intento.
Solo existe en modo de desarrollo; no concede acceso a intentos o grabaciones.
`/dev/toefl?form=1` muestra el Simulador 1 con la ruta superior;
`/dev/toefl?form=1&route=lower` muestra la ruta de menor dificultad.
Puedes sustituir `form=1` por `form=2` o `form=3` para revisar las versiones nuevas.

## Datos y respaldo

Los datos están en `.local/postgres`, dentro del proyecto. Detener el servidor
o reiniciar Windows no los elimina. No borres esa carpeta si quieres conservarlos.

La configuración previa de Neon quedó respaldada en
`.local/env.before-local` y `.local/env.local.before-local`. No se modificó la
base remota ni se copiaron sus datos. `.env` y `.env.local` apuntan ahora a
`127.0.0.1:54329/verbo_next` con una contraseña generada para esta computadora.
La base solo escucha en la interfaz local. La carpeta `.local` y los archivos
de entorno están excluidos de Git, ESLint y TypeScript.

Para respaldar la base, detén primero PostgreSQL con `npm run local:stop` y copia
la carpeta `.local` a otra ubicación privada. Para continuar, ejecuta el iniciador.
El respaldo también contiene contraseñas; consérvalo de forma privada.

## Preparar otra copia del repositorio

Con Node.js y npm instalados:

```powershell
npm install
npm run local:setup
npm run dev:local
```

`local:setup` genera credenciales, inicializa la base, aplica las migraciones y
carga ejemplos y usuarios locales. Se limita a la nueva base local; no migra datos
de Neon. Repetirlo conserva los datos y las credenciales de desarrollo existentes.
La instalación inicial descarga los binarios de PostgreSQL; el uso posterior
de la base no necesita Internet. La compilación actual sí descarga Google Fonts.

## Comprobaciones

```powershell
npm test
npm run lint
npm run verify:local
```

La última comprobación requiere el servidor en el puerto 3000. Crea un alumno
temporal, prueba las acciones por HTTP y verifica el audio almacenado; después
elimina sus propios registros. No utiliza ni modifica los intentos del alumno
de demostración. Solo admite la base local `verbo_next`.

El arranque de desarrollo usa Webpack porque se observó una falla de resolución
de paquetes en el modo Turbopack de este entorno Windows.

Verificación final realizada el 24 de octubre de 2026: TypeScript, ESLint, treinta y cinco pruebas
automatizadas y compilación de producción con Webpack completados correctamente.
La prueba HTTP del diagnóstico confirmó inicio concurrente sin duplicar cupo,
plazos persistentes, navegación, almacenamiento y lectura del audio, finalización
idempotente y revisión del profesor. Los registros temporales se eliminaron.
Las rutas superior y de menor dificultad del Simulador 1 pasaron por HTTP, con
once grabaciones y evaluación del profesor por rúbrica en cada recorrido. También
se comprobó por HTTP que el diagnóstico conserva su funcionamiento.
En el navegador se comprobó la transición adaptativa, la revisión del módulo,
la conservación de texto y reloj tras una recarga, y la reproducción automática
de Listening sin otra reproducción después de recargar. Falta comprobar la
captura con el micrófono físico del usuario; la prueba del servidor utiliza WAV
de verificación. Se aplicó una migración aditiva para guardar la rúbrica.
También se guardó una rúbrica de 4/5 con notas desde el formulario del profesor y
se comprobó el cambio de estado y resultado. La cuenta temporal y todos sus
registros fueron eliminados al terminar la verificación visual.

## Trabajo de fiabilidad incorporado

- Cursor y plazos persistentes en el servidor, con límite global del intento.
- Cierre completo de la sección al agotarse su tiempo.
- Autoguardado del texto y navegación transaccional; un error no salta preguntas.
- Bloqueo por fila al iniciar intentos para respetar el cupo entre pestañas.
- Comprobación de propietario, pregunta activa, acceso y plazo en las acciones.
- Códigos de examen vinculados a la sesión mediante una firma.
- Filtrado de campos internos y soluciones antes de enviarlos al navegador.
- Almacenamiento de audio real en PostgreSQL, límite de 8 MB y reproducción
  protegida para el alumno propietario y el administrador.
- La revisión del profesor puede escuchar el audio; las grabaciones antiguas que
  solo guardaban metadatos se identifican como registros sin archivo.

## Formato TOEFL 2026

La referencia de formato está registrada como `toefl-ibt-2026-01-21` en
`src/lib/toefl-format.ts`, con enlaces a ETS y fecha de verificación. El catálogo
incluye el orden Reading → Listening → Writing → Speaking, los doce tipos de tarea,
el bloque de seis minutos para Build a Sentence y relojes de respuesta posteriores
al audio en speaking. Las instrucciones y controles del examen aparecen en inglés.

Los ejercicios originales están en `content/toefl-2026/diagnostic.json`. Para
regenerar sus audios en Windows, ejecuta `scripts/generate-toefl-audio.ps1` desde
PowerShell 7 con una voz inglesa instalada. No cambia políticas del equipo ni
utiliza servicios de síntesis externos.

La actualización del catálogo existente se preparó y aplicó con
`scripts/update-toefl-local.ts`. Por defecto ese script solo muestra un plan;
`--apply` solo admite la base local y se niega a sustituir contenido si encuentra
intentos o preguntas personalizadas. No es un mecanismo de actualización de
bancos en producción.

## Simulador TOEFL 1

Contenido original en `content/toefl-2026/form-1*.ts`, identificado como
`verbo-toefl-2026-form-1-v1`. El banco contiene 124 registros para admitir las
ramas alternativas. Un alumno recibe 93 pantallas y 120 reactivos; cada texto
Complete the Words contiene diez reactivos.

| Sección | Reactivos del recorrido | Puntos máximos de práctica |
|---|---:|---:|
| Reading | 50 | 35 |
| Listening | 47 | 35 |
| Writing | 12 | 20 |
| Speaking | 11 | 55 |

Reading tiene un primer módulo de 21 minutos y un segundo de 9. Listening tiene
un primer módulo de 18 minutos y un segundo de 7 o 11. Writing tiene diez
oraciones en seis minutos, un email en siete y una discusión en diez. Speaking
presenta siete repeticiones con ventanas de 8/10/12 segundos y cuatro respuestas
de entrevista de 45 segundos. El reloj de respuesta comienza después del audio.

La selección de ruta usa un umbral interno del 65% de los puntos puntuables del
primer módulo. ETS no publica su umbral exacto; esta regla es de práctica.
Los reactivos no puntuables y las posiciones puntuables de los huecos se definen
en el banco de Verbo, no representan la ubicación de reactivos experimentales de
un examen oficial. La dificultad se asignó editorialmente, sin calibración
psicométrica. Las ramas no seleccionadas no se envían al alumno ni se califican.

Las rúbricas son resúmenes propios para el profesor basados en los criterios
de las guías ETS enlazadas en `src/lib/toefl-format.ts`. Se guarda la puntuación
holística de 0 a 5 y el feedback. Las tareas abiertas vacías reciben cero;
las respuestas con contenido esperan revisión humana. La banda interna de cada
sección convierte proporcionalmente los puntos a 1–6 y el resultado general
promedia las cuatro secciones. La pantalla la identifica como banda de práctica
sin calibrar, sin predicción de puntaje ETS.

Para instalar el contenido en otra base local preparada, con la versión
Simulador 1 vacía y sin intentos:

```powershell
npm run toefl:build-content
./scripts/generate-toefl-form-audio.ps1
npm run toefl:install-form
npm run toefl:install-form -- --apply
```

El instalador valida los audios y preguntas, se limita a la base local y rechaza
una versión con contenido o intentos. Solo amplía el acceso del alumno local de
demostración; el administrador controla los accesos de alumnos reales. No
modifica el diagnóstico, otras versiones ni sus intentos. Los audios utilizan
la voz inglesa disponible en este Windows; falta diversificar voces y acentos.

Para verificar el recorrido completo, define `VERIFY_FORM=simulator1` al ejecutar
`scripts/verify-local.ts`; `VERIFY_LOWER=1` fuerza respuestas del módulo inicial
que llevan a la ruta inferior. Cada ejecución crea y elimina su propio alumno.
`scripts/browser-toefl-test.ts` prepara una cuenta desechable para comprobar la
transición de módulos; `--cleanup` elimina solo esa cuenta y sus registros.

Pendientes: validación con alumnos y profesor, calibración de puntajes y seguir
afinando la interfaz. No se ha verificado equivalencia visual píxel por píxel con ETS.

## Simuladores 2 y 3 y comparación

Los bancos originales están en `content/toefl-2026/form-2*.ts` y `form-3*.ts`.
Cada banco tiene 124 registros y entrega 120 reactivos en 93 pantallas según la
ruta. Conservan los puntos máximos 35/35/20/55 y la misma distribución editorial
de dificultad por tipo y módulo que el Simulador 1. Los estímulos, bancos de
palabras y consignas de producción son distintos entre versiones; esto se
comprueba automáticamente. Esa igualdad de distribución no equivale a una
calibración psicométrica de dificultad.

La revisión editorial amplió seis claves de armado de oraciones del Simulador 1
para aceptar órdenes alternativos válidos. `review-toefl-content.ts` solo aplica
esta ampliación si identifica los estímulos originales; no cambia preguntas,
audios, tiempos, respuestas ni resultados ya guardados. Las versiones nuevas
también incluyen alternativas cuando corresponde.

Los 100 audios nuevos se generaron con Piper, dos modelos y cuatro hablantes:
dos voces estadounidenses y dos británicas. Los diálogos usan hablantes distintos.
El ritmo de los textos largos se revisó con duración y palabras por minuto. Los
modelos y ejecutables quedan en `.local`, excluidos de Git; el uso de la aplicación
no requiere tener el generador instalado. Las grabaciones del Simulador 1 y del
diagnóstico se conservaron. Atribuciones en `/creditos-audio` y en
`public/audio/toefl-2026/VOICE-CREDITS.md`; el manifiesto público registra voces,
duraciones y sumas de verificación por archivo.

Para preparar los audios en otra computadora Windows:

```powershell
npm run toefl:build-content
npm run toefl:prepare-voices
Expand-Archive -LiteralPath .local/voice-tools/piper_windows_amd64.zip -DestinationPath .local/voice-tools/piper
npm run toefl:generate-audio
npm run toefl:install-form -- --form=2
npm run toefl:install-form -- --form=2 --apply
npm run toefl:install-form -- --form=3 --apply
```

La preparación descarga por HTTPS el binario oficial de Piper y modelos de
Hugging Face, verificando los modelos contra sus sumas publicadas. La síntesis
posterior es local. El instalador se niega a sustituir versiones con contenido o
intentos; el administrador decide el acceso de alumnos reales.

La vista del alumno está en `/alumno/progreso/toefl-ibt`. El profesor puede abrir
el progreso desde la lista de alumnos. Comparan solo simulaciones con la misma
versión de evaluación y revisión terminada; diagnóstico, formatos incompatibles
e intentos en curso no se mezclan en las diferencias. Las revisiones pendientes
aparecen separadas en el historial. Las fechas se muestran en horario de Ciudad
de México y cada vista comprueba sesión y acceso.

Verificación: 35 pruebas automatizadas, TypeScript, ESLint y compilación de
producción. Por HTTP se recorrieron el Simulador 2 (ruta superior) y el Simulador 3
(ruta inferior), con once grabaciones y rúbricas en cada uno, incluyendo el
historial privado y la restricción del panel del profesor. También se comprobó
un agotamiento del plazo global antes de elegir la segunda ruta: los reactivos
sin visitar siguen contando en el máximo completo. Para repetir esos casos se
pueden usar `VERIFY_FORM=simulator2`, `VERIFY_FORM=simulator3`, `VERIFY_LOWER=1` y
`VERIFY_EXPIRE_EARLY=1` con `scripts/verify-local.ts`.

La comparación visual se probó con dos resultados sintéticos evaluados y uno
pendiente en una cuenta desechable. `browser-toefl-test.ts --progress` prepara
esa cuenta y `--cleanup` elimina exclusivamente sus registros. No se agregaron
resultados sintéticos al alumno de demostración ni a alumnos reales.

Comprobación final del 25 de octubre de 2026: compilación de producción y ESLint
sin errores, 35 pruebas aprobadas y navegación visual verificada para profesor
y alumno. La cuenta temporal se eliminó; una consulta posterior confirmó cero
alumnos de prueba visual y el intento original del diagnóstico todavía en curso.
