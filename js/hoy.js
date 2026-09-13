const Hoy = (() => {
  // Cuántos días de diferencia respecto de hoy se está mirando (0 = hoy,
  // 1 = mañana, 2 = pasado mañana, también se puede retroceder).
  let offsetDias = 0;

  function fechaVista() {
    return sumarDias(hoyISO(), offsetDias);
  }

  function etiquetaDia(offset) {
    if (offset === 0) return 'Hoy';
    if (offset === 1) return 'Mañana';
    if (offset === 2) return 'Pasado mañana';
    if (offset === -1) return 'Ayer';
    return offset > 0 ? `Dentro de ${offset} días` : `Hace ${Math.abs(offset)} días`;
  }

  function render() {
    const fecha = fechaVista();
    document.getElementById('hoy-fecha-label').innerHTML =
      `${etiquetaDia(offsetDias)} · <span id="hoy-fecha">${fmtDate(fecha)}</span>`;
    document.getElementById('hoy-volver').classList.toggle('hidden', offsetDias === 0);

    const activas = Store.reservas.filter(r => r.estado !== 'cancelada');
    const llegadas = activas
      .filter(r => r.checkin === fecha)
      .sort((a, b) => habitacionNombre(a.habitacion_id).localeCompare(habitacionNombre(b.habitacion_id)));
    const salidas = activas
      .filter(r => r.checkout === fecha)
      .sort((a, b) => habitacionNombre(a.habitacion_id).localeCompare(habitacionNombre(b.habitacion_id)));
    const pendientesLimpieza = reservasQueNecesitanLimpieza(fecha);
    const urgentes = pendientesLimpieza.filter(r => llegaHoyAHabitacion(r.habitacion_id, r.id, fecha));

    renderResumen(llegadas.length, salidas.length, urgentes.length, pendientesLimpieza.length);
    renderLlegadas(llegadas);
    renderSalidas(salidas, fecha);
    renderHousekeeping(pendientesLimpieza, fecha);
  }

  function renderResumen(nLlegadas, nSalidas, nUrgentes, nPendientes) {
    const sufijo = offsetDias === 0 ? 'hoy' : etiquetaDia(offsetDias).toLowerCase();
    document.getElementById('hoy-summary').innerHTML = `
      <div class="summary-card accent-leaf">
        <div class="label">Llegadas ${sufijo}</div>
        <div class="value">${nLlegadas}</div>
      </div>
      <div class="summary-card accent-leaf">
        <div class="label">Salidas ${sufijo}</div>
        <div class="value">${nSalidas}</div>
      </div>
      <div class="summary-card ${nUrgentes > 0 ? 'accent-fruit' : 'accent-leaf'}">
        <div class="label">Limpieza urgente</div>
        <div class="value">${nUrgentes}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total por limpiar</div>
        <div class="value">${nPendientes}</div>
      </div>
    `;
  }

  function renderLlegadas(lista) {
    const cont = document.getElementById('hoy-llegadas');
    if (lista.length === 0) {
      cont.innerHTML = '<p class="hint-text">No hay llegadas programadas para este día.</p>';
      return;
    }
    cont.innerHTML = lista.map(r => `
      <div class="hoy-item ${r.checkin_hecho === 'SI' ? 'hecho' : ''}">
        <div class="hoy-item-main">
          <span><strong>${habitacionNombre(r.habitacion_id)}</strong> · ${r.cliente_nombre || 'Sin nombre'}</span>
          <span class="badge-origen ${origenClass(r.origen)}">${origenLabel(r.origen)}</span>
        </div>
        <div class="hoy-item-sub">${r.huespedes || 1} huésped(es) · ${estadoPagoDe(r) === 'pagado' ? 'Pagado' : (estadoPagoDe(r) === 'parcial' ? 'Pago parcial' : 'Adeuda todo')}</div>
        <button class="chip chip-checkin ${r.checkin_hecho === 'SI' ? 'active' : ''}" data-toggle-hoy="checkin" data-id="${r.id}">
          ${r.checkin_hecho === 'SI' ? '✓ Check-in hecho' : 'Marcar check-in'}
        </button>
      </div>
    `).join('');
    wireToggles(cont);
  }

  function renderSalidas(lista, fecha) {
    const cont = document.getElementById('hoy-salidas');
    if (lista.length === 0) {
      cont.innerHTML = '<p class="hint-text">No hay salidas programadas para este día.</p>';
      return;
    }
    cont.innerHTML = lista.map(r => `
      <div class="hoy-item ${r.checkout_hecho === 'SI' ? 'hecho' : ''}">
        <div class="hoy-item-main">
          <span><strong>${habitacionNombre(r.habitacion_id)}</strong> · ${r.cliente_nombre || 'Sin nombre'}</span>
          ${estadoPagoDe(r) !== 'pagado' ? '<span class="hk-tag hk-urgente">Saldo pendiente</span>' : ''}
        </div>
        <div class="hoy-item-sub">${llegaHoyAHabitacion(r.habitacion_id, r.id, fecha) ? 'Ojo: llega otro huésped ese mismo día a esta habitación' : 'Sin llegada inmediata a esta habitación'}</div>
        <button class="chip chip-checkout ${r.checkout_hecho === 'SI' ? 'active' : ''}" data-toggle-hoy="checkout" data-id="${r.id}">
          ${r.checkout_hecho === 'SI' ? '✓ Check-out hecho' : 'Marcar check-out'}
        </button>
      </div>
    `).join('');
    wireToggles(cont);
  }

  function renderHousekeeping(lista, fecha) {
    const cont = document.getElementById('hoy-housekeeping-list');
    if (lista.length === 0) {
      cont.innerHTML = '<p class="hint-text">No hay habitaciones pendientes de limpieza. 🎉</p>';
      return;
    }
    const ordenada = [...lista].sort((a, b) => {
      const aUrg = llegaHoyAHabitacion(a.habitacion_id, a.id, fecha) ? 0 : 1;
      const bUrg = llegaHoyAHabitacion(b.habitacion_id, b.id, fecha) ? 0 : 1;
      return aUrg - bUrg;
    });
    cont.innerHTML = ordenada.map(r => {
      const urgente = llegaHoyAHabitacion(r.habitacion_id, r.id, fecha);
      const yaSeFue = r.checkout_hecho === 'SI';
      let estadoTxt;
      if (urgente && yaSeFue) estadoTxt = 'Ya se fue y llega otro huésped ese día: limpiar cuanto antes';
      else if (urgente) estadoTxt = 'Sale ese día y llega otro huésped el mismo día: limpiar apenas se vaya';
      else if (yaSeFue) estadoTxt = 'Ya hizo check-out; se puede limpiar sin apuro, no llega nadie ese día';
      else if (r.checkout === fecha) estadoTxt = 'Sale ese día (check-out todavía no marcado)';
      else estadoTxt = 'Salida atrasada: revisar si ya se fue';
      return `
        <div class="hoy-item housekeeping-item ${urgente ? 'urgente' : ''}">
          <div class="hoy-item-main">
            <span><strong>${habitacionNombre(r.habitacion_id)}</strong> · ${r.cliente_nombre || ''}</span>
            <span class="hk-tag ${urgente ? 'hk-urgente' : 'hk-normal'}">${urgente ? 'URGENTE' : 'Sin apuro'}</span>
          </div>
          <div class="hoy-item-sub">${estadoTxt} · Salida: ${fmtDate(r.checkout)}</div>
          <button class="btn btn-ghost" data-limpiar="${r.id}">Marcar como limpia</button>
        </div>
      `;
    }).join('');
    cont.querySelectorAll('[data-limpiar]').forEach(el => {
      el.addEventListener('click', () => marcarLimpieza(el.getAttribute('data-limpiar')));
    });
  }

  function wireToggles(cont) {
    cont.querySelectorAll('[data-toggle-hoy]').forEach(el => {
      el.addEventListener('click', () => toggleDesdeHoy(el.getAttribute('data-id'), el.getAttribute('data-toggle-hoy')));
    });
  }

  async function toggleDesdeHoy(id, campo) {
    const r = Store.reservas.find(r => r.id === id);
    if (!r) return;
    const field = campo === 'checkin' ? 'checkin_hecho' : 'checkout_hecho';
    const nuevoValor = r[field] === 'SI' ? 'NO' : 'SI';
    try {
      await Api.updateReserva({ id, [field]: nuevoValor });
      await reloadData();
      render();
      Reservas.render();
      Calendario.render();
      showToast(nuevoValor === 'SI' ? 'Marcado' : 'Desmarcado');
    } catch (err) {
      showToast('No se pudo actualizar: ' + err.message, true);
    }
  }

  async function marcarLimpieza(reservaId) {
    try {
      await Api.updateReserva({ id: reservaId, limpieza_hecha: 'SI' });
      await reloadData();
      render();
      showToast('Habitación marcada como limpia');
    } catch (err) {
      showToast('No se pudo marcar: ' + err.message, true);
    }
  }

  function initNav() {
    document.getElementById('hoy-prev').addEventListener('click', () => {
      offsetDias--;
      render();
    });
    document.getElementById('hoy-next').addEventListener('click', () => {
      offsetDias++;
      render();
    });
    document.getElementById('hoy-volver').addEventListener('click', () => {
      offsetDias = 0;
      render();
    });
  }

  return { render, initNav };
})();