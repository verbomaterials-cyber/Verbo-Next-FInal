# Experiencia Verbo NEXT · 25 de octubre de 2026

## Resultado implementado

El portal usa la identidad de la página compartida por el usuario:
[Verbo NEXT](https://verbolanguagesolutions.com/next). Se reutilizaron su símbolo
Verbo y los activos DET y TOEFL, con procedencia en `public/brand/sources.json`.
Las dos imágenes PNG también llevan el origen incrustado en sus metadatos.

Se aplicaron las guías solicitadas de [Emil Kowalski](https://github.com/emilkowalski/skills)
e [Impeccable](https://github.com/pbakaus/impeccable). Los archivos consultados se
conservaron en `.local/design-guides`; no se instalaron como preferencias globales.
El contexto de producto está en `PRODUCT.md`, y el contrato de este rediseño en
`.impeccable/surfaces/src-app.md`.
El sistema visual implementado se documenta en `DESIGN.md`, con tokens y
muestras de componentes en `.impeccable/design.json`.

| Pantalla | Comportamiento disponible |
| --- | --- |
| `/` | Bienvenida pública, acceso según sesión, recorrido que cambia entre DET y TOEFL y preguntas desplegables. Sigue accesible con una sesión iniciada. |
| `/login` | Diseño de acceso con identidad Verbo, mostrar/ocultar contraseña, validación del navegador y recuperación de errores de conexión. Conserva destinos internos seguros después de entrar. |
| `/alumno` | Nombre actualizado, resumen real, último intento en curso, catálogo asignado y actividad reciente. La práctica conserva el reloj del servidor. |
| `/alumno/examen/[slug]` | Identidad por examen, versiones, estados de acceso, intento retomable, errores recuperables y preparación antes de comenzar. |
| `/alumno/resultados` | Historial propio, filtros de examen/estado por URL y paginación de 12 intentos. Distingue En curso, En revisión y Finalizado. |
| `/alumno/perfil` | Nombre editable con persistencia, correo de lectura, accesos e intentos disponibles y fecha de alta. |
| `/alumno/ayuda` | Guía sobre acceso, equipo, reloj persistente, revisión y resultados; enlace de contacto con Verbo. |
| `/admin` y subrutas | Nueva navegación y marco visual compartido; funciones administrativas existentes conservadas. |

La navegación usa barra lateral en escritorio, menú de cuenta y navegación
inferior en móvil. Durante un intento se omite el marco del portal para conservar
la interfaz particular de DET o TOEFL. No se ejecutaron seeds ni migraciones.

## Movimiento y profundidad

La bienvenida tiene una entrada por recorte y esferas ambientales. El recorrido
cambia mediante un fundido y desplazamiento breve; la línea de sus etapas se
revela al cambiar de examen. El acceso entra lateralmente, el menú de cuenta
aparece desde su activador y la navegación usa una transición corta de contenido.
Los botones responden a la pulsación y las tarjetas se elevan al usar un puntero
con hover. Los desplegables tienen giro y revelado de respuesta.

Las animaciones son CSS y no bloquean la interacción. `prefers-reduced-motion`
desactiva el movimiento. Se implementaron estados de foco contrastantes sobre
superficies claras y oscuras; los filtros se apilan a partir de 580 px.

## Permisos y datos

La acción `updateProfile` obtiene al alumno de la sesión. Solo permite actualizar
el nombre, valida longitud y caracteres de control, e ignora cualquier ID de
alumno enviado por el navegador. No permite modificar roles, correo ni accesos.
La navegación vuelve a leer el nombre persistido después de guardar.

El historial consulta únicamente intentos del alumno autenticado. Los índices
DET y bandas de práctica TOEFL se muestran con etiquetas independientes; los
resultados pendientes, formatos desconocidos o valores fuera de rango no se
presentan como puntuaciones finales. Un cero final de DET sí se muestra.
No se añadieron rachas, logros, testimonios ni métricas inventadas.

## Verificación realizada

- TypeScript y ESLint sin errores; 57 pruebas unitarias aprobadas, incluidas
  protección de destinos de login, nombres internacionales, fechas de México,
  escalas separadas, resultados pendientes y cero final.
- Build de producción mediante `node node_modules/next/dist/bin/next build`;
  se evita el script que ejecuta migraciones.
- `scripts/verify-portal-local.ts`: HTTP real, sesión, Server Actions y PostgreSQL.
  Comprueba acceso invitado, estados vacíos, filtros, nombre persistido, ID ajeno
  ignorado, aislamiento entre alumnos, resultados privados y separación por rol.
  Las dos cuentas temporales se eliminaron al terminar. No se modificaron alumnos
  reales.
- Regresión HTTP DET del simulador 3: 72 pantallas, nueve grabaciones de prueba,
  17 revisiones, límites de reproducción, persistencia de plazos y permisos.
  La cuenta temporal se eliminó al terminar.
- Navegador en tamaño de escritorio del usuario y 390 × 844: bienvenida,
  acceso, panel, catálogo, perfil e historial. Sin desbordamiento horizontal.
  Se probaron cambio DET/TOEFL, contraseña visible/oculta con texto ficticio,
  menú y cierre con Escape, filtros y su estado vacío.
- La revisión independiente detectó foco oscuro sin contraste y valores de filtro
  recortados en móvil. Ambos se corrigieron y se capturaron de nuevo; Tab confirmó
  un anillo lima de 2 px con separación de 4 px en barra lateral y selector público.
  La segunda revisión dio por resueltos ambos hallazgos y aprobó ese alcance.
- El detector mecánico de Impeccable no reportó hallazgos; la comprobación de
  procedencia encontró cero imágenes sin origen.

Las capturas están en `.impeccable/review/final/` y se excluyen de Git.
`/dev/portal` muestra el componente real de acceso sin cerrar la sesión del
navegador; solo está disponible en desarrollo.

## Límites y siguientes funciones

La recuperación de contraseña y los cambios de correo siguen a cargo del asesor.
El perfil usa iniciales y no incluye subida de fotografía. El progreso detallado
por habilidad conserva el informe TOEFL existente; el nuevo historial reúne DET
y TOEFL sin comparar sus escalas. No se han añadido calendario de sesiones,
recordatorios, objetivos de fecha/puntaje ni recomendaciones automáticas.

Como siguiente evolución del producto conviene conectar una meta de examen y
fecha objetivo con un plan de práctica, después agregar agenda de sesiones y
recordatorios. Estos datos requieren definir con Verbo cómo los administrará el
asesor. El nuevo portal ya ofrece los puntos de entrada: perfil, práctica,
resultados y ayuda.

La revisión visual no equivale a pruebas con lector de pantalla ni con un
dispositivo físico configurado para movimiento reducido. Las capturas del acceso
usan el mismo componente a través de la vista de desarrollo; las pruebas HTTP
verifican la ruta y sesión reales. La aplicación se conserva en local: este lote
no publica ni modifica el sitio remoto de Verbo.
