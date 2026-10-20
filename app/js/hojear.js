/* Folio · hojear el libro compuesto, doble página por doble página */
(function () {
  'use strict';
  let capa = null, marco = null;
  function abrir() {
    if (!Folio.tieneContenido()) return App.aviso('No hay libro que hojear.');
    capa = document.createElement('div'); capa.className = 'hojear-capa';
    capa.innerHTML = `<div class="hojear-barra"><span>${App.esc(Folio.p.titulo || 'Libro')}</span><span class="hojear-n">componiendo…</span><button class="boton chico" data-h="-1">←</button><button class="boton chico" data-h="1">→</button><button class="boton chico" data-h="cerrar">Cerrar</button></div>`;
    marco = document.createElement('iframe'); marco.src = 'vista.html'; marco.className = 'hojear-marco'; capa.appendChild(marco);
    document.body.appendChild(capa);
    capa.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (!b) return; if (b.dataset.h === 'cerrar') cerrar(); else marco.contentWindow.postMessage({ tipo: 'pasar', d: +b.dataset.h }, location.origin); });
  }
  function cerrar() { if (capa) capa.remove(); capa = marco = null; }
  addEventListener('message', e => {
    if (!marco || e.source !== marco.contentWindow) return;
    const d = e.data || {};
    if (d.tipo === 'vista-lista') marco.contentWindow.postMessage({ tipo: 'componer', modo: 'hojear', proyecto: JSON.parse(JSON.stringify(Folio.p)), recursos: Folio.recursos }, location.origin);
    if (d.tipo === 'hoja') capa.querySelector('.hojear-n').textContent = `doble página ${d.i + 1} de ${d.total} · flechas o clic para pasar`;
    if (d.tipo === 'cerrar-hojear') cerrar();
  });
  addEventListener('keydown', e => { if (capa && e.key === 'Escape') cerrar(); if (capa && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); marco.contentWindow.postMessage({ tipo: 'pasar', d: e.key === 'ArrowRight' ? 1 : -1 }, location.origin); } }, true);
  window.Hojear = { abrir, cerrar };
})();
