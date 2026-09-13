const Pagos = (() => {
  function render() {
    renderResumen();
    renderTabla();
  }

  function renderResumen() {
    const activas = Store.reservas.filter(r => r.estado !== 'cancelada');
    const totalReservado = activas.reduce((s, r) => s + (Number(r.precio_total) || 0), 0);
    const totalPagado = activas.reduce((s, r) => s + totalPagadoDe(r.id), 0);
    const totalAdeudado = totalReservado - totalPagado;
    const cantAdeuda = activas.filter(r => estadoPagoDe(r) !== 'pagado').length;

    document.getElementById('pagos-summary').innerHTML = `
      <div class="summary-card accent-leaf">
        <div class="label">Total reservado</div>
        <div class="value">${fmtMoney(totalReservado)}</div>
      </div>
      <div class="summary-card accent-leaf">
        <div class="label">Total cobrado</div>
        <div class="value">${fmtMoney(totalPagado)}</div>
      </div>
      <div class="summary-card accent-fruit">
        <div class="label">Saldo pendiente</div>
        <div class="value">${fmtMoney(totalAdeudado)}</div>
      </div>
      <div class="summary-card accent-fruit">
        <div class="label">Reservas con saldo</div>
        <div class="value">${cantAdeuda}</div>
      </div>
    `;
  }

  function renderTabla() {
    const tbody = document.getElementById('tbl-pagos-body');
    const activas = [...Store.reservas]
      .filter(r => r.estado !== 'cancelada')
      .sort((a, b) => (a.checkin || '').localeCompare(b.checkin || ''));

    tbody.innerHTML = activas.map(r => {
      const pagado = totalPagadoDe(r.id);
      const total = Number(r.precio_total) || 0;
      const saldo = total - pagado;
      const estado = estadoPagoDe(r);
      const labels = { pagado: 'Pagado', parcial: 'Pago parcial', adeuda: 'Adeuda todo' };
      return `
        <tr>
          <td>${r.cliente_nombre || '—'}</td>
          <td>${habitacionNombre(r.habitacion_id)}</td>
          <td>${fmtMoney(total)}</td>
          <td>${fmtMoney(pagado)}</td>
          <td>${fmtMoney(saldo)}</td>
          <td><span class="badge badge-${estado}">${labels[estado]}</span></td>
          <td><button class="btn btn-ghost" data-abrir-pago="${r.id}">Registrar pago</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-abrir-pago]').forEach(el => {
      el.addEventListener('click', () => abrirModal(el.getAttribute('data-abrir-pago')));
    });
  }

  function abrirModal(reservaId) {
    const r = Store.reservas.find(r => r.id === reservaId);
    if (!r) return;
    document.getElementById('p-reserva-id').value = reservaId;
    document.getElementById('p-reserva-info').textContent =
      `${r.cliente_nombre} · ${habitacionNombre(r.habitacion_id)} · Total ${fmtMoney(r.precio_total)} · Saldo ${fmtMoney((Number(r.precio_total) || 0) - totalPagadoDe(reservaId))}`;
    document.getElementById('p-fecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('p-monto').value = '';
    document.getElementById('p-metodo').value = 'Pix';
    document.getElementById('p-notas').value = '';
    renderHistorial(reservaId);
    document.getElementById('modal-pago').classList.remove('hidden');
  }

  function renderHistorial(reservaId) {
    const historial = Store.pagos.filter(p => p.reserva_id === reservaId);
    const cont = document.getElementById('pagos-historial');
    if (historial.length === 0) {
      cont.innerHTML = '<h4>Pagos registrados</h4><p class="hint-text">Todavía no hay pagos para esta reserva.</p>';
      return;
    }
    cont.innerHTML = '<h4>Pagos registrados</h4>' + historial.map(p => `
      <div class="pago-row">
        <span>${fmtDate(p.fecha)} · ${p.metodo} · ${fmtMoney(p.monto)}${p.notas ? ' · ' + p.notas : ''}</span>
        <button data-del-pago="${p.id}">Eliminar</button>
      </div>
    `).join('');

    cont.querySelectorAll('[data-del-pago]').forEach(el => {
      el.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este pago?')) return;
        try {
          await Api.deletePago(el.getAttribute('data-del-pago'));
          await reloadData();
          renderHistorial(reservaId);
          render();
          Reservas.render();
          Calendario.render();
        } catch (err) {
          showToast('Error al eliminar el pago: ' + err.message, true);
        }
      });
    });
  }

  function cerrarModal() {
    document.getElementById('modal-pago').classList.add('hidden');
  }

  async function guardar(e) {
    e.preventDefault();
    const payload = {
      reserva_id: document.getElementById('p-reserva-id').value,
      fecha: document.getElementById('p-fecha').value,
      monto: Number(document.getElementById('p-monto').value) || 0,
      metodo: document.getElementById('p-metodo').value,
      notas: document.getElementById('p-notas').value.trim(),
    };
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await Api.addPago(payload);
      await reloadData();
      render();
      Reservas.render();
      Calendario.render();
      renderHistorial(payload.reserva_id);
      document.getElementById('p-monto').value = '';
      showToast('Pago registrado');
    } catch (err) {
      showToast('Error al registrar el pago: ' + err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  function initEvents() {
    document.getElementById('form-pago').addEventListener('submit', guardar);
    document.querySelectorAll('#modal-pago [data-close]').forEach(el => {
      el.addEventListener('click', cerrarModal);
    });
  }

  return { render, initEvents, abrirModal };
})();