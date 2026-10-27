"use client";
import { Icon } from "./icons";
export function PrintCertificate() { return <button type="button" onClick={()=>window.print()} className="next-button"><Icon name="chart" size={17} />Imprimir o guardar PDF</button>; }
