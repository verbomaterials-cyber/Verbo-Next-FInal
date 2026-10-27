import { StudentsDirectory } from "../alumnos/directory";
export const metadata = { title:"Accesos" };
export default function AccessPage({searchParams}:{searchParams:Promise<{q?:string;examen?:string}>}) { return <StudentsDirectory searchParams={searchParams} mode="access" />; }
