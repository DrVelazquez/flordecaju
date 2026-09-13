const Pagos = (() => {
  function render() {
    const filtradas = obtenerFiltradas();
    renderResumen(filtradas);
    renderTabla(filtradas);
  }

  // Mismo criterio de filtro (cliente + rango de fechas por superposición
  // de estadía) usado tanto para la tabla como para las tarjetas de
  // resumen, así los números de arriba siempre coinciden con lo que se
  // ve filtrado abajo.
  function obtenerFiltradas() {
    const buscar = (document.getElementById('filtro-pagos-cliente').value || '').toLowerCase();
    const desde = document.getElementById('filtro-pagos-desde').value;
    const hasta = document.getElementById('filtro-pagos-hasta').value;

    let activas = Store.reservas.filter(r => r.estado !== 'cancelada');
    if (buscar) activas = activas.filter(r => (r.cliente_nombre || '').toLowerCase().includes(buscar));
    if (desde || hasta) {
      const rangoDesde = desde || '0000-01-01';
      const rangoHasta = hasta || '9999-12-31';
      activas = activas.filter(r => r.checkin <= rangoHasta && r.checkout >= rangoDesde);
    }
    return activas;
  }

  function renderResumen(filtradas) {
    const activas = filtradas || obtenerFiltradas();
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

  function renderTabla(filtradas) {
    const tbody = document.getElementById('tbl-pagos-body');
    const buscar = (document.getElementById('filtro-pagos-cliente').value || '').toLowerCase();
    const desde = document.getElementById('filtro-pagos-desde').value;
    const hasta = document.getElementById('filtro-pagos-hasta').value;

    let activas = [...(filtradas || obtenerFiltradas())]
      .sort((a, b) => (a.checkin || '').localeCompare(b.checkin || ''));

    const totalActivas = Store.reservas.filter(r => r.estado !== 'cancelada').length;
    const infoEl = document.getElementById('pagos-filtro-info');
    if (buscar || desde || hasta) {
      infoEl.textContent = `Mostrando ${activas.length} de ${totalActivas} reserva(s) — filtradas. Los totales de arriba también corresponden a este filtro. Usá "Limpiar fechas" o vaciá el buscador para ver todo.`;
    } else {
      infoEl.textContent = '';
    }

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
          Hoy.render();
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
      Hoy.render();
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
    document.getElementById('filtro-pagos-cliente').addEventListener('input', render);
    document.getElementById('filtro-pagos-desde').addEventListener('change', render);
    document.getElementById('filtro-pagos-hasta').addEventListener('change', render);
    document.getElementById('btn-filtro-pagos-limpiar').addEventListener('click', () => {
      document.getElementById('filtro-pagos-desde').value = '';
      document.getElementById('filtro-pagos-hasta').value = '';
      render();
    });
  }

  return { render, initEvents, abrirModal };
})();