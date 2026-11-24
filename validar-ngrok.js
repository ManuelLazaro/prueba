// Recorre todas las rutas por la URL pública de ngrok y dice cuáles respondieron bien.
// Uso: node validar-ngrok.js   (con el servidor y ngrok ya levantados)
const fs = require("node:fs");
const path = require("node:path");
const { ENDPOINTS } = require("./src/docs");

const clave = fs.readFileSync(path.join(__dirname, ".env"), "utf8").match(/API_KEY=(.+)/)[1].trim();
const H = { "X-API-Key": clave, "ngrok-skip-browser-warning": "1", "Content-Type": "application/json" };

async function urlPublica() {
  const j = await (await fetch("http://127.0.0.1:4040/api/tunnels")).json();
  const t = j.tunnels.find((x) => x.public_url.startsWith("https"));
  if (!t) throw new Error("ngrok no tiene un túnel https abierto.");
  return t.public_url;
}

(async () => {
  const base = await urlPublica();
  console.log("URL pública:", base, "\n");
  let ok = 0, mal = 0;
  const probar = async (nombre, metodo, ruta, espera, body, headers = H) => {
    const r = await fetch(base + ruta, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
    const tipo = (r.headers.get("content-type") || "").split(";")[0];
    const texto = await r.text();
    let j = null; try { j = JSON.parse(texto); } catch {}
    const bien = r.status === espera && (tipo === "application/json" ? j !== null : true);
    bien ? ok++ : mal++;
    const dato = j && Array.isArray(j.datos) ? j.total + " registros" : j && j.error ? j.error.slice(0, 50) : "";
    console.log((bien ? "OK   " : "FALLA") + " " + String(r.status).padEnd(4) + metodo.padEnd(5) + ruta.padEnd(52) + dato);
    return j;
  };

  await probar("salud", "GET", "/health", 200, null, {});
  await probar("docs", "GET", "/docs", 200, null, { "ngrok-skip-browser-warning": "1" });
  await probar("openapi", "GET", "/openapi.json", 200, null, { "ngrok-skip-browser-warning": "1" });
  await probar("sin token", "GET", "/api/productos", 401, null, { "ngrok-skip-browser-warning": "1" });
  for (const e of ENDPOINTS.filter((x) => x.metodo === "GET")) await probar(e.ruta, "GET", e.ejemplo, 200);

  console.log("\nEscrituras:");
  const v = await probar("venta", "POST", "/api/ventas", 201, { telefono: "51999000001", cliente: "María Quispe", items: [{ sku: "MOC-002", cantidad: 1 }] });
  await probar("pagar", "POST", "/api/ventas/" + v.id + "/pagar", 200, { metodo: "Yape" });
  await probar("anular", "POST", "/api/ventas/" + v.id + "/anular", 200, {});
  await probar("sin stock", "POST", "/api/ventas", 409, { telefono: "51999000001", cliente: "María Quispe", items: [{ sku: "ACC-002", cantidad: 1 }] });
  const c = await probar("compra", "POST", "/api/compras", 201, { proveedor: "PRV-03", items: [{ sku: "ACC-002", cantidad: 20 }] });
  const res = await probar("reserva", "POST", "/api/reservas", 201, { cabina: "CAB-003", fecha: "2026-12-28", horas: 3, cliente: "Cliente Prueba", telefono: "51999000009" });
  await probar("confirmar", "POST", "/api/reservas/" + res.id + "/confirmar", 200, {});
  await probar("cancelar", "POST", "/api/reservas/" + res.id + "/cancelar", 200, {});
  await probar("ocupada", "POST", "/api/reservas", 409, { cabina: "CAB-001", fecha: "2026-12-12", horas: 2, cliente: "Otro", telefono: "51999000010" });

  console.log("\n" + ok + " correctas, " + mal + " con falla. Compra de prueba: " + (c ? c.id : "-"));
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error("No se pudo validar:", e.message); process.exit(1); });
