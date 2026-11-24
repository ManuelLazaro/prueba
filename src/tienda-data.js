// Datos inventados de una tienda de mochilas y maletas: productos, proveedores, ventas, compras, pagos e inventario.
const IGV = 0.18;
const r2 = (n) => Math.round(n * 100) / 100;

const PRODUCTOS = [
  ["MOC-001", "Mochila urbana para laptop 15.6\"", "Mochilas", "Qori", 129.9, 70, 24, 5],
  ["MOC-002", "Mochila escolar reforzada", "Mochilas", "Qori", 79.9, 40, 40, 8],
  ["MOC-004", "Mochila de viaje 40 L", "Mochilas", "Andes Trek", 189.9, 105, 12, 4],
  ["MOC-005", "Mochila de trekking 50 L", "Mochilas", "Andes Trek", 259.9, 150, 3, 5],
  ["MOC-006", "Mochila ejecutiva antirrobo", "Mochilas", "Qori", 159.9, 88, 18, 5],
  ["MAL-001", "Maleta de cabina 20\" rígida", "Maletas", "Andes Trek", 219.9, 120, 20, 5],
  ["MAL-002", "Maleta mediana 24\" rígida", "Maletas", "Andes Trek", 279.9, 160, 16, 4],
  ["MAL-003", "Maleta grande 28\" rígida", "Maletas", "Andes Trek", 339.9, 200, 2, 4],
  ["MAL-009", "Juego de 3 maletas rígidas", "Maletas", "Andes Trek", 749.9, 450, 8, 2],
  ["ACC-001", "Candado TSA de combinación", "Accesorios", "Misti", 29.9, 12, 60, 10],
  ["ACC-002", "Etiqueta de equipaje", "Accesorios", "Misti", 14.9, 5, 0, 10],
  ["ACC-003", "Funda impermeable para mochila", "Accesorios", "Misti", 39.9, 18, 35, 8],
].map(([sku, nombre, categoria, marca, precio, costo, stock, stockMinimo]) => ({ sku, nombre, categoria, marca, precio, costo, stock, stockMinimo, moneda: "PEN", activo: true }));

const PROVEEDORES = [
  { id: "PRV-01", nombre: "Importaciones Qori S.A.C.", ruc: "20600000011", contacto: "Rosa Paredes", telefono: "51988000011", ciudad: "Lima" },
  { id: "PRV-02", nombre: "Andes Trek Distribución E.I.R.L.", ruc: "20600000022", contacto: "Miguel Salas", telefono: "51988000022", ciudad: "Arequipa" },
  { id: "PRV-03", nombre: "Accesorios Misti S.R.L.", ruc: "20600000033", contacto: "Elena Cruz", telefono: "51988000033", ciudad: "Lima" },
];

// id, fecha, teléfono, cliente, canal, estado, método de pago, entrega, ítems [sku, cantidad]
const VENTAS = [
  ["VEN-2001", "2026-11-03", "51999000001", "María Quispe", "WhatsApp", "Entregada", "Yape", "Envío a domicilio", [["MOC-001", 1], ["ACC-001", 2]]],
  ["VEN-2002", "2026-11-05", "51999000002", "Jorge Ramos", "Tienda", "Entregada", "Tarjeta", "Recojo en tienda", [["MAL-001", 2]]],
  ["VEN-2003", "2026-11-09", "51999000003", "Lucía Torres", "WhatsApp", "Pagada", "Transferencia", "Envío a domicilio", [["MAL-009", 1], ["ACC-001", 3]]],
  ["VEN-2004", "2026-11-12", "51999000001", "María Quispe", "WhatsApp", "Pagada", "Yape", "Recojo en tienda", [["MOC-002", 3]]],
  ["VEN-2005", "2026-11-14", "51999000004", "Carlos Huamán", "Instagram", "Anulada", "Yape", "Envío a domicilio", [["MOC-005", 1]]],
  ["VEN-2006", "2026-11-18", "51999000002", "Jorge Ramos", "WhatsApp", "Pendiente", "ContraEntrega", "Envío a domicilio", [["MOC-006", 1], ["ACC-003", 1]]],
  ["VEN-2007", "2026-11-20", "51999000003", "Lucía Torres", "Tienda", "Entregada", "Efectivo", "Recojo en tienda", [["MAL-002", 1], ["MOC-001", 1]]],
  ["VEN-2008", "2026-11-22", "51999000004", "Carlos Huamán", "WhatsApp", "Pagada", "Yape", "Envío a domicilio", [["MOC-004", 2], ["ACC-003", 2]]],
  ["VEN-2009", "2026-11-23", "51999000001", "María Quispe", "WhatsApp", "Pendiente", "Yape", "Envío a domicilio", [["MAL-001", 1]]],
];

