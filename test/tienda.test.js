const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

const KEY = "clave-de-prueba";
const H = { "x-api-key": KEY };
const nuevaApp = () => createApp({ apiKey: KEY });
const get = (app, path, query = {}) => app.route({ method: "GET", path, query, headers: H });
const post = (app, path, body) => app.route({ method: "POST", path, query: {}, headers: H, body });
const stock = (app, sku) => get(app, "/api/productos/" + sku).body.stock;

test("lista productos con paginación", () => {
  const r = get(nuevaApp(), "/api/productos", { limite: "5", pagina: "2" });
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 12);
  assert.equal(r.body.pagina, 2);
  assert.equal(r.body.limite, 5);
  assert.equal(r.body.datos.length, 5);
  assert.equal(r.body.paginas, 3);
});

test("filtra productos por categoría, por texto y por stock bajo", () => {
  const app = nuevaApp();
  const cat = get(app, "/api/productos", { categoria: "Maletas" });
  assert.ok(cat.body.total >= 3);
  assert.ok(cat.body.datos.every((p) => p.categoria === "Maletas"));
  const q = get(app, "/api/productos", { q: "trekking" });
  assert.equal(q.body.datos[0].sku, "MOC-005");
  const bajo = get(app, "/api/productos", { bajo_stock: "1" });
  assert.deepEqual(bajo.body.datos.map((p) => p.sku).sort(), ["ACC-002", "MAL-003", "MOC-005"]);
});

test("trae un producto por SKU con precio, costo y stock", () => {
  const app = nuevaApp();
  const p = get(app, "/api/productos/MOC-001").body;
  assert.equal(p.moneda, "PEN");
  assert.equal(typeof p.precio, "number");
  assert.equal(typeof p.costo, "number");
  assert.equal(typeof p.stock, "number");
  assert.equal(get(app, "/api/productos/NO-HAY").status, 404);
});

test("lista categorías con su cantidad de productos", () => {
  const r = get(nuevaApp(), "/api/categorias");
  const moc = r.body.datos.find((c) => c.nombre === "Mochilas");
  assert.equal(moc.productos, 5);
});

test("lista proveedores y trae uno por id", () => {
  const app = nuevaApp();
  assert.ok(get(app, "/api/proveedores").body.total >= 3);
  assert.equal(get(app, "/api/proveedores/PRV-01").body.id, "PRV-01");
});

test("lista ventas y filtra por estado y por rango de fechas", () => {
  const app = nuevaApp();
  assert.ok(get(app, "/api/ventas").body.total >= 8);
  const pag = get(app, "/api/ventas", { estado: "Pagada" });
  assert.ok(pag.body.total >= 1);
  assert.ok(pag.body.datos.every((v) => v.estado === "Pagada"));
  const rango = get(app, "/api/ventas", { desde: "2026-11-10", hasta: "2026-11-15" });
  assert.ok(rango.body.total >= 1);
  assert.ok(rango.body.datos.every((v) => v.fecha >= "2026-11-10" && v.fecha <= "2026-11-15"));
});

test("una venta trae sus ítems y los totales cuadran con el IGV", () => {
  const v = get(nuevaApp(), "/api/ventas/VEN-2001").body;
  assert.ok(v.items.length >= 1);
  assert.ok(v.items[0].nombre);
  const suma = v.items.reduce((a, i) => a + i.subtotal, 0);
  assert.equal(Math.round(suma * 100), Math.round(v.total * 100));
  assert.equal(Math.round((v.subtotal + v.igv) * 100), Math.round(v.total * 100));
});

