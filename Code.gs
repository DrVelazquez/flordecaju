/**
 * POUSADA FLOR DE CAJU - Backend (Google Apps Script)
 * ----------------------------------------------------
 * Este script convierte esta planilla de Google Sheets en una API que
 * la web (alojada en GitHub Pages) usa para leer y escribir reservas.
 *
 * INSTALACION:
 * 1. Abrí tu Google Sheet.
 * 2. Extensiones > Apps Script.
 * 3. Borrá el contenido del archivo "Código.gs" y pegá TODO este archivo.
 * 4. Guardá (icono de disco).
 * 5. Ejecutá la función "setup" una vez (menú de funciones arriba, elegí
 *    "setup" y tocá "Ejecutar"). Te va a pedir autorización, aceptala.
 *    Esto crea las hojas "Habitaciones", "Reservas" y "Pagos" con las
 *    6 habitaciones ya cargadas.
 * 6. Implementar > Nueva implementación > tipo "Aplicación web".
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquier usuario (así el sitio puede leer/escribir)
 * 7. Copiá la URL que te da ("URL de la aplicación web") y pegala en
 *    js/api.js del sitio, en la constante API_URL.
 *
 * Nota sobre seguridad: la URL funciona como una llave. No la publiques
 * en redes ni la compartas; solo debe estar en el código de tu sitio.
 */

const SHEET_HABITACIONES = 'Habitaciones';
const SHEET_RESERVAS = 'Reservas';
const SHEET_PAGOS = 'Pagos';

// ---------- SETUP ----------

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let hab = ss.getSheetByName(SHEET_HABITACIONES);
  if (!hab) hab = ss.insertSheet(SHEET_HABITACIONES);
  hab.clear();
  hab.appendRow(['id', 'nombre', 'capacidad', 'tiene_cocina', 'notas', 'activa']);
  const habitacionesIniciales = [
    ['hab_1', 'Departamento', 4, 'NO', 'Hasta 4 personas', 'SI'],
    ['hab_2', 'Kitnet', 2, 'SI', 'Con cocinita', 'SI'],
    ['hab_3', 'Suite 3', 2, 'SI', 'Con cocinita', 'SI'],
    ['hab_4', 'Suite 4', 2, 'NO', '', 'SI'],
    ['hab_5', 'Suite 5', 2, 'NO', '', 'SI'],
    ['hab_6', 'Suite 6', 2, 'NO', '', 'SI'],
  ];
  hab.getRange(2, 1, habitacionesIniciales.length, 6).setValues(habitacionesIniciales);
  hab.setFrozenRows(1);

  let res = ss.getSheetByName(SHEET_RESERVAS);
  if (!res) res = ss.insertSheet(SHEET_RESERVAS);
  res.clear();
  res.appendRow([
    'id', 'habitacion_id', 'cliente_nombre', 'cliente_telefono', 'cliente_email',
    'checkin', 'checkout', 'huespedes', 'precio_total', 'estado', 'notas', 'creado_en'
  ]);
  res.setFrozenRows(1);

  let pag = ss.getSheetByName(SHEET_PAGOS);
  if (!pag) pag = ss.insertSheet(SHEET_PAGOS);
  pag.clear();
  pag.appendRow(['id', 'reserva_id', 'fecha', 'monto', 'metodo', 'notas']);
  pag.setFrozenRows(1);

  SpreadsheetApp.getUi().alert('Listo. Hojas creadas: Habitaciones, Reservas, Pagos.');
}

// ---------- HELPERS ----------

function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = values.slice(1);
  return rows
    .filter(r => r.join('') !== '') // skip totally empty rows
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) {
          v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
        obj[h] = v;
      });
      return obj;
    });
}

function findRowIndexById(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1; // 1-indexed sheet row
  }
  return -1;
}

