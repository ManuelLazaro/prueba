// Arma el texto completo para pegar en Automatizaciones de ECOMLAB, con la URL de ngrok y el token ya puestos.
// Uso: node generar-prompt.js   (con el servidor y ngrok levantados). Escribe PROMPT-AUTOMATIZACION.txt
const fs = require("node:fs");
const path = require("node:path");
const { ENDPOINTS } = require("./src/docs");

(async () => {
  const clave = fs.readFileSync(path.join(__dirname, ".env"), "utf8").match(/API_KEY=(.+)/)[1].trim();
  const j = await (await fetch("http://127.0.0.1:4040/api/tunnels")).json();
  const base = j.tunnels.find((t) => t.public_url.startsWith("https")).public_url;

  const rutas = ENDPOINTS.map((e) => {
    const filtros = e.params.filter((p) => p[1] === "query").map((p) => p[0]).join(", ");
    return "- " + e.metodo + " " + e.ruta + " — " + e.resumen + (filtros ? " Filtros: " + filtros + "." : "") + (e.cuerpo ? " Cuerpo JSON: " + JSON.stringify(e.cuerpo) : "");
  }).join("\n");

  const texto = `Conéctate a una API externa de prueba y úsala como fuente de datos de mi tienda.

CONEXIÓN
- URL base: ${base}
- En TODAS las llamadas envía estos encabezados:
  X-API-Key: ${clave}
  ngrok-skip-browser-warning: 1
  Content-Type: application/json
- La especificación completa está en ${base}/openapi.json (no pide clave).
- Todas las respuestas son JSON. Las listas traen: total, pagina, limite, paginas y datos. Aceptan los parámetros limite (1 a 100) y pagina.
- Los errores traen un campo "error" con el motivo. Códigos: 400 falta un dato, 401 clave inválida, 404 no existe, 409 sin stock o cabina ocupada.
- Las fechas van en formato AAAA-MM-DD. Los precios están en soles (PEN) e incluyen IGV.

RUTAS DISPONIBLES
${rutas}

LO QUE QUIERO QUE HAGAS AHORA (PRUEBA DE CONEXIÓN)
1. Llama a GET /api/reportes/resumen.
2. Llama a GET /api/productos?bajo_stock=1.
3. Avísame en la campana con este texto: cuántas ventas hay, cuánto suman los ingresos, cuántas compras hay y qué productos están con stock bajo (SKU y nombre).
4. Si alguna llamada falla, avísame el código de respuesta y el mensaje de error tal cual llegó.

Resultado esperado si todo está bien: 8 ventas por S/ 2997.90, 4 compras, y 3 productos con stock bajo (MOC-005, MAL-003 y ACC-002).
`;
  fs.writeFileSync(path.join(__dirname, "PROMPT-AUTOMATIZACION.txt"), texto, "utf8");
  console.log("Escrito PROMPT-AUTOMATIZACION.txt (" + texto.length + " caracteres, " + ENDPOINTS.length + " rutas). URL:", base);
})().catch((e) => { console.error("No se pudo generar:", e.message); process.exit(1); });
