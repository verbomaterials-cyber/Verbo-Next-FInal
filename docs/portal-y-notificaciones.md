# Portal y avisos de Verbo NEXT

Publicado en https://next.verboacademic.com. El inicio explica el programa sin
mostrar un catálogo público; cada alumno ve sus exámenes asignados.

## Administración

- **Mi tablero:** alumnos, permisos habilitados, revisiones pendientes y evaluaciones terminadas.
- **Alumnos:** crear o editar perfiles, asignar el correo del profesor, restablecer contraseñas y suspender cuentas. La suspensión conserva los datos e invalida las sesiones. Un cambio de contraseña también invalida las sesiones anteriores.
- **Accesos:** buscar al alumno y abrir **Gestionar accesos**. Permite asignar un examen con versiones específicas e intentos, bloquear o quitar un permiso y regenerar su código. Quitar un permiso conserva los resultados. El límite nunca puede ser menor a los intentos utilizados.
- **Correos:** revisar los últimos 50 avisos y procesar pendientes o reintentar errores recientes. “Aceptado” confirma aceptación por Resend; no confirma recepción en bandeja.

El correo de avisos por sí solo no concede permisos. Las cuentas docentes se crean en Profesores y se asignan explícitamente al alumno.

## Resultados

Los intentos completamente evaluados de las familias de práctica vigentes
muestran una constancia con nombre, examen, versión, overall score, habilidades,
fecha y referencia. El alumno puede imprimirla o guardarla como PDF desde su
navegador. Los resultados pendientes no emiten una constancia final; los formatos
históricos sin escala reconocida tampoco. No se convierte el índice DET interno
a su escala oficial ni se afirma una equivalencia certificada.

La constancia es privada: se consulta con la sesión de su propietario. No se
crean enlaces públicos que expongan su nombre o calificación.

## Correo transaccional

Los eventos se guardan en `EmailDelivery` dentro de la misma transacción:

1. Creación de alumno: bienvenida y usuario; la contraseña se comparte aparte.
2. Asignación o habilitación de versiones: examen, simuladores, intentos y código.
3. Envío de intento: confirmación al alumno y aviso al profesor asignado.
4. Revisión finalizada: resultado disponible y aviso al profesor.

**Transporte de producción:** función separada `verbo-next-email` en el Supabase
de Academy (`tudkeownvrohnijulsvk`). Reutiliza los secretos existentes de Resend y
su remitente verificado como **Verbo NEXT <notificaciones@verbolanguagesolutions.com>**.
No consulta ni modifica las tablas de Academy. Las solicitudes se verifican con
Ed25519 y caducan a los cinco minutos; una clave pública en la función valida la
firma. La clave privada vive únicamente en la configuración de Vercel de NEXT.
La prueba firmada `probe` comprueba el remitente sin enviar mensajes.

Variables de Production en Vercel:

- `NEXT_EMAIL_BRIDGE_URL`: URL de la función.
- `NEXT_EMAIL_PRIVATE_KEY`: clave privada PKCS8 en base64; valor sensible, solo servidor.

Como alternativa se admite una clave independiente `RESEND_API_KEY` y
`RESEND_FROM_EMAIL`. Nunca configurar estas claves con prefijo `NEXT_PUBLIC_`.
La cuenta de Resend y sus límites de envío son compartidos con Academy.

Los envíos se procesan después de responder al usuario. La cola tiene exclusión
por fila y una clave de idempotencia estable por aviso. Los fallidos se reintentan
desde Correos dentro de las 23 horas iniciales; más tarde requieren revisión para
respetar la ventana de idempotencia de Resend. No hay un webhook de entregabilidad
ni un proceso periódico de reintentos: el administrador dispone del registro y
el botón para procesarlos.

La tabla está protegida con RLS y sin acceso para `anon` ni `authenticated`.

## Verificación

- `node --test --import tsx tests/*.test.ts`: 59 pruebas.
- `node --env-file=.env.local --import tsx scripts/verify-portal.ts`: flujo HTTP de alumnos, accesos, códigos, aislamiento de resultados, suspensión y sesiones.
- `node --env-file=.env.local --import tsx scripts/verify-local.ts`: recorrido del examen, audio, envío y revisión humana.
- TypeScript, ESLint y compilación de producción.

Las verificaciones locales crean registros temporales propios y los eliminan.
No ejecutan seeds ni reemplazan alumnos, exámenes o intentos existentes.


## Profesores, metas y preparación semanal

En **Administración → Profesores** se crean las cuentas docentes, se actualizan sus
datos y se activan o suspenden. La contraseña se muestra una sola vez al crear o
restablecer; el profesor recibe un correo de bienvenida sin la contraseña.

En **Alumnos → Editar → Profesor con acceso al panel** se asigna una cuenta docente.
El campo de correo de avisos permanece como alternativa para notificaciones y no
concede acceso. Las asignaciones previas por correo no se convierten en permisos.

El profesor utiliza el mismo login y entra a `/profesor`. Puede:

- Consultar únicamente sus alumnos asignados, sus planes e intentos.
- Revisar las respuestas y escuchar las grabaciones de intentos enviados.
- Usar las mismas rúbricas y herramientas de revisión que la administración.
- Ajustar metas y prioridades y escribir una orientación visible para el alumno.

No puede crear cuentas, asignarse alumnos, modificar exámenes, conceder accesos ni
abrir el registro de correos. La reasignación revoca su acceso anterior en cada
consulta y mutación. Las revisiones bloquean la asignación durante su transacción
para evitar que cambie mientras se guarda una evaluación. Suspender o restablecer
la contraseña invalida las sesiones docentes. La tabla `Teacher` está protegida
con RLS y sin permisos para los roles públicos de Supabase.

**Alumno → Mi plan** muestra un plan por examen asignado:

- Meta en la escala interna correspondiente: TOEFL 1–6 en pasos de 0.5; DET 0–100.
- Fecha objetivo opcional y de una a siete simulaciones por semana.
- Hasta dos habilidades prioritarias con orientación práctica.
- Número real de intentos enviados durante la semana, incluyendo los pendientes
  de revisión. La semana empieza el lunes en Ciudad de México; no incluye
  intentos en curso, intentos ajenos ni los de semanas anteriores.
- Último puntaje de práctica completamente evaluado y reconocimiento de la meta
  cuando ese resultado la alcanza. Las escalas no se mezclan.
- Orientación del profesor, que el alumno puede leer pero no modificar.

El administrador también puede abrir **Alumnos → Plan y avance**. Las metas y
el plan no cambian los tiempos, el contenido, los intentos permitidos ni las reglas
del examen. El plan no crea sesiones de calendario ni recordatorios automáticos.

Verificación adicional:

- `node --test --import tsx tests/*.test.ts`: 63 pruebas automatizadas.
- `node --env-file=.env.local --import tsx scripts/verify-teaching.ts`: flujo HTTP
  completo de docentes, reasignación, audio privado, revisión, metas y notas.
- La opción `--official` verifica el mismo flujo únicamente en la producción
  fijada por `production-target.mjs`, con cuentas temporales y buzones de pruebas
  de Resend. Limpia exclusivamente sus propios registros.


Los avisos docentes pendientes vuelven a comprobar la asignación y el estado de
la cuenta antes de enviarse. Si el profesor cambió o quedó suspendido, se marcan
como cancelados; un reintento no envía el aviso anterior a quien perdió el acceso.

