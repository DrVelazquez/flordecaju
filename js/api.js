/**
 * Capa de comunicación con el backend (Google Apps Script).
 * La URL se guarda en localStorage para que cada quien pueda apuntar
 * a su propia copia de la planilla sin tocar el código.
 */
const Api = (() => {
  function getUrl() {
    return localStorage.getItem('flordecaju_api_url') || '';
  }
  function setUrl(url) {
    localStorage.setItem('flordecaju_api_url', url.trim());
  }
  function hasUrl() {
    return !!getUrl();
  }

  async function getAll() {
    const res = await fetch(`${getUrl()}?action=getAll`);
    if (!res.ok) throw new Error('Error de red al leer los datos');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error desconocido');
    return json;
  }

  // Content-Type text/plain a propósito: evita el preflight OPTIONS
  // que Google Apps Script no responde bien, así funciona desde
  // GitHub Pages sin configuración extra de CORS.
  async function post(action, data) {
    const res = await fetch(getUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data }),
    });
    if (!res.ok) throw new Error('Error de red al guardar los datos');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error desconocido');
    return json;
  }

  return {
    getUrl, setUrl, hasUrl, getAll,
    addReserva: (data) => post('addReserva', data),
    updateReserva: (data) => post('updateReserva', data),
    deleteReserva: (id) => post('deleteReserva', { id }),
    addPago: (data) => post('addPago', data),
    updatePago: (data) => post('updatePago', data),
    deletePago: (id) => post('deletePago', { id }),
    updateHabitacion: (data) => post('updateHabitacion', data),
  };
})();
