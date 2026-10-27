import {redirect} from "next/navigation";
import { getAppSession } from "@/lib/session";
import {roleHome} from "@/lib/portal";
export async function requireTeacherSession(){const session=await getAppSession();if(!session)redirect("/login");if(session.user.role!=="TEACHER")redirect(roleHome(session.user.role));return session;}