function newId(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- READ (GET) ----------

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = (e.parameter.action || 'getAll');

  try {
    if (action === 'getAll') {
      const habitaciones = sheetToObjects(ss.getSheetByName(SHEET_HABITACIONES));
      const reservas = sheetToObjects(ss.getSheetByName(SHEET_RESERVAS));
      const pagos = sheetToObjects(ss.getSheetByName(SHEET_PAGOS));
      return jsonOut({ ok: true, habitaciones, reservas, pagos });
    }
    return jsonOut({ ok: false, error: 'Acción GET desconocida: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// ---------- WRITE (POST) ----------
// El body llega como texto plano (Content-Type: text/plain) para evitar
// el preflight CORS que Apps Script no maneja bien. Acá lo parseamos.

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'JSON inválido' });
  }

  const action = body.action;
  const data = body.data || {};

  try {
    switch (action) {
      case 'addReserva': return addReserva(ss, data);
      case 'updateReserva': return updateReserva(ss, data);
      case 'deleteReserva': return deleteReserva(ss, data);
      case 'addPago': return addPago(ss, data);
      case 'updatePago': return updatePago(ss, data);
      case 'deletePago': return deletePago(ss, data);
      case 'updateHabitacion': return updateHabitacion(ss, data);
      default:
        return jsonOut({ ok: false, error: 'Acción POST desconocida: ' + action });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// ---------- RESERVAS ----------

function addReserva(ss, data) {
  const sheet = ss.getSheetByName(SHEET_RESERVAS);
  const id = newId('res');
  const creado_en = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  sheet.appendRow([
    id,
    data.habitacion_id || '',
    data.cliente_nombre || '',
    data.cliente_telefono || '',
    data.cliente_email || '',
    data.checkin || '',
    data.checkout || '',
    data.huespedes || 1,
    data.precio_total || 0,
    data.estado || 'confirmada',
    data.notas || '',
    creado_en
  ]);
  return jsonOut({ ok: true, id });
}

function updateReserva(ss, data) {
  const sheet = ss.getSheetByName(SHEET_RESERVAS);
  const row = findRowIndexById(sheet, data.id);
  if (row === -1) return jsonOut({ ok: false, error: 'Reserva no encontrada' });

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach((h, i) => {
    if (h === 'id' || h === 'creado_en') return;
    if (data.hasOwnProperty(h)) {
      sheet.getRange(row, i + 1).setValue(data[h]);
    }
  });
  return jsonOut({ ok: true });
}

function deleteReserva(ss, data) {
  const sheet = ss.getSheetByName(SHEET_RESERVAS);
  const row = findRowIndexById(sheet, data.id);
  if (row === -1) return jsonOut({ ok: false, error: 'Reserva no encontrada' });
  sheet.deleteRow(row);

  // También borramos los pagos asociados a esa reserva
  const pagos = ss.getSheetByName(SHEET_PAGOS);
  const values = pagos.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1]) === String(data.id)) {
      pagos.deleteRow(i + 1);
    }
  }
  return jsonOut({ ok: true });
}

// ---------- PAGOS ----------

function addPago(ss, data) {
  const sheet = ss.getSheetByName(SHEET_PAGOS);
  const id = newId('pag');
  sheet.appendRow([
    id,
    data.reserva_id || '',
    data.fecha || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    data.monto || 0,
    data.metodo || '',
    data.notas || ''
  ]);
  return jsonOut({ ok: true, id });
}

function updatePago(ss, data) {
  const sheet = ss.getSheetByName(SHEET_PAGOS);
  const row = findRowIndexById(sheet, data.id);
  if (row === -1) return jsonOut({ ok: false, error: 'Pago no encontrado' });

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach((h, i) => {
    if (h === 'id') return;
    if (data.hasOwnProperty(h)) {
      sheet.getRange(row, i + 1).setValue(data[h]);
    }
  });
  return jsonOut({ ok: true });
}

function deletePago(ss, data) {
  const sheet = ss.getSheetByName(SHEET_PAGOS);
  const row = findRowIndexById(sheet, data.id);
  if (row === -1) return jsonOut({ ok: false, error: 'Pago no encontrado' });
  sheet.deleteRow(row);
  return jsonOut({ ok: true });
}

// ---------- HABITACIONES ----------

function updateHabitacion(ss, data) {
  const sheet = ss.getSheetByName(SHEET_HABITACIONES);
  const row = findRowIndexById(sheet, data.id);
  if (row === -1) return jsonOut({ ok: false, error: 'Habitación no encontrada' });

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach((h, i) => {
    if (h === 'id') return;
    if (data.hasOwnProperty(h)) {
      sheet.getRange(row, i + 1).setValue(data[h]);
    }
  });
  return jsonOut({ ok: true });
}
