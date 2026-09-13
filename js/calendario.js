const Calendario = (() => {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function esFinDeSemana(anio, mes, dia) {
    const dow = new Date(anio, mes, dia).getDay(); // 0 = domingo, 6 = sábado
    return dow === 0 || dow === 6;
  }

  function render() {
    const anio = Store.calAnio, mes = Store.calMes;
    document.getElementById('mes-label').textContent = `${MESES[mes]} ${anio}`;

    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const habitaciones = Store.habitaciones.filter(h => h.activa !== 'NO');
    const hoy = new Date();
    const hoyDia = (hoy.getFullYear() === anio && hoy.getMonth() === mes) ? hoy.getDate() : -1;

    const wrap = document.getElementById('gantt-wrap');
    const grid = document.createElement('div');
    grid.className = 'gantt-grid';
    grid.style.gridTemplateColumns = `150px repeat(${diasEnMes}, 38px)`;
    grid.style.gridTemplateRows = `40px repeat(${habitaciones.length}, 52px)`;

    // Encabezado
    const labelCorner = document.createElement('div');
    labelCorner.className = 'gantt-header-label';
    labelCorner.style.gridColumn = '1';
    labelCorner.style.gridRow = '1';
    labelCorner.textContent = 'Habitación';
    grid.appendChild(labelCorner);

    for (let d = 1; d <= diasEnMes; d++) {
      const head = document.createElement('div');
      const finde = esFinDeSemana(anio, mes, d);
      head.className = 'gantt-day-header' + (finde ? ' weekend' : '') + (d === hoyDia ? ' today' : '');
      head.style.gridColumn = String(d + 1);
      head.style.gridRow = '1';
      head.innerHTML = `<span>${d}</span>`;
      grid.appendChild(head);
    }

    // Filas por habitación: fondo de celdas + barras de reservas
    habitaciones.forEach((hab, idx) => {
      const fila = idx + 2;
      const label = document.createElement('div');
      label.className = 'gantt-room-label';
      label.style.gridColumn = '1';
      label.style.gridRow = String(fila);
      label.textContent = hab.nombre;
      grid.appendChild(label);

      for (let d = 1; d <= diasEnMes; d++) {
        const cell = document.createElement('div');
        const finde = esFinDeSemana(anio, mes, d);
        cell.className = 'gantt-day-cell' + (finde ? ' weekend' : '') + (d === hoyDia ? ' today' : '');
        cell.style.gridColumn = String(d + 1);
        cell.style.gridRow = String(fila);
        const dateStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cell.addEventListener('click', () => Reservas.abrirModalConDatos(hab.id, dateStr));
        grid.appendChild(cell);
      }

      // Las reservas canceladas no se muestran en el gantt (siguen
      // apareciendo en la pestaña "Reservas", donde queda el registro).
      Store.reservas
        .filter(r => r.habitacion_id === hab.id && r.estado !== 'cancelada')
        .forEach(r => {
          const bar = construirBarra(r, anio, mes, diasEnMes, fila);
          if (bar) grid.appendChild(bar);
        });
    });

    wrap.innerHTML = '';
    wrap.appendChild(grid);
  }

  function construirBarra(r, anio, mes, diasEnMes, fila) {
    const inicioMes = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
    const finMes = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(diasEnMes).padStart(2, '0')}`;
    if (r.checkout <= inicioMes || r.checkin > finMes) return null;

    const diaInicio = r.checkin < inicioMes ? 1 : Number(r.checkin.slice(8, 10));
    const finClipeado = r.checkout > finMes ? diasEnMes + 1 : Number(r.checkout.slice(8, 10));
    const diaFin = Math.max(diaInicio + 1, finClipeado);

    const bar = document.createElement('div');
    const estadia = estadiaInfo(r);
    const pago = estadoPagoDe(r); // 'pagado' | 'parcial' | 'adeuda' -> define el COLOR de la barra
    bar.className = `gantt-bar pago-${pago}${estadia.cls === 'finalizada' ? ' finalizada' : ''}`;
    bar.style.gridColumn = `${diaInicio + 1} / ${diaFin + 1}`;
    bar.style.gridRow = String(fila);
    const pagoLabel = { pagado: 'Pagado', parcial: 'Pago parcial', adeuda: 'Adeuda todo' }[pago];
    bar.title = `${r.cliente_nombre} · ${fmtDate(r.checkin)} a ${fmtDate(r.checkout)} · ${estadia.label} · ${origenLabel(r.origen)} · ${pagoLabel}`;
    bar.innerHTML = `
      <span class="bar-origen-badge ${origenClass(r.origen)}" title="${origenLabel(r.origen)}">${origenInitial(r.origen)}</span>
      <span class="bar-name">${r.cliente_nombre || 'Sin nombre'}</span>
      <span class="bar-estadia-dot estadia-${estadia.cls}" title="${estadia.label}"></span>
    `;
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      Reservas.abrirModal(r.id);
    });
    return bar;
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