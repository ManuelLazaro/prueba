// Datos de ejemplo, inventados para la prueba. Cada llamada devuelve una copia nueva.
const HORA_ADICIONAL = 220;

const CABINAS = [
  { codigo: "CAB-001", nombre: "Cabina clásica cerrada", tipo: "Cabina", descripcion: "Cabina cerrada con cortina, estilo fotomatón, para grupos pequeños.", incluye: ["Operador", "Fotos ilimitadas", "Impresión en tira de 3 fotos", "Accesorios básicos"], horasIncluidas: 2, precio: 650, moneda: "PEN" },
  { codigo: "CAB-002", nombre: "Cabina abierta con fondo de lentejuelas", tipo: "Cabina", descripcion: "Cabina abierta con fondo brillante, para fotos grupales de hasta 10 personas.", incluye: ["Operador", "Fondo a elegir", "Fotos ilimitadas", "Impresión 10 x 15 cm"], horasIncluidas: 2, precio: 750, moneda: "PEN" },
  { codigo: "CAB-003", nombre: "Cabina selfie con aro de luz", tipo: "Cabina", descripcion: "Estación compacta con aro de luz y pantalla táctil.", incluye: ["Equipo con aro de luz", "Fotos digitales por código QR", "Montaje y desmontaje"], horasIncluidas: 3, precio: 480, moneda: "PEN" },
  { codigo: "PAQ-001", nombre: "Paquete Boda", tipo: "Paquete", descripcion: "Cabina abierta con fondo floral y diseño de foto personalizado.", incluye: ["Operador", "Fotos ilimitadas", "Impresión doble", "Álbum de firmas", "Accesorios"], horasIncluidas: 4, precio: 1350, moneda: "PEN" },
  { codigo: "PAQ-002", nombre: "Paquete Quinceañero y cumpleaños", tipo: "Paquete", descripcion: "Cabina abierta con arco de globos y marco personalizado.", incluye: ["Operador", "Fotos ilimitadas", "Impresión 10 x 15 cm", "Accesorios", "Letrero neón"], horasIncluidas: 3, precio: 980, moneda: "PEN" },
  { codigo: "PAQ-003", nombre: "Paquete Corporativo", tipo: "Paquete", descripcion: "Cabina para eventos de empresa con el logo de la marca en cada foto.", incluye: ["Operador", "Fotos ilimitadas", "Logo en la foto", "Galería en línea"], horasIncluidas: 4, precio: 1500, moneda: "PEN" },
];

const CLIENTES = [
  { telefono: "51999000001", nombre: "María Quispe", distrito: "Miraflores", correo: "maria.quispe@example.com" },
  { telefono: "51999000002", nombre: "Jorge Ramos", distrito: "San Isidro", correo: "jorge.ramos@example.com" },
  { telefono: "51999000003", nombre: "Lucía Torres", distrito: "Surco", correo: "lucia.torres@example.com" },
  { telefono: "51999000004", nombre: "Carlos Huamán", distrito: "La Molina", correo: "carlos.huaman@example.com" },
];

const RESERVAS = [
  { id: "RES-1001", cabina: "CAB-001", fecha: "2026-12-12", horas: 3, cliente: "María Quispe", telefono: "51999000001", lugar: "Miraflores", estado: "Confirmada", total: 870, adelanto: 435, pago: "Yape" },
  { id: "RES-1002", cabina: "CAB-002", fecha: "2026-12-19", horas: 2, cliente: "Jorge Ramos", telefono: "51999000002", lugar: "San Isidro", estado: "Pendiente", total: 750, adelanto: 375, pago: "Yape" },
  { id: "RES-1003", cabina: "CAB-003", fecha: "2026-12-19", horas: 3, cliente: "Lucía Torres", telefono: "51999000003", lugar: "Surco", estado: "Cancelada", total: 480, adelanto: 240, pago: "Transferencia" },
  { id: "RES-1004", cabina: "PAQ-001", fecha: "2026-12-26", horas: 4, cliente: "Carlos Huamán", telefono: "51999000004", lugar: "La Molina", estado: "ContraEntrega", total: 1350, adelanto: 0, pago: "Efectivo el día del evento" },
  { id: "RES-1005", cabina: "CAB-002", fecha: "2026-12-05", horas: 2, cliente: "María Quispe", telefono: "51999000001", lugar: "Barranco", estado: "Confirmada", total: 750, adelanto: 375, pago: "Yape" },
];

const copia = (x) => JSON.parse(JSON.stringify(x));
module.exports = { HORA_ADICIONAL, semilla: () => ({ cabinas: copia(CABINAS), clientes: copia(CLIENTES), reservas: copia(RESERVAS) }) };
