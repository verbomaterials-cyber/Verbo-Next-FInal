---
name: Verbo NEXT
description: Sistema visual implementado del portal privado de preparación de Verbo.
colors:
  brand: "#01304a"
  brand-strong: "#002338"
  brand-soft: "#e5eff2"
  verbo-orange: "#ed7729"
  verbo-lime: "#59cc01"
  lime-light: "#c4f586"
  lime-hover: "#d3fba3"
  display-green: "#338000"
  background: "#f4f7f8"
  welcome-background: "#f5f8f7"
  surface: "oklch(100% 0 0)"
  ink: "#133e53"
  ink-muted: "#526e7b"
  line: "#dce7eb"
  line-strong: "#b8cdd6"
  nav-active: "#1b465e"
  nav-muted: "#bdd0da"
  danger: "oklch(49% 0.18 27)"
  danger-soft: "oklch(96% 0.02 27)"
  success: "oklch(50% 0.13 155)"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(42px, 6.5vw, 84px)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-.04em"
  page-title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-.025em"
  section-title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    letterSpacing: "-.015em"
  card-title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    letterSpacing: "-.02em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
  body-support:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.7
  action-label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 650
  mono:
    fontFamily: "Geist Mono, monospace"
rounded:
  switch-item: "6px"
  control-sm: "8px"
  profile-input: "9px"
  control: "10px"
  dropdown: "12px"
  list-surface: "14px"
  card: "15px"
  journey: "16px"
  circle: "50%"
spacing:
  brand-gap: "10px"
  nav-gap: "6px"
  form-gap: "22px"
  exam-grid-gap: "22px"
  exam-card-padding: "27px"
  profile-surface-padding: "30px"
  portal-content-padding: "38px 40px 50px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    typography: "{typography.action-label}"
    rounded: "{rounded.control}"
    padding: "12px 23px"
  button-primary-hover:
    backgroundColor: "#12465f"
  button-lime:
    backgroundColor: "{colors.lime-light}"
    textColor: "{colors.brand}"
    typography: "{typography.action-label}"
    rounded: "{rounded.control}"
    padding: "12px 23px"
  button-lime-hover:
    backgroundColor: "{colors.lime-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.brand}"
    typography: "{typography.action-label}"
    rounded: "{rounded.control}"
    padding: "12px 23px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control-sm}"
    padding: "8px 20px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.control-sm}"
    padding: "8px 20px"
  signin-input:
    backgroundColor: "#f9fbfb"
    rounded: "{rounded.control}"
    padding: "13px 44px"
  portal-navigation:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.nav-muted}"
    rounded: "{rounded.control}"
    padding: "13px 14px"
  portal-navigation-current:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.surface}"
  status-pill:
    backgroundColor: "#e7f4eb"
    textColor: "#2a6042"
    rounded: "{rounded.switch-item}"
    padding: "5px 9px"
  exam-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.exam-card-padding}"
  journey:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.journey}"
    padding: "35px 40px 26px"
---

# Design System: Verbo NEXT

## Overview

**Creative North Star: "Tu siguiente paso"**

El contrato visual establecido parte de la marca de Verbo Language Solutions y de la petición de un rediseño integral con dinamismo, sombras y animaciones variadas. El sistema implementado combina azul petróleo, naranja de marca y lima con Hanken Grotesk, superficies claras y navegación profunda. «Tu siguiente paso» nombra aquí el lenguaje ya presente en la interfaz; no registra una nueva elección ni una entrevista del usuario.

La bienvenida tiene una escala amplia y un recorrido interactivo; el producto autenticado concentra la orientación en una barra lateral, títulos legibles y acciones claras. La profundidad alterna superficies tonales, sombras suaves y respuesta al puntero. El movimiento distingue aparición, cambio de contenido, expansión y ambiente, y respeta movimiento reducido. Este documento describe el portal y el acceso: los intentos de examen conservan sus interfaces específicas.

