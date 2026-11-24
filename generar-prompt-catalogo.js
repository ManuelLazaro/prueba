// Arma el texto para traer solo el catálogo. Uso: node generar-prompt-catalogo.js
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const clave = fs.readFileSync(path.join(__dirname, ".env"), "utf8").match(/API_KEY=(.+)/)[1].trim();
  const j = await (await fetch("http://127.0.0.1:4040/api/tunnels")).json();
  const base = j.tunnels.find((t) => t.public_url.startsWith("https")).public_url;
  const texto = `Trae el catálogo de productos de mi tienda desde una API externa y guárdalo en una tabla.

CONEXIÓN
- URL base: ${base}
- En todas las llamadas envía estos encabezados:
  X-API-Key: ${clave}
  ngrok-skip-browser-warning: 1

QUÉ LLAMAR
- GET /api/productos?limite=100
- La respuesta es JSON con: total, pagina, limite, paginas y datos.
- Si "paginas" es mayor que 1, repite la llamada con pagina=2, pagina=3, etc., hasta traer todos.

QUÉ TRAE CADA PRODUCTO (dentro de "datos")
- sku: código único del producto
- nombre
- categoria: Mochilas, Maletas o Accesorios
- marca
- precio: en soles (PEN), con IGV incluido
- costo
- stock: unidades disponibles
- stockMinimo
- moneda
- activo

QUÉ HACER CON LOS DATOS
1. Guarda los productos en una tabla llamada catalogo_api, una fila por producto, usando sku como identificador. Si el sku ya existe, actualiza la fila en lugar de duplicarla.
2. Avísame en la campana cuántos productos se trajeron y cuántos tienen stock 0.
3. Si la llamada falla, avísame el código de respuesta y el mensaje de error tal cual llegó.

Resultado esperado si todo está bien: 12 productos, 1 con stock 0 (ACC-002).
`;
  fs.writeFileSync(path.join(__dirname, "PROMPT-CATALOGO.txt"), texto, "utf8");
  console.log("Escrito PROMPT-CATALOGO.txt (" + texto.length + " caracteres). URL:", base);
})().catch((e) => { console.error("No se pudo generar:", e.message); process.exit(1); });
