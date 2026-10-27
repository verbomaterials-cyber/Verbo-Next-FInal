import { simulator1, audioScripts as audio1 } from "./simulator-1";
import { simulator2, audioScripts as audio2 } from "./simulator-2";
import { simulator3, audioScripts as audio3 } from "./simulator-3";
export const toeflForms = [
  { number: 1, label: "Simulador 1", data: simulator1, audioScripts: audio1 },
  { number: 2, label: "Simulador 2", data: simulator2, audioScripts: audio2 },
  { number: 3, label: "Simulador 3", data: simulator3, audioScripts: audio3 },
] as const;
export function toeflForm(value = "1") {
  const result = toeflForms.find((form) => String(form.number) === value);
  if (!result) throw new Error("Selecciona un simulador TOEFL entre 1 y 3.");
  return result;
}
