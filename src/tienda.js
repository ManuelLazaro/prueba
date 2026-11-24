// Rutas de la tienda: productos, categorías, proveedores, ventas, compras, pagos, inventario y resumen.
const { semillaTienda, IGV, r2 } = require("./tienda-data");

const hoy = () => new Date().toISOString().slice(0, 10);

function crearTienda({ json, error, lista }) {
  const db = semillaTienda();
  const sig = { venta: 2010, compra: 3005, pago: 4001 + db.pagos.length, mov: db.movimientos.length + 1 };
  const producto = (sku) => db.productos.find((p) => p.sku === sku);
  const mover = (sku, tipo, cantidad, referencia) => db.movimientos.push({ id: "MOV-" + String(sig.mov++).padStart(4, "0"), fecha: hoy(), sku, tipo, cantidad, referencia });

  // Valida ítems [{sku, cantidad}] y devuelve un error o null
  function revisarItems(items) {
    if (!Array.isArray(items) || !items.length) return error(400, "Faltan campos obligatorios.", { faltan: ["items"] });
    for (const i of items) {
      if (!producto(i.sku)) return error(404, "No existe el producto " + i.sku + ".");
      if (!Number.isInteger(Number(i.cantidad)) || Number(i.cantidad) < 1) return error(400, "La cantidad de " + i.sku + " debe ser un entero mayor que cero.");
    }
    return null;
  }

  // Campos editables de un producto: texto o número (con su mínimo)
  const TEXTO = ["nombre", "categoria", "marca"];
  const NUMERO = { precio: 0.01, costo: 0, stock: 0, stockMinimo: 0 };

  // Devuelve { error } o { datos } con los campos ya convertidos
  function leerProducto(b) {
    const datos = {};
    for (const k of TEXTO) if (b[k] !== undefined) { if (!String(b[k]).trim()) return { error: error(400, "El campo " + k + " no puede estar vacío.") }; datos[k] = String(b[k]).trim(); }
    for (const k of Object.keys(NUMERO)) if (b[k] !== undefined) {
      const n = Number(b[k]);
      if (typeof b[k] === "boolean" || b[k] === "" || !Number.isFinite(n) || n < NUMERO[k]) return { error: error(400, "El campo " + k + " debe ser un número" + (NUMERO[k] > 0 ? " mayor que cero." : " igual o mayor que cero.")) };
      if ((k === "stock" || k === "stockMinimo") && !Number.isInteger(n)) return { error: error(400, "El campo " + k + " debe ser un número entero.") };
      datos[k] = n;
    }
    if (b.activo !== undefined) datos.activo = b.activo === true || b.activo === "true";
    return { datos };
  }

  function crearProducto(body) {
    const b = body || {};
    const faltan = ["sku", "nombre", "categoria", "precio"].filter((k) => b[k] === undefined || b[k] === "");
    if (faltan.length) return error(400, "Faltan campos obligatorios.", { faltan });
    const sku = String(b.sku).trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(sku)) return error(400, "El SKU solo puede tener letras, números y guiones, de 2 a 20 caracteres.");
    if (producto(sku)) return error(409, "Ya existe un producto con el SKU " + sku + ".");
    const r = leerProducto(b);
    if (r.error) return r.error;
    const p = Object.assign({ sku, nombre: "", categoria: "", marca: "", precio: 0, costo: 0, stock: 0, stockMinimo: 0, moneda: "PEN", activo: true }, r.datos);
    db.productos.push(p);
    if (p.stock > 0) mover(p.sku, "Entrada", p.stock, "Alta de producto");
    return json(201, p);
  }

  function editarProducto(sku, body) {
    const p = producto(sku);
    if (!p) return error(404, "No existe el producto " + sku + ".");
    const b = body || {};
    if (b.sku !== undefined && String(b.sku) !== p.sku) return error(400, "El SKU no se puede cambiar. Crea un producto nuevo.");
    const r = leerProducto(b);
    if (r.error) return r.error;
    if (!Object.keys(r.datos).length) return error(400, "No enviaste ningún campo para cambiar.");
    if (r.datos.stock !== undefined && r.datos.stock !== p.stock) mover(p.sku, r.datos.stock > p.stock ? "Entrada" : "Salida", Math.abs(r.datos.stock - p.stock), "Ajuste manual");
    Object.assign(p, r.datos);
    return json(200, p);
  }

  function borrarProducto(sku) {
    const p = producto(sku);
    if (!p) return error(404, "No existe el producto " + sku + ".");
    const usado = db.ventas.some((v) => v.items.some((i) => i.sku === sku)) || db.compras.some((c) => c.items.some((i) => i.sku === sku));
    if (usado) return error(409, "El producto " + sku + " tiene ventas o compras y no se puede borrar. Desactívalo con PUT enviando activo en false.");
    db.productos.splice(db.productos.indexOf(p), 1);
    return json(200, { borrado: true, sku });
  }

  function crearVenta(body) {
    const b = body || {};
    const faltan = ["telefono", "cliente", "items"].filter((k) => b[k] === undefined || b[k] === "");
    if (faltan.length) return error(400, "Faltan campos obligatorios.", { faltan });
    const mal = revisarItems(b.items);
    if (mal) return mal;
    for (const i of b.items) {
      const p = producto(i.sku);
      if (p.stock < Number(i.cantidad)) return error(409, "No hay stock suficiente de " + p.sku + ": quedan " + p.stock + ".", { sku: p.sku, stock: p.stock });
    }
    const id = "VEN-" + sig.venta++;
    const items = b.items.map((i) => {
      const p = producto(i.sku); const cantidad = Number(i.cantidad);
      p.stock -= cantidad; mover(p.sku, "Salida", cantidad, id);
      return { sku: p.sku, nombre: p.nombre, cantidad, precioUnitario: p.precio, subtotal: r2(p.precio * cantidad) };
    });
    const total = r2(items.reduce((a, l) => a + l.subtotal, 0));
    const subtotal = r2(total / (1 + IGV));
    const v = { id, fecha: hoy(), telefono: String(b.telefono), cliente: String(b.cliente), canal: b.canal ? String(b.canal) : "WhatsApp", estado: "Pendiente", metodoPago: b.metodoPago ? String(b.metodoPago) : "Yape", entrega: b.entrega ? String(b.entrega) : "Envío a domicilio", items, subtotal, igv: r2(total - subtotal), total, moneda: "PEN" };
    db.ventas.push(v);
    return json(201, v);
  }

  function pagarVenta(id, body) {
    const v = db.ventas.find((x) => x.id === id);
    if (!v) return error(404, "No existe la venta " + id + ".");
    if (v.estado !== "Pendiente") return error(409, "La venta " + id + " está " + v.estado + " y no se puede pagar.");
    v.estado = "Pagada";
    if (body && body.metodo) v.metodoPago = String(body.metodo);
    db.pagos.push({ id: "PAG-" + sig.pago++, venta: v.id, fecha: hoy(), monto: v.total, metodo: v.metodoPago, estado: "Aprobado", moneda: "PEN" });
    return json(200, v);
  }

  function anularVenta(id) {
    const v = db.ventas.find((x) => x.id === id);
    if (!v) return error(404, "No existe la venta " + id + ".");
    if (v.estado === "Anulada") return error(409, "La venta " + id + " ya está anulada.");
    v.items.forEach((i) => { producto(i.sku).stock += i.cantidad; mover(i.sku, "Entrada", i.cantidad, v.id + " (anulación)"); });
    v.estado = "Anulada";
    return json(200, v);
  }

  function crearCompra(body) {
    const b = body || {};
    const faltan = ["proveedor", "items"].filter((k) => b[k] === undefined || b[k] === "");
    if (faltan.length) return error(400, "Faltan campos obligatorios.", { faltan });
    const prov = db.proveedores.find((p) => p.id === b.proveedor);
    if (!prov) return error(404, "No existe el proveedor " + b.proveedor + ".");
    const mal = revisarItems(b.items);
    if (mal) return mal;
    const id = "COM-" + sig.compra++;
    const items = b.items.map((i) => {
      const p = producto(i.sku); const cantidad = Number(i.cantidad);
      const costoUnitario = i.costoUnitario === undefined ? p.costo : Number(i.costoUnitario);
      p.stock += cantidad; mover(p.sku, "Entrada", cantidad, id);
      return { sku: p.sku, nombre: p.nombre, cantidad, costoUnitario, subtotal: r2(cantidad * costoUnitario) };
    });
    const c = { id, fecha: hoy(), proveedor: prov.id, proveedorNombre: prov.nombre, estado: "Recibida", items, total: r2(items.reduce((a, l) => a + l.subtotal, 0)), moneda: "PEN" };
    db.compras.push(c);
    return json(201, c);
  }

  function resumen() {
    const validas = db.ventas.filter((v) => v.estado !== "Anulada");
    const unidades = {};
    validas.forEach((v) => v.items.forEach((i) => { unidades[i.sku] = (unidades[i.sku] || 0) + i.cantidad; }));
    const masVendidos = Object.entries(unidades).map(([sku, u]) => ({ sku, nombre: producto(sku).nombre, unidades: u })).sort((a, b) => b.unidades - a.unidades).slice(0, 5);
    const porEstado = {};
    db.ventas.forEach((v) => { porEstado[v.estado] = (porEstado[v.estado] || 0) + 1; });
    return json(200, {
      moneda: "PEN",
      ventas: { cantidad: validas.length, ingresos: r2(validas.reduce((a, v) => a + v.total, 0)), porEstado },
      compras: { cantidad: db.compras.length, total: r2(db.compras.reduce((a, c) => a + c.total, 0)) },
      inventario: { productos: db.productos.length, unidades: db.productos.reduce((a, p) => a + p.stock, 0), bajoStock: db.productos.filter((p) => p.stock <= p.stockMinimo).length, valorAlCosto: r2(db.productos.reduce((a, p) => a + p.stock * p.costo, 0)) },
      masVendidos,
    });
  }

  const uno = (arr, campo, valor, nombre) => { const x = arr.find((e) => e[campo] === valor); return x ? json(200, x) : error(404, "No existe " + nombre + " " + valor + "."); };

  return {
    productos: ({ query: q }) => lista(db.productos.filter((p) => (!q.categoria || p.categoria === q.categoria) && (!q.marca || p.marca === q.marca) && (!q.q || p.nombre.toLowerCase().includes(String(q.q).toLowerCase())) && (!q.bajo_stock || p.stock <= p.stockMinimo)), q),
    producto: ({ params }) => uno(db.productos, "sku", params[0], "el producto"),
    crearProducto: ({ body }) => crearProducto(body),
    editarProducto: ({ params, body }) => editarProducto(params[0], body),
    borrarProducto: ({ params }) => borrarProducto(params[0]),
    categorias: ({ query }) => lista([...new Set(db.productos.map((p) => p.categoria))].map((nombre) => ({ nombre, productos: db.productos.filter((p) => p.categoria === nombre).length })), query),
    proveedores: ({ query }) => lista(db.proveedores, query),
    proveedor: ({ params }) => uno(db.proveedores, "id", params[0], "el proveedor"),
    ventas: ({ query: q }) => lista(db.ventas.filter((v) => (!q.estado || v.estado === q.estado) && (!q.telefono || v.telefono === q.telefono) && (!q.canal || v.canal === q.canal) && (!q.desde || v.fecha >= q.desde) && (!q.hasta || v.fecha <= q.hasta)), q),
    venta: ({ params }) => uno(db.ventas, "id", params[0], "la venta"),
    crearVenta: ({ body }) => crearVenta(body),
    pagarVenta: ({ params, body }) => pagarVenta(params[0], body),
    anularVenta: ({ params }) => anularVenta(params[0]),
    compras: ({ query: q }) => lista(db.compras.filter((c) => (!q.estado || c.estado === q.estado) && (!q.proveedor || c.proveedor === q.proveedor)), q),
    compra: ({ params }) => uno(db.compras, "id", params[0], "la compra"),
    crearCompra: ({ body }) => crearCompra(body),
    pagos: ({ query: q }) => lista(db.pagos.filter((p) => (!q.venta || p.venta === q.venta) && (!q.metodo || p.metodo === q.metodo)), q),
    movimientos: ({ query: q }) => lista(db.movimientos.filter((m) => (!q.sku || m.sku === q.sku) && (!q.tipo || m.tipo === q.tipo)), q),
    resumen,
  };
}

module.exports = { crearTienda };
