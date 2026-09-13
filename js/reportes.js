/**
 * Reportes: métricas de ocupación, ingresos y cancelaciones para poder
 * tomar decisiones de precio/administración. Todo se calcula en el
 * cliente a partir de Store.reservas / Store.pagos / Store.habitaciones,
 * no requiere nada nuevo del backend.
 *
 * Definiciones usadas (importante para interpretar los números):
 * - "Facturado" = precio_total de cada reserva activa, prorrateado por
 *   noche y sumado solo por las noches que caen dentro del período
 *   elegido (así una reserva que cruza dos meses no se cuenta doble).
 * - "Cobrado" = suma de los pagos (Api/Store.pagos) cuya fecha cae
 *   dentro del período, sin importar a qué reserva/mes correspondan.
 * - "Ocupación" = noches ocupadas / (habitaciones activas × días del
 *   período).
 * - Las reservas canceladas no suman a facturación ni ocupación, pero
 *   sí se cuentan en "Cancelaciones".
 */
const Reportes = (() => {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const Rep = {
    periodo: 'mes', // 'semana' | 'mes' | 'anio'
    refIso: hoyISO(),
  };

  function inicioSemana(d) {
    const dia = d.getDay(); // 0 = domingo
    const diff = dia === 0 ? -6 : 1 - dia; // arranca el lunes
    const lunes = new Date(d);
    lunes.setDate(d.getDate() + diff);
    lunes.setHours(0, 0, 0, 0);
    return lunes;
  }

  // Rango [start, end) para el período actual (offset 0) o para uno
  // anterior (offset > 0 = esa cantidad de períodos hacia atrás), según
  // el tipo de período elegido. Se usa tanto para el reporte principal
  // como para armar la tendencia de los últimos períodos.
  function calcularRango(offset) {
    const ref = new Date(Rep.refIso + 'T00:00:00');
    if (Rep.periodo === 'semana') {
      ref.setDate(ref.getDate() - 7 * offset);
      const start = inicioSemana(ref);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end };
    }
    if (Rep.periodo === 'anio') {
      const anio = ref.getFullYear() - offset;
      return { start: new Date(anio, 0, 1), end: new Date(anio + 1, 0, 1) };
    }
    // mes
    const start = new Date(ref.getFullYear(), ref.getMonth() - offset, 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() - offset + 1, 1);
    return { start, end };
  }

  function etiquetaRango(start, end) {
    if (Rep.periodo === 'semana') {
      const fin = new Date(end);
      fin.setDate(fin.getDate() - 1);
      return `Semana del ${fmtDate(isoDeDate(start))} al ${fmtDate(isoDeDate(fin))}`;
    }
    if (Rep.periodo === 'anio') {
      return `Año ${start.getFullYear()}`;
    }
    return `${MESES[start.getMonth()]} ${start.getFullYear()}`;
  }

  function etiquetaCorta(start) {
    if (Rep.periodo === 'semana') {
      return `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
    }
    if (Rep.periodo === 'anio') {
      return String(start.getFullYear());
    }
    return MESES_ABR[start.getMonth()];
  }

  function calcularStats(start, end) {
    const startISO = isoDeDate(start);
    const endISO = isoDeDate(end);
    const diasPeriodo = Math.max(1, diasEntre(startISO, endISO));

    const habitaciones = Store.habitaciones.filter(h => h.activa !== 'NO');
    const capacidadNoches = habitaciones.length * diasPeriodo;

    const enPeriodo = Store.reservas.filter(r => r.checkin < endISO && r.checkout > startISO);
    const activas = enPeriodo.filter(r => r.estado !== 'cancelada');
    const canceladas = Store.reservas.filter(r =>
      r.estado === 'cancelada' && r.checkin >= startISO && r.checkin < endISO);

    let nochesOcupadas = 0;
    let facturado = 0;
    const porHabitacion = {};
    const porOrigen = {};

    activas.forEach(r => {
      const totalNoches = nightsBetween(r.checkin, r.checkout) || 1;
      const solapaDesde = r.checkin > startISO ? r.checkin : startISO;
      const solapaHastaExcl = r.checkout < endISO ? r.checkout : endISO;
      const nochesSolapadas = Math.max(0, diasEntre(solapaDesde, solapaHastaExcl));
      if (nochesSolapadas <= 0) return;

      const precioNoche = (Number(r.precio_total) || 0) / totalNoches;
      const facturadoReserva = precioNoche * nochesSolapadas;

      nochesOcupadas += nochesSolapadas;
      facturado += facturadoReserva;

      if (!porHabitacion[r.habitacion_id]) {
        porHabitacion[r.habitacion_id] = { nombre: habitacionNombre(r.habitacion_id), noches: 0, facturado: 0, reservas: 0 };
      }
      porHabitacion[r.habitacion_id].noches += nochesSolapadas;
      porHabitacion[r.habitacion_id].facturado += facturadoReserva;
      porHabitacion[r.habitacion_id].reservas += 1;

      const origenKey = origenLabel(r.origen);
      if (!porOrigen[origenKey]) porOrigen[origenKey] = { reservas: 0, facturado: 0 };
      porOrigen[origenKey].reservas += 1;
      porOrigen[origenKey].facturado += facturadoReserva;
    });

    // Habitaciones sin ninguna reserva en el período igual aparecen en el
    // desglose, con 0 noches ocupadas (es información útil: muestra qué
    // habitación no se está vendiendo).
    habitaciones.forEach(h => {
      if (!porHabitacion[h.id]) porHabitacion[h.id] = { nombre: h.nombre, noches: 0, facturado: 0, reservas: 0 };
    });

    const cobrado = Store.pagos
      .filter(p => p.fecha >= startISO && p.fecha < endISO)
      .reduce((s, p) => s + (Number(p.monto) || 0), 0);

    const ocupacionPct = capacidadNoches > 0 ? (nochesOcupadas / capacidadNoches) * 100 : 0;
    const precioPromedioNoche = nochesOcupadas > 0 ? facturado / nochesOcupadas : 0;
    const totalCheckinsPeriodo = activas.filter(r => r.checkin >= startISO && r.checkin < endISO).length + canceladas.length;
    const tasaCancelacion = totalCheckinsPeriodo > 0 ? (canceladas.length / totalCheckinsPeriodo) * 100 : 0;

    return {
      diasPeriodo, capacidadNoches, nochesOcupadas, facturado, cobrado,
      ocupacionPct, precioPromedioNoche, canceladas: canceladas.length, tasaCancelacion,
      porHabitacion, porOrigen,
    };
  }

  function sugerenciaDePrecio(stats) {
    if (stats.ocupacionPct >= 80) {
      return {
        nivel: 'alta',
        texto: `Ocupación muy alta (${stats.ocupacionPct.toFixed(0)}%). Es un buen momento para subir la tarifa entre 10% y 20%, sobre todo fines de semana y fechas pico, sin perder demanda.`,
      };
    }
    if (stats.ocupacionPct >= 55) {
      return {
        nivel: 'media-alta',
        texto: `Ocupación sólida (${stats.ocupacionPct.toFixed(0)}%). Se podría probar un aumento moderado (5%-10%) en las fechas con más consultas y mantener el resto sin cambios.`,
      };
    }
    if (stats.ocupacionPct >= 30) {
      return {
        nivel: 'media',
        texto: `Ocupación moderada (${stats.ocupacionPct.toFixed(0)}%). Conviene mantener los precios actuales por ahora y prestar atención a la tendencia antes de mover tarifas.`,
      };
    }
    return {
      nivel: 'baja',
      texto: `Ocupación baja (${stats.ocupacionPct.toFixed(0)}%). Puede convenir bajar precio en fechas flojas, ofrecer descuento por estadías largas, o reforzar la difusión en más canales (WhatsApp, redes, Booking).`,
    };
  }

  function render() {
    const { start, end } = calcularRango(0);
    document.getElementById('rep-label').textContent = etiquetaRango(start, end);
    const stats = calcularStats(start, end);

    renderResumen(stats);
    renderTendencia();
    renderSugerencia(stats);
    renderHabitaciones(stats);
    renderOrigen(stats);
  }

  function renderResumen(stats) {
    document.getElementById('rep-summary').innerHTML = `
      <div class="summary-card accent-leaf">
        <div class="label">Cobrado en el período</div>
        <div class="value">${fmtMoney(stats.cobrado)}</div>
      </div>
      <div class="summary-card accent-leaf">
        <div class="label">Facturado (reservado)</div>
        <div class="value">${fmtMoney(stats.facturado)}</div>
      </div>
      <div class="summary-card ${stats.ocupacionPct >= 55 ? 'accent-leaf' : 'accent-fruit'}">
        <div class="label">Ocupación</div>
        <div class="value">${stats.ocupacionPct.toFixed(0)}%</div>
      </div>
      <div class="summary-card">
        <div class="label">Precio prom. / noche</div>
        <div class="value">${fmtMoney(stats.precioPromedioNoche)}</div>
      </div>
      <div class="summary-card ${stats.canceladas > 0 ? 'accent-fruit' : 'accent-leaf'}">
        <div class="label">Cancelaciones</div>
        <div class="value">${stats.canceladas}${stats.tasaCancelacion ? ` (${stats.tasaCancelacion.toFixed(0)}%)` : ''}</div>
      </div>
    `;
  }

  function renderTendencia() {
    const N = 6;
    const puntos = [];
    for (let k = N - 1; k >= 0; k--) {
      const { start, end } = calcularRango(k);
      const stats = calcularStats(start, end);
      puntos.push({ label: etiquetaCorta(start), facturado: stats.facturado, esActual: k === 0 });
    }
    const max = Math.max(1, ...puntos.map(p => p.facturado));

    document.getElementById('rep-tendencia').innerHTML = `
      <div class="rep-bars">
        ${puntos.map(p => `
          <div class="rep-bar-col">
            <div class="rep-bar-value">${fmtMoney(p.facturado)}</div>
            <div class="rep-bar ${p.esActual ? 'actual' : ''}" style="height:${Math.max(4, (p.facturado / max) * 100)}%;"></div>
            <div class="rep-bar-label">${p.label}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderSugerencia(stats) {
    const s = sugerenciaDePrecio(stats);
    document.getElementById('rep-sugerencia').innerHTML = `
      <div class="rep-suggestion-box nivel-${s.nivel}">
        <p>${s.texto}</p>
      </div>
    `;
  }

  function renderHabitaciones(stats) {
    const filas = Object.values(stats.porHabitacion).sort((a, b) => b.facturado - a.facturado);
    const tbody = document.getElementById('rep-habitaciones-body');
    if (filas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="hint-text">No hay habitaciones activas.</td></tr>';
      return;
    }
    tbody.innerHTML = filas.map(f => {
      const ocupacionHab = stats.diasPeriodo > 0 ? (f.noches / stats.diasPeriodo) * 100 : 0;
      const precioProm = f.noches > 0 ? f.facturado / f.noches : 0;
      return `
        <tr>
          <td>${f.nombre}</td>
          <td>${f.noches}</td>
          <td>${ocupacionHab.toFixed(0)}%</td>
          <td>${fmtMoney(precioProm)}</td>
          <td>${fmtMoney(f.facturado)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderOrigen(stats) {
    const entradas = Object.entries(stats.porOrigen).sort((a, b) => b[1].facturado - a[1].facturado);
    const tbody = document.getElementById('rep-origen-body');
    if (entradas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="hint-text">No hay reservas activas en este período.</td></tr>';
      return;
    }
    const totalReservas = entradas.reduce((s, [, v]) => s + v.reservas, 0);
    tbody.innerHTML = entradas.map(([origen, v]) => `
      <tr>
        <td>${origen}</td>
        <td>${v.reservas}</td>
        <td>${totalReservas > 0 ? ((v.reservas / totalReservas) * 100).toFixed(0) : 0}%</td>
        <td>${fmtMoney(v.facturado)}</td>
      </tr>
    `).join('');
  }

  function irAnterior() {
    const ref = new Date(Rep.refIso + 'T00:00:00');
    if (Rep.periodo === 'semana') ref.setDate(ref.getDate() - 7);
    else if (Rep.periodo === 'anio') ref.setFullYear(ref.getFullYear() - 1);
    else ref.setMonth(ref.getMonth() - 1);
    Rep.refIso = isoDeDate(ref);
    render();
  }

  function irSiguiente() {
    const ref = new Date(Rep.refIso + 'T00:00:00');
    if (Rep.periodo === 'semana') ref.setDate(ref.getDate() + 7);
    else if (Rep.periodo === 'anio') ref.setFullYear(ref.getFullYear() + 1);
    else ref.setMonth(ref.getMonth() + 1);
    Rep.refIso = isoDeDate(ref);
    render();
  }

  function initEvents() {
    document.getElementById('rep-prev').addEventListener('click', irAnterior);
    document.getElementById('rep-next').addEventListener('click', irSiguiente);
    document.getElementById('rep-hoy').addEventListener('click', () => {
      Rep.refIso = hoyISO();
      render();
    });
    document.getElementById('rep-periodo').addEventListener('change', (e) => {
      Rep.periodo = e.target.value;
      Rep.refIso = hoyISO();
      render();
    });
  }

  return { render, initEvents };
})();