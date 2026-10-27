import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  Newsreader,
  Libre_Franklin,
} from "next/font/google";

/*
 * Fuentes del motor de examen. Cada examen usa un par en eje de contraste
 * (display expresivo + texto neutro), nunca dos sans idénticas.
 *
 * DET  — Bricolage Grotesque (display con carácter, números redondeados)
 *        + Hanken Grotesk (humanist sans, cuerpo cálido y ágil).
 * TOEFL — Newsreader (serif editorial con carácter, títulos de sección)
 *        + Libre Franklin (grotesque tipo periódico, contenido).
 *
 * Los themeConfig referencian estas variables por su nombre CSS; el motor
 * las mapea a --xfont-display / --xfont-body sin lógica por examen.
 */

export const detDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-det-display",
  display: "swap",
});

export const detBody = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-det-body",
  display: "swap",
});

export const toeflDisplay = Newsreader({
  subsets: ["latin"],
  variable: "--font-toefl-display",
  display: "swap",
  style: ["normal", "italic"],
});

export const toeflBody = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-toefl-body",
  display: "swap",
});

/** classNames combinados de las cuatro variables, para el contenedor del motor. */
export const examFontClass = [detDisplay, detBody, toeflDisplay, toeflBody]
  .map((f) => f.variable)
  .join(" ");
