(function initTabs() {
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.getAttribute('data-tab');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + target).classList.add('active');
  });
})();

async function iniciarApp() {
  try {
    await reloadData();
  } catch (e) {
    // Si fue un error de autorización, api.js ya mostró la pantalla de
    // login de nuevo con el mensaje correspondiente; si fue otro error
    // de red, el toast ya se disparó. En ambos casos no seguimos.
    return;
  }
  Auth.mostrarApp();
  Calendario.render();
  Reservas.render();
  Pagos.render();
  Hoy.render();
  Mantenimiento.render();
  Reportes.render();
}
window.iniciarApp = iniciarApp;

function boot() {
  Calendario.initNav();
  Hoy.initNav();
  Reservas.initEvents();
  Pagos.initEvents();
  Mantenimiento.initEvents();
  Reportes.initEvents();
  Auth.initEvents();

  if (Auth.isLoggedIn()) {
    iniciarApp();
  } else {
    Auth.mostrarLogin();
  }
}

boot();