# Publicación de Verbo NEXT

La dirección oficial es `https://next.verboacademic.com`.

- Código: `verbomaterials-cyber/Verbo-Next-FInal`, rama `main`.
- Vercel: proyecto `verbo-next`, equipo `verbo-academys-projects`.
- Supabase: `Verbo NEXT Final`, referencia `botdckksttbfuxhybvju`.
- La base y el catálogo de Academy no forman parte de este despliegue.

## Variables privadas de Vercel

Configurar `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL` y `NEXTAUTH_SECRET` para
Production. `NEXTAUTH_URL` debe ser `https://next.verboacademic.com`.

Prisma usa el pooler de transacciones en el puerto 6543 durante la ejecución,
con `pgbouncer=true`, `connection_limit=1` y `sslmode=require`. Las migraciones
usan el pooler de sesiones en el puerto 5432 mediante `DIRECT_URL`.

Las credenciales se configuran en Vercel; nunca se incluyen en GitHub. Las
variables de Production no deben compartirse automáticamente con Preview.

## Inicialización controlada

`node scripts/prepare-production.mjs` comprueba el destino sin modificarlo.
`node scripts/prepare-production.mjs --apply` aplica las migraciones, protege
las tablas e importa el catálogo cuando la base está vacía. Este script solo
acepta el proyecto Supabase indicado arriba; rechaza cualquier otro destino.

La contraseña se lee de `.local/deploy.env`, clave `SUPABASE_DB_PASSWORD`.
La fuente del catálogo debe ser la base local `127.0.0.1:54329/verbo_next`.
Debe estar iniciada al ejecutar la preparación. No se copian alumnos, accesos,
intentos ni grabaciones. Los datos remotos existentes se conservan.

Los archivos privados `.local/deploy/access.json` y
`.local/deploy/vercel-env.json` guardan el acceso administrativo inicial y la
configuración de Production. Están excluidos del repositorio.

Las tablas tienen RLS habilitado y sin permisos para `anon` o `authenticated`.
La aplicación utiliza NextAuth y Prisma en el servidor; las claves de respuesta,
credenciales y grabaciones no se exponen mediante la Data API de Supabase.

## Compilación y comprobación

`npm run build` genera Prisma y compila Next.js. Compilar no ejecuta migraciones.
Las grabaciones usan audio a 64 kbps y un máximo de 4 MiB por subida, dentro del
límite de Vercel. El favicon reutiliza el símbolo de Verbo en `src/app/icon.png`.

Antes de publicar: `npm test`, `npm run lint`, `npx tsc --noEmit` y
`npm run build`. Después, verificar HTTPS, favicon, inicio de sesión, catálogo,
asignación de acceso y persistencia de un intento en el entorno oficial.

## Portal, constancias y correo

El rediseño y las nuevas herramientas de administración se documentan en
[Portal y notificaciones](portal-y-notificaciones.md). La migración aditiva
`20261027000100_portal_access_email` incorpora el estado de las cuentas, el correo
del profesor y la cola privada de envíos. No reemplaza el catálogo ni los datos.
