/* ==========================================================================
   Comprobante de reserva / pago (PDF en portugués) — Flor de Caju
   Se genera 100% en el navegador con jsPDF (se carga solo al primer click).
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1) DATOS DE LA POUSADA: COMPLETAR ---------- */
  const POSADA = {
    nombre: 'Pousada Flor de Caju',
    cnpj: '',                                   // ej: '00.000.000/0001-00' (vacío = no se muestra)
    direccion: 'Rua do Céu, Pipa',
    ciudad: 'Tibau do Sul — RN, Brasil',
    telefono: '',                               // ej: '+55 84 9 XXXX-XXXX' (vacío = no se muestra)
    email: 'reservas@flordecaju.com.br',
    web: 'Instagram: @flordecaju.pipa'
  };

  const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const COLOR = { principal: [214, 90, 49], texto: [40, 40, 40], suave: [120, 120, 120], linea: [220, 220, 220], ok: [46, 139, 87], warn: [217, 130, 20], bad: [192, 57, 43] };

  /* ---------- 2) DATOS DESDE Store (state.js) ---------- */
  function obtenerDatos(reservaId) {
    const r = Store.reservas.find(x => x.id === reservaId);
    if (!r) throw new Error('No encontré la reserva (¿está guardada?).');

    const pagos = Store.pagos
      .filter(p => p.reserva_id === r.id)
      .map(p => ({ fecha: p.fecha, monto: Number(p.monto) || 0, metodo: p.metodo, notas: p.notas }))
      .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));

    const consumos = Store.consumos
      .filter(c => c.reserva_id === r.id)
      .map(c => ({ fecha: c.fecha, descripcion: c.descripcion, monto: Number(c.monto) || 0, metodo: consumoCobrado(c) ? c.metodo_pago : '' }))
      .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));

    return {
      id: r.id,
      cliente: r.cliente_nombre,
      telefone: r.cliente_telefono,
      email: r.cliente_email,
      habitacion: habitacionNombre(r.habitacion_id),
      huespedes: r.huespedes || 1,
      checkin: r.checkin,
      checkout: r.checkout,
      total: Number(r.precio_total) || 0,
      origen: r.origen,
      estado: r.estado,
      notas: r.notas,
      pagos,
      consumos
    };
  }

  /* ---------- 3) FORMATOS ---------- */
  const brl = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0).replace(/\u00A0/g, ' ');
  function fecha(iso) {
    if (!iso) return '—';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
  }
  function noches(a, b) {
    const ma = String(a).match(/^(\d{4})-(\d{2})-(\d{2})/), mb = String(b).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!ma || !mb) return 0;
    return Math.round((Date.UTC(+mb[1], +mb[2] - 1, +mb[3]) - Date.UTC(+ma[1], +ma[2] - 1, +ma[3])) / 86400000);
  }
  // Los métodos y algunas notas automáticas se guardan en español: se traducen para el PDF.
  const METODOS_PT = { Pix: 'Pix', Efectivo: 'Dinheiro', Transferencia: 'Transferência', Tarjeta: 'Cartão', Otro: 'Outro' };
  const metodoPT = m => METODOS_PT[m] || m || '—';
  const notaPT = n => String(n || '').replace('Pago inicial al crear la reserva', 'Pagamento inicial').replace(/^Seña$/i, 'Sinal');
  const slug = s => String(s || 'hospede').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');

  /* ---------- 4) CARGA PEREZOSA DE jsPDF ---------- */
  function cargarJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSPDF_URL;
      s.onload = () => (window.jspdf && window.jspdf.jsPDF) ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF no se inicializó'));
      s.onerror = () => reject(new Error('No se pudo cargar jsPDF (¿sin internet?)'));
      document.head.appendChild(s);
    });
  }

  /* ---------- 5) GENERACIÓN DEL PDF ---------- */
  async function generarPDF(d) {
    const JsPDF = await cargarJsPdf();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 16, R = W - M;
    let y = 0;

    const setC = c => doc.setTextColor(c[0], c[1], c[2]);
    const ensure = h => { if (y + h > 280) { doc.addPage(); y = 20; } };

    function seccion(titulo) {
      ensure(14);
      y += 4;
      doc.setFillColor(...COLOR.principal);
      doc.rect(M, y - 4, 1.6, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setC(COLOR.texto);
      doc.text(titulo.toUpperCase(), M + 4, y);
      y += 3;
      doc.setDrawColor(...COLOR.linea); doc.line(M, y, R, y);
      y += 5;
    }
    function fila(label, valor, x = M, w = 80) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setC(COLOR.suave);
      doc.text(label, x, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setC(COLOR.texto);
      const lines = doc.splitTextToSize(String(valor || '—'), w);
      doc.text(lines, x, y + 4.5);
      return 4.5 + lines.length * 4.5;
    }
    function par(l1, v1, l2, v2) {
      ensure(14);
      const h1 = fila(l1, v1, M, 82);
      const h2 = l2 ? fila(l2, v2, M + 90, 80) : 0;
      y += Math.max(h1, h2) + 2;
    }

    // ----- Cabecera -----
    doc.setFillColor(...COLOR.principal);
    doc.rect(0, 0, W, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text(POSADA.nombre, M, 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('COMPROVANTE DE RESERVA E PAGAMENTO', M, 23);
    const emitido = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(9);
    doc.text(`Emitido em ${emitido}`, R, 15, { align: 'right' });
    doc.text(`Reserva nº ${String(d.id).slice(-8).toUpperCase()}`, R, 21, { align: 'right' });
    y = 42;

    // ----- Pousada -----
    seccion('Dados da pousada');
    const linPousada = [
      POSADA.cnpj && `CNPJ: ${POSADA.cnpj}`,
      [POSADA.direccion, POSADA.ciudad].filter(Boolean).join(' — '),
      [POSADA.telefono && `Tel/WhatsApp: ${POSADA.telefono}`, POSADA.email, POSADA.web].filter(Boolean).join('  ·  ')
    ].filter(Boolean);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setC(COLOR.texto);
    doc.text(POSADA.nombre, M, y); y += 5;
    linPousada.forEach(l => { doc.text(doc.splitTextToSize(l, R - M), M, y); y += 5; });

    // ----- Hóspede -----
    seccion('Dados do hóspede');
    par('Nome', d.cliente, 'Telefone', d.telefone);
    par('E-mail', d.email, 'Nº de hóspedes', d.huespedes);

    // ----- Reserva -----
    seccion('Dados da reserva');
    const n = noches(d.checkin, d.checkout);
    par('Acomodação', d.habitacion, 'Noites', n ? String(n) : '—');
    par('Check-in', fecha(d.checkin), 'Check-out', fecha(d.checkout));

    // ----- Financeiro -----
    const extrasCobrados = d.consumos.filter(c => c.metodo);
    const extrasPend = d.consumos.filter(c => !c.metodo);
    const totExtras = d.consumos.reduce((s, c) => s + c.monto, 0);
    const totPagosReserva = d.pagos.reduce((s, p) => s + p.monto, 0);
    const totExtrasCobrados = extrasCobrados.reduce((s, c) => s + c.monto, 0);
    const totalGeral = d.total + totExtras;
    const pagoTotal = totPagosReserva + totExtrasCobrados;
    const saldo = Math.max(totalGeral - pagoTotal, 0);

    seccion('Resumo financeiro');
    const linea = (label, valor, bold, color) => {
      ensure(7);
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11 : 10); setC(color || COLOR.texto);
      doc.text(label, M, y);
      doc.text(valor, R, y, { align: 'right' });
      y += bold ? 7 : 6;
    };
    linea(`Hospedagem${n ? ` (${n} ${n === 1 ? 'noite' : 'noites'})` : ''}`, brl(d.total));
    if (d.consumos.length) linea('Consumos / extras', brl(totExtras));
    doc.setDrawColor(...COLOR.linea); doc.line(M, y - 3, R, y - 3);
    linea('Total', brl(totalGeral), true);
    linea('Total pago', brl(pagoTotal), true, COLOR.ok);
    linea('Saldo a pagar', brl(saldo), true, saldo > 0 ? COLOR.bad : COLOR.ok);

    // Selo de situação
    const sit = d.estado === 'cancelada' ? ['RESERVA CANCELADA', COLOR.suave] : saldo <= 0.005 && totalGeral > 0 ? ['PAGO', COLOR.ok] : (pagoTotal > 0 ? ['PAGAMENTO PARCIAL', COLOR.warn] : ['AGUARDANDO PAGAMENTO', COLOR.bad]);
    ensure(14);
    doc.setDrawColor(...sit[1]); doc.setLineWidth(0.6);
    doc.roundedRect(M, y, 70, 9, 2, 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setC(sit[1]);
    doc.text(sit[0], M + 35, y + 6, { align: 'center' });
    doc.setLineWidth(0.2);
    y += 14;

    // ----- Pagamentos -----
    const movimientos = [
      ...d.pagos.map(p => ({ fecha: p.fecha, desc: 'Pagamento da hospedagem' + (notaPT(p.notas) ? ` — ${notaPT(p.notas)}` : ''), metodo: metodoPT(p.metodo), monto: p.monto })),
      ...extrasCobrados.map(c => ({ fecha: c.fecha, desc: `Consumo: ${c.descripcion}`, metodo: metodoPT(c.metodo), monto: c.monto }))
    ];
    seccion('Pagamentos recebidos');
    if (!movimientos.length) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(10); setC(COLOR.suave);
      doc.text('Nenhum pagamento registrado até o momento.', M, y); y += 6;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setC(COLOR.suave);
      doc.text('DATA', M, y); doc.text('DESCRIÇÃO', M + 28, y); doc.text('MÉTODO', M + 118, y); doc.text('VALOR', R, y, { align: 'right' });
      y += 2; doc.line(M, y, R, y); y += 5;
      movimientos.forEach(m => {
        const desc = doc.splitTextToSize(m.desc, 86);
        ensure(desc.length * 4.5 + 3);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setC(COLOR.texto);
        doc.text(fecha(m.fecha), M, y);
        doc.text(desc, M + 28, y);
        doc.text(String(m.metodo || '—'), M + 118, y);
        doc.text(brl(m.monto), R, y, { align: 'right' });
        y += desc.length * 4.5 + 1.5;
      });
    }

    // ----- Extras pendentes -----
    if (extrasPend.length) {
      seccion('Consumos ainda não cobrados');
      extrasPend.forEach(c => {
        ensure(6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setC(COLOR.texto);
        doc.text(String(c.descripcion || '—'), M, y);
        doc.text(brl(c.monto), R, y, { align: 'right' });
        y += 5.5;
      });
    }

    if (d.notas) {
      seccion('Observações');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setC(COLOR.texto);
      const l = doc.splitTextToSize(String(d.notas), R - M);
      ensure(l.length * 5);
      doc.text(l, M, y); y += l.length * 5;
    }

    // ----- Rodapé (todas as páginas) -----
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...COLOR.linea); doc.line(M, 284, R, 284);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setC(COLOR.suave);
      doc.text('Este documento é um comprovante de reserva e pagamento e não substitui nota fiscal.', M, 289);
      doc.text(`Página ${i} de ${pages}`, R, 289, { align: 'right' });
      doc.text('Obrigado pela preferência!', M, 293);
    }

    doc.save(`Comprovante_${slug(d.cliente)}_${String(d.checkin).slice(0, 10)}.pdf`);
  }

  /* ---------- 6) BOTÓN ---------- */
  async function onClick(ev) {
    const btn = ev.currentTarget;
    const id = (document.getElementById('f-res-id') || {}).value;
    if (!id) { alert('Primero guardá la reserva para poder generar el comprobante.'); return; }
    const txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'Generando…';
    try {
      await generarPDF(obtenerDatos(id));
    } catch (e) {
      console.error(e);
      alert('No se pudo generar el comprobante: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = txt;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('btn-generar-comprobante');
    if (b) b.addEventListener('click', onClick);
  });

  window.generarComprobante = id => generarPDF(obtenerDatos(id));
})();
