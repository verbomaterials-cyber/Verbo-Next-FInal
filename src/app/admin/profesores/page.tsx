import {prisma} from "@/lib/prisma";
import {TeachersManager} from "./teachers-manager";
export const metadata={title:"Profesores"};
export default async function TeachersPage(){const teachers=await prisma.teacher.findMany({orderBy:{fullName:"asc"},select:{id:true,fullName:true,email:true,isActive:true,_count:{select:{students:true}}}});return <TeachersManager teachers={teachers.map(t=>({...t,students:t._count.students}))}/>;}
