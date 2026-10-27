import { z } from "zod";
export const profileNameZ = z.string().trim().min(2, "Escribe al menos dos caracteres.").max(100, "Usa un máximo de 100 caracteres.").refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Escribe el nombre en una sola línea.");
