const Reservas = (() => {
  const METODOS_PAGO = ['Pix', 'Efectivo', 'Transferencia', 'Tarjeta', 'Otro'];

  function poblarSelectHabitaciones() {
    const sel = document.getElementById('f-habitacion');
    sel.innerHTML = Store.habitaciones
      .filter(h => h.activa !== 'NO')
      .map(h => `<option value="${h.id}">${h.nombre} (hasta ${h.capacidad})</option>`)
      .join('');
  }

  function render() {
    const tbody = document.getElementById('tbl-reservas-body');
    const buscar = (document.getElementById('filtro-cliente').value || '').toLowerCase();
    const estadoFiltro = document.getElementById('filtro-estado').value;
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;

    let lista = [...Store.reservas];
    if (buscar) lista = lista.filter(r => (r.cliente_nombre || '').toLowerCase().includes(buscar));
    if (estadoFiltro) lista = lista.filter(r => r.estado === estadoFiltro);
    // El rango de fechas filtra por superposición: se muestran las reservas
    // cuya estadía toca en algún punto el rango elegido (no solo las que
    // empiezan justo adentro), así no se pierden estadías que cruzan el límite.
    if (desde || hasta) {
      const rangoDesde = desde || '0000-01-01';
      const rangoHasta = hasta || '9999-12-31';
      lista = lista.filter(r => r.checkin <= rangoHasta && r.checkout >= rangoDesde);
    }
    lista.sort((a, b) => (a.checkin || '').localeCompare(b.checkin || ''));

    const infoEl = document.getElementById('reservas-filtro-info');
    if (desde || hasta) {
      infoEl.textContent = `Mostrando ${lista.length} de ${Store.reservas.length} reserva(s) — filtradas por fecha. Usá "Limpiar fechas" para ver todo el historial.`;
    } else {
      infoEl.textContent = '';
    }

    document.getElementById('reservas-empty').classList.toggle('hidden', Store.reservas.length !== 0);

    tbody.innerHTML = lista.map(r => {
      const pagado = totalPagadoDe(r.id);
      const saldo = saldoPendienteDe(r);
      const extrasPend = totalConsumosPendientesDe(r.id);
      const estadia = estadiaInfo(r);
      return `
        <tr>
          <td class="row-link" data-open-reserva="${r.id}">${r.cliente_nombre || '—'}</td>
          <td>${habitacionNombre(r.habitacion_id)}</td>
          <td>${fmtDate(r.checkin)}</td>
          <td>${fmtDate(r.checkout)}</td>
          <td>${r.huespedes || 1}</td>
          <td>${fmtMoney(totalACobrarDe(r))}${extrasPend > 0 ? `<div class="hint-text" style="padding-top:2px;">incl. ${fmtMoney(extrasPend)} en extras</div>` : ''}</td>
          <td>${fmtMoney(pagado)}</td>
          <td>${fmtMoney(saldo)}</td>
          <td><span class="badge badge-${r.estado}">${capitaliza(r.estado)}</span></td>
          <td><span class="badge-origen ${origenClass(r.origen)}">${origenLabel(r.origen)}</span></td>
          <td>
            <div class="estadia-cell">
              <span class="badge badge-estadia-${estadia.cls}">
                <span class="estadia-dot dot-${estadia.cls}"></span>${estadia.label}
              </span>
              <div class="estadia-mini">
                <button class="chip chip-checkin ${r.checkin_hecho === 'SI' ? 'active' : ''}" data-toggle="checkin" data-id="${r.id}" ${r.estado === 'cancelada' ? 'disabled' : ''}>Check-in</button>
                <button class="chip chip-checkout ${r.checkout_hecho === 'SI' ? 'active' : ''}" data-toggle="checkout" data-id="${r.id}" ${r.estado === 'cancelada' ? 'disabled' : ''}>Check-out</button>
              </div>
            </div>
          </td>
          <td><button class="icon-btn" data-open-reserva="${r.id}" aria-label="Editar">✎</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-open-reserva]').forEach(el => {
      el.addEventListener('click', () => abrirModal(el.getAttribute('data-open-reserva')));
    });
    tbody.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', () => toggleEstadia(el.getAttribute('data-id'), el.getAttribute('data-toggle')));
    });
  }

  function capitaliza(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  async function toggleEstadia(id, campo) {
    const r = Store.reservas.find(r => r.id === id);
    if (!r) return;
    const field = campo === 'checkin' ? 'checkin_hecho' : 'checkout_hecho';
    const nuevoValor = r[field] === 'SI' ? 'NO' : 'SI';
    try {
      await Api.updateReserva({ id, [field]: nuevoValor });
      await reloadData();
      render();
      Calendario.render();
      Hoy.render();
      if (!document.getElementById('modal-reserva').classList.contains('hidden')
        && document.getElementById('f-res-id').value === id) {
        actualizarBotonesEstadia(id);
      }
      showToast(nuevoValor === 'SI' ? 'Marcado' : 'Desmarcado');
    } catch (err) {
      showToast('No se pudo actualizar: ' + err.message, true);
    }
  }

  function actualizarBotonesEstadia(id) {
    const r = Store.reservas.find(r => r.id === id);
    if (!r) return;
    document.getElementById('btn-toggle-checkin').classList.toggle('active', r.checkin_hecho === 'SI');
    document.getElementById('btn-toggle-checkout').classList.toggle('active', r.checkout_hecho === 'SI');
  }

  function abrirModal(id) {
    poblarSelectHabitaciones();
    const modal = document.getElementById('modal-reserva');
    const form = document.getElementById('form-reserva');
    form.reset();
    document.getElementById('f-disponibilidad-warning').classList.add('hidden');
    document.getElementById('f-pago-inicial-detalle').classList.add('hidden');

    if (id) {
      const r = Store.reservas.find(r => r.id === id);
      document.getElementById('modal-reserva-title').textContent = 'Editar reserva';
      document.getElementById('f-res-id').value = r.id;
      document.getElementById('f-habitacion').value = r.habitacion_id;
      document.getElementById('f-huespedes').value = r.huespedes || 1;
      document.getElementById('f-cliente').value = r.cliente_nombre || '';
      document.getElementById('f-telefono').value = r.cliente_telefono || '';
      document.getElementById('f-email').value = r.cliente_email || '';
      document.getElementById('f-estado').value = r.estado || 'confirmada';
      document.getElementById('f-checkin').value = r.checkin || '';
      document.getElementById('f-checkout').value = r.checkout || '';
      document.getElementById('f-precio').value = r.precio_total || '';
      // Los datos históricos que solo decían "Manual" se muestran en la
      // opción "Otro" del selector; las reservas nuevas ya guardan el
      // origen específico (WhatsApp / Directo / Otro).
      const origenSelect = document.getElementById('f-origen');
      const valorOrigen = [...origenSelect.options].some(o => o.value === r.origen) ? r.origen : 'Otro';
      origenSelect.value = valorOrigen;
      document.getElementById('f-notas').value = r.notas || '';
      document.getElementById('btn-eliminar-reserva').classList.remove('hidden');
      document.getElementById('f-estadia-actions').classList.remove('hidden');
      document.getElementById('f-pago-inicial-wrap').classList.add('hidden');
      actualizarBotonesEstadia(id);
      renderInfoAdicional(id);
      document.getElementById('f-info-adicional').classList.remove('hidden');
    } else {
      document.getElementById('modal-reserva-title').textContent = 'Nueva reserva';
      document.getElementById('f-res-id').value = '';
      document.getElementById('f-origen').value = 'Directo';
      document.getElementById('f-pago-inicial').value = 'ninguno';
      document.getElementById('btn-eliminar-reserva').classList.add('hidden');
      document.getElementById('f-estadia-actions').classList.add('hidden');
      document.getElementById('f-pago-inicial-wrap').classList.remove('hidden');
      document.getElementById('f-info-adicional').classList.add('hidden');
    }
    actualizarInfoNoches();
    modal.classList.remove('hidden');
  }

  // Resumen de pagos y estadía que se muestra al final del modal al
  // editar una reserva existente, para tener toda la info a mano sin
  // tener que ir a buscarla a la pestaña de Pagos.
  function renderInfoAdicional(id) {
    const r = Store.reservas.find(r => r.id === id);
    if (!r) return;
    const hospedaje = Number(r.precio_total) || 0;
    const pagado = totalPagadoDe(id);
    const saldo = saldoPendienteDe(r);
    const extrasPend = totalConsumosPendientesDe(id);
    const extrasCobrados = totalConsumosDe(id) - extrasPend;
    const estadoPago = estadoPagoDe(r);
    const labels = { pagado: 'Pagado', parcial: 'Pago parcial', adeuda: 'Adeuda todo' };
    document.getElementById('f-info-resumen').textContent =
      `Hospedaje ${fmtMoney(hospedaje)}` +
      (extrasPend > 0 ? ` · Extras sin cobrar ${fmtMoney(extrasPend)}` : '') +
      (extrasCobrados > 0 ? ` · Extras ya cobrados ${fmtMoney(extrasCobrados)}` : '') +
      ` · Pagado ${fmtMoney(pagado)} · Saldo ${fmtMoney(saldo)} · ${labels[estadoPago]}`;

    const historial = Store.pagos
      .filter(p => p.reserva_id === id)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const cont = document.getElementById('f-info-pagos-historial');
    if (historial.length === 0) {
      cont.innerHTML = '<div class="pago-row-mini-empty">Todavía no se registró ningún pago para esta reserva.</div>';
    } else {
      cont.innerHTML = historial.map(p => `
        <div class="pago-row-mini">
          <span>${fmtDate(p.fecha)} · ${escapeHtml(p.metodo)} · ${fmtMoney(p.monto)}${p.notas ? ' · ' + escapeHtml(p.notas) : ''}</span>
        </div>
      `).join('');
    }

    renderConsumos(id);
  }

  // ---------- Consumos / extras ----------

  function opcionesMetodo() {
    return METODOS_PAGO.map(m => `<option value="${m}">${m}</option>`).join('');
  }

  function renderConsumos(reservaId) {
    const cont = document.getElementById('f-consumos-lista');
    const lista = consumosDe(reservaId)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    if (lista.length === 0) {
      cont.innerHTML = '<div class="pago-row-mini-empty">Todavía no se cargó ningún consumo o extra.</div>';
      return;
    }
    cont.innerHTML = lista.map(c => {
      const cobrado = consumoCobrado(c);
      return `
        <div class="consumo-row">
          <div class="consumo-row-info">
            <span>${fmtDate(c.fecha)} · ${escapeHtml(c.descripcion)} · <strong>${fmtMoney(c.monto)}</strong></span>
            <span class="badge ${cobrado ? 'badge-pagado' : 'badge-adeuda'}">${cobrado ? 'Cobrado · ' + escapeHtml(c.metodo_pago) : 'Sin cobrar'}</span>
          </div>
          <div class="consumo-row-actions">
            ${cobrado ? '' : `
              <select data-consumo-metodo="${c.id}" aria-label="Método de cobro">${opcionesMetodo()}</select>
              <button type="button" class="btn btn-ghost" data-consumo-cobrar="${c.id}">Marcar cobrado</button>
            `}
            <button type="button" class="btn btn-danger" data-consumo-eliminar="${c.id}">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');

    cont.querySelectorAll('[data-consumo-cobrar]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-consumo-cobrar');
        const metodo = cont.querySelector(`[data-consumo-metodo="${id}"]`).value;
        cobrarConsumo(id, metodo);
      });
    });
    cont.querySelectorAll('[data-consumo-eliminar]').forEach(el => {
      el.addEventListener('click', () => eliminarConsumo(el.getAttribute('data-consumo-eliminar')));
    });
  }

  // Refresca todo lo que depende del saldo de la reserva (tabla, gantt
  // por el color de pago, panel Hoy, pestaña Pagos y el propio modal).
  function refrescarTrasConsumo(reservaId) {
    invalidarContabilidad();
    render();
    Calendario.render();
    Hoy.render();
    Pagos.render();
    renderInfoAdicional(reservaId);
  }

  async function agregarConsumo() {
    const reservaId = document.getElementById('f-res-id').value;
    if (!reservaId) return;
    const descripcion = document.getElementById('c-descripcion').value.trim();
    const monto = Number(document.getElementById('c-monto').value) || 0;
    const metodo = document.getElementById('c-metodo').value; // '' = todavía no cobrado
    if (!descripcion) { showToast('Poné una descripción del consumo', true); return; }
    if (monto <= 0) { showToast('El monto tiene que ser mayor a 0', true); return; }

    const btn = document.getElementById('btn-agregar-consumo');
    btn.disabled = true;
    try {
      await Api.addConsumo({
        reserva_id: reservaId,
        fecha: hoyISO(),
        descripcion,
        monto,
        metodo_pago: metodo,
      });
      await reloadData();
      document.getElementById('c-descripcion').value = '';
      document.getElementById('c-monto').value = '';
      document.getElementById('c-metodo').value = '';
      refrescarTrasConsumo(reservaId);
      showToast('Consumo agregado');
    } catch (err) {
      showToast('No se pudo agregar el consumo: ' + err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function cobrarConsumo(consumoId, metodo) {
    const c = Store.consumos.find(c => c.id === consumoId);
    if (!c) return;
    try {
      await Api.updateConsumo({ id: consumoId, metodo_pago: metodo });
      await reloadData();
      refrescarTrasConsumo(c.reserva_id);
      showToast('Consumo marcado como cobrado');
    } catch (err) {
      showToast('No se pudo actualizar el consumo: ' + err.message, true);
    }
  }

  async function eliminarConsumo(consumoId) {
    const c = Store.consumos.find(c => c.id === consumoId);
    if (!c) return;
    if (!confirm('¿Eliminar este consumo? Si ya estaba cobrado, también se borra su ingreso en Contabilidad.')) return;
    try {
      await Api.deleteConsumo(consumoId);
      await reloadData();
      refrescarTrasConsumo(c.reserva_id);
      showToast('Consumo eliminado');
    } catch (err) {
      showToast('No se pudo eliminar el consumo: ' + err.message, true);
    }
  }

  function abrirModalConDatos(habitacionId, fechaCheckin) {
    abrirModal(null);
    document.getElementById('f-habitacion').value = habitacionId;
    document.getElementById('f-checkin').value = fechaCheckin;
    const fin = new Date(fechaCheckin + 'T00:00:00');
    fin.setDate(fin.getDate() + 1);
    document.getElementById('f-checkout').value = fin.toISOString().slice(0, 10);
    actualizarInfoNoches();
  }

  function cerrarModal() {
    document.getElementById('modal-reserva').classList.add('hidden');
  }

  function actualizarInfoNoches() {
    const checkin = document.getElementById('f-checkin').value;
    const checkout = document.getElementById('f-checkout').value;
    const noches = nightsBetween(checkin, checkout);
    document.getElementById('f-noches-info').textContent = noches > 0 ? `${noches} noche(s)` : 'Elegí las fechas de check-in y check-out';
    validarDisponibilidad();
  }

  function validarDisponibilidad() {
    const checkin = document.getElementById('f-checkin').value;
    const checkout = document.getElementById('f-checkout').value;
    const habitacionId = document.getElementById('f-habitacion').value;
    const idActual = document.getElementById('f-res-id').value || null;
    const warnBox = document.getElementById('f-disponibilidad-warning');

    if (!checkin || !checkout || checkout <= checkin) {
      warnBox.classList.add('hidden');
      return;
    }
    const conflictos = reservasActivasEnRango(checkin, checkout, idActual)
      .filter(r => r.habitacion_id === habitacionId);

    if (conflictos.length > 0) {
      warnBox.textContent = `Atención: "${habitacionNombre(habitacionId)}" ya tiene una reserva de ${fmtDate(conflictos[0].checkin)} a ${fmtDate(conflictos[0].checkout)} (${conflictos[0].cliente_nombre}) que se superpone con estas fechas.`;
      warnBox.classList.remove('hidden');
    } else {
      warnBox.classList.add('hidden');
    }
  }

  function actualizarPagoInicialUI() {
    const val = document.getElementById('f-pago-inicial').value;
    const detalle = document.getElementById('f-pago-inicial-detalle');
    const montoInput = document.getElementById('f-pago-inicial-monto');
    if (val === 'ninguno') {
      detalle.classList.add('hidden');
    } else {
      detalle.classList.remove('hidden');
      if (val === 'completo') {
        montoInput.value = document.getElementById('f-precio').value || '';
      }
    }
  }

  async function guardar(e) {
    e.preventDefault();
    const id = document.getElementById('f-res-id').value;
    const payload = {
      habitacion_id: document.getElementById('f-habitacion').value,
      huespedes: Number(document.getElementById('f-huespedes').value) || 1,
      cliente_nombre: document.getElementById('f-cliente').value.trim(),
      cliente_telefono: document.getElementById('f-telefono').value.trim(),
      cliente_email: document.getElementById('f-email').value.trim(),
      estado: document.getElementById('f-estado').value,
      checkin: document.getElementById('f-checkin').value,
      checkout: document.getElementById('f-checkout').value,
      precio_total: Number(document.getElementById('f-precio').value) || 0,
      origen: document.getElementById('f-origen').value,
      notas: document.getElementById('f-notas').value.trim(),
    };
    if (payload.checkout <= payload.checkin) {
      showToast('La fecha de check-out debe ser posterior al check-in', true);
      return;
    }

    const pagoInicial = !id ? document.getElementById('f-pago-inicial').value : 'ninguno';
    const montoInicial = Number(document.getElementById('f-pago-inicial-monto').value) || 0;
    const metodoInicial = document.getElementById('f-pago-inicial-metodo').value;

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      let reservaId = id;
      if (id) {
        await Api.updateReserva({ id, ...payload });
      } else {
        const res = await Api.addReserva(payload);
        reservaId = res.id;
      }
      if (!id && pagoInicial !== 'ninguno' && montoInicial > 0) {
        await Api.addPago({
          reserva_id: reservaId,
          fecha: new Date().toISOString().slice(0, 10),
          monto: montoInicial,
          metodo: metodoInicial,
          notas: 'Pago inicial al crear la reserva',
        });
      }
      await reloadData();
      if (pagoInicial !== 'ninguno' && montoInicial > 0) invalidarContabilidad();
      render();
      Calendario.render();
      Hoy.render();
      Pagos.render();
      cerrarModal();
      showToast('Reserva guardada');
    } catch (err) {
      showToast('Error al guardar: ' + err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function eliminar() {
    const id = document.getElementById('f-res-id').value;
    if (!id) return;
    if (!confirm('¿Eliminar esta reserva y sus pagos y consumos asociados? Esta acción no se puede deshacer.')) return;
    try {
      await Api.deleteReserva(id);
      await reloadData();
      invalidarContabilidad();
      render();
      Calendario.render();
      Hoy.render();
      Pagos.render();
      cerrarModal();
      showToast('Reserva eliminada');
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, true);
    }
  }

  function initEvents() {
    document.getElementById('btn-nueva-reserva').addEventListener('click', () => abrirModal(null));
    document.getElementById('form-reserva').addEventListener('submit', guardar);
    document.getElementById('btn-eliminar-reserva').addEventListener('click', eliminar);
    document.getElementById('filtro-cliente').addEventListener('input', render);
    document.getElementById('filtro-estado').addEventListener('change', render);
    document.getElementById('filtro-desde').addEventListener('change', render);
    document.getElementById('filtro-hasta').addEventListener('change', render);
    document.getElementById('btn-filtro-fechas-limpiar').addEventListener('click', () => {
      document.getElementById('filtro-desde').value = '';
      document.getElementById('filtro-hasta').value = '';
      render();
    });
    document.getElementById('f-pago-inicial').addEventListener('change', actualizarPagoInicialUI);
    document.getElementById('btn-toggle-checkin').addEventListener('click', () => toggleEstadia(document.getElementById('f-res-id').value, 'checkin'));
    document.getElementById('btn-toggle-checkout').addEventListener('click', () => toggleEstadia(document.getElementById('f-res-id').value, 'checkout'));
    document.getElementById('btn-agregar-consumo').addEventListener('click', agregarConsumo);
    // Enter dentro de los campos del consumo agrega el consumo; sin esto
    // enviaría (y cerraría) el formulario de la reserva completa.
    ['c-descripcion', 'c-monto'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); agregarConsumo(); }
      });
    });
    document.getElementById('btn-ir-a-pago').addEventListener('click', () => {
      const id = document.getElementById('f-res-id').value;
      if (!id) return;
      cerrarModal();
      Pagos.abrirModal(id);
    });
    ['f-checkin', 'f-checkout', 'f-habitacion'].forEach(id => {
      document.getElementById(id).addEventListener('change', actualizarInfoNoches);
    });
    document.querySelectorAll('#modal-reserva [data-close]').forEach(el => {
      el.addEventListener('click', cerrarModal);
    });
  }

  return { render, initEvents, abrirModal, abrirModalConDatos };
})();