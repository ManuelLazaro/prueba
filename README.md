# API de prueba · Tienda y cabinas

Backend chico con datos inventados para validar que un sistema externo (por ejemplo, una automatización de ECOMLAB) puede consultar y escribir en una API protegida con token.

No usa dependencias: solo Node.js 18 o superior.

## Arrancar

```
node server.js
```

Queda en `http://localhost:4000`. La documentación navegable está en `http://localhost:4000/docs` y la especificación en `http://localhost:4000/openapi.json`.

Para exponerla con ngrok:

```
ngrok http 4000
```

ngrok muestra una dirección `https://....ngrok-free.app`. Esa es la URL base que se carga en el sistema que quieres validar.

## Abrirlo en GitHub Codespaces

1. En la página del repositorio toca **Code › Codespaces › Create codespace on main**.
2. Espera a que cargue. El servidor arranca solo en la terminal y genera su propio token.
3. Abre la pestaña **Ports** (Puertos): ahí está la dirección del puerto 4000.
4. Para que otros sistemas puedan llamarla, haz clic derecho sobre el puerto 4000 › **Port Visibility › Public**. Por defecto es privada y solo la ves tú.
5. El token está en el archivo `.env` que aparece en el explorador de archivos, en la línea `API_KEY=`.

Si cierras la terminal, vuelve a arrancarlo con `node server.js`. Para correr las pruebas: `node --test`.

Cada codespace genera un token distinto y tiene su propia dirección.

## Documentación como HTML fijo

La carpeta `docs/` tiene la documentación lista para cualquier alojamiento de HTML: `index.html`, `openapi.json` y el PDF. No necesita que el servidor esté corriendo.

Para publicarla con GitHub Pages: en el repositorio, **Settings › Pages › Branch: main, carpeta /docs › Save**.

Si cambias las rutas, vuelve a generarla con `node generar-docs-estaticos.js`.

## El token

La primera vez que arranca, el servidor genera un token al azar y lo guarda en el archivo `.env`, en la línea `API_KEY=`. Ábrelo y cópialo desde ahí.

- Para cambiarlo, borra esa línea y vuelve a arrancar: se genera otro.
- El archivo `.env` está en `.gitignore`; no lo subas ni lo compartas.

Todas las rutas que empiezan con `/api/` piden el token en uno de estos encabezados:

```
X-API-Key: <token>
Authorization: Bearer <token>
```

Sin token responden `/health`, `/docs` y `/openapi.json`.

## Rutas

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/health` | Comprueba que el servicio responde |
| GET | `/api/cabinas` | Lista cabinas y paquetes. Filtro: `tipo` |
| GET | `/api/cabinas/{codigo}` | Una cabina, por ejemplo `CAB-001` |
| GET | `/api/disponibilidad?fecha=AAAA-MM-DD` | Qué cabinas están libres ese día. Filtro: `cabina` |
| GET | `/api/reservas` | Lista reservas. Filtros: `estado`, `telefono`, `fecha` |
| POST | `/api/reservas` | Crea una reserva Pendiente y calcula el adelanto del 50 % |
| GET | `/api/reservas/{id}` | Una reserva, por ejemplo `RES-1001` |
| POST | `/api/reservas/{id}/confirmar` | La pasa a Confirmada y ocupa la fecha |
| POST | `/api/reservas/{id}/cancelar` | La pasa a Cancelada y libera la fecha |
| GET | `/api/clientes` | Lista clientes. Filtro: `telefono` |
| GET | `/api/clientes/{telefono}` | Un cliente, por ejemplo `51999000001` |

### Tienda: productos, ventas, compras e inventario

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/productos` | Lista productos. Filtros: `categoria`, `marca`, `q`, `bajo_stock=1` |
| GET | `/api/productos/{sku}` | Un producto, por ejemplo `MOC-001` |
| POST | `/api/productos` | Agrega un producto. Obligatorios: `sku`, `nombre`, `categoria`, `precio` |
| PUT | `/api/productos/{sku}` | Cambia solo los campos enviados. El SKU no se cambia |
| DELETE | `/api/productos/{sku}` | Borra un producto sin ventas ni compras; si las tiene, 409 |
| GET | `/api/categorias` | Categorías con su cantidad de productos |
| GET | `/api/ventas` | Lista ventas. Filtros: `estado`, `telefono`, `canal`, `desde`, `hasta` |
| POST | `/api/ventas` | Registra una venta, descuenta stock y calcula IGV y total |
| GET | `/api/ventas/{id}` | Una venta con sus ítems, por ejemplo `VEN-2001` |
| POST | `/api/ventas/{id}/pagar` | La pasa a Pagada y registra el pago |
| POST | `/api/ventas/{id}/anular` | La anula y devuelve el stock |
| GET | `/api/pagos` | Pagos recibidos. Filtros: `venta`, `metodo` |
| GET | `/api/compras` | Compras a proveedores. Filtros: `estado`, `proveedor` |
| POST | `/api/compras` | Registra una compra y aumenta el stock |
| GET | `/api/compras/{id}` | Una compra con sus ítems, por ejemplo `COM-3001` |
| GET | `/api/proveedores` y `/api/proveedores/{id}` | Proveedores |
| GET | `/api/inventario/movimientos` | Entradas y salidas de stock. Filtros: `sku`, `tipo` |
| GET | `/api/reportes/resumen` | Totales de ventas, compras e inventario, y más vendidos |

