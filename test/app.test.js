const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

const KEY = "clave-de-prueba";
const nuevaApp = () => createApp({ apiKey: KEY });
const conClave = { "x-api-key": KEY };
const get = (app, path, query = {}, headers = conClave) => app.route({ method: "GET", path, query, headers });
const post = (app, path, body, headers = conClave) => app.route({ method: "POST", path, query: {}, headers, body });

test("salud responde sin clave", () => {
  const r = get(nuevaApp(), "/health", {}, {});
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, "ok");
});

test("sin clave la API responde 401 con un mensaje claro", () => {
  const r = get(nuevaApp(), "/api/cabinas", {}, {});
  assert.equal(r.status, 401);
  assert.match(r.body.error, /X-API-Key/);
});

test("con clave equivocada responde 401", () => {
  const r = get(nuevaApp(), "/api/cabinas", {}, { "x-api-key": "otra" });
  assert.equal(r.status, 401);
});

test("la clave también se acepta como Authorization Bearer", () => {
  const r = get(nuevaApp(), "/api/cabinas", {}, { authorization: "Bearer " + KEY });
  assert.equal(r.status, 200);
});

test("lista las cabinas con precio en soles", () => {
  const r = get(nuevaApp(), "/api/cabinas");
  assert.equal(r.status, 200);
  assert.equal(r.body.total, r.body.datos.length);
  assert.ok(r.body.total >= 3);
  const c = r.body.datos.find((x) => x.codigo === "CAB-001");
  assert.equal(c.moneda, "PEN");
  assert.equal(typeof c.precio, "number");
});

test("filtra las cabinas por tipo", () => {
  const r = get(nuevaApp(), "/api/cabinas", { tipo: "Paquete" });
  assert.ok(r.body.total >= 1);
  assert.ok(r.body.datos.every((x) => x.tipo === "Paquete"));
});

test("trae una cabina por código", () => {
  const r = get(nuevaApp(), "/api/cabinas/CAB-002");
  assert.equal(r.status, 200);
  assert.equal(r.body.codigo, "CAB-002");
});

test("cabina que no existe responde 404", () => {
  const r = get(nuevaApp(), "/api/cabinas/NO-EXISTE");
  assert.equal(r.status, 404);
  assert.match(r.body.error, /NO-EXISTE/);
});

test("disponibilidad exige la fecha en formato AAAA-MM-DD", () => {
  assert.equal(get(nuevaApp(), "/api/disponibilidad").status, 400);
  assert.equal(get(nuevaApp(), "/api/disponibilidad", { fecha: "12/12/2026" }).status, 400);
});

test("una reserva confirmada ocupa la cabina solo ese día", () => {
  const app = nuevaApp();
  const ocupado = get(app, "/api/disponibilidad", { fecha: "2026-12-12" });
  assert.equal(ocupado.status, 200);
  const cab = ocupado.body.cabinas.find((x) => x.codigo === "CAB-001");
  assert.equal(cab.disponible, false);
  assert.equal(cab.reserva, "RES-1001");
  const otroDia = get(app, "/api/disponibilidad", { fecha: "2026-12-13" });
  assert.equal(otroDia.body.cabinas.find((x) => x.codigo === "CAB-001").disponible, true);
});

test("una reserva pendiente o cancelada no ocupa la cabina", () => {
  const r = get(nuevaApp(), "/api/disponibilidad", { fecha: "2026-12-19" });
  assert.equal(r.body.cabinas.find((x) => x.codigo === "CAB-002").disponible, true);
  assert.equal(r.body.cabinas.find((x) => x.codigo === "CAB-003").disponible, true);
});

test("disponibilidad de una sola cabina", () => {
  const r = get(nuevaApp(), "/api/disponibilidad", { fecha: "2026-12-12", cabina: "CAB-001" });
  assert.equal(r.body.cabinas.length, 1);
  assert.equal(r.body.cabinas[0].disponible, false);
});

