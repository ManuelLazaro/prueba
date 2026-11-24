// Genera la documentación como archivos fijos en la carpeta docs/, lista para GitHub Pages
// o cualquier alojamiento de HTML. Uso: node generar-docs-estaticos.js
const fs = require("node:fs");
const path = require("node:path");
const { openapi, paginaDocs } = require("./src/docs");

const dir = path.join(__dirname, "docs");
fs.mkdirSync(dir, { recursive: true });

// En un alojamiento estático los enlaces deben ser relativos, no desde la raíz del servidor
const html = paginaDocs()
  .replaceAll('href="/openapi.json"', 'href="openapi.json"')
  .replaceAll(">/openapi.json<", ">openapi.json<")
  .replaceAll('href="/documentacion.pdf"', 'href="Documentacion-API-prueba.pdf"')
  .replaceAll(">/documentacion.pdf<", ">Documentacion-API-prueba.pdf<");

// ----- Datos de solo lectura: cada consulta queda como un archivo JSON fijo en docs/api/ -----
const { createApp } = require("./src/app");
const app = createApp({ apiKey: "sin-uso", abierto: true });
const pedir = (ruta, query = {}) => app.route({ method: "GET", path: ruta, query, headers: {} }).body;
const escritos = [];
function guardar(rel, datos) {
  const destino = path.join(dir, "api", rel + ".json");
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(datos, null, 2), "utf8");
  escritos.push("api/" + rel + ".json");
}
// [lista, campo que identifica a cada elemento o null si no tiene detalle]
const LISTAS = [["productos", "sku"], ["categorias", null], ["ventas", "id"], ["compras", "id"], ["proveedores", "id"], ["pagos", null], ["cabinas", "codigo"], ["reservas", "id"], ["clientes", "telefono"]];
for (const [nombre, clave] of LISTAS) {
  const lista = pedir("/api/" + nombre, { limite: "100" });
  guardar(nombre, lista);
  if (clave) for (const x of lista.datos) guardar(nombre + "/" + x[clave], pedir("/api/" + nombre + "/" + x[clave]));
}
guardar("inventario/movimientos", pedir("/api/inventario/movimientos", { limite: "100" }));
guardar("reportes/resumen", pedir("/api/reportes/resumen"));
guardar("productos-bajo-stock", pedir("/api/productos", { bajo_stock: "1" }));
for (const fecha of ["2026-12-05", "2026-12-12", "2026-12-13", "2026-12-19", "2026-12-26"]) guardar("disponibilidad/" + fecha, pedir("/api/disponibilidad", { fecha }));

const principales = ["productos", "productos/MOC-001", "productos-bajo-stock", "categorias", "ventas", "ventas/VEN-2001", "compras", "compras/COM-3001", "proveedores", "pagos", "inventario/movimientos", "reportes/resumen", "cabinas", "reservas", "clientes", "disponibilidad/2026-12-12"];
const bloque = `<h2>Datos de prueba en archivos fijos (solo lectura)</h2>
<p>Estos archivos JSON se pueden leer directo, sin clave y sin que el servidor esté corriendo. Son una copia de los datos iniciales: no aceptan filtros en la dirección ni permiten escribir. Para token, filtros y escritura hace falta la API en funcionamiento.</p>
<ul>${principales.map((r) => `<li><a href="api/${r}.json"><code>api/${r}.json</code></a></li>`).join("")}</ul>
<p>Cada producto, venta, compra, proveedor, cabina, reserva y cliente tiene además su propio archivo, por ejemplo <code>api/productos/MAL-001.json</code>.</p>
<h2>Rutas de la API en funcionamiento</h2>`;
const htmlFinal = html.replace("<h2>Cómo autenticarse</h2>", bloque + "<h2>Cómo autenticarse</h2>");
fs.writeFileSync(path.join(dir, "index.html"), htmlFinal, "utf8");
fs.writeFileSync(path.join(dir, "openapi.json"), JSON.stringify(openapi(), null, 2), "utf8");
fs.writeFileSync(path.join(dir, ".nojekyll"), "", "utf8");
const pdf = path.join(__dirname, "Documentacion-API-prueba.pdf");
if (fs.existsSync(pdf)) fs.copyFileSync(pdf, path.join(dir, "Documentacion-API-prueba.pdf"));
console.log("Listo:", fs.readdirSync(dir).join(", "), "y", escritos.length, "archivos de datos");
