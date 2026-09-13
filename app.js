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

async function boot() {
  if (!Api.hasUrl()) {
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    return;
  }
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  Calendario.initNav();
  Reservas.initEvents();
  Pagos.initEvents();

  try {
    await reloadData();
  } catch (e) {
    // el error ya se muestra en un toast; seguimos para no dejar la UI colgada
  }
  Calendario.render();
  Reservas.render();
  Pagos.render();
  Habitaciones.render();
}

document.getElementById('setup-save').addEventListener('click', () => {
  const val = document.getElementById('setup-url').value.trim();
  if (!val.startsWith('https://script.google.com/')) {
    showToast('Pegá la URL completa que te dio Apps Script (empieza con https://script.google.com/)', true);
    return;
  }
  Api.setUrl(val);
  boot();
});

boot();
