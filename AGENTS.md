<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Verbo NEXT: objetivo y forma de trabajo

- Construir una plataforma de simulación fiel a los exámenes oficiales: interfaz,
  estructura, tipos de pregunta, tiempos, navegación y resultados. Verificar los
  formatos vigentes con fuentes oficiales y registrar la versión del examen.
- Continuar el trabajo autorizado hasta completar y verificar el resultado.
  No detenerse al terminar cada capa o bloque para pedir un "adelante" o un commit.
  Consultar únicamente decisiones que necesiten información del usuario,
  amplíen sustancialmente el encargo o impliquen acciones destructivas.
- Las antiguas instrucciones de trabajar por capas con aprobación entre ellas
  quedan sustituidas por estas instrucciones.
- Las menciones históricas a "esqueleto", "MVP" o "fase 2" describen pendientes;
  no prohíben implementarlos cuando formen parte del trabajo solicitado.
- Reutilizar configuración y componentes compartidos donde ayuden. Permitir
  componentes y flujos específicos de cada examen cuando sean necesarios para
  reproducir su experiencia; no imponer que todo se resuelva con JSON y temas.
- Comunicar avances y limitaciones comprobadas. Distinguir entre funciones
  implementadas, verificadas en ejecución y todavía pendientes.
- Preservar cambios existentes del usuario y datos reales. No ejecutar seeds ni
  migraciones como parte de una revisión de diagnóstico.
