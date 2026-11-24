// Una sola lista de rutas: de aquí salen el enrutador, la página /docs y el OpenAPI.
const ENDPOINTS = [
  { metodo: "GET", ruta: "/api/cabinas", patron: /^\/api\/cabinas$/, resumen: "Lista las cabinas y paquetes.", params: [["tipo", "query", "Opcional. Cabina o Paquete."]], ejemplo: "/api/cabinas?tipo=Paquete" },
  { metodo: "GET", ruta: "/api/cabinas/{codigo}", patron: /^\/api\/cabinas\/[^/]+$/, resumen: "Trae una cabina por su código.", params: [["codigo", "path", "Por ejemplo CAB-001."]], ejemplo: "/api/cabinas/CAB-001" },
  { metodo: "GET", ruta: "/api/disponibilidad", patron: /^\/api\/disponibilidad$/, resumen: "Dice qué cabinas están libres en una fecha.", params: [["fecha", "query", "Obligatorio. Formato AAAA-MM-DD."], ["cabina", "query", "Opcional. Código de una sola cabina."]], ejemplo: "/api/disponibilidad?fecha=2026-12-12&cabina=CAB-001" },
  { metodo: "GET", ruta: "/api/reservas", patron: /^\/api\/reservas$/, resumen: "Lista las reservas.", params: [["estado", "query", "Opcional. Pendiente, Confirmada, ContraEntrega o Cancelada."], ["telefono", "query", "Opcional. Teléfono del cliente."], ["fecha", "query", "Opcional. AAAA-MM-DD."]], ejemplo: "/api/reservas?estado=Confirmada" },
  { metodo: "POST", ruta: "/api/reservas", patron: /^\/api\/reservas$/, resumen: "Crea una reserva en estado Pendiente y calcula el adelanto del 50 %.", params: [], cuerpo: { cabina: "CAB-002", fecha: "2026-12-20", horas: 2, cliente: "Cliente Prueba", telefono: "51999000009", lugar: "Surco" }, ejemplo: "/api/reservas" },
  { metodo: "GET", ruta: "/api/reservas/{id}", patron: /^\/api\/reservas\/[^/]+$/, resumen: "Trae una reserva por su id.", params: [["id", "path", "Por ejemplo RES-1001."]], ejemplo: "/api/reservas/RES-1001" },
  { metodo: "POST", ruta: "/api/reservas/{id}/confirmar", patron: /^\/api\/reservas\/[^/]+\/confirmar$/, resumen: "Pasa la reserva a Confirmada. Desde ese momento la cabina queda ocupada ese día.", params: [["id", "path", "Id de la reserva."]], ejemplo: "/api/reservas/RES-1002/confirmar" },
  { metodo: "POST", ruta: "/api/reservas/{id}/cancelar", patron: /^\/api\/reservas\/[^/]+\/cancelar$/, resumen: "Pasa la reserva a Cancelada y libera la fecha.", params: [["id", "path", "Id de la reserva."]], ejemplo: "/api/reservas/RES-1001/cancelar" },
  { metodo: "GET", ruta: "/api/clientes", patron: /^\/api\/clientes$/, resumen: "Lista los clientes.", params: [["telefono", "query", "Opcional. Teléfono exacto, con 51 adelante."]], ejemplo: "/api/clientes?telefono=51999000001" },
  { metodo: "GET", ruta: "/api/clientes/{telefono}", patron: /^\/api\/clientes\/[^/]+$/, resumen: "Trae un cliente por su teléfono.", params: [["telefono", "path", "Por ejemplo 51999000001."]], ejemplo: "/api/clientes/51999000001" },
].concat(require("./rutas-tienda"));

