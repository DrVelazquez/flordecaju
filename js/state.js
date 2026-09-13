/**
 * Estado en memoria compartido entre las vistas, y utilidades comunes.
 */
const Store = {
  habitaciones: [],
  reservas: [],
  pagos: [],
  calMes: new Date().getMonth(),
  calAnio: new Date().getFullYear(),
};

async function reloadData() {
  setSync('syncing');
  try {
    const data = await Api.getAll();
    Store.habitaciones = data.habitaciones || [];
    Store.reservas = data.reservas || [];
    Store.pagos = data.pagos || [];
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

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
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

function origenClass(origen) {
  const map = { Web: 'origen-web', WhatsApp: 'origen-whatsapp', Directo: 'origen-directo' };
  return map[origen] || 'origen-otro';
}

function estadiaInfo(r) {
  if (r.checkout_hecho === 'SI') return { label: 'Finalizada', cls: 'finalizada' };
  if (r.checkin_hecho === 'SI') return { label: 'En la pousada', cls: 'en-pousada' };
  return { label: 'Por llegar', cls: 'por-llegar' };
}

