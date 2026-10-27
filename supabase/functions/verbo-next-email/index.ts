// Isolated mail transport for NEXT. No Academy database access.
// Authenticated with Ed25519 signatures; only the public verification key lives here.
const PUBLIC_KEY = "MCowBQYDK2VwAyEAmsUah2mKT7op2dhyL7MxB8zsynZXuCvrauebYDf4AX8=";
const json = (body:unknown,status=200) => Response.json(body,{status});
const bytes = (base64:string) => Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
Deno.serve(async (request:Request) => {
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  if(Number(request.headers.get("content-length")??0)>24000)return json({error:"Payload too large"},413);
  const body=await request.text();
  if(body.length>24000)return json({error:"Payload too large"},413);
  try {
    const signature=request.headers.get("X-Next-Signature")??"";
    const key=await crypto.subtle.importKey("spki",bytes(PUBLIC_KEY),{name:"Ed25519"},false,["verify"]);
    if(!signature||!await crypto.subtle.verify("Ed25519",key,bytes(signature),new TextEncoder().encode(body)))return json({error:"Unauthorized"},401);
    const data=JSON.parse(body);
    if(typeof data.timestamp!=="number"||Math.abs(Date.now()-data.timestamp)>300000)return json({error:"Expired request"},401);
    const apiKey=Deno.env.get("RESEND_API_KEY");
    const configuredFrom=Deno.env.get("RESEND_FROM_EMAIL")??"";
    const address=/<([^>]+)>/.exec(configuredFrom)?.[1]??configuredFrom;
    if(!apiKey||!/^[-\w.+]+@(?:[\w-]+\.)*verbolanguagesolutions\.com$/i.test(address))return json({error:"Verified sender unavailable"},503);
    // Signed probe verifies shared configuration without sending any email.
    if(data.probe===true)return json({ready:true,from:`Verbo NEXT <${address}>`});
    if(typeof data.id!=="string"||!/^[a-z0-9-]{15,100}$/i.test(data.id)||typeof data.to!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.to)||typeof data.subject!=="string"||data.subject.length>250||/[\r\n]/.test(data.subject)||typeof data.text!=="string"||data.text.length>18000)return json({error:"Invalid request"},400);
    const from=`Verbo NEXT <${address}>`;
    const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
    const html=`<div style="background:#f3f7ef;padding:32px;font-family:Arial,sans-serif;color:#01304a"><div style="max-width:580px;margin:auto;background:white;border-radius:20px;padding:32px"><p style="font-weight:800;font-size:22px">Verbo NEXT<span style="color:#ed7729">.</span></p><h1 style="font-size:23px;line-height:1.3">${escape(data.subject.replace(/ · Verbo NEXT$/,""))}</h1><div style="white-space:pre-wrap;font-size:15px;line-height:1.8;color:#476474">${escape(data.text)}</div><p style="font-size:11px;border-top:1px solid #e5ecdf;padding-top:20px;margin-top:28px">Verbo Language Solutions · Tu siguiente paso, con propósito.</p></div></div>`;
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","Idempotency-Key":`verbo-next/${data.id}`},body:JSON.stringify({from,to:[data.to],subject:data.subject,text:data.text,html,tags:[{name:"product",value:"verbo-next"}]}),signal:AbortSignal.timeout(12000)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)return json({error:"Email provider rejected message"},502);
    return json({id:result.id});
  }catch{return json({error:"Invalid or unsuccessful request"},400);}
});
