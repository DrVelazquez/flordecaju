/**
 * Estado en memoria compartido entre las vistas, y utilidades comunes.
 */
const Store = {
  habitaciones: [],
  reservas: [],
  pagos: [],
  mantenimiento: [],
  calMes: new Date().getMonth(),
  calAnio: new Date().getFullYear(),
  contabilidad: { movimientos: [], meses: [], cargado: false },
};

// La contabilidad se carga aparte (recién cuando se abre esa pestaña),
// no en cada reloadData(), porque vive en otra planilla y no cambia con
// cada acción del sistema (reservas, pagos, etc.).
async function reloadContabilidad() {
  const data = await Api.getContabilidad();
  Store.contabilidad.movimientos = data.movimientos || [];
  Store.contabilidad.meses = data.meses || [];
  Store.contabilidad.cargado = true;
}

async function reloadData() {
  setSync('syncing');
  try {
    const data = await Api.getAll();
    Store.habitaciones = data.habitaciones || [];
    Store.reservas = data.reservas || [];
    Store.pagos = data.pagos || [];
    Store.mantenimiento = data.mantenimiento || [];
    setSync('ok');
  } catch (err) {
    setSync('error');
    showToast('No se pudo conectar con la planilla: ' + err.message, true);
    throw err;
  }
}

function setSync(state) {
  const el = document.getElementById('sync-indicator');
  el.classList.remove('error', 'syncing');
  if (state === 'error') el.classList.add('error');
  if (state === 'syncing') el.classList.add('syncing');
}

/**
 * Overlay de carga global: se muestra cada vez que hay una petición al
 * backend en curso (Api.getAll / Api.post), para que no se puedan
 * disparar varios clicks mientras se está sincronizando con la planilla.
 * Usa un contador porque puede haber más de una petición en simultáneo.
 */
let _loadingCount = 0;
function beginLoading() {
  _loadingCount++;
  setGlobalLoading(true);
}
function endLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) setGlobalLoading(false);
}
function setGlobalLoading(isLoading) {
  const overlay = document.getElementById('global-loading');
  if (!overlay) return;
  overlay.classList.toggle('hidden', !isLoading);
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hidden'), 3200);
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fechas siempre en formato DD-MM-AAAA (el valor interno sigue siendo
// AAAA-MM-DD, que es lo que espera <input type="date"> y la planilla).
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function nightsBetween(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const a = new Date(checkin + 'T00:00:00');
  const b = new Date(checkout + 'T00:00:00');
  return Math.max(0, Math.round((b - a) / 86400000));
}

function habitacionNombre(id) {
  const h = Store.habitaciones.find(h => h.id === id);
  return h ? h.nombre : id;
}

function totalPagadoDe(reservaId) {
  return Store.pagos
    .filter(p => p.reserva_id === reservaId)
    .reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
}

function estadoPagoDe(reserva) {
  const pagado = totalPagadoDe(reserva.id);
  const total = Number(reserva.precio_total) || 0;
  if (pagado <= 0) return 'adeuda';
  if (pagado >= total) return 'pagado';
  return 'parcial';
}

/**
 * Devuelve true si dos rangos [aIn, aOut) y [bIn, bOut) se superponen.
 * El check-out de un día coincide con el check-in de otra reserva sin
 * pisarse (la habitación se libera esa mañana).
 */
function rangosSuperpuestos(aIn, aOut, bIn, bOut) {
  return aIn < bOut && bIn < aOut;
}

function reservasActivasEnRango(checkin, checkout, excluirReservaId) {
  return Store.reservas.filter(r => {
    if (r.estado === 'cancelada') return false;
    if (excluirReservaId && r.id === excluirReservaId) return false;
    return rangosSuperpuestos(checkin, checkout, r.checkin, r.checkout);
  });
}

function habitacionesLibresEnRango(checkin, checkout, excluirReservaId) {
  const ocupadasIds = new Set(
    reservasActivasEnRango(checkin, checkout, excluirReservaId).map(r => r.habitacion_id)
  );
  return Store.habitaciones.filter(h => h.activa !== 'NO' && !ocupadasIds.has(h.id));
}

// El color del badge sigue distinguiendo solo Booking vs. el resto (para
// que el gantt y las tablas no se llenen de colores), pero el TEXTO ahora
// muestra el origen específico (WhatsApp, Directo/Walk-in, Otro), útil
// para los reportes. Los datos viejos que solo decían "Manual" se
// muestran igual, como "Manual".
function origenClass(origen) {
  return origen === 'Booking' ? 'origen-booking' : 'origen-manual';
}
function origenLabel(origen) {
  return origen || 'Manual';
}
function origenInitial(origen) {
  return (origenLabel(origen) || 'M').charAt(0).toUpperCase();
}

// ---------- Utilidades de fecha para Reportes ----------

function isoDeDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sumarDias(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDeDate(d);
}
function diasEntre(isoDesde, isoHasta) {
  return Math.round((new Date(isoHasta + 'T00:00:00') - new Date(isoDesde + 'T00:00:00')) / 86400000);
}

function estadiaInfo(r) {
  if (r.checkout_hecho === 'SI') return { label: 'Finalizada', cls: 'finalizada' };
  if (r.checkin_hecho === 'SI') return { label: 'En la pousada', cls: 'en-pousada' };
  return { label: 'Por llegar', cls: 'por-llegar' };
}

// ---------- Panel "Hoy" / Housekeeping ----------

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Reservas activas cuyo check-out ya pasó (o es la fecha de referencia)
// y todavía no se marcó la habitación como limpia. Por defecto usa hoy,
// pero el panel "Hoy" puede pasar una fecha futura (mañana, pasado
// mañana) para anticipar qué hay que tener listo.
function reservasQueNecesitanLimpieza(fechaRef) {
  const ref = fechaRef || hoyISO();
  return Store.reservas.filter(r =>
    r.estado !== 'cancelada' &&
    r.checkout && r.checkout <= ref &&
    r.limpieza_hecha !== 'SI'
  );
}

// true si esa habitación tiene otra reserva activa que llega justo en
// la fecha de referencia (además de la reserva que se quiere excluir,
// típicamente la que se acaba de ir). Por defecto usa hoy.
function llegaHoyAHabitacion(habitacionId, excluirReservaId, fechaRef) {
  const ref = fechaRef || hoyISO();
  return Store.reservas.some(r =>
    r.estado !== 'cancelada' &&
    r.id !== excluirReservaId &&
    r.habitacion_id === habitacionId &&
    r.checkin === ref
  );
}