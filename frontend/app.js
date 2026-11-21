(() => {
  const API = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';
  const MAX_DIAS = 60;
  const PRODUCTOS = [
    'Pan de bono (docena)',
    'Almojábanas (docena)',
    'Buñuelos (docena)',
    'Pan artesanal (unidad)',
    'Torta de zanahoria',
    'Torta de chocolate',
  ];

  const $ = (id) => document.getElementById(id);
  const form = $('form-pedido');
  const mensaje = $('mensaje');
  const btnEnviar = $('btn-enviar');
  const lista = $('lista-pedidos');
  const estadoLista = $('estado-lista');

  // Fecha local en formato AAAA-MM-DD (sin desfases por UTC)
  function fechaLocal(dias = 0) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  // Formatea 'AAAA-MM-DD' sin convertir por zona horaria
  function formatearEntrega(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  // Llenar el selector de productos y limitar el calendario
  for (const p of PRODUCTOS) {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    $('producto').appendChild(opt);
  }
  $('fechaEntrega').min = fechaLocal(0);
  $('fechaEntrega').max = fechaLocal(MAX_DIAS);
  $('fechaEntrega').value = fechaLocal(1);

  function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = tipo || '';
  }

  async function cargarPedidos() {
    estadoLista.textContent = 'Cargando…';
    try {
      const res = await fetch(`${API}/pedidos`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { pedidos } = await res.json();

      lista.replaceChildren();
      estadoLista.textContent = pedidos.length ? '' : 'Aún no hay pedidos.';

      for (const p of pedidos) {
        // textContent (nunca innerHTML) para evitar inyección de HTML/XSS
        const li = document.createElement('li');

        const titulo = document.createElement('span');
        titulo.className = 'titulo';
        titulo.textContent = `${p.cantidad} × ${p.producto}`;

        const detalle = document.createElement('span');
        detalle.className = 'detalle';
        detalle.textContent = `Cliente: ${p.cliente}` + (p.notas ? ` · ${p.notas}` : '');

        const entrega = document.createElement('span');
        entrega.className = 'detalle';
        entrega.textContent = `Entrega: ${formatearEntrega(p.fechaEntrega)}`;

        const fecha = document.createElement('span');
        fecha.className = 'fecha';
        fecha.textContent = `Registrado: ${new Date(p.creadoEn).toLocaleString('es-CO')}`;

        li.append(titulo, detalle, entrega, fecha);
        lista.appendChild(li);
      }
    } catch (err) {
      estadoLista.textContent = 'No se pudieron cargar los pedidos.';
      console.error(err);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrarMensaje('', '');

    const pedido = {
      cliente: $('cliente').value.trim(),
      producto: $('producto').value,
      cantidad: Number($('cantidad').value),
      fechaEntrega: $('fechaEntrega').value,
      notas: $('notas').value.trim(),
    };

    if (pedido.cliente.length < 2) {
      mostrarMensaje('Escribe el nombre del cliente (mínimo 2 caracteres).', 'error');
      return;
    }
    if (!Number.isInteger(pedido.cantidad) || pedido.cantidad < 1 || pedido.cantidad > 20) {
      mostrarMensaje('La cantidad debe estar entre 1 y 20.', 'error');
      return;
    }
    if (!pedido.fechaEntrega) {
      mostrarMensaje('Elige una fecha de entrega.', 'error');
      return;
    }

    btnEnviar.disabled = true;
    try {
      const res = await fetch(`${API}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detalle = data.detalles ? ` ${data.detalles.join('. ')}` : '';
        mostrarMensaje(`${data.error || 'Error al enviar'}.${detalle}`, 'error');
        return;
      }

      mostrarMensaje(`¡Pedido recibido! Código: ${data.pedidoId.slice(0, 8)}`, 'ok');
      form.reset();
      $('cantidad').value = 1;
      $('fechaEntrega').value = fechaLocal(1);
      await cargarPedidos();
    } catch (err) {
      mostrarMensaje('No se pudo conectar con el servidor.', 'error');
      console.error(err);
    } finally {
      btnEnviar.disabled = false;
    }
  });

  $('btn-recargar').addEventListener('click', cargarPedidos);
  cargarPedidos();
})();
