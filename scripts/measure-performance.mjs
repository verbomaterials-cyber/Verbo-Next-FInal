// Read-only production probe. Credentials and reports stay in ignored .local/.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'https://next.verboacademic.com';
const access = JSON.parse(await fs.readFile('.local/deploy/access.json', 'utf8'));
const output = process.argv[2] ?? '.local/deploy/performance-before.json';
const jar = new Map();
async function request(path, init = {}) {
  const start = performance.now();
  const r = await fetch(base + path, { ...init, redirect: 'manual', headers: { Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; '), ...init.headers } });
  const ttfb = performance.now() - start;
  for (const value of r.headers.getSetCookie()) { const p = value.split(';',1)[0], i = p.indexOf('='); jar.set(p.slice(0,i),p.slice(i+1)); }
  const text = await r.text();
  return { status: r.status, text, ttfbMs: Math.round(ttfb), totalMs: Math.round(performance.now()-start), decodedBytes: Buffer.byteLength(text), cache: r.headers.get('x-vercel-cache'), cacheControl: r.headers.get('cache-control'), region: r.headers.get('x-vercel-id')?.split('::')[0] };
}
const samples = [];
for (const role of ['anonymous', 'student', 'admin']) {
  jar.clear();
  if (role !== 'anonymous') {
    const a = access[role]; assert.ok(a, `${role} account`);
    const csrf = JSON.parse((await request('/api/auth/csrf')).text).csrfToken;
    await request('/api/auth/callback/credentials', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({email:a.email,password:a.password,csrfToken:csrf,json:'true',callbackUrl:base}) });
    assert.equal(JSON.parse((await request('/api/auth/session')).text).user?.role, role.toUpperCase());
  }
  const paths = role === 'anonymous' ? ['/', '/login'] : role === 'student' ? ['/alumno', '/alumno/plan', '/alumno/resultados', '/alumno/examen/toefl-ibt'] : ['/admin', '/admin/alumnos', '/admin/metricas'];
  for (const path of paths) for (let n=0;n<3;n++) { const result=await request(path); delete result.text; assert.equal(result.status,200,path); samples.push({role,path,round:n+1,...result}); }
}
await fs.writeFile(output, JSON.stringify({base,at:new Date().toISOString(),dataMutations:0,samples},null,2)+'\n');
console.log(JSON.stringify(samples));
process.exit(0);