// id, fecha, proveedor, estado, ítems [sku, cantidad, costo unitario]
const COMPRAS = [
  ["COM-3001", "2026-10-28", "PRV-01", "Recibida", [["MOC-001", 30, 70], ["MOC-002", 50, 40], ["MOC-006", 20, 88]]],
  ["COM-3002", "2026-10-30", "PRV-02", "Recibida", [["MAL-001", 25, 120], ["MAL-002", 18, 160], ["MAL-009", 10, 450]]],
  ["COM-3003", "2026-11-06", "PRV-03", "Recibida", [["ACC-001", 80, 12], ["ACC-003", 40, 18]]],
  ["COM-3004", "2026-11-21", "PRV-02", "Pendiente", [["MAL-003", 12, 200], ["MOC-005", 10, 150]]],
];

function armarVenta(precioDe, nombreDe, [id, fecha, telefono, cliente, canal, estado, metodoPago, entrega, items]) {
  const lineas = items.map(([sku, cantidad]) => ({ sku, nombre: nombreDe(sku), cantidad, precioUnitario: precioDe(sku), subtotal: r2(precioDe(sku) * cantidad) }));
  const total = r2(lineas.reduce((a, l) => a + l.subtotal, 0));
  const subtotal = r2(total / (1 + IGV));
  return { id, fecha, telefono, cliente, canal, estado, metodoPago, entrega, items: lineas, subtotal, igv: r2(total - subtotal), total, moneda: "PEN" };
}

function semillaTienda() {
  const productos = PRODUCTOS.map((p) => Object.assign({}, p));
  const por = (sku) => productos.find((p) => p.sku === sku);
  const proveedores = PROVEEDORES.map((p) => Object.assign({}, p));
  const ventas = VENTAS.map((v) => armarVenta((s) => por(s).precio, (s) => por(s).nombre, v));
  const compras = COMPRAS.map(([id, fecha, proveedor, estado, items]) => {
    const lineas = items.map(([sku, cantidad, costoUnitario]) => ({ sku, nombre: por(sku).nombre, cantidad, costoUnitario, subtotal: r2(cantidad * costoUnitario) }));
    return { id, fecha, proveedor, proveedorNombre: proveedores.find((p) => p.id === proveedor).nombre, estado, items: lineas, total: r2(lineas.reduce((a, l) => a + l.subtotal, 0)), moneda: "PEN" };
  });
  const movimientos = [];
  let n = 1;
  const mov = (fecha, sku, tipo, cantidad, referencia) => movimientos.push({ id: "MOV-" + String(n++).padStart(4, "0"), fecha, sku, tipo, cantidad, referencia });
  compras.filter((c) => c.estado === "Recibida").forEach((c) => c.items.forEach((i) => mov(c.fecha, i.sku, "Entrada", i.cantidad, c.id)));
  ventas.filter((v) => v.estado !== "Anulada").forEach((v) => v.items.forEach((i) => mov(v.fecha, i.sku, "Salida", i.cantidad, v.id)));
  const pagos = ventas.filter((v) => ["Pagada", "Entregada"].includes(v.estado)).map((v, i) => ({ id: "PAG-" + (4001 + i), venta: v.id, fecha: v.fecha, monto: v.total, metodo: v.metodoPago, estado: "Aprobado", moneda: "PEN" }));
  return { productos, proveedores, ventas, compras, movimientos, pagos };
}

module.exports = { semillaTienda, IGV, r2 };
