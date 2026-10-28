# Revisión y reporte docente

El profesor entra en `/profesor` y consulta exclusivamente alumnos asignados e
intentos enviados. La revisión muestra puntos por habilidad, aciertos, errores,
crédito parcial, omisiones y respuestas pendientes. Los errores y las dudas se
presentan primero; los aciertos y las respuestas abiertas evaluadas se pueden
desplegar. No concede acceso al banco ni a ramas adaptativas alternativas.

Las preguntas cerradas se califican con sus claves. TOEFL y DET conservan sus
reglas de crédito parcial. Escritura, speaking y paráfrasis DET que requieren
interpretación esperan evaluación humana. Los porcentajes describen puntos de
práctica y no equivalen a puntuaciones oficiales. La prioridad automática es
orientativa: hasta dos habilidades completamente evaluadas por debajo del 75%.
El profesor decide el plan tomando en cuenta la evidencia y la meta del alumno.

El alumno recibe el resumen por habilidad incluso en diagnósticos sin feedback
por pregunta. El resultado sigue marcado como parcial mientras falte evaluación.
La disponibilidad del desglose por pregunta conserva `ExamVersion.hasFeedback`.

Cada intento admite un reporte con resumen, fortalezas, áreas por reforzar,
actividades de estudio, dos prioridades, observaciones por habilidad y fecha
opcional de seguimiento. `Attempt.teacherReport` conserva un borrador privado y
una instantánea publicada con autor, fecha y resultados. Guardar un borrador no
altera la versión que ve el alumno. Publicar requiere evaluación completa y los
cuatro campos principales desarrollados. La versión publicada tiene identidad
Verbo y una hoja de impresión propia para guardar como PDF desde el navegador.

Las acciones verifican sesión y asignación actual dentro de la transacción,
bloquean el intento para coordinarse con la evaluación y rechazan revisiones
obsoletas. Cambiar una evaluación retira la publicación, conserva el borrador y
exige republicar. Ningún borrador se serializa hacia la vista del alumno.

La migración Prisma `20261027000300_teacher_report` añade únicamente una columna
JSONB opcional; no reemplaza datos ni carga contenido. En Supabase permanece la
autorización de servidor con NextAuth y Prisma y el bloqueo de la Data API.

## Demostración y verificación

`node --env-file=.env.local --import tsx scripts/teacher-demo.ts` crea una cuenta
docente y un alumno ficticio con dos intentos TOEFL: uno evaluado y otro pendiente.
Las pantallas los identifican como demostración; los audios son tonos de prueba.
No representan desempeño real. Las contraseñas aleatorias se guardan en
`.local/teacher-demo-access.json`. Repetirlo conserva la cuenta existente.

`scripts/verify-teacher-report.ts` comprueba por HTTP el login, las restricciones,
los borradores, publicación, concurrencia, lectura de audio y retirada del reporte
al cambiar una rúbrica. Deja un reporte ilustrativo publicado en el intento
evaluado de la cuenta de demostración; elimina únicamente su alumno temporal de
comprobación de permisos. No envía correos ni modifica intentos de personas reales.

Ambos scripts aceptan `--official` solo para el proyecto fijado en
`scripts/production-target.mjs`. Las credenciales y evidencias de producción quedan
en `.local/deploy/`, excluidas de Git. Nunca se deben copiar contraseñas al código.
