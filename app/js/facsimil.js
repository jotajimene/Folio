/* Folio · edición facsimilar: editor de folios (imagen del original + transcripción línea por línea) */
(function () {
  'use strict';
  const { esc, panel } = App;
  let actual = 0, zoom = 1, marcandoGuias = false, lineaActiva = -1;
  const fx = () => Folio.p.facsimil || { folios: [] };
  const folio = () => fx().folios[actual];

  // ---------- importar escaneos (imágenes o PDF) ----------
  async function aImagen(src, max = 2600) {
    const img = new Image(); img.src = src; await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { datos: c.toDataURL('image/jpeg', .9), w: c.width, h: c.height };
  }
  async function importar(archivos) {
    const nuevos = []; let n = fx().folios.length;
    for (const f of archivos) {
      if (/\.pdf$/i.test(f.name)) {
        const pdfjs = await FolioImport.pdfEngine();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
          App.aviso(`Leyendo página ${i} de ${doc.numPages}…`, { ms: 1200 });
          const pg = await doc.getPage(i), v = pg.getViewport({ scale: 1 }), k = Math.min(3, 2600 / Math.max(v.width, v.height));
          const vp = pg.getViewport({ scale: k }), c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          nuevos.push({ datos: c.toDataURL('image/jpeg', .9), w: c.width, h: c.height });
        }
        await doc.destroy();
      } else nuevos.push(await aImagen(await App.leerDataURL(f)));
    }
    const folios = nuevos.map(x => { n++; const nombre = 'facs-' + Date.now().toString(36) + '-' + n + '.jpg'; Folio.recursos[nombre] = x.datos; return { id: Folio.uid(), recurso: nombre, w: x.w, h: x.h, etiqueta: String(n), transcripcion: '', guias: [] }; });
    Folio.cambiar('facsimil:importar', p => { p.facsimil = p.facsimil || { folios: [], modo: 'paleografica', numerarCada: 5 }; p.facsimil.folios.push(...folios); p.tipo = 'facsimil'; if (!p.titulo) p.titulo = 'Edición facsimilar'; });
    App.aviso(`${folios.length} folios agregados.`);
  }
  function elegir() { const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.jpg,.jpeg,.png,.webp,.tif,.tiff,.pdf'; inp.onchange = () => inp.files.length && importar([...inp.files]); inp.click(); }

  // ---------- vista ----------
  function render() {
    const f = fx(), fo = folio();
    if (!f.folios.length) return { cols: '1fr', html: panel('puerta', 'Edición facsimilar', 'el original junto a su transcripción', `<div class="vacio"><h2>Trae las páginas del manuscrito</h2><p>Fotos o escaneos (JPG, PNG) o un PDF escaneado. Cada página es un folio: a la izquierda irá la imagen y a la derecha tu transcripción, línea por línea.</p><div><button class="boton taco" data-fx="importar">Elegir las páginas</button> <button class="boton" data-fx="salir">Volver al manuscrito de texto</button></div></div>`, '', 'texto-panel') };
    const lineas = String(fo.transcripcion || '').split('\n');
    const lista = `<ul class="folios">${f.folios.map((x, i) => `<li class="${i === actual ? 'on' : ''}" data-folio="${i}" draggable="true"><img src="${Folio.recursos[x.recurso] || ''}" alt=""><span>${esc(x.etiqueta || i + 1)}<small>${String(x.transcripcion || '').trim() ? String(x.transcripcion).split('\n').length + ' líneas' : 'sin transcribir'}</small></span></li>`).join('')}</ul>
      <div class="pila"><button class="boton chico" data-fx="importar">Agregar páginas</button><button class="boton chico" data-fx="quitar">Quitar este folio</button><button class="boton chico" data-fx="salir">Texto de acompañamiento</button></div>
      <div class="sub">Edición</div>
      <label class="ajuste"><span>Transcripción</span><select data-fxo="modo"><option value="paleografica" ${f.modo !== 'lectura' ? 'selected' : ''}>Paleográfica (con todas las marcas)</option><option value="lectura" ${f.modo === 'lectura' ? 'selected' : ''}>De lectura (texto limpio)</option></select></label>
      <label class="ajuste"><span>Numerar líneas cada</span><select data-fxo="numerarCada">${[1, 5, 10, 999].map(n => `<option value="${n}" ${(f.numerarCada || 5) === n ? 'selected' : ''}>${n === 999 ? 'sin numerar' : n}</option>`).join('')}</select></label>
      <label class="chequeo"><input type="checkbox" data-fxo="alinear" ${f.alinear !== false ? 'checked' : ''}> Alinear cada línea con su renglón del original (si marcaste las guías)</label>`;
    const visor = `<div class="fx-herr"><button class="boton chico" data-fx="zoom-" title="Alejar">−</button><button class="boton chico" data-fx="zoom+" title="Acercar">+</button><button class="boton chico ${marcandoGuias ? 'taco' : ''}" data-fx="guias" title="Haz clic sobre cada renglón del original, de arriba abajo">${marcandoGuias ? 'Marcando renglones… (clic en la imagen)' : 'Marcar renglones'}</button>${(fo.guias || []).length ? `<button class="boton chico" data-fx="borrar-guias">Borrar guías (${fo.guias.length})</button>` : ''}<span class="nota">${(fo.guias || []).length} guías · ${lineas.length} líneas</span></div>
      <div class="fx-visor ${marcandoGuias ? 'marcando' : ''}"><div class="fx-lienzo" style="width:${zoom * 100}%"><img src="${Folio.recursos[fo.recurso] || ''}" alt="" draggable="false">${(fo.guias || []).map((g, i) => `<i class="guia${i === lineaActiva ? ' activa' : ''}" style="top:${g * 100}%" data-guia="${i}"><b>${i + 1}</b></i>`).join('')}${lineaActiva >= 0 && fo.guias && fo.guias[lineaActiva] != null ? `<u class="banda" style="top:${((fo.guias[lineaActiva - 1] ?? Math.max(0, fo.guias[lineaActiva] - .03)) * 100).toFixed(2)}%;height:${((fo.guias[lineaActiva] - (fo.guias[lineaActiva - 1] ?? Math.max(0, fo.guias[lineaActiva] - .03))) * 100 + .6).toFixed(2)}%"></u>` : ''}</div></div>`;
    const editor = `<div class="fx-marcas">${[['tachado', '[-', '-]', 'Tachado'], ['añadido', '[+', '+]', 'Añadido entre líneas'], ['ilegible', '[...]', '', 'Ilegible'], ['dudoso', '[?', '?]', 'Lectura dudosa'], ['abrev.', '{', '}', 'Desarrollo de abreviatura'], ['nota', '{{', '}}', 'Nota del editor']].map(([t, a, z, ti]) => `<button class="boton chico" data-marca="${esc(a)}|${esc(z)}" title="${ti}">${t}</button>`).join('')}</div>
      <div class="fx-texto"><pre class="fx-numeros" aria-hidden="true">${lineas.map((_, i) => i + 1).join('\n')}</pre><textarea class="fx-area" spellcheck="false" placeholder="Escribe aquí la transcripción, respetando los saltos de línea del original.">${esc(fo.transcripcion || '')}</textarea></div>
      <div class="fila-botones"><label class="campo" style="flex:1;margin:0"><span>Nombre del folio</span><input data-fxe="etiqueta" value="${esc(fo.etiqueta || '')}" placeholder="por ejemplo: 1r, 1v, 12"></label></div>
      <div class="fila-botones"><button class="boton chico" data-fx="ocr" title="Funciona bien con letra impresa o mecanografiada; con manuscrita sirve de borrador">Leer con OCR (borrador)</button><button class="boton chico" data-fx="dictar" title="Lee el folio en voz alta; cada pausa larga es un salto de línea. Se transcribe en este computador.">Dictar</button><button class="boton chico" data-fx="vista-previa">Cómo queda</button></div>
      <p class="nota">Marcas: [-tachado-] · [+añadido+] · [...] ilegible · [?dudoso?] · q{ue} abreviatura · {{nota}}. La guía <i>n</i> corresponde a la línea <i>n</i>.</p>`;
    return {
      cols: '230px 1fr 400px',
      html: panel('folios', 'Folios', `${f.folios.length}`, lista) +
        panel('original', `Folio ${esc(fo.etiqueta || actual + 1)}`, 'el original', visor, '', 'vista-panel') +
        panel('transcripcion', 'Transcripción', f.modo === 'lectura' ? 'de lectura' : 'paleográfica', editor, App.seguir(3, 'Ver el libro enfrentado →')),
    };
  }
  function lineaDelCursor(ta) { return ta.value.slice(0, ta.selectionStart).split('\n').length - 1; }
  function marcarBanda(m) {
    const fo = folio(); const l = m.querySelector('.fx-lienzo'); if (!l) return;
    l.querySelectorAll('.guia').forEach((g, i) => g.classList.toggle('activa', i === lineaActiva));
    l.querySelectorAll('u.banda').forEach(b => b.remove());
    const g = fo.guias || []; if (lineaActiva < 0 || g[lineaActiva] == null) return;
    const a = g[lineaActiva - 1] ?? Math.max(0, g[lineaActiva] - .03), z = g[lineaActiva];
    l.insertAdjacentHTML('beforeend', `<u class="banda" style="top:${a * 100}%;height:${(z - a) * 100 + .6}%"></u>`);
    const vis = m.querySelector('.fx-visor'), y = z * l.offsetHeight - vis.clientHeight / 2; vis.scrollTo({ top: y, behavior: 'smooth' });
  }
  function montar(m) {
    let tGuardar = null;
    m.addEventListener('click', async e => {
      const li = e.target.closest('[data-folio]'); if (li) { actual = +li.dataset.folio; lineaActiva = -1; return App.refrescar(); }
      const mk = e.target.closest('[data-marca]');
      if (mk) { const ta = m.querySelector('.fx-area'), [a, z] = mk.dataset.marca.split('|'); const s = ta.selectionStart, f = ta.selectionEnd; ta.setRangeText(a + ta.value.slice(s, f) + z, s, f, f > s ? 'end' : 'select'); if (f === s && z) ta.setSelectionRange(s + a.length, s + a.length); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
      const lienzo = e.target.closest('.fx-lienzo');
      if (lienzo && marcandoGuias) { const r = lienzo.getBoundingClientRect(), y = (e.clientY - r.top) / r.height; Folio.cambiar('facsimil:guias', p => { const fo = p.facsimil.folios[actual]; fo.guias = [...(fo.guias || []), Math.max(0, Math.min(1, y))].sort((x, z) => x - z); }); return; }
      const b = e.target.closest('[data-fx]'); if (!b) return;
      switch (b.dataset.fx) {
        case 'importar': return elegir();
        case 'dictar': { const t = await HerrLocal.dictar(); if (!t) return; const ta = m.querySelector('.fx-area'); if (!ta) return; const pos = ta.selectionStart; ta.setRangeText((pos && ta.value[pos - 1] !== '\n' ? '\n' : '') + t, pos, ta.selectionEnd, 'end'); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
        case 'salir': return Folio.cambiar('facsimil:vista', p => { p.facsimil = p.facsimil || { folios: [] }; p.facsimil.editarTexto = true; });
        case 'quitar': if (await App.confirmar('¿Quitar este folio y su transcripción? Puedes deshacerlo con Ctrl+Z.', 'Quitar')) { Folio.cambiar('facsimil:quitar', p => { p.facsimil.folios.splice(actual, 1); }); actual = Math.max(0, actual - 1); } return;
        case 'zoom+': zoom = Math.min(4, zoom * 1.25); return App.refrescar();
        case 'zoom-': zoom = Math.max(.5, zoom / 1.25); return App.refrescar();
        case 'guias': marcandoGuias = !marcandoGuias; return App.refrescar();
        case 'borrar-guias': return Folio.cambiar('facsimil:guias', p => { p.facsimil.folios[actual].guias = []; });
        case 'vista-previa': return App.ir(3);
        case 'ocr': {
          const fo = folio(); if (String(fo.transcripcion || '').trim() && !(await App.confirmar('Ya hay transcripción en este folio. ¿Reemplazarla por la lectura del OCR?', 'Reemplazar'))) return;
          App.aviso('Leyendo el folio con OCR… puede tardar un poco.', { ms: 4000 });
          try { const img = new Image(); img.src = Folio.recursos[fo.recurso]; await img.decode(); const r = await FolioImport.ocrRenglones(img, { language: 'spa' }); Folio.cambiar('facsimil:texto', p => { p.facsimil.folios[actual].transcripcion = r.texto; }); App.aviso(`Listo (confianza ${r.confianza} %). Revísalo con el original al lado.`); }
          catch (err) { App.aviso('No se pudo leer: ' + err.message, { tipo: 'mal' }); }
          return;
        }
      }
    });
    // la transcripción se guarda mientras escribes, sin redibujar
    m.addEventListener('input', e => {
      const ta = e.target.closest('.fx-area');
      if (ta) {
        const nums = m.querySelector('.fx-numeros'); const n = ta.value.split('\n').length; nums.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
        clearTimeout(tGuardar); const v = ta.value; tGuardar = setTimeout(() => Folio.cambiar('facsimil:texto', p => { p.facsimil.folios[actual].transcripcion = v; }, { agrupar: true }), 250);
        return;
      }
      const et = e.target.dataset.fxe; if (et) Folio.cambiar('facsimil:texto', p => { p.facsimil.folios[actual][et] = e.target.value; }, { agrupar: true });
    });
    m.addEventListener('change', e => { const k = e.target.dataset.fxo; if (!k) return; const v = e.target.type === 'checkbox' ? e.target.checked : (k === 'numerarCada' ? +e.target.value : e.target.value); Folio.cambiar('facsimil:opciones', p => { p.facsimil[k] = v; }); });
    m.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('fx-area')) m.querySelector('.fx-numeros').scrollTop = e.target.scrollTop; }, true);
    // la línea donde está el cursor se marca sobre el original
    const sync = () => { const ta = m.querySelector('.fx-area'); if (!ta) return; const l = lineaDelCursor(ta); if (l !== lineaActiva) { lineaActiva = l; marcarBanda(m); } };
    m.addEventListener('keyup', sync); m.addEventListener('mouseup', sync);
    // arrastrar para reordenar folios
    let arr = null;
    m.addEventListener('dragstart', e => { const li = e.target.closest('[data-folio]'); if (li) arr = +li.dataset.folio; });
    m.addEventListener('dragover', e => { if (arr != null && e.target.closest('[data-folio]')) e.preventDefault(); });
    m.addEventListener('drop', e => { const li = e.target.closest('[data-folio]'); if (arr == null || !li) return; e.preventDefault(); const a = arr, b = +li.dataset.folio; arr = null; if (a === b) return; Folio.cambiar('facsimil:orden', p => { const [x] = p.facsimil.folios.splice(a, 1); p.facsimil.folios.splice(b, 0, x); }); actual = b; });
    // arrastrar con el mouse para desplazar la imagen ampliada
    const vis = m.querySelector('.fx-visor');
    if (vis) { let d = null; vis.addEventListener('pointerdown', e => { if (marcandoGuias) return; d = { x: e.clientX, y: e.clientY, l: vis.scrollLeft, t: vis.scrollTop }; vis.setPointerCapture(e.pointerId); }); vis.addEventListener('pointermove', e => { if (d) { vis.scrollLeft = d.l - (e.clientX - d.x); vis.scrollTop = d.t - (e.clientY - d.y); } }); vis.addEventListener('pointerup', () => { d = null; }); }
  }
  const activo = () => Folio.p.tipo === 'facsimil' && !(Folio.p.facsimil && Folio.p.facsimil.editarTexto);
  window.Facsimil = { render, montar, importar, elegir, activo, _actual: () => actual, _ir: i => { actual = i; } };
})();
