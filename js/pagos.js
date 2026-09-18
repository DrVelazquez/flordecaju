const Pagos = (() => {
  function render() {
    renderPeriodo();
    renderCuentas();
  }

  // ---------- Dinero cobrado en un período ----------
  // OJO: esto se calcula a partir de la FECHA DEL PAGO (p.fecha), no de
  // las fechas de check-in/check-out de la reserva. Antes se sumaba el
  // total pagado de cada reserva que "tocaba" el rango elegido, así que
  // una reserva larga (ej: del 1 de septiembre al 1 de enero) con un
  // único pago hecho en septiembre aparecía sumada otra vez en octubre,
  // noviembre, diciembre... aunque ese día no hubiera entrado plata
  // nueva. Ahora cada pago solo cuenta en el día en que efectivamente
  // se registró.
  function obtenerPagosDelPeriodo() {
    const desde = document.getElementById('filtro-pagos-desde').value;
    const hasta = document.getElementById('filtro-pagos-hasta').value;
    const rangoDesde = desde || '0000-01-01';
    const rangoHasta = hasta || '9999-12-31';
    return Store.pagos
      .filter(p => (p.fecha || '') >= rangoDesde && (p.fecha || '') <= rangoHasta)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }

  function renderPeriodo() {
    const pagos = obtenerPagosDelPeriodo();
    const desde = document.getElementById('filtro-pagos-desde').value;
    const hasta = document.getElementById('filtro-pagos-hasta').value;

    const totalCobrado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    document.getElementById('pagos-summary').innerHTML = `
      <div class="summary-card accent-leaf">
        <div class="label">Total cobrado en el período</div>
        <div class="value">${fmtMoney(totalCobrado)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Cantidad de pagos</div>
        <div class="value">${pagos.length}</div>
      </div>
    `;

    const infoEl = document.getElementById('pagos-filtro-info');
    if (desde || hasta) {
      infoEl.textContent = `Mostrando pagos registrados entre ${desde ? fmtDate(desde) : 'el inicio'} y ${hasta ? fmtDate(hasta) : 'hoy'}.`;
    } else {
      infoEl.textContent = 'Mostrando todos los pagos registrados. Elegí un rango de fechas para ver cuánto entró en un día, semana o mes puntual.';
    }

    const tbody = document.getElementById('tbl-pagos-periodo-body');
    if (pagos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="hint-text">No hay pagos registrados en este período.</td></tr>';
      return;
    }
    tbody.innerHTML = pagos.map(p => {
      const r = Store.reservas.find(res => res.id === p.reserva_id);
      return `
        <tr>
          <td>${fmtDate(p.fecha)}</td>
          <td>${r ? (r.cliente_nombre || '—') : '—'}</td>
          <td>${r ? habitacionNombre(r.habitacion_id) : '—'}</td>
          <td>${p.metodo || '—'}</td>
          <td>${fmtMoney(p.monto)}</td>
          <td>${p.notas || ''}</td>
          <td>
            ${r ? `<button class="btn btn-ghost" data-abrir-pago="${r.id}">Ver reserva</button>` : ''}
            <button class="btn btn-danger" data-del-pago-periodo="${p.id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-abrir-pago]').forEach(el => {
      el.addEventListener('click', () => abrirModal(el.getAttribute('data-abrir-pago')));
    });
    tbody.querySelectorAll('[data-del-pago-periodo]').forEach(el => {
      el.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este pago?')) return;
        try {
          await Api.deletePago(el.getAttribute('data-del-pago-periodo'));
          await reloadData();
          invalidarContabilidad();
          render();
          Reservas.render();
          Calendario.render();
          Hoy.render();
          showToast('Pago eliminado');
        } catch (err) {
          showToast('Error al eliminar el pago: ' + err.message, true);
        }
      });
    });
  }

  // ---------- Estado de cuentas ----------
  // Saldo total (histórico, no acotado a un rango) por reserva activa:
  // esto es intencionalmente independiente del filtro de fecha de
  // arriba, porque "cuánto debe todavía" no es algo que tenga sentido
  // recortar por día — es un acumulado a hoy.
  function obtenerReservasCuentas() {
    const buscar = (document.getElementById('filtro-pagos-cliente').value || '').toLowerCase();
    let activas = Store.reservas.filter(r => r.estado !== 'cancelada');
    if (buscar) activas = activas.filter(r => (r.cliente_nombre || '').toLowerCase().includes(buscar));
    return activas.sort((a, b) => (a.checkin || '').localeCompare(b.checkin || ''));
  }

  function renderCuentas() {
    const tbody = document.getElementById('tbl-pagos-body');
    const activas = obtenerReservasCuentas();
    if (activas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="hint-text">No hay reservas para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = activas.map(r => {
      const pagado = totalPagadoDe(r.id);
      const total = totalACobrarDe(r);
      const saldo = saldoPendienteDe(r);
      const extrasPend = totalConsumosPendientesDe(r.id);
      const estado = estadoPagoDe(r);
      const labels = { pagado: 'Pagado', parcial: 'Pago parcial', adeuda: 'Adeuda todo' };
      return `
        <tr>
          <td>${r.cliente_nombre || '—'}</td>
          <td>${habitacionNombre(r.habitacion_id)}</td>
          <td>${fmtMoney(total)}${extrasPend > 0 ? `<div class="hint-text" style="padding-top:2px;">incl. ${fmtMoney(extrasPend)} en extras</div>` : ''}</td>
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
    const extrasPend = totalConsumosPendientesDe(reservaId);
    document.getElementById('p-reserva-info').textContent =
      `${r.cliente_nombre} · ${habitacionNombre(r.habitacion_id)} · Total ${fmtMoney(totalACobrarDe(r))} · Saldo ${fmtMoney(saldoPendienteDe(r))}` +
      (extrasPend > 0
        ? ` · Ojo: incluye ${fmtMoney(extrasPend)} de extras sin cobrar. Para no duplicarlos en Contabilidad, cobralos desde la reserva (sección "Consumos / extras") y acá registrá solo el pago del hospedaje.`
        : '');
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
          invalidarContabilidad();
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
      invalidarContabilidad();
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
    document.getElementById('filtro-pagos-cliente').addEventListener('input', renderCuentas);
    document.getElementById('filtro-pagos-desde').addEventListener('change', renderPeriodo);
    document.getElementById('filtro-pagos-hasta').addEventListener('change', renderPeriodo);
    document.getElementById('btn-filtro-pagos-limpiar').addEventListener('click', () => {
      document.getElementById('filtro-pagos-desde').value = '';
      document.getElementById('filtro-pagos-hasta').value = '';
      renderPeriodo();
    });
  }

  return { render, initEvents, abrirModal };
})();