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

fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
fs.writeFileSync(path.join(dir, "openapi.json"), JSON.stringify(openapi(), null, 2), "utf8");
fs.writeFileSync(path.join(dir, ".nojekyll"), "", "utf8");
const pdf = path.join(__dirname, "Documentacion-API-prueba.pdf");
if (fs.existsSync(pdf)) fs.copyFileSync(pdf, path.join(dir, "Documentacion-API-prueba.pdf"));
console.log("Listo:", fs.readdirSync(dir).join(", "));
