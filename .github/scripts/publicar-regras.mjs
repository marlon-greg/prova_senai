// Publica o firestore.rules direto pela API do Firebase Rules (sem firebase-tools).
// Uso: GOOGLE_APPLICATION_CREDENTIALS=sa.json node publicar-regras.mjs <projeto>
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
const projeto = process.argv[2];
const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const agora = Math.floor(Date.now() / 1000);
const corpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase", aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600 })}`;
const jwt = `${corpo}.${createSign("RSA-SHA256").update(corpo).sign(sa.private_key, "base64url")}`;
const tok = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` })).json();
if (!tok.access_token) { console.error("Falha no token:", JSON.stringify(tok)); process.exit(1); }
const api = async (metodo, url, dados) => {
  const r = await fetch(`https://firebaserules.googleapis.com/v1/${url}`, { method: metodo, headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" }, body: JSON.stringify(dados) });
  const d = await r.json();
  if (!r.ok) { console.error(`${metodo} ${url}: ${r.status}`, JSON.stringify(d.error || d)); process.exit(1); }
  return d;
};
const rs = await api("POST", `projects/${projeto}/rulesets`, { source: { files: [{ name: "firestore.rules", content: readFileSync("firestore.rules", "utf8") }] } });
console.log("Regras compiladas:", rs.name);
const nome = `projects/${projeto}/releases/cloud.firestore`;
await api("PATCH", nome, { release: { name: nome, rulesetName: rs.name } });
console.log("✅ Regras publicadas no Firestore:", rs.name);
