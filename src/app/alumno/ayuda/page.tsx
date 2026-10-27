import Link from "next/link";
import { Icon } from "@/components/icons";
export const metadata = { title: "Guía y ayuda" };
const questions = [
  ["¿Por dónde empiezo?", "Abre Mis exámenes y elige una certificación asignada. Usa el código que recibiste de tu asesor. Si tienes un diagnóstico disponible, puede ayudarte a encontrar tu punto de partida antes de continuar con los simuladores."],
  ["¿Qué preparo antes de practicar?", "Reserva tiempo sin interrupciones y revisa tu conexión, sonido y micrófono. La pantalla de preparación te guía antes de comenzar. DET se practica con bocinas, sin audífonos. El reloj del intento comienza después de la preparación del equipo."],
  ["¿Puedo retomar un intento?", "Sí. El panel y el historial muestran los intentos en curso. El reloj del examen sigue corriendo aunque cierres la pestaña: volver al intento no reinicia sus plazos. El sistema aplica el tiempo restante del servidor."],
  ["¿Por qué aparece En revisión?", "Las respuestas de escritura y speaking necesitan evaluación del equipo de Verbo. Algunas respuestas abiertas de escucha también pueden requerir revisión. Mientras esté pendiente, el resultado no es definitivo. Cuando se complete, podrás consultarlo desde Resultados."],
  ["¿Mi resultado equivale al examen oficial?", "No. Los resultados son indicadores de práctica. Los índices DET y las bandas de práctica TOEFL no están calibrados para predecir un resultado oficial, y cada uno usa su propia escala."],
  ["¿Por qué un simulador está bloqueado?", "Tu asesor gestiona las versiones disponibles y el número de intentos de cada examen. Si necesitas habilitar otro simulador o ampliar tu acceso, ponte en contacto con él antes de comenzar."],
  ["¿Cómo cambio mi contraseña?", "Por ahora, tu asesor administra las credenciales y puede ayudarte a restablecerlas. Puedes actualizar tu nombre en Mi perfil. Nunca compartas tu contraseña ni tu código de acceso con otras personas."],
];
export default function HelpPage() {
  return <><div className="page-heading"><div><h1>Antes de dar el siguiente paso.</h1><p>Resuelve lo esencial para aprovechar tu práctica y saber qué esperar.</p></div></div><div className="help-layout"><section aria-label="Preguntas frecuentes">{questions.map(([question, answer]) => <details className="welcome-details" key={question}><summary>{question}<Icon name="chevron" size={17} /></summary><p>{answer}</p></details>)}</section><aside className="help-contact"><h2>Tu asesor está contigo.</h2><p>Para accesos, revisión de respuestas o tu siguiente sesión, habla con el equipo de Verbo.</p><a className="next-button" href="mailto:info@verbolanguagesolutions.com?subject=Ayuda%20en%20Verbo%20NEXT">Contactar a Verbo<Icon name="arrow" size={17} /></a><Link href="/alumno" className="text-link mt-6">Volver a mi espacio<Icon name="arrow" size={16} /></Link></aside></div></>;
}