test("registrar una venta descuenta el stock y deja un movimiento de salida", () => {
  const app = nuevaApp();
  const antes = stock(app, "MOC-001");
  const r = post(app, "/api/ventas", { telefono: "51999000001", cliente: "María Quispe", metodoPago: "Yape", items: [{ sku: "MOC-001", cantidad: 2 }, { sku: "ACC-001", cantidad: 1 }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.estado, "Pendiente");
  assert.equal(Math.round(r.body.total * 100), Math.round((129.9 * 2 + 29.9) * 100));
  assert.equal(stock(app, "MOC-001"), antes - 2);
  const mov = get(app, "/api/inventario/movimientos", { sku: "MOC-001", tipo: "Salida" });
  assert.ok(mov.body.datos.some((m) => m.referencia === r.body.id && m.cantidad === 2));
});

test("no vende más de lo que hay en stock", () => {
  const app = nuevaApp();
  const r = post(app, "/api/ventas", { telefono: "51999000001", cliente: "María", items: [{ sku: "ACC-002", cantidad: 1 }] });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /stock/i);
});

test("registrar venta valida campos y productos", () => {
  const app = nuevaApp();
  assert.equal(post(app, "/api/ventas", { cliente: "X" }).status, 400);
  assert.equal(post(app, "/api/ventas", { telefono: "51", cliente: "X", items: [{ sku: "NO-HAY", cantidad: 1 }] }).status, 404);
});

test("pagar una venta la deja Pagada y registra el pago", () => {
  const app = nuevaApp();
  const v = post(app, "/api/ventas", { telefono: "51999000002", cliente: "Jorge Ramos", items: [{ sku: "ACC-003", cantidad: 1 }] }).body;
  const r = post(app, "/api/ventas/" + v.id + "/pagar", { metodo: "Yape" });
  assert.equal(r.body.estado, "Pagada");
  const pagos = get(app, "/api/pagos", { venta: v.id });
  assert.equal(pagos.body.total, 1);
  assert.equal(pagos.body.datos[0].monto, v.total);
});

test("anular una venta devuelve el stock", () => {
  const app = nuevaApp();
  const antes = stock(app, "MAL-001");
  const v = post(app, "/api/ventas", { telefono: "51999000003", cliente: "Lucía Torres", items: [{ sku: "MAL-001", cantidad: 3 }] }).body;
  assert.equal(stock(app, "MAL-001"), antes - 3);
  assert.equal(post(app, "/api/ventas/" + v.id + "/anular", {}).body.estado, "Anulada");
  assert.equal(stock(app, "MAL-001"), antes);
});

test("lista compras y trae una con sus ítems", () => {
  const app = nuevaApp();
  assert.ok(get(app, "/api/compras").body.total >= 4);
  const c = get(app, "/api/compras/COM-3001").body;
  assert.ok(c.items.length >= 1);
  assert.ok(c.proveedorNombre);
});

test("registrar una compra aumenta el stock y deja un movimiento de entrada", () => {
  const app = nuevaApp();
  const antes = stock(app, "MAL-003");
  const r = post(app, "/api/compras", { proveedor: "PRV-02", items: [{ sku: "MAL-003", cantidad: 10, costoUnitario: 195 }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 1950);
  assert.equal(stock(app, "MAL-003"), antes + 10);
  const mov = get(app, "/api/inventario/movimientos", { sku: "MAL-003", tipo: "Entrada" });
  assert.ok(mov.body.datos.some((m) => m.referencia === r.body.id));
});

test("el resumen suma ventas, compras y stock bajo", () => {
  const app = nuevaApp();
  const r = get(app, "/api/reportes/resumen").body;
  const ventas = get(app, "/api/ventas", { limite: "100" }).body.datos.filter((v) => v.estado !== "Anulada");
  const ingresos = ventas.reduce((a, v) => a + v.total, 0);
  assert.equal(r.ventas.cantidad, ventas.length);
  assert.equal(Math.round(r.ventas.ingresos * 100), Math.round(ingresos * 100));
  assert.equal(r.inventario.bajoStock, 3);
  assert.ok(r.compras.total > 0);
  assert.ok(r.masVendidos.length >= 3);
  assert.ok(r.masVendidos[0].unidades >= r.masVendidos[1].unidades);
});

test("las ventas de un cliente se consultan por teléfono", () => {
  const r = get(nuevaApp(), "/api/ventas", { telefono: "51999000001" });
  assert.ok(r.body.total >= 2);
  assert.ok(r.body.datos.every((v) => v.telefono === "51999000001"));
});

const put = (app, path, body) => app.route({ method: "PUT", path, query: {}, headers: H, body });
const del = (app, path) => app.route({ method: "DELETE", path, query: {}, headers: H });
const NUEVO = { sku: "MOC-010", nombre: "Mochila de cuero sintético", categoria: "Mochilas", marca: "Qori", precio: 139.9, costo: 75, stock: 14, stockMinimo: 4 };

test("agrega un producto y queda disponible para consultar y vender", () => {
  const app = nuevaApp();
  const r = post(app, "/api/productos", NUEVO);
  assert.equal(r.status, 201);
  assert.equal(r.body.sku, "MOC-010");
  assert.equal(r.body.moneda, "PEN");
  assert.equal(r.body.activo, true);
  assert.equal(get(app, "/api/productos").body.total, 13);
  assert.equal(get(app, "/api/productos/MOC-010").body.precio, 139.9);
  assert.equal(post(app, "/api/ventas", { telefono: "51999000001", cliente: "María", items: [{ sku: "MOC-010", cantidad: 1 }] }).status, 201);
});

test("agregar un producto con lo mínimo pone stock 0 y costo 0", () => {
  const r = post(nuevaApp(), "/api/productos", { sku: "ACC-010", nombre: "Correa para maleta", categoria: "Accesorios", precio: 19.9 });
  assert.equal(r.status, 201);
  assert.equal(r.body.stock, 0);
  assert.equal(r.body.costo, 0);
});

test("no agrega un producto con SKU repetido", () => {
  const r = post(nuevaApp(), "/api/productos", Object.assign({}, NUEVO, { sku: "MOC-001" }));
  assert.equal(r.status, 409);
  assert.match(r.body.error, /MOC-001/);
});

test("agregar producto valida campos obligatorios y números", () => {
  const app = nuevaApp();
  const falta = post(app, "/api/productos", { sku: "X-1" });
  assert.equal(falta.status, 400);
  assert.deepEqual(falta.body.faltan.sort(), ["categoria", "nombre", "precio"]);
  assert.equal(post(app, "/api/productos", Object.assign({}, NUEVO, { precio: "caro" })).status, 400);
  assert.equal(post(app, "/api/productos", Object.assign({}, NUEVO, { precio: -5 })).status, 400);
  assert.equal(post(app, "/api/productos", Object.assign({}, NUEVO, { stock: -1 })).status, 400);
});

test("edita solo los campos enviados de un producto", () => {
  const app = nuevaApp();
  const r = put(app, "/api/productos/MOC-001", { precio: 149.9, stock: 30 });
  assert.equal(r.status, 200);
  assert.equal(r.body.precio, 149.9);
  assert.equal(r.body.stock, 30);
  assert.equal(r.body.nombre, "Mochila urbana para laptop 15.6\"");
  assert.equal(put(app, "/api/productos/NO-HAY", { precio: 10 }).status, 404);
  assert.equal(put(app, "/api/productos/MOC-001", { precio: -1 }).status, 400);
  assert.equal(put(app, "/api/productos/MOC-001", { sku: "OTRO" }).status, 400);
});

test("borra un producto sin movimientos y no deja borrar uno con ventas", () => {
  const app = nuevaApp();
  post(app, "/api/productos", NUEVO);
  assert.equal(del(app, "/api/productos/MOC-010").status, 200);
  assert.equal(get(app, "/api/productos/MOC-010").status, 404);
  const r = del(app, "/api/productos/MOC-001");
  assert.equal(r.status, 409);
  assert.match(r.body.error, /activo/);
  assert.equal(del(app, "/api/productos/NO-HAY").status, 404);
});
