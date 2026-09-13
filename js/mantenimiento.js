/**
 * Registro de tareas de mantenimiento (reparaciones, pendientes, etc.).
 *
 * Antes esto se guardaba en localStorage (solo en el navegador donde se
 * cargaba la tarea, y se perdía si se borraba la caché). Ahora usa la
 * hoja "Mantenimiento" de la planilla, igual que reservas y pagos, así
 * que se ve desde cualquier celular o computadora y no se pierde.
 */
const Mantenimiento = (() => {
  function poblarSelectHabitaciones() {
    const sel = document.getElementById('m-habitacion');
    if (!sel) return;
    const valorPrevio = sel.value;
    sel.innerHTML = '<option value="">General / toda la pousada</option>' +
      Store.habitaciones.map(h => `<option value="${h.id}">${h.nombre}</option>`).join('');
    if (valorPrevio && [...sel.options].some(o => o.value === valorPrevio)) {
      sel.value = valorPrevio;
    }
  }

  function render() {
    poblarSelectHabitaciones();

    const tareas = Store.mantenimiento || [];
    const pendientes = tareas.filter(t => t.estado !== 'hecho');
    const urgentes = pendientes.filter(t => t.prioridad === 'urgente');

    const info = document.getElementById('mant-info');
    if (info) {
      info.textContent = pendientes.length === 0
        ? 'No hay tareas pendientes.'
        : `${pendientes.length} pendiente(s)${urgentes.length ? ` · ${urgentes.length} urgente(s)` : ''}`;
    }

    const cont = document.getElementById('mant-list');
    if (!cont) return;

    if (tareas.length === 0) {
      cont.innerHTML = '<p class="hint-text">Todavía no cargaste ninguna tarea de mantenimiento.</p>';
      return;
    }

    // Pendientes primero (urgentes arriba de todo), después las resueltas.
    const ordenadas = [...tareas].sort((a, b) => {
      const aHecho = a.estado === 'hecho' ? 1 : 0;
      const bHecho = b.estado === 'hecho' ? 1 : 0;
      if (aHecho !== bHecho) return aHecho - bHecho;
      const aUrg = a.prioridad === 'urgente' ? 0 : 1;
      const bUrg = b.prioridad === 'urgente' ? 0 : 1;
      if (aUrg !== bUrg) return aUrg - bUrg;
      return (b.creado || '').localeCompare(a.creado || '');
    });

    cont.innerHTML = ordenadas.map(t => {
      const habNombre = t.habitacion_id ? habitacionNombre(t.habitacion_id) : 'General';
      const hecho = t.estado === 'hecho';
      return `
        <div class="hoy-item ${hecho ? 'hecho' : ''}">
          <div class="hoy-item-main">
            <span><strong>${habNombre}</strong> · ${t.descripcion}</span>
            <span class="hk-tag ${t.prioridad === 'urgente' ? 'hk-urgente' : 'hk-normal'}">${t.prioridad === 'urgente' ? 'URGENTE' : 'Normal'}</span>
          </div>
          <div class="hoy-item-sub">Creada el ${fmtDate(t.creado)}${hecho ? ' · Resuelta' : ''}</div>
          <div class="mant-actions">
            <button class="btn btn-ghost" data-mant-toggle="${t.id}">${hecho ? 'Reabrir tarea' : 'Marcar resuelta'}</button>
            <button class="btn btn-danger" data-mant-eliminar="${t.id}">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');

    cont.querySelectorAll('[data-mant-toggle]').forEach(el => {
      el.addEventListener('click', () => toggleTarea(el.getAttribute('data-mant-toggle')));
    });
    cont.querySelectorAll('[data-mant-eliminar]').forEach(el => {
      el.addEventListener('click', () => eliminarTarea(el.getAttribute('data-mant-eliminar')));
    });
  }

  async function agregarTarea(e) {
    e.preventDefault();
    const descripcion = document.getElementById('m-descripcion').value.trim();
    if (!descripcion) return;
    const payload = {
      habitacion_id: document.getElementById('m-habitacion').value || '',
      prioridad: document.getElementById('m-prioridad').value,
      descripcion,
      estado: 'pendiente',
      creado: hoyISO(),
    };
    const btn = document.querySelector('#form-mantenimiento button[type=submit]');
    if (btn) btn.disabled = true;
    try {
      await Api.addMantenimiento(payload);
      await reloadData();
      document.getElementById('m-descripcion').value = '';
      document.getElementById('m-prioridad').value = 'normal';
      render();
      showToast('Tarea de mantenimiento agregada');
    } catch (err) {
      showToast('No se pudo guardar la tarea: ' + err.message, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function toggleTarea(id) {
    const t = (Store.mantenimiento || []).find(t => t.id === id);
    if (!t) return;
    const nuevoEstado = t.estado === 'hecho' ? 'pendiente' : 'hecho';
    try {
      await Api.updateMantenimiento({ id, estado: nuevoEstado });
      await reloadData();
      render();
    } catch (err) {
      showToast('No se pudo actualizar la tarea: ' + err.message, true);
    }
  }

  async function eliminarTarea(id) {
    if (!confirm('¿Eliminar esta tarea de mantenimiento?')) return;
    try {
      await Api.deleteMantenimiento(id);
      await reloadData();
      render();
    } catch (err) {
      showToast('No se pudo eliminar la tarea: ' + err.message, true);
    }
  }

  function initEvents() {
    const form = document.getElementById('form-mantenimiento');
    if (form) form.addEventListener('submit', agregarTarea);
  }

  return { render, initEvents };
})();