function openapi() {
  const paths = {};
  for (const e of ENDPOINTS) {
    paths[e.ruta] = paths[e.ruta] || {};
    const op = {
      summary: e.resumen,
      security: [{ ApiKey: [] }],
      parameters: e.params.map(([name, donde, description]) => ({ name, in: donde, required: donde === "path" || /^Obligatorio/.test(description), description, schema: { type: "string" } })),
      responses: { 200: { description: "Correcto" }, 401: { description: "Falta la clave o no es válida" }, 404: { description: "No existe" } },
    };
    if (e.cuerpo) op.requestBody = { required: true, content: { "application/json": { example: e.cuerpo } } };
    paths[e.ruta][e.metodo.toLowerCase()] = op;
  }
  paths["/health"] = { get: { summary: "Comprueba que el servicio responde. No pide clave.", responses: { 200: { description: "Correcto" } } } };
  return {
    openapi: "3.0.3",
    info: { title: "API de prueba · Tienda y cabinas", version: "1.0.0", description: "Datos inventados para validar que un sistema externo puede consultar una API." },
    components: { securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "X-API-Key" } } },
    paths,
  };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function paginaDocs() {
  let grupo = "";
  const filas = ENDPOINTS.map((e) => `${(e.g || "Cabinas, reservas y clientes") !== grupo ? "<h2>" + (grupo = e.g || "Cabinas, reservas y clientes") + "</h2>" : ""}
  <section>
    <h3><span class="m ${e.metodo}">${e.metodo}</span> <code>${esc(e.ruta)}</code></h3>
    <p>${esc(e.resumen)}</p>
    ${e.params.length ? "<ul>" + e.params.map(([n, d, t]) => `<li><code>${n}</code> (${d === "path" ? "en la ruta" : "en la consulta"}): ${esc(t)}</li>`).join("") + "</ul>" : ""}
    ${e.cuerpo ? "<p>Cuerpo JSON de ejemplo:</p><pre>" + esc(JSON.stringify(e.cuerpo, null, 2)) + "</pre>" : ""}
    <p>Ejemplo: <code>${esc(e.ejemplo)}</code></p>
  </section>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>API de prueba · Tienda y cabinas</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:0 auto;padding:24px 16px;color:#1b2233;background:#fff}
h1{font-size:28px}h2{margin-top:32px;border-bottom:1px solid #d9dce6;padding-bottom:6px}h3{margin:24px 0 4px;font-size:17px}
code,pre{font-family:ui-monospace,Consolas,monospace;background:#f3f2ff;border-radius:4px}code{padding:1px 5px}pre{padding:12px;overflow:auto}
.m{font-size:12px;font-weight:700;color:#fff;border-radius:4px;padding:2px 8px}.GET{background:#1fa855}.POST{background:#6c63ff}.PUT{background:#b45309}.DELETE{background:#c62f3b}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #d9dce6;padding:6px 10px;text-align:left}
</style></head><body>
<h1>API de prueba · Tienda y cabinas</h1>
<p>Datos inventados para validar que un sistema externo puede consultar y escribir en una API. Los cambios viven en memoria: al reiniciar el servidor vuelven los datos iniciales.</p>
<h2>Cómo autenticarse</h2>
<p>Todas las rutas que empiezan con <code>/api/</code> piden la clave en el encabezado <code>X-API-Key</code>. También se acepta <code>Authorization: Bearer &lt;clave&gt;</code>. La clave está en el archivo <code>.env</code> del proyecto.</p>
<p>Sin clave responden <code>/health</code>, <code>/docs</code> y <code>/openapi.json</code>.</p>
<h2>Respuestas</h2>
<table><tr><th>Código</th><th>Significa</th></tr>
<tr><td>200 / 201</td><td>Correcto / reserva creada</td></tr>
<tr><td>400</td><td>Falta un dato o tiene mal formato</td></tr>
<tr><td>401</td><td>Falta la clave o no es válida</td></tr>
<tr><td>404</td><td>No existe la ruta, la cabina, la reserva o el cliente</td></tr>
<tr><td>405</td><td>Método no permitido en esa ruta</td></tr>
<tr><td>409</td><td>La cabina ya está ocupada ese día, o no hay stock suficiente</td></tr></table>
<p>Los errores siempre traen un campo <code>error</code> con el motivo. Las listas traen <code>total</code> y <code>datos</code>.</p>
<h2>Regla de disponibilidad</h2>
<p>Una cabina está ocupada en una fecha solo si tiene una reserva <strong>Confirmada</strong> o <strong>ContraEntrega</strong> para ese día. Las reservas Pendiente y Cancelada no la ocupan.</p>
<h2>Paginación</h2>
<p>Todas las listas aceptan <code>limite</code> (1 a 100, por defecto 50) y <code>pagina</code> (desde 1). La respuesta trae <code>total</code>, <code>pagina</code>, <code>limite</code>, <code>paginas</code> y <code>datos</code>.</p>
<h2>Reglas de la tienda</h2>
<ul><li>Los precios están en soles e incluyen IGV (18 %). Cada venta trae <code>subtotal</code>, <code>igv</code> y <code>total</code>.</li>
<li>Registrar una venta descuenta el stock; anularla lo devuelve. Registrar una compra lo aumenta.</li>
<li>No se puede vender más unidades de las que hay: responde 409.</li></ul>
${filas}
<h2>Descargas</h2><p>La especificación en JSON está en <a href="/openapi.json">/openapi.json</a> y esta documentación en PDF en <a href="/documentacion.pdf">/documentacion.pdf</a>. Ninguna de las dos pide clave.</p>
</body></html>`;
}

module.exports = { ENDPOINTS, openapi, paginaDocs };