test("lista reservas y filtra por estado y por teléfono", () => {
  const app = nuevaApp();
  const todas = get(app, "/api/reservas");
  assert.ok(todas.body.total >= 4);
  const conf = get(app, "/api/reservas", { estado: "Confirmada" });
  assert.ok(conf.body.datos.every((x) => x.estado === "Confirmada"));
  const tel = get(app, "/api/reservas", { telefono: "51999000001" });
  assert.ok(tel.body.total >= 1);
  assert.ok(tel.body.datos.every((x) => x.telefono === "51999000001"));
});

test("crea una reserva pendiente y calcula el adelanto del 50 %", () => {
  const app = nuevaApp();
  const r = post(app, "/api/reservas", { cabina: "CAB-002", fecha: "2026-12-20", horas: 2, cliente: "Cliente Prueba", telefono: "51999000009", lugar: "Surco" });
  assert.equal(r.status, 201);
  assert.equal(r.body.estado, "Pendiente");
  assert.equal(r.body.total, 750);
  assert.equal(r.body.adelanto, 375);
  assert.match(r.body.id, /^RES-\d+$/);
  assert.equal(get(app, "/api/reservas/" + r.body.id).status, 200);
});

test("no deja reservar una cabina ocupada ese día", () => {
  const r = post(nuevaApp(), "/api/reservas", { cabina: "CAB-001", fecha: "2026-12-12", horas: 2, cliente: "Otro", telefono: "51999000010" });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /no está disponible/);
});

test("crear reserva valida los campos obligatorios", () => {
  const r = post(nuevaApp(), "/api/reservas", { cabina: "CAB-001" });
  assert.equal(r.status, 400);
  assert.ok(r.body.faltan.includes("fecha"));
  assert.ok(r.body.faltan.includes("telefono"));
});

test("confirmar una reserva pendiente la vuelve Confirmada y ocupa la fecha", () => {
  const app = nuevaApp();
  const r = post(app, "/api/reservas/RES-1002/confirmar", {});
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, "Confirmada");
  const d = get(app, "/api/disponibilidad", { fecha: r.body.fecha, cabina: r.body.cabina });
  assert.equal(d.body.cabinas[0].disponible, false);
});

test("cancelar una reserva libera la fecha", () => {
  const app = nuevaApp();
  const r = post(app, "/api/reservas/RES-1001/cancelar", {});
  assert.equal(r.body.estado, "Cancelada");
  const d = get(app, "/api/disponibilidad", { fecha: "2026-12-12", cabina: "CAB-001" });
  assert.equal(d.body.cabinas[0].disponible, true);
});

test("busca un cliente por teléfono", () => {
  const app = nuevaApp();
  assert.equal(get(app, "/api/clientes", { telefono: "51999000001" }).body.datos[0].nombre, "María Quispe");
  assert.equal(get(app, "/api/clientes/51999000001").status, 200);
  assert.equal(get(app, "/api/clientes/51000000000").status, 404);
});

test("la documentación y el OpenAPI se sirven sin clave", () => {
  const app = nuevaApp();
  const doc = get(app, "/docs", {}, {});
  assert.equal(doc.status, 200);
  assert.match(doc.type, /html/);
  const spec = get(app, "/openapi.json", {}, {});
  assert.equal(spec.body.openapi.slice(0, 2), "3.");
  assert.ok(spec.body.paths["/api/disponibilidad"]);
});

test("una ruta que no existe responde 404 y un método no permitido 405", () => {
  const app = nuevaApp();
  assert.equal(get(app, "/api/nada").status, 404);
  assert.equal(app.route({ method: "DELETE", path: "/api/cabinas", query: {}, headers: conClave }).status, 405);
});

test("en modo abierto la API responde sin clave", () => {
  const app = createApp({ apiKey: KEY, abierto: true });
  assert.equal(get(app, "/api/cabinas", {}, {}).status, 200);
  assert.equal(get(app, "/api/productos", {}, {}).status, 200);
});
