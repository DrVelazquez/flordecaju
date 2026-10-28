const Calendario = (() => {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function esFinDeSemana(anio, mes, dia) {
    const dow = new Date(anio, mes, dia).getDay(); // 0 = domingo, 6 = sábado
    return dow === 0 || dow === 6;
  }

  // Días del mes siguiente que se muestran a continuación del mes actual,
  // para poder ver las reservas que están por empezar sin cambiar de mes.
  const DIAS_MES_SIGUIENTE = 7;

  function isoDe(anio, mes, dia) {
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  // Lleva el scroll horizontal para que la columna de "hoy" quede visible
  // (con unos días de contexto a la izquierda). Si el mes mostrado no es el
  // actual, vuelve al principio.
  function irAHoy() {
    const wrap = document.getElementById('gantt-wrap');
    if (!wrap) return;
    const celda = wrap.querySelector('.gantt-day-header.today');
    if (!celda) { wrap.scrollLeft = 0; return; }
    const anchoEtiqueta = 150;
    wrap.scrollLeft = Math.max(0, celda.offsetLeft - anchoEtiqueta - 38 * 2);
  }

  // Vuelve al mes actual y se posiciona en hoy (al abrir la pestaña
  // Calendario o al tocar el botón "Hoy").
  function mostrarHoy() {
    const h = new Date();
    Store.calMes = h.getMonth();
    Store.calAnio = h.getFullYear();
    render();
  }

  function render() {
    const anio = Store.calAnio, mes = Store.calMes;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const totalDias = diasEnMes + DIAS_MES_SIGUIENTE;
    const mesSig = (mes + 1) % 12;
    const anioSig = mes === 11 ? anio + 1 : anio;
    document.getElementById('mes-label').textContent = `${MESES[mes]} ${anio}`;

    const habitaciones = Store.habitaciones.filter(h => h.activa !== 'NO');
    const hoyIso = hoyISO();
    const inicioVentana = isoDe(anio, mes, 1);
    const finVentana = isoDe(anioSig, mesSig, DIAS_MES_SIGUIENTE); // último día mostrado

    // Una entrada por columna: los últimos DIAS_MES_SIGUIENTE son del mes que sigue.
    const dias = [];
    for (let i = 1; i <= totalDias; i++) {
      const sig = i > diasEnMes;
      const a = sig ? anioSig : anio, m = sig ? mesSig : mes, d = sig ? i - diasEnMes : i;
      dias.push({ iso: isoDe(a, m, d), d, finde: esFinDeSemana(a, m, d), sig });
    }

    const wrap = document.getElementById('gantt-wrap');
    const scrollPrevio = wrap.scrollLeft;
    const grid = document.createElement('div');
    grid.className = 'gantt-grid';
    grid.style.gridTemplateColumns = `150px repeat(${totalDias}, 38px)`;
    grid.style.gridTemplateRows = `40px repeat(${habitaciones.length}, 52px)`;

    // Encabezado
    const labelCorner = document.createElement('div');
    labelCorner.className = 'gantt-header-label';
    labelCorner.style.gridColumn = '1';
    labelCorner.style.gridRow = '1';
    labelCorner.textContent = 'Habitación';
    grid.appendChild(labelCorner);

    dias.forEach((dia, idx) => {
      const head = document.createElement('div');
      head.className = 'gantt-day-header' + (dia.finde ? ' weekend' : '') +
        (dia.iso === hoyIso ? ' today' : '') + (dia.sig ? ' next-month' : '') +
        (dia.sig && dia.d === 1 ? ' next-month-start' : '');
      head.style.gridColumn = String(idx + 2);
      head.style.gridRow = '1';
      head.innerHTML = dia.sig && dia.d === 1
        ? `<span class="mes-sig-tag">${MESES[mesSig].slice(0, 3)}</span><span>${dia.d}</span>`
        : `<span>${dia.d}</span>`;
      grid.appendChild(head);
    });

    // Filas por habitación: fondo de celdas + barras de reservas
    habitaciones.forEach((hab, idx) => {
      const fila = idx + 2;
      const label = document.createElement('div');
      label.className = 'gantt-room-label';
      label.style.gridColumn = '1';
      label.style.gridRow = String(fila);
      label.textContent = hab.nombre;
      grid.appendChild(label);

      dias.forEach((dia, i) => {
        const cell = document.createElement('div');
        cell.className = 'gantt-day-cell' + (dia.finde ? ' weekend' : '') +
          (dia.iso === hoyIso ? ' today' : '') + (dia.sig ? ' next-month' : '') +
          (dia.sig && dia.d === 1 ? ' next-month-start' : '');
        cell.style.gridColumn = String(i + 2);
        cell.style.gridRow = String(fila);
        cell.addEventListener('click', () => Reservas.abrirModalConDatos(hab.id, dia.iso));
        grid.appendChild(cell);
      });

      // Las reservas canceladas no se muestran en el gantt (siguen
      // apareciendo en la pestaña "Reservas", donde queda el registro).
      Store.reservas
        .filter(r => r.habitacion_id === hab.id && r.estado !== 'cancelada')
        .forEach(r => {
          const bar = construirBarra(r, inicioVentana, finVentana, totalDias, fila);
          if (bar) grid.appendChild(bar);
        });
    });

    wrap.innerHTML = '';
    wrap.appendChild(grid);
    // Al abrir/cambiar de mes se posiciona en hoy; en refrescos por
    // edición de una reserva se respeta donde estaba el scroll.
    if (render._reposicionar !== false) irAHoy(); else wrap.scrollLeft = scrollPrevio;
    render._reposicionar = false;
  }

  function construirBarra(r, inicioVentana, finVentana, totalDias, fila) {
    // La ventana va del día 1 del mes hasta el último día del mes siguiente mostrado.
    if (r.checkout <= inicioVentana || r.checkin > finVentana) return null;

    const diaInicio = r.checkin < inicioVentana ? 1 : diasEntre(inicioVentana, r.checkin) + 1;
    const finClipeado = r.checkout > finVentana ? totalDias + 1 : diasEntre(inicioVentana, r.checkout) + 1;
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
      render._reposicionar = true;
      render();
    });
    document.getElementById('mes-next').addEventListener('click', () => {
      Store.calMes++;
      if (Store.calMes > 11) { Store.calMes = 0; Store.calAnio++; }
      render._reposicionar = true;
      render();
    });
  }

  function initHoy() {
    const btn = document.getElementById('mes-hoy');
    if (btn) btn.addEventListener('click', () => { render._reposicionar = true; mostrarHoy(); });
  }

  // Se llama al abrir la pestaña Calendario: siempre arranca en "hoy".
  function abrirPestana() {
    render._reposicionar = true;
    mostrarHoy();
  }

  return { render, initNav: () => { initNav(); initHoy(); }, abrirPestana };
})();