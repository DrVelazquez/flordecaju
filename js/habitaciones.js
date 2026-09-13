const Habitaciones = (() => {
  function render() {
    const cont = document.getElementById('hab-grid');
    cont.innerHTML = Store.habitaciones.map(h => `
      <div class="hab-card">
        <h3 contenteditable="true" data-hab-field="nombre" data-hab-id="${h.id}">${h.nombre}</h3>
        <div class="hab-meta">Capacidad: ${h.capacidad} persona(s)${h.tiene_cocina === 'SI' ? ' · Con cocinita' : ''}</div>
        ${h.notas ? `<div class="hab-tag">${h.notas}</div>` : ''}
      </div>
    `).join('');

    cont.querySelectorAll('[data-hab-field]').forEach(el => {
      el.addEventListener('blur', async () => {
        const id = el.getAttribute('data-hab-id');
        const field = el.getAttribute('data-hab-field');
        const value = el.textContent.trim();
        try {
          await Api.updateHabitacion({ id, [field]: value });
          await reloadData();
          render();
        } catch (err) {
          showToast('No se pudo guardar el nombre: ' + err.message, true);
        }
      });
    });
  }

  return { render };
})();
