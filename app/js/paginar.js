/* Folio · paginar con Paged.js (MIT)
 * 1. Justificación fina: los párrafos justificados se cortan con el algoritmo de Knuth y Plass
 *    (tex-linebreak, MIT) antes de paginar, con guionado español.
 * 2. Paginación con Paged.js.
 * 3. Arreglo automático de viudas y huérfanas: aprieta o afloja imperceptiblemente el párrafo
 *    responsable y vuelve a paginar (hasta dos intentos).
 */
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
  function completarIA(raiz) {
    for (const li of raiz.querySelectorAll('[data-ia-entrada]')) {
      const k = li.dataset.iaEntrada, pags = new Set();
      for (const s of raiz.querySelectorAll(`.ia[data-ia="${k}"]`)) { const pg = s.closest('.pagedjs_page'); if (pg) pags.add(+pg.dataset.pageNumber); }
      li.querySelector('.pags').textContent = [...pags].sort((a, b) => a - b).join(', ') || '—';
    }
  }
  // justificación Knuth-Plass sobre una copia oculta con el mismo ancho de caja y las mismas fuentes
  let guionador = null;
  // quita los bloques @page (con sus márgenes anidados) contando llaves; el resto del CSS queda igual
  function sinPage(css) {
    let out = '', i = 0;
    for (;;) {
      const k = css.indexOf('@page', i); if (k < 0) return out + css.slice(i);
      out += css.slice(i, k); let j = css.indexOf('{', k); if (j < 0) return out; let n = 1; j++;
      while (j < css.length && n) { if (css[j] === '{') n++; else if (css[j] === '}') n--; j++; }
      i = j;
    }
  }
  function justificar(html, css, proyecto) {
    if (!window.Herramientas || !Herramientas.justifyContent) return html;
    const a = proyecto.ajustes, [W] = Folio.FORMATOS[proyecto.formato] || Folio.FORMATOS.A5;
    const ancho = W - a.margenInterior - a.margenExterior;
    const st = document.createElement('style'); st.textContent = sinPage(css);
    const caja = document.createElement('div'); caja.style.cssText = `position:absolute;left:-99999px;top:0;width:${ancho}mm;visibility:hidden`;
    caja.innerHTML = html; document.head.appendChild(st); document.body.appendChild(caja);
    try {
      if (!guionador) { const h = Herramientas.createHyphenator(Herramientas.patronesES, { hyphenChar: '­', async: false, minWordLength: 6 }); guionador = w => h(w).split('­'); }
      const ps = [...caja.querySelectorAll('p.fina')].filter(p => !p.classList.contains('capitular') && !p.querySelector('.nota-pie, img'));
      // Chromium deja vacío el atajo «font» cuando hay cifras antiguas o ligaduras; tex-linebreak arma entonces una fuente
      // inválida para medir y mide todo en 10px. Mientras justifica, le damos una descripción de fuente válida.
      const gcs = window.getComputedStyle;
      window.getComputedStyle = function (el, ps) {
        const cs = gcs.call(window, el, ps);
        return new Proxy(cs, { get(t, k) { if (k === 'font') { const f = t.font; return f || `${t.fontStyle} ${t.fontVariantCaps === 'small-caps' ? 'small-caps' : 'normal'} ${t.fontWeight} ${t.fontSize} ${t.fontFamily}`; } const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
      };
      // la sangría de primera línea: tex-linebreak no la ve, así que va como una caja vacía del mismo ancho al comienzo del párrafo
      for (const p of ps) { const ind = parseFloat(gcs.call(window, p).textIndent) || 0; if (ind > 0.5) { const s = document.createElement('span'); s.className = 'sangria-fina'; s.style.cssText = `display:inline;padding-left:${ind.toFixed(2)}px`; p.prepend(s); p.style.textIndent = '0'; } }
      try { if (ps.length) Herramientas.justifyContent(ps, proyecto.ajustes.guionado ? guionador : undefined); }
      finally { window.getComputedStyle = gcs; }
      return caja.innerHTML;
    } catch (e) { console.error('justificación fina', e); return html; }
    finally { caja.remove(); st.remove(); }
  }
  async function unaVez(destino, proyecto, recursos, opciones, finos) {
    const c = Libro.componer(proyecto, { recursos, ...opciones, finos });
    await fuentesListas(c.fuentes);
    const tmp = document.createElement('div'); tmp.innerHTML = c.html; await imagenesListas(tmp);
    const html = proyecto.ajustes.justificacionFina !== false && /class="[^"]*\bfina\b/.test(c.html) ? justificar(c.html, c.css, proyecto) : c.html;
    destino.innerHTML = '';
    document.querySelectorAll('style[data-pagedjs-inserted-styles]').forEach(s => s.remove());
    const prev = new PagedModule.Previewer();
    const flujo = await prev.preview(html, [{ [location.origin + '/libro.css']: c.css }], destino);
    await imagenesListas(destino);
    completarIA(destino);
    const r = Libro.comprobar(document, proyecto);
    r.total = flujo.total;
    return r;
  }
  window.Paginar = async function (destino, proyecto, recursos, opciones = {}) {
    if (window.ARCHIVO) await ARCHIVO.cargar();
    let finos = {}, r = await unaVez(destino, proyecto, recursos, opciones, finos), intentos = 0, arreglos = 0;
    while (proyecto.ajustes.viudasAuto !== false && intentos < 2) {
      const malas = r.avisos.filter(a => a.tipo === 'viuda' || a.tipo === 'huerfana');
      if (!malas.length) break;
      let cambio = false;
      for (const a of malas) {
        const pg = document.querySelectorAll('.pagedjs_page')[a.pagina - 1]; if (!pg) continue;
        const cont = pg.querySelector('.pagedjs_page_content');
        if (a.tipo === 'viuda') { const el = cont.querySelector('p[data-split-from]'); const id = el && el.dataset.b; if (id && !finos[id]) { finos[id] = 'apretar'; cambio = true; } }
        else { const ps = [...cont.querySelectorAll('p[data-b]')]; const ult = ps[ps.length - 1], ant = ps[ps.length - 2]; const id = ant && ant.dataset.b; if (id && !finos[id]) { finos[id] = 'aflojar'; cambio = true; } else if (ult && !finos[ult.dataset.b]) { finos[ult.dataset.b] = 'aflojar'; cambio = true; } }
      }
      if (!cambio) break;
      intentos++;
      const r2 = await unaVez(destino, proyecto, recursos, opciones, finos);
      const antes = malas.length, despues = r2.avisos.filter(a => a.tipo === 'viuda' || a.tipo === 'huerfana').length;
      arreglos += Math.max(0, antes - despues); r = r2;
    }
    r.arreglosFinos = arreglos; r.ajustados = Object.keys(finos).length;
    return r;
  };
})();
