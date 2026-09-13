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
}

boot();