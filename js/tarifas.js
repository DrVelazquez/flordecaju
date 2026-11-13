/* ============================================================
   TARIFAS — mismas reglas que calculadora.html (cotizador interno)
   Para cambiar precios, temporadas o feriados editá SOLO este archivo.
   (calculadora.html guarda sus cambios en el navegador de quien la usa,
    así que si cambiás precios allá, repetí el cambio acá.)
   ============================================================ */
(function () {
'use strict';

/* Tarifa por noche (R$) por tipo de unidad y categoría de fecha */
var RATES = {
  suite:  { baja: 220, feriado: 290, alta: 500, pico: 700, revelion: 1100,  carnaval: 630, especial: 415 },   // Suite estándar sin cocina
  studio: { baja: 220, feriado: 290, alta: 550, pico: 850, revelion: 1300,  carnaval: 700, especial: 415 },   // Suite tipo estudio con cocina
  apto:   { baja: 340, feriado: 450, alta: 900, pico: 1500, revelion: 1800, carnaval: 1400, especial: 620 }   // Apartamento
};

/* Cantidad de personas incluidas en la tarifa; por encima se cobra persona extra por noche.
   (Supuesto: suites y estudio incluyen 2 personas; el apartamento incluye hasta 4.) */
var INCLUDED = { suite: 2, studio: 2, apto: 4 };
var EXTRA_FEE = 50;   // R$ por persona extra por noche

/* Máximo de personas por tipo */
var MAX_GUESTS = { apto: 4, studio: 3, suite: 3 };

/* Fechas especiales (noche desde / hasta, ambas incluidas) */
var SPECIALS = [
  { from: '2026-10-30', to: '2026-11-01', cat: 'feriado' },   // Finados
  { from: '2026-11-19', to: '2026-11-21', cat: 'especial' },   // Consciência Negra
  { from: '2027-02-05', to: '2027-02-09', cat: 'carnaval' },  // Carnaval 2027
  { from: '2027-03-25', to: '2027-03-27', cat: 'feriado' },   // Semana Santa
  { from: '2027-04-20', to: '2027-04-20', cat: 'feriado' },   // Tiradentes
  { from: '2027-05-26', to: '2027-05-29', cat: 'feriado' },   // Corpus Christi
  { from: '2027-09-03', to: '2027-09-06', cat: 'feriado' },   // Independência
  { from: '2027-10-08', to: '2027-10-11', cat: 'feriado' },   // Aparecida
  { from: '2027-10-29', to: '2027-11-01', cat: 'feriado' },   // Finados 2027
  { from: '2027-11-12', to: '2027-11-14', cat: 'feriado' },   // Proclamação da República
  { from: '2026-12-24', to: '2026-12-25', cat: 'pico' },      // Navidad 2026
  { from: '2026-12-30', to: '2027-01-02', cat: 'pico' },      // Año Nuevo 2026/27
  { from: '2027-12-24', to: '2027-12-25', cat: 'pico' },      // Navidad 2027      // Navidad 2027
  { from: '2027-12-30', to: '2028-01-01', cat: 'revelion' },
  { from: '2027-01-01', to: '2028-01-02', cat: 'pico' }       // Año Nuevo 2027/28
];

/* ---------- lógica (idéntica a calculadora.html) ---------- */
var PRI = ['pico', 'carnaval', 'alta', 'feriado', 'especial', 'baja'];
function pad(n) { return String(n).padStart(2, '0'); }
function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
function toUTC(s) { var p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
function fromUTC(t) { var d = new Date(t); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
function addDays(s, n) { return fromUTC(toUTC(s) + n * 864e5); }
function categoryOf(s) {
  var md = s.slice(5), found = {};
  if (md >= '12-24' || md <= '02-28') found.alta = 1;   // temporada alta 24 dic – 28 feb
  for (var i = 0; i < SPECIALS.length; i++) {
    var sp = SPECIALS[i];
    if (s >= sp.from && s <= sp.to) found[sp.cat] = 1;
  }
  for (var j = 0; j < PRI.length; j++) if (found[PRI[j]]) return PRI[j];
  return 'baja';
}

/* Devuelve { nights, total } o null si no hay tarifa / fechas inválidas.
   inn y out: 'YYYY-MM-DD' (noche de salida no se cobra). */
function quote(inn, out, type, guests) {
  if (!RATES[type] || !inn || !out || out <= inn) return null;
  var total = 0, nights = 0, s = inn;
  while (s < out) {
    var rate = RATES[type][categoryOf(s)];
    if (!rate) return null;
    total += rate;
    nights++;
    s = addDays(s, 1);
  }
  var extra = Math.max(0, (guests || 1) - INCLUDED[type]);
  total += extra * EXTRA_FEE * nights;
  return { nights: nights, total: total };
}

window.Tarifas = { quote: quote, maxGuests: MAX_GUESTS };
})();
