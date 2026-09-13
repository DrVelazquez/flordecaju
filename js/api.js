/**
 * Capa de comunicación con el backend (Google Apps Script).
 *
 * La URL de la app web de Apps Script queda fija acá abajo (API_URL),
 * así el sitio se conecta solo, sin pantalla de configuración.
 * Si en algún momento la tenés que cambiar (por ejemplo, si volvés a
 * implementar el script y te da una URL nueva), simplemente reemplazá
 * el valor de API_URL por la nueva.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbzGRgp1FYBf_UYjfPXS5ATkpQMGT6fkoKQIouuGxkMy6BGiQigO_v_CvfeGsv3nMiWz9g/exec';

const Api = (() => {
  function getUrl() {
    return API_URL;
  }
  function hasUrl() {
    return !!API_URL;
  }

  async function getAll() {
    beginLoading();
    try {
      const res = await fetch(`${getUrl()}?action=getAll`);
      if (!res.ok) throw new Error('Error de red al leer los datos');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error desconocido');
      return json;
    } finally {
      endLoading();
    }
  }

  // Content-Type text/plain a propósito: evita el preflight OPTIONS
  // que Google Apps Script no responde bien, así funciona desde
  // GitHub Pages sin configuración extra de CORS.
  async function post(action, data) {
    beginLoading();
    try {
      const res = await fetch(getUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data }),
      });
      if (!res.ok) throw new Error('Error de red al guardar los datos');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error desconocido');
      return json;
    } finally {
      endLoading();
    }
  }

  return {
    getUrl, hasUrl, getAll,
    addReserva: (data) => post('addReserva', data),
    updateReserva: (data) => post('updateReserva', data),
    deleteReserva: (id) => post('deleteReserva', { id }),
    addPago: (data) => post('addPago', data),
    updatePago: (data) => post('updatePago', data),
    deletePago: (id) => post('deletePago', { id }),
    updateHabitacion: (data) => post('updateHabitacion', data),
  };
})();
