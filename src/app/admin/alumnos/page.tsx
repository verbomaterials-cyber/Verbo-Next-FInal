import { StudentsDirectory } from "./directory";
export const metadata = { title: "Alumnos" };
export default function StudentsPage({searchParams}:{searchParams:Promise<{q?:string;examen?:string}>}) { return <StudentsDirectory searchParams={searchParams} />; }
