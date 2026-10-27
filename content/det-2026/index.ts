import { questions, audioScripts } from "./form-1";
import "./interactive";
export { questions, audioScripts };
export const DET_FORM_LABEL = "Simulador DET 2026 · 1";
export const DET_DELIVERED_SCREENS = questions.filter(q=>!((q.prompt._det as {slot?:string;level?:number}).slot) || (q.prompt._det as {level?:number}).level===3).length;
