# Portal y avisos de Verbo NEXT

Publicado en https://next.verboacademic.com. El inicio explica el programa sin
mostrar un catálogo público; cada alumno ve sus exámenes asignados.

## Administración

- **Mi tablero:** alumnos, permisos habilitados, revisiones pendientes y evaluaciones terminadas.
- **Alumnos:** crear o editar perfiles, asignar el correo del profesor, restablecer contraseñas y suspender cuentas. La suspensión conserva los datos e invalida las sesiones. Un cambio de contraseña también invalida las sesiones anteriores.
- **Accesos:** buscar al alumno y abrir **Gestionar accesos**. Permite asignar un examen con versiones específicas e intentos, bloquear o quitar un permiso y regenerar su código. Quitar un permiso conserva los resultados. El límite nunca puede ser menor a los intentos utilizados.
- **Correos:** revisar los últimos 50 avisos y procesar pendientes o reintentar errores recientes. “Aceptado” confirma aceptación por Resend; no confirma recepción en bandeja.

El correo de profesor recibe avisos, pero no crea una cuenta ni concede permisos.
Para abrir las revisiones se necesita una cuenta administrativa autorizada.

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
