import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth";
import {roleHome} from "@/lib/portal";
export async function requireTeacherSession(){const session=await getServerSession(authOptions);if(!session)redirect("/login");if(session.user.role!=="TEACHER")redirect(roleHome(session.user.role));return session;}
