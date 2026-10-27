import {redirect} from "next/navigation";
import { getAppSession } from "@/lib/session";
import {roleHome} from "@/lib/portal";
import {PortalShell} from "@/components/portal-shell";
export default async function TeacherLayout({children}:{children:React.ReactNode}) {
  const session=await getAppSession();
  if(!session)redirect("/login");
  if(session.user.role!=="TEACHER")redirect(roleHome(session.user.role));
  return <PortalShell role="teacher" name={session.user.name??"Profesor"}>{children}</PortalShell>;
}
