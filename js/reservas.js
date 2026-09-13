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
          <td><button class="icon-btn" data-open-reserva="${r.id}" aria-label="Editar">✎</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-open-reserva]').forEach(el => {
      el.addEventListener('click', () => abrirModal(el.getAttribute('data-open-reserva')));
    });
  }

  function capitaliza(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function abrirModal(id) {
    poblarSelectHabitaciones();
    const modal = document.getElementById('modal-reserva');
    const form = document.getElementById('form-reserva');
    form.reset();
    document.getElementById('f-disponibilidad-warning').classList.add('hidden');

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
      document.getElementById('f-notas').value = r.notas || '';
      document.getElementById('btn-eliminar-reserva').classList.remove('hidden');
    } else {
      document.getElementById('modal-reserva-title').textContent = 'Nueva reserva';
      document.getElementById('f-res-id').value = '';
      document.getElementById('btn-eliminar-reserva').classList.add('hidden');
    }
    actualizarInfoNoches();
    modal.classList.remove('hidden');
  }

  function cerrarModal() {
    document.getElementById('modal-reserva').classList.add('hidden');
  }

  function actualizarInfoNoches() {
    const checkin = document.getElementById('f-checkin').value;
    const checkout = document.getElementById('f-checkout').value;
    const noches = nightsBetween(checkin, checkout);
    document.getElementById('f-noches-info').textContent = noches > 0 ? `${noches} noche(s)` : '—';
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
      notas: document.getElementById('f-notas').value.trim(),
    };
    if (payload.checkout <= payload.checkin) {
      showToast('La fecha de check-out debe ser posterior al check-in', true);
      return;
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if (id) {
        await Api.updateReserva({ id, ...payload });
      } else {
        await Api.addReserva(payload);
      }
      await reloadData();
      render();
      Calendario.render();
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
    ['f-checkin', 'f-checkout', 'f-habitacion'].forEach(id => {
      document.getElementById(id).addEventListener('change', actualizarInfoNoches);
    });
    document.querySelectorAll('#modal-reserva [data-close]').forEach(el => {
      el.addEventListener('click', cerrarModal);
    });
  }

  return { render, initEvents, abrirModal };
})();
