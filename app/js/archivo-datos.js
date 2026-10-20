/* Folio · catálogo del archivo de grabados (todo local, en archivo/) */
(function () {
  'use strict';
  const A = {
    listo: false, laminas: [], paginas: {}, fuentes: [], porId: {},
    cargar() {
      if (A._p) return A._p;
      A._p = fetch('archivo/catalogo.json').then(r => r.json()).then(c => {
        A.fuentes = c.fuentes; A.laminas = c.laminas;
        for (const p of c.paginas) A.paginas[p.p] = p;
        for (const l of c.laminas) A.porId[l.id] = l;
        // orden mezclado para la galería (cada apertura de Folio muestra otras primero); A.laminas queda estable para las semillas
        A.mezcla = A.laminas.slice(); for (let i = A.mezcla.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [A.mezcla[i], A.mezcla[j]] = [A.mezcla[j], A.mezcla[i]]; }
        return A.cargarExtra();
      }).then(() => { A.listo = true; return A; });
      return A._p;
    },
    // láminas que trajiste de Commons: viven en tu carpeta de Folio, no entran en los sorteos de cubiertas
    extra: [],
    cargarExtra() {
      return fetch('folio://datos/archivo/extra.json').then(r => r.ok ? r.json() : null).catch(() => null).then(c => {
        if (!c) return;
        if (!A.fuentes.find(f => f.nombre === 'Traídas de Wikimedia Commons')) A.fuentes.push({ nombre: 'Traídas de Wikimedia Commons', obra: 'Wikimedia Commons' });
        const ya = new Set(A.extra.map(l => l.id));
        for (const p of c.paginas) A.paginas[p.p] = p;
        for (const l of c.laminas) { A.porId[l.id] = l; if (!ya.has(l.id)) { A.extra.push(l); A.mezcla.unshift(l); } }
      });
    },
    quitarExtra(id) { A.extra = A.extra.filter(l => l.id !== id); A.mezcla = A.mezcla.filter(l => l.id !== id); delete A.porId[id]; delete A.paginas[id]; },
    esExtra: id => /^X\d+$/.test(id),
    ficha(id) {
      const l = A.porId[id]; if (!l) return null;
      const pagina = A.paginas[l.p] || {};
      const fuente = A.fuentes.find(f => f.nombre === pagina.f) || { nombre: pagina.f, obra: pagina.f };
      return { lamina: l, pagina, fuente };
    },
    src: id => A.esExtra(id) ? 'folio://datos/archivo/laminas/' + id + '.png' : 'archivo/laminas/' + id + '.png',
    mini: id => A.esExtra(id) ? 'folio://datos/archivo/mini/' + id + '.png' : 'archivo/mini/' + id + '.png',
    paginaSrc: n => A.esExtra(String(n)) ? 'folio://datos/archivo/paginas/' + n + '.jpg' : 'archivo/paginas/' + String(n).padStart(4, '0') + '.png',
    // generador pseudoaleatorio con semilla (para que una cubierta sea siempre igual)
    azar(semilla) { let s = (semilla >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
    elegir(filtro, semilla, n = 1) {
      const lista = A.laminas.filter(filtro); const r = A.azar(semilla); const out = [];
      for (let i = 0; i < n && lista.length; i++) out.push(lista.splice((r() * lista.length) | 0, 1)[0]);
      return out;
    },
  };
  window.ARCHIVO = A;
})();