Fuentes del contrato: [PRODUCT.md](PRODUCT.md), [dirección del portal](.impeccable/surfaces/src-app.md) y [marca indicada por el usuario](https://verbolanguagesolutions.com/next). La extracción se apoya en `src/app/globals.css`, `portal.css`, `layout.tsx` y los componentes reales de interfaz, marca, navegación, recorrido y acceso. Las capturas de `.impeccable/review/final/` registran el resultado implementado.

**Key Characteristics:**

- Azul petróleo para estructura, naranja para la firma y lima para interacción sobre oscuro.
- Hanken Grotesk con titulares compactos y texto de apoyo aireado.
- Superficies claras, tarjetas elevadas y navegación persistente adaptable.
- Movimiento contextual y foco visible según el fondo.

## Colors

La estructura es azul petróleo; el naranja firma la marca y los verdes distinguen energía, selección y apoyo.

### Primary

- **Azul petróleo Verbo** (`brand`): botones principales, navegación lateral, recorrido y campo narrativo del acceso. `brand-strong` pertenece al hover del botón compartido de administración; el botón del portal tiene su propio hover.
- **Azul suave** (`brand-soft`): feedback discreto, badges y superficies de interacción de controles compartidos.

### Secondary

- **Naranja de marca** (`verbo-orange`): punto final del logotipo y esfera ambiental. El punto activo de navegación tiene su tono propio, extraído en el snippet.
- **Lima de marca** (`verbo-lime`): identidad cromática conservada como variable. La implementación usa **lima clara** (`lime-light`) en botones, selección y foco sobre oscuro; `lime-hover` es su hover.
- **Verde de titular** (`display-green`): énfasis de la bienvenida.

### Neutral

- **Fondo de portal** (`background`) y **fondo de bienvenida** (`welcome-background`): campos claros ligeramente tintados.
- **Superficie** (`surface`): tarjetas, formularios y menús.
- **Tinta** (`ink`) y **tinta secundaria** (`ink-muted`): lectura y apoyo.
- **Línea** (`line`) y **línea firme** (`line-strong`): separadores y controles.
- **Navegación activa** (`nav-active`) y **navegación atenuada** (`nav-muted`): jerarquía sobre el fondo profundo.

Los colores semánticos `danger`, `danger-soft` y `success` conservan su notación OKLCH original. Las píldoras del portal usan además combinaciones específicas para listo, pendiente, en curso y bloqueado; no son intercambiables con la selección de examen.

**The Portal y examen Rule.** La identidad del portal no se convierte en un tema obligatorio de los simuladores; PortalShell omite las rutas /alumno/intento/**.

**The Foco según superficie Rule.** En la barra lateral, el recorrido y la historia del acceso, el foco visible usa lima clara y separación amplia; sobre claro conserva el contorno de marca.

## Typography

**Display Font:** Hanken Grotesk, con system-ui y sans-serif de respaldo.  
**Body Font:** Hanken Grotesk, cargada por `next/font/google` en `layout.tsx`.  
**Label/Mono Font:** Geist Mono está disponible; dentro del portal la clase monoespaciada se sustituye por Hanken Grotesk con cifras tabulares.

**Character:** una misma familia construye titulares amplios, títulos compactos y etiquetas legibles. El nombre histórico `--font-geist-sans` contiene Hanken Grotesk.

### Hierarchy

- **Display:** el rol del frontmatter describe el titular de bienvenida; en móvil pasa a (43px), interlínea (1.12).
- **Page title:** encabezado del producto; en móvil baja a (29px). El título de acceso tiene su variante de (34px), peso (750) y tracking (-.03em), con (32px) en móvil.
- **Section title / Card title:** jerarquía de secciones y catálogo según los roles extraídos.
- **Body:** la familia es compartida, sin imponer un tamaño global inexistente. El texto de apoyo suele usar (14px) e interlínea (1.7); las descripciones de tarjetas usan (13px) e interlínea (1.75).
- **Action label:** acción de portal; los botones compartidos usan (14px) y peso (500). Las etiquetas de navegación usan (14px); las píldoras de estado (10px) y peso (650).

Los encabezados usan balance de líneas. Los títulos de página admiten palabras largas; las cifras de resumen y puntuación son tabulares. Los controles del portal mantienen al menos (16px) para lectura y uso móvil.

## Layout

La bienvenida usa navegación con contenedor máximo (1280px), escenario máximo (1400px) y recorrido máximo (1184px). El titular se limita a (920px) y su apoyo a (600px). Estos anchos describen esa superficie, no una plantilla obligatoria para cada página.

El producto autenticado usa barra lateral fija (232px), cabecera mínima (86px) y contenido centrado con máximo (1390px). El panel inicial combina columnas (1.45fr / 1fr); el catálogo utiliza dos columnas de ancho flexible. El perfil y la ayuda tienen composiciones propias. El acceso divide el viewport en dos columnas iguales y limita el formulario a (390px).

### Responsive

- Hasta (1100px): barra lateral de (204px), contenido con márgenes internos horizontales de (28px) y menor densidad en tarjetas.
- Hasta (800px): la barra lateral cede a navegación inferior fija, la marca aparece en cabecera y el contenido usa (24px) laterales. La barra inferior incorpora `env(safe-area-inset-bottom)`.
- Hasta (580px): recorrido y catálogo pasan a una columna, perfil y ayuda se apilan y el acceso muestra solo formulario y marca. El contenido usa (20px) laterales. Los filtros se ordenan en una columna; etiquetas y selectores ocupan todo su ancho con `min-width: 0`.

El ritmo observado combina separaciones específicas, no una escala universal nueva: tarjetas del catálogo (22px), formulario de acceso (22px), tarjetas de perfil con relleno (30px). Las variantes móviles conservan sus valores de fuente.

## Elevation & Depth

La profundidad mezcla fondos tonales y elevación con tinta azul petróleo. Las tarjetas de examen, actividad y perfil reposan sobre sombra baja; los menús y el recorrido tienen sombras propias. Los estados bloqueados del catálogo suprimen su sombra.

### Shadow Vocabulary

- **Elevación baja:** `--elevation-low`, aplicada a superficies blancas del producto.
- **Elevación alta:** `--elevation-high`, respuesta de tarjetas al hover con ascenso de (3px).
- **Acción:** sombra compacta propia de botón; aumenta en hover.
- **Menú de cuenta:** sombra flotante con origen de transformación en la esquina superior derecha.
- **Recorrido:** sombra amplia bajo la superficie azul.

Los valores completos viven en `extensions.shadows` del sidecar, junto con las curvas y duraciones extraídas. No se añaden grupos de sombras o movimiento al frontmatter.

La bienvenida revela el título por clip (650ms); el recorrido cambia contenido (220ms) y dibuja conexiones (550ms); el acceso entra lateralmente (350ms); el menú combina escala y desplazamiento (180ms); las rutas del portal entran (220ms). Las esferas flotan en ciclos de (6s), (7s) o (9s) según su contexto. Los controles responden en (150–200ms), con presión a escala (.97) cuando corresponde.

**The Movimiento con contexto Rule.** Conservar las respuestas distintas de cada patrón y la alternativa prefers-reduced-motion; los desplazamientos de hover se reservan a punteros finos.

## Shapes

El sistema mezcla rectángulos suaves y círculos funcionales. Botones del portal y enlaces de navegación comparten radio de control; las tarjetas usan el radio de tarjeta, las listas el de superficie y el recorrido el suyo. La variedad documenta lo implementado: no debe normalizarse por accidente.

Los nodos del trayecto, avatares y órbitas son circulares. Los símbolos de examen se alojan en contenedores suaves con proporciones específicas: DET ocupa una base cuadrada y TOEFL una más ancha. Los campos compartidos usan radio (12px), los del acceso el radio de control y los de perfil su radio particular. Los estados vacíos emplean borde discontinuo; las tarjetas comunes se distinguen principalmente por superficie y sombra.

## Components

### Buttons

Las acciones del portal son compactas y firmes: altura mínima (48px), espacio entre texto e icono (18px), radio y relleno del frontmatter. Primario azul, variante lima sobre oscuro y variante de contorno con borde (#9aafb8). Hover, solo con puntero fino, cambia fondo y sombra; la flecha avanza (3px). La presión reduce escala (.97); deshabilitado usa opacidad (.5), cursor no permitido y pierde sombra.

El `Button` compartido conserva variantes primary, ghost, outline y danger; radio (8px), peso (500), tamaño de texto (14px), relleno medio (8px 20px) o pequeño (6px 12px), transición (150ms). Primary usa brand/brand-strong; ghost cambia de tinta secundaria a tinta sobre brand-soft; outline usa line-strong y cambia borde y texto a brand; danger usa danger/danger-soft. Sus sombras provienen de las utilidades Tailwind de la implementación, sin introducir equivalentes nuevos.

### Chips / Status

La píldora del portal es compacta, de radio suave y una línea. Listo usa verde suave, pendiente ámbar, en curso azul claro y bloqueado rojo suave. El componente `Badge` compartido conserva su forma de píldora completa y tonos neutral, brand, success y warning. Los estados representan datos reales.

### Cards / Containers

La tarjeta de examen usa los valores del frontmatter, sombra baja y hover elevado. Su título, descripción, metadatos y enlace inferior tienen jerarquías distintas; el enlace se separa con línea y desplaza su flecha (4px) en hover de la tarjeta. Perfil, actividad y versiones mantienen sus rellenos y radios específicos. Una versión bloqueada usa superficie (#edf2f4) y carece de elevación.

### Inputs / Fields

Los campos de acceso tienen altura mínima (52px), borde (#bbced5), superficie (#f9fbfb) y espacio para iconos laterales. Focus cambia a blanco, borde de marca y contorno claro de (3px), separado (1px). El botón de contraseña conserva área (40px × 40px), estado `aria-pressed` y fondo propio al activarse.

Los campos compartidos Input/Textarea/Select usan superficie, line-strong, relleno (8px 12px), sombra pequeña y foco de marca con halo de (3px) en brand-soft; deshabilitado reduce opacidad. Los filtros y campos del perfil mantienen sus variantes locales.

### Navigation

La barra lateral profunda combina iconos lineales y texto; el enlace actual usa superficie nav-active, tinta blanca y punto naranja. El foco visible sobre oscuro usa lima clara (2px) y separación (4px); sobre claro el contorno global es de marca (2px), separado (2px).

En móvil la navegación inferior pasa a superficie blanca, iconos sobre etiquetas y selección verde suave. El menú de cuenta usa `details`, avatar circular, animación de entrada y cierre por Escape o pulsación exterior. El enlace de salto aparece al recibir foco.

### Recorrido interactivo

La firma implementada es el trayecto de tres pasos. El selector DET/TOEFL usa botones con `aria-pressed`, selección lima clara, contenido que se actualiza y conexiones animadas. Es horizontal en escritorio y vertical en móvil. Los símbolos originales proceden de `public/brand`; los snippets omiten imágenes remotas y no sustituyen esos activos.

## Do's and Don'ts

### Do:

- **Do** reutilizar los valores y variantes existentes según su contexto de portal, acceso o administración.
- **Do** mantener los símbolos originales de Verbo, DET y TOEFL con sus proporciones y archivos de public/brand.
- **Do** conservar el foco visible claro sobre oscuro y la navegación móvil con su zona segura inferior.
- **Do** mantener los filtros móviles en una columna, con selectores que ocupan el ancho disponible.
- **Do** usar movimiento reducido y las restricciones de hover para punteros finos.

### Don't:

- **Don't** aplicar la composición o la paleta del portal como una obligación visual de los motores de examen.
- **Don't** reemplazar Hanken Grotesk por el nombre histórico de la variable --font-geist-sans.
- **Don't** convertir los colores o las rampas de previsualización del sidecar en nuevos estados de producto.
- **Don't** añadir estadísticas, rachas o logros ficticios para llenar tarjetas o estados vacíos.

