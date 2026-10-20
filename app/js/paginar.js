/* Folio · paginar con Paged.js (MIT) y esperar a que las fuentes estén cargadas */
(function () {
  'use strict';
  async function fuentesListas(f) {
    const fams = [...new Set([f.texto, f.titulos, 'Fell', 'Fraktur', 'FBookman', 'FPalatino'])];
    await Promise.all(fams.flatMap(x => ['400 12pt ' + x, 'italic 400 12pt ' + x, '700 12pt ' + x].map(s => document.fonts.load(s).catch(() => {}))));
    await document.fonts.ready;
  }
  async function imagenesListas(raiz) {
    await Promise.all([...raiz.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  }
  // índice analítico: páginas reales donde aparece cada término
  function completarIA(raiz) {
    for (const li of raiz.querySelectorAll('[data-ia-entrada]')) {
      const k = li.dataset.iaEntrada, pags = new Set();
      for (const s of raiz.querySelectorAll(`.ia[data-ia="${k}"]`)) { const pg = s.closest('.pagedjs_page'); if (pg) pags.add(+pg.dataset.pageNumber); }
      li.querySelector('.pags').textContent = [...pags].sort((a, b) => a - b).join(', ') || '—';
    }
  }
  window.Paginar = async function (destino, proyecto, recursos, opciones = {}) {
    if (window.ARCHIVO) await ARCHIVO.cargar();
    const c = Libro.componer(proyecto, { recursos, ...opciones });
    await fuentesListas(c.fuentes);
    // precarga de imágenes para que la medición sea exacta
    const tmp = document.createElement('div'); tmp.innerHTML = c.html; await imagenesListas(tmp);
    const prev = new PagedModule.Previewer();
    const flujo = await prev.preview(c.html, [{ [location.origin + '/libro.css']: c.css }], destino);
    await imagenesListas(destino);
    completarIA(destino);
    const r = Libro.comprobar(document, proyecto);
    r.total = flujo.total;
    return r;
  };
})();
