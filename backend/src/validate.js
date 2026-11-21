// Validacion de entrada del pedido. Se valida SIEMPRE en el servidor,
// aunque el frontend tambien valide (nunca confiar en el cliente).

export const PRODUCTOS = [
  'Pan de bono (docena)',
  'Almojábanas (docena)',
  'Buñuelos (docena)',
  'Pan artesanal (unidad)',
  'Torta de zanahoria',
  'Torta de chocolate',
];

export const MAX_CANTIDAD = 20;
export const MAX_DIAS_ANTICIPACION = 60;

// Fecha de hoy en Colombia (YYYY-MM-DD), sin importar la zona horaria del servidor (Lambda usa UTC).
export function hoyColombia(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function sumarDias(fechaIso, dias) {
  const d = new Date(`${fechaIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function esFechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

export function validarPedido(body, now = new Date()) {
  const errores = [];

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errores: ['El cuerpo debe ser un objeto JSON'] };
  }

  const cliente = typeof body.cliente === 'string' ? body.cliente.trim() : '';
  if (cliente.length < 2 || cliente.length > 60) {
    errores.push('El nombre del cliente debe tener entre 2 y 60 caracteres');
  }

  if (!PRODUCTOS.includes(body.producto)) {
    errores.push('Producto no válido');
  }

  const cantidad = body.cantidad;
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
    errores.push(`La cantidad debe ser un entero entre 1 y ${MAX_CANTIDAD}`);
  }

  const hoy = hoyColombia(now);
  const limite = sumarDias(hoy, MAX_DIAS_ANTICIPACION);
  if (!esFechaValida(body.fechaEntrega)) {
    errores.push('La fecha de entrega debe tener formato AAAA-MM-DD');
  } else if (body.fechaEntrega < hoy || body.fechaEntrega > limite) {
    errores.push(
      `La fecha de entrega debe estar entre hoy y los próximos ${MAX_DIAS_ANTICIPACION} días`
    );
  }

  let notas = '';
  if (body.notas !== undefined && body.notas !== null) {
    if (typeof body.notas !== 'string' || body.notas.length > 200) {
      errores.push('Las notas deben ser texto de máximo 200 caracteres');
    } else {
      notas = body.notas.trim();
    }
  }

  if (errores.length > 0) {
    return { ok: false, errores };
  }

  return {
    ok: true,
    pedido: {
      cliente,
      producto: body.producto,
      cantidad,
      fechaEntrega: body.fechaEntrega,
      notas,
    },
  };
}
