const Reservas = (() => {
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

    let lista = [...Store.reservas];
    if (buscar) lista = lista.filter(r => (r.cliente_nombre || '').toLowerCase().includes(buscar));
    if (estadoFiltro) lista = lista.filter(r => r.estado === estadoFiltro);
    lista.sort((a, b) => (a.checkin || '').localeCompare(b.checkin || ''));

    document.getElementById('reservas-empty').classList.toggle('hidden', Store.reservas.length !== 0);

    tbody.innerHTML = lista.map(r => {
      const pagado = totalPagadoDe(r.id);
      const saldo = (Number(r.precio_total) || 0) - pagado;
      const estadia = estadiaInfo(r);
      return `
        <tr>
          <td class="row-link" data-open-reserva="${r.id}">${r.cliente_nombre || '—'}</td>
          <td>${habitacionNombre(r.habitacion_id)}</td>
          <td>${fmtDate(r.checkin)}</td>
          <td>${fmtDate(r.checkout)}</td>
          <td>${r.huespedes || 1}</td>
          <td>${fmtMoney(r.precio_total)}</td>
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
      document.getElementById('f-origen').value = r.origen === 'Booking' ? 'Booking' : 'Manual';
      document.getElementById('f-notas').value = r.notas || '';
      document.getElementById('btn-eliminar-reserva').classList.remove('hidden');
      document.getElementById('f-estadia-actions').classList.remove('hidden');
      document.getElementById('f-pago-inicial-wrap').classList.add('hidden');
      actualizarBotonesEstadia(id);
    } else {
      document.getElementById('modal-reserva-title').textContent = 'Nueva reserva';
      document.getElementById('f-res-id').value = '';
      document.getElementById('f-origen').value = 'Manual';
      document.getElementById('f-pago-inicial').value = 'ninguno';
      document.getElementById('btn-eliminar-reserva').classList.add('hidden');
      document.getElementById('f-estadia-actions').classList.add('hidden');
      document.getElementById('f-pago-inicial-wrap').classList.remove('hidden');
    }
    actualizarInfoNoches();
    modal.classList.remove('hidden');
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
    if (!confirm('¿Eliminar esta reserva y sus pagos asociados? Esta acción no se puede deshacer.')) return;
    try {
      await Api.deleteReserva(id);
      await reloadData();
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
    document.getElementById('f-pago-inicial').addEventListener('change', actualizarPagoInicialUI);
    document.getElementById('btn-toggle-checkin').addEventListener('click', () => toggleEstadia(document.getElementById('f-res-id').value, 'checkin'));
    document.getElementById('btn-toggle-checkout').addEventListener('click', () => toggleEstadia(document.getElementById('f-res-id').value, 'checkout'));
    ['f-checkin', 'f-checkout', 'f-habitacion'].forEach(id => {
      document.getElementById(id).addEventListener('change', actualizarInfoNoches);
    });
    document.querySelectorAll('#modal-reserva [data-close]').forEach(el => {
      el.addEventListener('click', cerrarModal);
    });
  }

  return { render, initEvents, abrirModal, abrirModalConDatos };
})();