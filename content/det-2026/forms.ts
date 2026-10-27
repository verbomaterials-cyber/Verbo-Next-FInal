import { questions, audioScripts, DET_FORM_LABEL, DET_DELIVERED_SCREENS } from "./index";
import { buildDetForm } from "./build-form";
import { diagnostic } from "./diagnostic";
import { form2 } from "./form-2";
import { form3 } from "./form-3";

export const detForms = [
  buildDetForm(diagnostic),
  { id: "1", label: DET_FORM_LABEL, hasFeedback: true, questions, audioScripts, deliveredScreens: DET_DELIVERED_SCREENS },
  buildDetForm(form2), buildDetForm(form3),
];
export function detForm(id = "1") {
  const form = detForms.find(f => f.id === id);
  if (!form) throw new Error(`Formulario DET desconocido: ${id}`);
  return form;
}
