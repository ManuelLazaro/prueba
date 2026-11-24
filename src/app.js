const { semilla, HORA_ADICIONAL } = require("./data");
const { ENDPOINTS, openapi, paginaDocs } = require("./docs");
const { crearTienda } = require("./tienda");

// Estados que dejan la cabina ocupada en la fecha de la reserva
const OCUPAN = ["Confirmada", "ContraEntrega"];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const json = (status, body) => ({ status, body, type: "application/json; charset=utf-8" });
const error = (status, mensaje, extra) => json(status, Object.assign({ error: mensaje }, extra));
// Listas paginadas: ?limite (1 a 100, por defecto 50) y ?pagina (desde 1)
function lista(todos, query = {}) {
  const limite = Math.min(100, Math.max(1, parseInt(query.limite, 10) || 50));
  const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
  const datos = todos.slice((pagina - 1) * limite, pagina * limite);
  return json(200, { total: todos.length, pagina, limite, paginas: Math.max(1, Math.ceil(todos.length / limite)), datos });
}

function createApp({ apiKey, abierto = false }) {
  const db = semilla();
  const tienda = crearTienda({ json, error, lista });
  let siguiente = 1 + Math.max(...db.reservas.map((r) => Number(r.id.split("-")[1])));

  const reservaQueOcupa = (codigo, fecha) => db.reservas.find((r) => r.cabina === codigo && r.fecha === fecha && OCUPAN.includes(r.estado));
  const cabina = (codigo) => db.cabinas.find((c) => c.codigo === codigo);

  function autorizado(headers) {
    const bearer = (headers.authorization || "").replace(/^Bearer\s+/i, "");
    return headers["x-api-key"] === apiKey || bearer === apiKey;
  }

  function disponibilidad(query) {
    if (!query.fecha || !FECHA.test(query.fecha)) return error(400, "Falta el parámetro fecha en formato AAAA-MM-DD, por ejemplo 2026-12-12.");
    if (query.cabina && !cabina(query.cabina)) return error(404, "No existe la cabina " + query.cabina + ".");
    const cabinas = db.cabinas.filter((c) => !query.cabina || c.codigo === query.cabina).map((c) => {
      const r = reservaQueOcupa(c.codigo, query.fecha);
      return { codigo: c.codigo, nombre: c.nombre, disponible: !r, reserva: r ? r.id : null };
    });
    return json(200, { fecha: query.fecha, cabinas });
  }

  function crearReserva(body) {
    const b = body || {};
    const faltan = ["cabina", "fecha", "horas", "cliente", "telefono"].filter((k) => b[k] === undefined || b[k] === "");
    if (faltan.length) return error(400, "Faltan campos obligatorios.", { faltan });
    if (!FECHA.test(b.fecha)) return error(400, "La fecha debe tener el formato AAAA-MM-DD.");
    const horas = Number(b.horas);
    if (!Number.isInteger(horas) || horas < 1) return error(400, "Las horas deben ser un número entero mayor que cero.");
    const c = cabina(b.cabina);
    if (!c) return error(404, "No existe la cabina " + b.cabina + ".");
    const ocupa = reservaQueOcupa(c.codigo, b.fecha);
    if (ocupa) return error(409, "La cabina " + c.codigo + " no está disponible el " + b.fecha + ".", { reserva: ocupa.id });
    const total = c.precio + Math.max(0, horas - c.horasIncluidas) * HORA_ADICIONAL;
    const r = { id: "RES-" + siguiente++, cabina: c.codigo, fecha: b.fecha, horas, cliente: String(b.cliente), telefono: String(b.telefono), lugar: b.lugar ? String(b.lugar) : "", estado: "Pendiente", total, adelanto: total / 2, pago: b.pago ? String(b.pago) : "Yape" };
    db.reservas.push(r);
    return json(201, r);
  }

  function cambiarEstado(id, estado) {
    const r = db.reservas.find((x) => x.id === id);
    if (!r) return error(404, "No existe la reserva " + id + ".");
    if (estado === "Confirmada") {
      const otra = reservaQueOcupa(r.cabina, r.fecha);
      if (otra && otra.id !== r.id) return error(409, "La cabina " + r.cabina + " no está disponible el " + r.fecha + ".", { reserva: otra.id });
    }
    r.estado = estado;
    return json(200, r);
  }

  function route({ method, path, query = {}, headers = {}, body }) {
    if (path === "/health") return json(200, { estado: "ok", servicio: "api-prueba-cabinas" });
    if (path === "/" || path === "/docs") return { status: 200, body: paginaDocs(), type: "text/html; charset=utf-8" };
    if (path === "/openapi.json") return json(200, openapi());
    if (!path.startsWith("/api/")) return error(404, "No existe la ruta " + path + ". Revisa /docs.");
    if (!abierto && !autorizado(headers)) return error(401, "Falta la clave o no es válida. Envía el encabezado X-API-Key.");

    const p = path.split("/").filter(Boolean).slice(1); // sin "api"
    const conocida = ENDPOINTS.filter((e) => e.patron.test(path));
    if (!conocida.length) return error(404, "No existe la ruta " + path + ". Revisa /docs.");
    const e = conocida.find((x) => x.metodo === method);
    if (!e) return error(405, "El método " + method + " no está permitido en " + path + ".");
    if (e.h) return tienda[e.h]({ query, body, params: path.match(e.patron).slice(1).map(decodeURIComponent) });

    if (p[0] === "cabinas" && p.length === 1) return lista(db.cabinas.filter((c) => !query.tipo || c.tipo === query.tipo), query);
    if (p[0] === "cabinas") { const c = cabina(p[1]); return c ? json(200, c) : error(404, "No existe la cabina " + p[1] + "."); }
    if (p[0] === "disponibilidad") return disponibilidad(query);
    if (p[0] === "reservas" && p.length === 1 && method === "GET") return lista(db.reservas.filter((r) => (!query.estado || r.estado === query.estado) && (!query.telefono || r.telefono === query.telefono) && (!query.fecha || r.fecha === query.fecha)), query);
    if (p[0] === "reservas" && p.length === 1) return crearReserva(body);
    if (p[0] === "reservas" && p.length === 2) { const r = db.reservas.find((x) => x.id === p[1]); return r ? json(200, r) : error(404, "No existe la reserva " + p[1] + "."); }
    if (p[0] === "reservas" && p[2] === "confirmar") return cambiarEstado(p[1], "Confirmada");
    if (p[0] === "reservas" && p[2] === "cancelar") return cambiarEstado(p[1], "Cancelada");
    if (p[0] === "clientes" && p.length === 1) return lista(db.clientes.filter((c) => !query.telefono || c.telefono === query.telefono), query);
    const cli = db.clientes.find((c) => c.telefono === p[1]);
    return cli ? json(200, cli) : error(404, "No existe un cliente con el teléfono " + p[1] + ".");
  }

  return { route };
}

module.exports = { createApp };
