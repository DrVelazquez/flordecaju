const Calendario = (() => {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  function ocupacionDelDia(dateStr) {
    const totalHabitaciones = Store.habitaciones.filter(h => h.activa !== 'NO').length || 1;
    const ocupadas = new Set();
    Store.reservas.forEach(r => {
      if (r.estado === 'cancelada') return;
      if (r.checkin <= dateStr && dateStr < r.checkout) {
        ocupadas.add(r.habitacion_id);
      }
    });
    return { ocupadas: ocupadas.size, total: totalHabitaciones };
  }

  function render() {
    const grid = document.getElementById('calendario-grid');
    const label = document.getElementById('mes-label');
    const anio = Store.calAnio, mes = Store.calMes;
    label.textContent = `${MESES[mes]} ${anio}`;

    grid.innerHTML = '';
    DOW.forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    const primerDia = new Date(anio, mes, 1);
    // Lunes = 0 ... Domingo = 6
    let offset = (primerDia.getDay() + 6) % 7;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const hoyStr = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < offset; i++) {
      grid.appendChild(celdaVacia());
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const dateStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const { ocupadas, total } = ocupacionDelDia(dateStr);
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      if (dateStr === hoyStr) cell.classList.add('today');

      let statusClass = 'status-libre';
      let statusLabel = 'Libre';
      if (ocupadas >= total) { statusClass = 'status-completo'; statusLabel = 'Completo'; }
      else if (ocupadas > 0) { statusClass = 'status-parcial'; statusLabel = 'Parcial'; }

      cell.innerHTML = `
        <span class="cal-day-num">${dia}</span>
        <span class="cal-day-status ${statusClass}">${statusLabel}</span>
        <span class="cal-day-count">${ocupadas}/${total} ocupadas</span>
      `;
      cell.addEventListener('click', () => {
        document.querySelector('.tab[data-tab="reservas"]').click();
        document.getElementById('filtro-cliente').value = '';
        Reservas.render();
      });
      grid.appendChild(cell);
    }
  }

  function celdaVacia() {
    const el = document.createElement('div');
    el.className = 'cal-day other-month';
    return el;
  }

  function initNav() {
    document.getElementById('mes-prev').addEventListener('click', () => {
      Store.calMes--;
      if (Store.calMes < 0) { Store.calMes = 11; Store.calAnio--; }
      render();
    });
    document.getElementById('mes-next').addEventListener('click', () => {
      Store.calMes++;
      if (Store.calMes > 11) { Store.calMes = 0; Store.calAnio++; }
      render();
    });
  }

  return { render, initNav };
})();
