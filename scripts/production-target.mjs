import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const projectRef = "botdckksttbfuxhybvju";
export const productionOrigin = "https://next.verboacademic.com";
const pooler = "aws-1-us-west-2.pooler.supabase.com";

export function envValue(text, key) {
  const line = text.split(/\r?\n/).find((line) => line.startsWith(`${key}=`));
  let value = line?.slice(key.length + 1).trim() ?? "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  return value;
}

export function assertProductionTarget(value) {
  const url = new URL(value);
  if (url.hostname !== pooler || decodeURIComponent(url.username) !== `postgres.${projectRef}` ||
      !["5432", "6543"].includes(url.port) || url.pathname !== "/postgres" || url.searchParams.get("sslmode") !== "require") {
    throw new Error("Destino rechazado: solo se permite el Supabase exclusivo de Verbo NEXT Final.");
  }
  return url;
}

export async function productionConnections() {
  const text = await fs.readFile(path.join(root, ".local/deploy.env"), "utf8");
  const password = envValue(text, "SUPABASE_DB_PASSWORD");
  if (!password) throw new Error("Falta SUPABASE_DB_PASSWORD en el archivo privado .local/deploy.env.");
  const prefix = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${pooler}`;
  const DATABASE_URL = `${prefix}:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require&connect_timeout=15`;
  const DIRECT_URL = `${prefix}:5432/postgres?sslmode=require&connect_timeout=15`;
  assertProductionTarget(DATABASE_URL);
  assertProductionTarget(DIRECT_URL);
  return { DATABASE_URL, DIRECT_URL };
}
