/**
 * Login simple por contraseña compartida.
 *
 * OJO — límites de esto (para que no genere falsa sensación de seguridad):
 * el frontend solo guarda la contraseña que el usuario escribió y la manda
 * con cada pedido. Quien realmente la valida es el backend (Apps Script):
 * ver la guía que se entregó junto con este código para agregar la
 * verificación del lado del servidor. Sin eso, esta pantalla es cosmética.
 */
const Auth = (() => {
  const TOKEN_KEY = 'florDeCaju_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }
  function isLoggedIn() {
    return !!getToken();
  }

  function mostrarLogin(mensajeError) {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    const err = document.getElementById('login-error');
    if (mensajeError) {
      err.textContent = mensajeError;
      err.classList.remove('hidden');
    } else {
      err.classList.add('hidden');
    }
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
    const btn = document.getElementById('btn-login-submit');
    if (btn) btn.disabled = false;
  }

  function mostrarApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }

  // Llamado por api.js cuando el backend responde que el token es
  // inválido o falta. Se limpia el token guardado y se vuelve a pedir.
  function sesionInvalida(mensaje) {
    clearToken();
    mostrarLogin(mensaje || 'Contraseña incorrecta. Probá de nuevo.');
  }

  async function intentarLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('login-password').value;
    if (!pass) return;
    setToken(pass);
    const btn = document.getElementById('btn-login-submit');
    btn.disabled = true;
    try {
      await window.iniciarApp();
    } finally {
      btn.disabled = false;
    }
  }

  function initEvents() {
    document.getElementById('form-login').addEventListener('submit', intentarLogin);
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (!confirm('¿Cerrar sesión en este navegador?')) return;
        clearToken();
        location.reload();
      });
    }
  }

  return { getToken, setToken, clearToken, isLoggedIn, mostrarLogin, mostrarApp, sesionInvalida, initEvents };
})();