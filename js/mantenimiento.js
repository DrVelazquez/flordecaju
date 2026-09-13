/**
 * Registro de tareas de mantenimiento (reparaciones, pendientes, etc.).
 *
 * No existe un endpoint en el backend (Apps Script) para esto, así que
 * se guardan en localStorage, en este navegador. Si más adelante se
 * agrega soporte del lado del backend, esta sección se puede migrar a
 * usar Api.* como el resto de los módulos.
 */
const Mantenimiento = (() => {
  const STORAGE_KEY = 'florDeCaju_mantenimiento_v1';

  function cargar() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function guardar(tareas) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tareas));
    } catch (e) {
      showToast('No se pudieron guardar las tareas en este navegador', true);
    }
  }

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

    const tareas = cargar();
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

  function agregarTarea(e) {
    e.preventDefault();
    const descripcion = document.getElementById('m-descripcion').value.trim();
    if (!descripcion) return;
    const tareas = cargar();
    tareas.push({
      id: 'mant_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      habitacion_id: document.getElementById('m-habitacion').value || '',
      prioridad: document.getElementById('m-prioridad').value,
      descripcion,
      estado: 'pendiente',
      creado: hoyISO(),
    });
    guardar(tareas);
    document.getElementById('m-descripcion').value = '';
    document.getElementById('m-prioridad').value = 'normal';
    render();
    showToast('Tarea de mantenimiento agregada');
  }

  function toggleTarea(id) {
    const tareas = cargar();
    const t = tareas.find(t => t.id === id);
    if (!t) return;
    t.estado = t.estado === 'hecho' ? 'pendiente' : 'hecho';
    guardar(tareas);
    render();
  }

  function eliminarTarea(id) {
    if (!confirm('¿Eliminar esta tarea de mantenimiento?')) return;
    const tareas = cargar().filter(t => t.id !== id);
    guardar(tareas);
    render();
  }

  function initEvents() {
    const form = document.getElementById('form-mantenimiento');
    if (form) form.addEventListener('submit', agregarTarea);
  }

  return { render, initEvents };
})();