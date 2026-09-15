const Contabilidad = (() => {
  const MESES_NOMBRE = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
  };
  const MESES_ABR = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
  };

  let iniciado = false;

  // ---------- Carga ----------

  async function abrirPestana() {
    if (Store.contabilidad.cargado) {
      posicionarEnMesActual();
      render();
      return;
    }
    await cargar();
  }

  async function cargar() {
    ocultarError();
    setCargando(true);
    try {
      await reloadContabilidad();
      if (!iniciado) {
        document.getElementById('cont-anio').addEventListener('change', () => {
          poblarSelectMes();
          render();
        });
        iniciado = true;
      }
      posicionarEnMesActual();
      render();
    } catch (err) {
      mostrarError('No se pudo cargar la contabilidad: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  // Al abrir (o refrescar) la pestaña, arranca siempre en modo "Mensual"
  // mirando el mes actual. Si todavía no hay datos cargados para el mes
  // actual, cae al año/mes más reciente con movimientos.
  function posicionarEnMesActual() {
    const hoy = new Date();
    const anioActual = String(hoy.getFullYear());
    const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');

    document.getElementById('cont-tipo-periodo').value = 'mes';

    const anios = aniosDisponibles();
    poblarSelectAnio(anios.includes(anioActual) ? anioActual : undefined);
    poblarSelectMes();

    const selMes = document.getElementById('cont-mes');
    const anioSeleccionado = document.getElementById('cont-anio').value;
    const hayMesActual = anioSeleccionado === anioActual &&
      [...selMes.options].some(o => o.value === mesActual);
    if (hayMesActual) selMes.value = mesActual;
  }

  function setCargando(v) {
    const btn = document.getElementById('cont-refrescar');
    if (btn) btn.disabled = v;
  }

  function mostrarError(msg) {
    const el = document.getElementById('cont-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function ocultarError() {
    const el = document.getElementById('cont-error');
    if (el) el.classList.add('hidden');
  }

  // ---------- Selects de período ----------

  function aniosDisponibles() {
    return [...new Set(Store.contabilidad.meses.map(m => m.anio))].sort();
  }

  function poblarSelectAnio(valorPrevio) {
    const sel = document.getElementById('cont-anio');
    const anios = aniosDisponibles();
    sel.innerHTML = anios.map(a => `<option value="${a}">${a}</option>`).join('');
    if (valorPrevio && anios.includes(valorPrevio)) {
      sel.value = valorPrevio;
    } else if (anios.length) {
      sel.value = anios[anios.length - 1];
    }
  }

  function poblarSelectMes() {
    const anio = document.getElementById('cont-anio').value;
    const sel = document.getElementById('cont-mes');
    const valorPrevio = sel.value;
    const meses = Store.contabilidad.meses
      .filter(m => m.anio === anio)
      .sort((a, b) => a.mes.localeCompare(b.mes));
    sel.innerHTML = meses.map(m => `<option value="${m.mes}">${MESES_NOMBRE[m.mes] || m.mes}</option>`).join('');
    if (valorPrevio && meses.some(m => m.mes === valorPrevio)) {
      sel.value = valorPrevio;
    }
  }

  function tipoPeriodo() {
    return document.getElementById('cont-tipo-periodo').value;
  }

  // ---------- Filtrado ----------

  function movimientosFiltrados() {
    const tipo = tipoPeriodo();
    const anio = document.getElementById('cont-anio').value;
    const mes = document.getElementById('cont-mes').value;
    let lista = Store.contabilidad.movimientos;
    if (tipo === 'mes') lista = lista.filter(m => m.anio === anio && m.mes === mes);
    else if (tipo === 'anio') lista = lista.filter(m => m.anio === anio);
    return lista;
  }

  function mesesFiltrados() {
    const tipo = tipoPeriodo();
    const anio = document.getElementById('cont-anio').value;
    if (tipo === 'anio') return Store.contabilidad.meses.filter(m => m.anio === anio);
    if (tipo === 'mes') return Store.contabilidad.meses.filter(m => m.anio === anio && m.mes === document.getElementById('cont-mes').value);
    return Store.contabilidad.meses;
  }

  // ---------- Render ----------

  function render() {
    document.getElementById('cont-mes-wrap').classList.toggle('hidden', tipoPeriodo() !== 'mes');
    document.getElementById('cont-anio-wrap').classList.toggle('hidden', tipoPeriodo() === 'todo');

    const movimientos = movimientosFiltrados();
    const ingresos = movimientos.reduce((s, m) => s + m.ingreso, 0);
    const gastos = movimientos.reduce((s, m) => s + m.gasto, 0);

    renderResumen(ingresos, gastos, movimientos.length);
    renderTendencia();
    renderCategorias(movimientos);
    renderMovimientos(movimientos);
  }

  function renderResumen(ingresos, gastos, cantidad) {
    const saldo = ingresos - gastos;
    document.getElementById('cont-summary').innerHTML = `
      <div class="summary-card accent-leaf">
        <div class="label">Ingresos</div>
        <div class="value">${fmtMoney(ingresos)}</div>
      </div>
      <div class="summary-card accent-fruit">
        <div class="label">Gastos</div>
        <div class="value">${fmtMoney(gastos)}</div>
      </div>
      <div class="summary-card ${saldo >= 0 ? 'accent-leaf' : 'accent-fruit'}">
        <div class="label">Saldo</div>
        <div class="value">${fmtMoney(saldo)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Movimientos</div>
        <div class="value">${cantidad}</div>
      </div>
    `;
  }

  function renderTendencia() {
    const meses = [...mesesFiltrados()].sort((a, b) => (a.anio + a.mes).localeCompare(b.anio + b.mes));
    const cont = document.getElementById('cont-tendencia');
    if (meses.length === 0) {
      cont.innerHTML = '<p class="hint-text">No hay datos para este período.</p>';
      return;
    }
    const max = Math.max(1, ...meses.map(m => Math.max(m.ingresos, m.gastos)));
    cont.innerHTML = `
      <div class="rep-bars">
        ${meses.map(m => `
          <div class="rep-bar-col">
            <div class="rep-bar-value">${fmtMoney(m.saldo)}</div>
            <div class="cont-bar-group">
              <div class="rep-bar cont-bar-ingreso" style="height:${Math.max(4, (m.ingresos / max) * 100)}%;" title="Ingresos: ${fmtMoney(m.ingresos)}"></div>
              <div class="rep-bar cont-bar-gasto" style="height:${Math.max(4, (m.gastos / max) * 100)}%;" title="Gastos: ${fmtMoney(m.gastos)}"></div>
            </div>
            <div class="rep-bar-label">${MESES_ABR[m.mes] || m.mes} ${m.anio.slice(2)}</div>
          </div>
        `).join('')}
      </div>
      <div class="legend" style="margin-top:10px;">
        <span class="legend-item"><i class="dot" style="background:var(--color-leaf-light);"></i> Ingresos</span>
        <span class="legend-item"><i class="dot" style="background:var(--color-fruit);"></i> Gastos</span>
      </div>
    `;
  }

  function renderCategorias(movimientos) {
    const porCategoria = {};
    movimientos.forEach(m => {
      const key = m.categoria || 'Sin categoría';
      if (!porCategoria[key]) porCategoria[key] = { ingresos: 0, gastos: 0 };
      porCategoria[key].ingresos += m.ingreso;
      porCategoria[key].gastos += m.gasto;
    });
    const filas = Object.entries(porCategoria).sort((a, b) => (b[1].gastos + b[1].ingresos) - (a[1].gastos + a[1].ingresos));
    const tbody = document.getElementById('cont-categorias-body');
    if (filas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="hint-text">No hay movimientos en este período.</td></tr>';
      return;
    }
    tbody.innerHTML = filas.map(([cat, v]) => `
      <tr>
        <td>${cat}</td>
        <td>${fmtMoney(v.ingresos)}</td>
        <td>${fmtMoney(v.gastos)}</td>
        <td>${fmtMoney(v.ingresos - v.gastos)}</td>
      </tr>
    `).join('');
  }

  function renderMovimientos(movimientos) {
    const buscar = (document.getElementById('filtro-cont-texto').value || '').toLowerCase();
    let lista = movimientos;
    if (buscar) {
      lista = lista.filter(m =>
        (m.categoria || '').toLowerCase().includes(buscar) ||
        (m.concepto || '').toLowerCase().includes(buscar) ||
        (m.anotaciones || '').toLowerCase().includes(buscar));
    }
    lista = [...lista].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    const tbody = document.getElementById('cont-movimientos-body');
    if (lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="hint-text">No hay movimientos para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(m => `
      <tr>
        <td>${fmtDate(m.fecha)}</td>
        <td>${m.categoria || '—'}</td>
        <td>${m.concepto || '—'}</td>
        <td>${m.metodo_pago || '—'}</td>
        <td>${m.ingreso ? fmtMoney(m.ingreso) : ''}</td>
        <td>${m.gasto ? fmtMoney(m.gasto) : ''}</td>
        <td>${m.anotaciones || ''}</td>
        <td>
          <button class="icon-btn" data-mc-editar="${m.id}" aria-label="Editar">✎</button>
          <button class="icon-btn" data-mc-eliminar="${m.id}" aria-label="Eliminar">🗑</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-mc-editar]').forEach(el => {
      el.addEventListener('click', () => editarMovimiento(el.getAttribute('data-mc-editar')));
    });
    tbody.querySelectorAll('[data-mc-eliminar]').forEach(el => {
      el.addEventListener('click', () => eliminarMovimiento(el.getAttribute('data-mc-eliminar')));
    });
  }

  // ---------- Alta / edición / borrado de movimientos ----------

  async function guardarMovimiento(e) {
    e.preventDefault();
    const id = document.getElementById('mc-id').value;
    const tipo = document.getElementById('mc-tipo').value;
    const monto = Number(document.getElementById('mc-monto').value) || 0;
    const payload = {
      fecha: document.getElementById('mc-fecha').value,
      categoria: document.getElementById('mc-categoria').value.trim(),
      concepto: document.getElementById('mc-concepto').value.trim(),
      metodo_pago: document.getElementById('mc-metodo').value.trim(),
      ingreso: tipo === 'ingreso' ? monto : 0,
      gasto: tipo === 'gasto' ? monto : 0,
      anotaciones: document.getElementById('mc-anotaciones').value.trim(),
    };
    if (!payload.fecha) {
      showToast('Elegí una fecha', true);
      return;
    }
    const btn = document.querySelector('#form-movimiento-contable button[type=submit]');
    btn.disabled = true;
    try {
      if (id) {
        await Api.updateMovimientoContable({ id, ...payload });
        showToast('Movimiento actualizado');
      } else {
        await Api.addMovimientoContable(payload);
        showToast('Movimiento agregado');
      }
      await reloadContabilidad();
      cancelarEdicionMovimiento();
      render();
    } catch (err) {
      showToast('Error al guardar el movimiento: ' + err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  function editarMovimiento(id) {
    const m = Store.contabilidad.movimientos.find(m => m.id === id);
    if (!m) return;
    document.getElementById('mc-id').value = m.id;
    document.getElementById('mc-fecha').value = m.fecha;
    document.getElementById('mc-tipo').value = m.gasto > 0 ? 'gasto' : 'ingreso';
    document.getElementById('mc-monto').value = m.gasto > 0 ? m.gasto : m.ingreso;
    document.getElementById('mc-categoria').value = m.categoria || '';
    document.getElementById('mc-metodo').value = m.metodo_pago || '';
    document.getElementById('mc-concepto').value = m.concepto || '';
    document.getElementById('mc-anotaciones').value = m.anotaciones || '';
    document.getElementById('mc-info').textContent = 'Editando movimiento del ' + fmtDate(m.fecha);
    document.getElementById('btn-mc-cancelar').classList.remove('hidden');
    document.querySelector('#form-movimiento-contable button[type=submit]').textContent = 'Guardar cambios';
    document.getElementById('form-movimiento-contable').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function cancelarEdicionMovimiento() {
    document.getElementById('form-movimiento-contable').reset();
    document.getElementById('mc-id').value = '';
    document.getElementById('mc-info').textContent = '';
    document.getElementById('btn-mc-cancelar').classList.add('hidden');
    document.querySelector('#form-movimiento-contable button[type=submit]').textContent = 'Agregar movimiento';
  }

  async function eliminarMovimiento(id) {
    if (!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer. Si viene de un pago de huésped, esto no borra el pago en la pestaña "Pagos", solo su registro contable.')) return;
    try {
      await Api.deleteMovimientoContable(id);
      await reloadContabilidad();
      render();
      showToast('Movimiento eliminado');
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, true);
    }
  }

  // ---------- Eventos ----------

  function initEvents() {
    document.getElementById('cont-tipo-periodo').addEventListener('change', render);
    document.getElementById('cont-mes').addEventListener('change', render);
    document.getElementById('filtro-cont-texto').addEventListener('input', () => renderMovimientos(movimientosFiltrados()));
    document.getElementById('cont-refrescar').addEventListener('click', cargar);
    document.getElementById('form-movimiento-contable').addEventListener('submit', guardarMovimiento);
    document.getElementById('btn-mc-cancelar').addEventListener('click', cancelarEdicionMovimiento);
  }

  return { abrirPestana, initEvents };
})();