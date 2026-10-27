# Verbo NEXT

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Alumnos de Verbo Language Solutions que preparan una certificación de inglés,
y el equipo que administra sus accesos, revisa respuestas y acompaña su preparación.

## Product Purpose

Ofrecer simulaciones fieles al formato de cada examen, con tiempos y navegación
propios, resultados de práctica y revisión humana de respuestas abiertas.
El alumno debe entender dónde está y cuál es su siguiente paso.

## Operating Context

Aplicación privada con acceso entregado por un asesor. El alumno llega a una
bienvenida, inicia sesión, elige un examen asignado, prepara su equipo y practica.
Puede retomar un intento y consultar resultados y progreso. El profesor conserva
el control sobre accesos y evaluación. El entorno de desarrollo usa PostgreSQL local.

## Capabilities and Constraints

Next.js 16.2, React 19, NextAuth y Prisma. DET y TOEFL tienen motores específicos.
Las escalas e índices de práctica no predicen puntuaciones oficiales. Los datos
reales e intentos existentes deben conservarse. El rediseño del portal no cambia
la interfaz interna de los exámenes. Este encargo no autoriza publicar una versión
remota ni modificar planes comerciales. Los nuevos perfiles e historial deben
usar datos y permisos reales; no se inventan estadísticas, rachas o logros.

## Brand Commitments

El usuario pide una identidad nueva para la aplicación basada en
https://verbolanguagesolutions.com/next, incluidos sus colores y símbolos por examen.
Quiere profundidad, sombras y movimiento variado, además de bienvenida, acceso
y funciones de alumno como el perfil. La experiencia habla español con cercanía
y claridad. Emil Kowalski e Impeccable son las guías de diseño solicitadas.

## Evidence on Hand

Catálogo local DET con diagnóstico y tres simuladores; TOEFL con diagnóstico y
simuladores. Resultados, respuestas y rúbricas persistidos en PostgreSQL.
Los activos en public/brand provienen del sitio compartido por el usuario;
su procedencia se documenta en public/brand/sources.json.

## Product Principles

- Toda acción principal lleva a una función disponible y autorizada.
- Progreso significa datos observados, con evaluaciones pendientes identificadas.
- El portal expresa Verbo; cada simulador conserva su propia fidelidad.
- Los estados vacíos orientan al alumno sin inventar actividad.
- La animación acompaña la acción y respeta movimiento reducido.
