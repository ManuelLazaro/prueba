const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createApp } = require("./src/app");

const ENV = path.join(__dirname, ".env");

// Lee .env (CLAVE=valor). Si no hay API_KEY, genera un token nuevo y lo guarda ahí.
function cargarEnv() {
  const env = {};
  if (fs.existsSync(ENV)) {
    for (const linea of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  if (!env.API_KEY) {
    env.API_KEY = "cab_" + crypto.randomBytes(24).toString("hex");
    fs.appendFileSync(ENV, (fs.existsSync(ENV) && fs.readFileSync(ENV, "utf8").length ? "\n" : "") + "API_KEY=" + env.API_KEY + "\n");
    console.log("Token nuevo generado y guardado en .env");
  }
  return env;
}

const env = cargarEnv();
const PORT = Number(process.env.PORT || env.PORT || 4000);
const abierto = (process.env.AUTH || env.AUTH || "on").toLowerCase() === "off";
const app = createApp({ apiKey: process.env.API_KEY || env.API_KEY, abierto });
if (abierto) console.log("MODO ABIERTO: la API responde sin clave (AUTH=off en .env)");

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  // El PDF de la documentación se sirve tal cual, sin clave
  if (req.method === "GET" && url.pathname === "/documentacion.pdf") {
    const pdf = path.join(__dirname, "Documentacion-API-prueba.pdf");
    if (!fs.existsSync(pdf)) return responder(res, req, url, { status: 404, type: "application/json; charset=utf-8", body: { error: "Todavía no se generó el PDF de la documentación." } });
    res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Documentacion-API-prueba.pdf"' });
    res.end(fs.readFileSync(pdf));
    return console.log(new Date().toISOString(), "GET", url.pathname, 200);
  }
  let crudo = "";
  req.on("data", (c) => { crudo += c; if (crudo.length > 1e6) req.destroy(); });
  req.on("end", () => {
    let body;
    if (crudo) {
      try { body = JSON.parse(crudo); } catch { return responder(res, req, url, { status: 400, type: "application/json; charset=utf-8", body: { error: "El cuerpo no es un JSON válido." } }); }
    }
    const r = app.route({ method: req.method, path: url.pathname.replace(/\/+$/, "") || "/", query: Object.fromEntries(url.searchParams), headers: req.headers, body });
    responder(res, req, url, r);
  });
}).listen(PORT, () => {
  console.log("API de prueba en http://localhost:" + PORT);
  console.log("Documentación en http://localhost:" + PORT + "/docs");
});

function responder(res, req, url, r) {
  const texto = typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2);
  res.writeHead(r.status, { "Content-Type": r.type });
  res.end(texto);
  console.log(new Date().toISOString(), req.method, url.pathname + url.search, r.status);
}