Todas las listas aceptan `limite` (1 a 100, por defecto 50) y `pagina`, y devuelven `total`, `pagina`, `limite`, `paginas` y `datos`.

Cuerpo para registrar una venta:

```json
{
  "telefono": "51999000001",
  "cliente": "María Quispe",
  "metodoPago": "Yape",
  "items": [
    { "sku": "MOC-001", "cantidad": 2 },
    { "sku": "ACC-001", "cantidad": 1 }
  ]
}
```

Cuerpo para registrar una compra:

```json
{
  "proveedor": "PRV-02",
  "items": [{ "sku": "MAL-003", "cantidad": 10, "costoUnitario": 195 }]
}
```

Cuerpo para crear una reserva:

```json
{
  "cabina": "CAB-002",
  "fecha": "2026-12-20",
  "horas": 2,
  "cliente": "Cliente Prueba",
  "telefono": "51999000009",
  "lugar": "Surco"
}
```

Son obligatorios `cabina`, `fecha`, `horas`, `cliente` y `telefono`.

## Reglas del negocio

- **Disponibilidad:** una cabina está ocupada en una fecha solo si tiene una reserva `Confirmada` o `ContraEntrega` ese día. `Pendiente` y `Cancelada` no la ocupan.
- **Precio:** el precio de la cabina cubre sus horas incluidas. Cada hora extra suma S/ 220.
- **Adelanto:** el 50 % del total.

- **Precios de la tienda:** en soles, con IGV (18 %) incluido. Cada venta trae `subtotal`, `igv` y `total`.
- **Stock:** una venta lo descuenta, anularla lo devuelve y una compra lo aumenta. Vender más de lo que hay responde 409.

## Respuestas

| Código | Significa |
|---|---|
| 200 / 201 | Correcto / reserva creada |
| 400 | Falta un dato o tiene mal formato |
| 401 | Falta el token o no es válido |
| 404 | No existe la ruta, la cabina, la reserva o el cliente |
| 405 | Método no permitido en esa ruta |
| 409 | La cabina ya está ocupada ese día |

Los errores traen siempre un campo `error`. Las listas traen `total` y `datos`.

## Datos de ejemplo

- 6 cabinas y paquetes: `CAB-001` a `CAB-003` y `PAQ-001` a `PAQ-003`.
- 4 clientes, con teléfonos `51999000001` a `51999000004`.
- 5 reservas, `RES-1001` a `RES-1005`, una en cada estado.

- 12 productos en 3 categorías (Mochilas, Maletas, Accesorios), 3 de ellos con stock bajo.
- 3 proveedores, `PRV-01` a `PRV-03`.
- 9 ventas, `VEN-2001` a `VEN-2009`, en estados Pendiente, Pagada, Entregada y Anulada.
- 4 compras, `COM-3001` a `COM-3004`.
- Pagos y movimientos de inventario que salen de esas ventas y compras.

Casos útiles para probar:

| Prueba | Llamada | Resultado esperado |
|---|---|---|
| Cabina ocupada | `GET /api/disponibilidad?fecha=2026-12-12&cabina=CAB-001` | `disponible: false`, reserva `RES-1001` |
| Misma cabina, otro día | `GET /api/disponibilidad?fecha=2026-12-13&cabina=CAB-001` | `disponible: true` |
| Reserva pendiente no bloquea | `GET /api/disponibilidad?fecha=2026-12-19&cabina=CAB-002` | `disponible: true` |
| Reservar algo ocupado | `POST /api/reservas` con `CAB-001` y `2026-12-12` | 409 |
| Sin token | `GET /api/cabinas` sin encabezado | 401 |
| Producto agotado | `POST /api/ventas` con `ACC-002` | 409 |
| Stock bajo | `GET /api/productos?bajo_stock=1` | `MOC-005`, `MAL-003` y `ACC-002` |
| Ventas de un cliente | `GET /api/ventas?telefono=51999000001` | 3 ventas |
| Resumen | `GET /api/reportes/resumen` | 8 ventas válidas y 4 compras |

Los cambios viven en memoria: al reiniciar el servidor vuelven los datos iniciales.

## Pruebas

```
node --test
```
