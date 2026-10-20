/* Folio · etapa I · Manuscrito
 * Importar, ordenar y editar los bloques. Lo único que cambia el texto aquí
 * eres tú: editar, unir, dividir, cambiar la función de un bloque.
 */
(function () {
  'use strict';
  const { esc, panel } = App;
  const TIPOS = { h1: 'capítulo', h2: 'subtítulo', p: 'párrafo', verso: 'verso', cita: 'cita', separador: 'separador' };
  let sel = null, editando = null;

  const EJEMPLO = `# La casa de las horas

La primera vez que entré, la casa estaba vacía. Había una silla junto a la ventana y una marca clara en la pared donde antes colgaba un cuadro. Dejé la maleta sobre el suelo. Afuera, alguien barría la vereda.

Mi abuela decía que las casas guardan los sonidos. No todos: solamente aquellos que nadie alcanzó a escuchar. El agua que hierve cuando uno se queda dormido, un nombre dicho en una habitación desierta, la llave que cae al fondo de un bolsillo.

Abrí la ventana.  Entró un poco de aire y el olor de los árboles mojados. Sobre la mesa encontré una libreta. Sus paginas estaban numeradas, pero no habia nada escrito en ellas...

# El inventario

Anoté las cosas que habían quedado: tres tazas, una lámpara sin ampolleta, una manta doblada, dos llaves distintas. La más pequeña no abría ninguna puerta y y tampoco la otra.

- Aquí falta algo - dijo.

¿Qué cosa? pregunté. Que hora es?`;

  function bloquesDesde(lista) {
    return lista.map(b => ({ id: Folio.uid(), tipo: { h1: 'h1', h2: 'h2', poem: 'verso', p: 'p' }[b.kind] || 'p', texto: b.text, runs: b.runs && b.runs.some(r => r.bold || r.italic) ? b.runs.map(r => ({ text: r.text, ...(r.italic ? { italic: true } : {}), ...(r.bold ? { bold: true } : {}) })) : null }));
  }

  // ---------- importación ----------
  async function importar(archivos, { modo = 'reemplazar', ocr = false } = {}) {
    if (!archivos || !archivos.length) return;
    const ctl = new AbortController();
    const capa = document.querySelector('.modal-capa'); let cerrar;
    const prog = App.modal({ titulo: 'Importando', cuerpo: `<p class="progreso-texto">Abriendo…</p><div class="barra"><i style="width:0"></i></div><p class="nota">Todo se lee en este equipo. Nada se envía a internet.</p>`, botones: [{ texto: 'Cancelar', valor: 'cancelar' }], alAbrir: (m, c) => { cerrar = c.cerrar; } });
    prog.then(v => { if (v === 'cancelar') ctl.abort(); });
    try {
      const r = await FolioImport.extract([...archivos], { signal: ctl.signal, autoOCR: true, forceOCR: ocr, language: 'spa', progress: (t, v) => { const pt = capa.querySelector('.progreso-texto'), b = capa.querySelector('.barra i'); if (pt) pt.textContent = t; if (b) b.style.width = Math.round((v || 0) * 100) + '%'; } });
      const nuevos = bloquesDesde(r.blocks);
      for (const f of archivos) if (f.size < 25 * 1024 * 1024) Folio.originales[f.name] = (await App.leerDataURL(f)).replace(/^data:[^,]*,/, '');
      Folio.cambiar('importar', p => {
        if (modo === 'anadir') { p.bloques.push(...nuevos); p.original.push(...nuevos.map(b => ({ ...b }))); }
        else { p.bloques = nuevos; p.original = nuevos.map(b => ({ ...b })); p.ilustraciones = []; p.revision = { decididas: [], ignorar: [], diccionario: p.revision.diccionario || [] }; }
        const previo = modo === 'anadir' && p.origen ? p.origen : { archivos: [], avisos: [], informes: [] };
        p.origen = { archivos: [...previo.archivos, ...[...archivos].map(f => ({ nombre: f.name, bytes: f.size, fecha: new Date().toISOString() }))], avisos: [...previo.avisos, ...r.warnings], informes: [...previo.informes, ...r.reports] };
        if (!p.titulo) { const h = nuevos.find(b => b.tipo === 'h1'); p.titulo = h ? h.texto : archivos[0].name.replace(/\.[^.]+$/, ''); }
      });
      if (cerrar) cerrar('ok');
      App.aviso(`${nuevos.length} bloques importados.`);
    } catch (e) {
      if (cerrar) cerrar('error');
      if (e.name !== 'AbortError') App.aviso(e.message || String(e), { tipo: 'mal', ms: 9000 }); else App.aviso('Importación cancelada.');
    }
  }
  function elegirArchivo(opciones) {
    const inp = document.getElementById('entrada-archivo'); inp.value = '';
    inp.onchange = () => importar(inp.files, opciones);
    inp.click();
  }
  async function pegar(modo) {
    const t = await App.modal({ titulo: 'Pegar texto', ancho: 720, cuerpo: `<p class="nota">Separa párrafos con una línea en blanco. Una línea que empieza con # es un capítulo; con ##, un subtítulo.</p><textarea class="area" rows="16" placeholder="Pega aquí tu texto"></textarea>`, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Usar este texto', taco: true, valor: c => c.querySelector('textarea').value }] });
    if (!t || !t.trim()) return;
    const nuevos = bloquesDesde(FolioImport.textBlocks(t));
    Folio.cambiar('importar', p => {
      if (modo === 'anadir') { p.bloques.push(...nuevos); p.original.push(...nuevos.map(b => ({ ...b }))); }
      else { p.bloques = nuevos; p.original = nuevos.map(b => ({ ...b })); p.ilustraciones = []; }
      p.origen = { archivos: [...((modo === 'anadir' && p.origen?.archivos) || []), { nombre: 'Texto pegado', bytes: t.length, fecha: new Date().toISOString() }], avisos: (modo === 'anadir' && p.origen?.avisos) || [], informes: [] };
      if (!p.titulo) { const h = nuevos.find(b => b.tipo === 'h1'); if (h) p.titulo = h.texto; }
    });
  }
  function ejemplo() {
    const nuevos = bloquesDesde(FolioImport.textBlocks(EJEMPLO));
    Folio.cambiar('importar', p => { p.bloques = nuevos; p.original = nuevos.map(b => ({ ...b })); p.origen = { archivos: [{ nombre: 'Ejemplo de Folio', bytes: EJEMPLO.length, fecha: new Date().toISOString() }], avisos: ['Texto de ejemplo con errores a propósito, para probar la revisión.'], informes: [] }; if (!p.titulo) p.titulo = 'La casa de las horas'; if (!p.autor) p.autor = 'Autora de ejemplo'; });
  }
  // arrastrar y soltar en toda la ventana mientras estás en esta etapa
  addEventListener('dragover', e => { if (App.actual === 0) { e.preventDefault(); document.body.classList.add('soltando'); } });
  addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('soltando'); });
  addEventListener('drop', e => {
    document.body.classList.remove('soltando');
    if (App.actual !== 0 || !e.dataTransfer.files.length) return; e.preventDefault();
    importar(e.dataTransfer.files, { modo: Folio.p.bloques.length ? 'anadir' : 'reemplazar' });
  });

  // ---------- edición ----------
  function htmlBloque(b) {
    if (b.tipo === 'separador') return '⁂';
    const g = t => esc(t).replace(/\n/g, '<br>');
    if (b.runs && b.runs.length) return b.runs.map(r => { let h = g(r.text); if (r.italic) h = `<i>${h}</i>`; if (r.bold) h = `<b>${h}</b>`; return h; }).join('');
    return g(b.texto);
  }
  // lee lo editado de vuelta a tramos (cursiva y negrita)
  function leerRuns(el) {
    const runs = [];
    (function rec(n, fmt) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) runs.push({ text: c.nodeValue.replace(/ /g, ' '), ...fmt });
        else if (c.nodeName === 'BR') runs.push({ text: '\n', ...fmt });
        else if (c.nodeType === 1) {
          const f = { ...fmt }; if (/^(I|EM)$/.test(c.nodeName) || c.style.fontStyle === 'italic') f.italic = true; if (/^(B|STRONG)$/.test(c.nodeName) || +c.style.fontWeight >= 600) f.bold = true;
          if (/^(DIV|P)$/.test(c.nodeName) && runs.length) runs.push({ text: '\n', ...fmt });
          rec(c, f);
        }
      }
    })(el, {});
    const juntos = [];
    for (const r of runs) { const u = juntos[juntos.length - 1]; if (u && !!u.italic === !!r.italic && !!u.bold === !!r.bold) u.text += r.text; else juntos.push({ ...r }); }
    while (juntos.length && /\n$/.test(juntos[juntos.length - 1].text)) { juntos[juntos.length - 1].text = juntos[juntos.length - 1].text.replace(/\n+$/, ''); if (!juntos[juntos.length - 1].text) juntos.pop(); }
    return juntos.map(r => ({ text: r.text, ...(r.italic ? { italic: true } : {}), ...(r.bold ? { bold: true } : {}) }));
  }
  function editar(id) {
    const el = document.querySelector(`.bloque[data-id="${id}"] .contenido`); if (!el) return;
    editando = id; el.contentEditable = 'true'; el.focus();
    el.closest('.bloque').classList.add('editando');
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd();
  }
  function terminar(guardar) {
    if (!editando) return;
    const id = editando; editando = null;
    const el = document.querySelector(`.bloque[data-id="${id}"] .contenido`); if (!el) return;
    el.contentEditable = 'false'; el.closest('.bloque').classList.remove('editando');
    const i = Folio.p.bloques.findIndex(b => b.id === id); if (i < 0) return;
    const b = Folio.p.bloques[i];
    if (!guardar) { el.innerHTML = htmlBloque(b); return; }
    const runs = leerRuns(el), texto = runs.map(r => r.text).join('');
    const conFormato = runs.some(r => r.italic || r.bold);
    if (texto === b.texto && JSON.stringify(conFormato ? runs : null) === JSON.stringify(b.runs && b.runs.some(r => r.italic || r.bold) ? b.runs : null)) return;
    Folio.cambiar('texto:editar', p => { const x = p.bloques[i]; x.texto = texto; x.runs = conFormato ? runs : null; });
  }
  function posicionCursor(el) {
    const s = getSelection(); if (!s.rangeCount) return -1;
    const r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(el); r.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset);
    const tmp = document.createElement('div'); tmp.appendChild(r.cloneContents()); return leerRuns(tmp).map(x => x.text).join('').length;
  }

  function cambiarTipo(id, boton) {
    const menu = document.createElement('div'); menu.className = 'menu-tipos';
    menu.innerHTML = Object.entries(TIPOS).map(([k, v]) => `<button data-t="${k}">${v}</button>`).join('');
    const r = boton.getBoundingClientRect(); menu.style.left = r.left + 'px'; menu.style.top = r.bottom + 4 + 'px';
    document.body.appendChild(menu);
    const fuera = e => { if (!menu.contains(e.target)) { menu.remove(); removeEventListener('pointerdown', fuera, true); } };
    addEventListener('pointerdown', fuera, true);
    menu.onclick = e => { const t = e.target.closest('[data-t]'); if (!t) return; menu.remove(); removeEventListener('pointerdown', fuera, true); Folio.cambiar('texto:tipo', p => { const b = p.bloques.find(x => x.id === id); if (b) b.tipo = t.dataset.t; }); };
  }
  async function verOriginal(id) {
    const b = Folio.p.bloques.find(x => x.id === id), o = (Folio.p.original || []).find(x => x.id === id);
    const igual = o && o.texto === b.texto;
    const r = await App.modal({ titulo: 'El original de este bloque', ancho: 760, cuerpo: o ? `<div class="comparar"><div><small>Como llegó en la importación</small><p>${esc(o.texto)}</p></div><div><small>Como está ahora</small><p>${esc(b.texto)}</p></div></div><p class="nota">${igual ? 'Sin cambios respecto del original.' : 'El bloque cambió desde la importación (por edición tuya o correcciones aceptadas).'}</p>` : '<p>Este bloque no viene de la importación: lo creaste al dividir, o el proyecto es de una versión anterior.</p>', botones: o && !igual ? [{ texto: 'Cerrar', valor: null }, { texto: 'Volver al original', valor: 'volver' }] : [{ texto: 'Cerrar', valor: null }] });
    if (r === 'volver') Folio.cambiar('texto:editar', p => { const x = p.bloques.find(y => y.id === id); x.texto = o.texto; x.runs = o.runs ? JSON.parse(JSON.stringify(o.runs)) : null; });
  }

  // ---------- vistas ----------
  function puerta() {
    const esc2 = (window.BESTIARIO || []).filter(f => f.rol === 'escena'); const e = esc2[(Math.random() * esc2.length) | 0] || {};
    return { cols: '1fr', html: panel('puerta', 'La puerta del manuscrito', 'nada cambia sin tu permiso', `<div class="vacio"><figure class="marco-escena"><img src="${e.src || ''}" alt="" title="${esc(e.ficha || '')}"></figure><h2>Trae tu manuscrito</h2><p>Arrástralo aquí: Word, PDF, OpenDocument, RTF, texto, Markdown, HTML o fotos de páginas.</p><div><button class="boton taco" data-m="elegir">Elegir archivo</button> <button class="boton" data-m="escaneo">Leer páginas escaneadas</button> <button class="boton" data-m="pegar">Pegar texto</button> <button class="boton" data-m="abrir">Abrir un proyecto</button></div><p class="nota" style="margin-top:14px"><button class="enlace" data-m="ejemplo">o prueba con un texto de ejemplo</button></p></div>`, '', 'texto-panel') };
  }
  function render() {
    const p = Folio.p;
    if (!p.bloques.length) return puerta();
    const secciones = []; let actual = null;
    p.bloques.forEach((b, i) => { if (b.tipo === 'h1' || b.tipo === 'h2' || !actual) { actual = { id: b.id, t: b.tipo === 'h1' || b.tipo === 'h2' ? b.texto : '(inicio)', nivel: b.tipo, n: 0 }; secciones.push(actual); } actual.n++; });
    const palabras = p.bloques.reduce((a, b) => a + (b.texto.match(/\S+/g) || []).length, 0);
    const ilus = {}; for (const il of p.ilustraciones || []) (ilus[il.despuesDe] = ilus[il.despuesDe] || []).push(il);
    const texto = `<div class="manuscrito">${p.bloques.map((b, i) => `
      <div class="bloque t-${b.tipo}${sel === b.id ? ' sel' : ''}" data-id="${b.id}"><button class="glosa" data-m="tipo" title="Cambiar la función del bloque">${TIPOS[b.tipo] || b.tipo}</button><div class="contenido">${htmlBloque(b)}</div>
      ${sel === b.id ? `<div class="herr"><button class="boton chico" data-m="editar">Editar</button><button class="boton chico" data-m="unir" ${i === p.bloques.length - 1 ? 'disabled' : ''}>Unir con el siguiente</button><button class="boton chico" data-m="dividir" title="Edita el bloque, pon el cursor donde quieras cortar y pulsa aquí">Dividir en el cursor</button><button class="boton chico" data-m="original">Ver el original</button><button class="boton chico" data-m="grabado">Poner un grabado aquí</button><button class="boton chico" data-m="eliminar">Eliminar</button></div>` : ''}</div>
      ${(ilus[b.id] || []).map(il => `<figure class="ilus-man"><img src="${il.lamina ? ARCHIVO.mini(il.lamina) : ''}" alt=""><figcaption>${esc(il.pie || 'Grabado ' + (il.lamina || ''))} · ${({ pagina: 'página completa', media: 'media página', vineta: 'viñeta' })[il.modo] || ''}</figcaption></figure>`).join('')}`).join('')}</div>`;
    const o = p.origen || { archivos: [], avisos: [], informes: [] };
    const ocrBaja = (o.informes || []).filter(r => r.method === 'OCR' && r.confidence < 75);
    return {
      cols: '236px 1fr 300px',
      html: panel('esquema', 'Esquema', `${secciones.length} ${secciones.length === 1 ? 'sección' : 'secciones'}`, `<ul class="lista secciones">${secciones.map(s => `<li data-ir-bloque="${s.id}" class="${s.nivel === 'h2' ? 'sub2' : ''}"><a>${esc(s.t).slice(0, 60)}</a> <span>${s.n}</span></li>`).join('')}</ul><p class="nota">${p.bloques.length} bloques · ${palabras.toLocaleString('es-CL')} palabras. Clic en una sección para ir a ella.</p>`) +
        panel('texto', 'El texto', 'doble clic para editar · clic en la glosa para cambiar la función', texto, '', 'texto-panel') +
        panel('origen', 'Origen', esc((o.archivos[0] || {}).nombre || ''), `<div class="ficha">${o.archivos.map(a => `<p>${esc(a.nombre)} <span class="dim">· ${new Date(a.fecha).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</span></p>`).join('')}<p class="dim">El original queda guardado dentro del proyecto.</p>
          ${o.avisos.length || ocrBaja.length ? `<div class="sub">Avisos de la importación</div><ul class="avisos">${o.avisos.map(a => `<li>${esc(a)}</li>`).join('')}${ocrBaja.map(r => `<li>OCR p. ${r.page}: confianza ${r.confidence} %</li>`).join('')}</ul>` : ''}
          <div class="sub">Tipo de libro</div><div class="fila-botones">${Object.entries(Folio.TIPOS_LIBRO).map(([k, t]) => `<button class="boton chico ${p.tipo === k ? 'taco' : ''}" data-tipo-libro="${k}">${t.nombre}</button>`).join('')}</div>
          <div class="pila"><button class="boton" data-m="anadir">Añadir otro archivo al final</button><button class="boton" data-m="pegar-anadir">Pegar texto al final</button><button class="boton" data-m="reemplazar">Reemplazar el manuscrito…</button><button class="boton" data-m="exportar">Exportar el texto (.txt)</button></div></div>`, App.seguir(1, 'Revisar el texto →')),
    };
  }

  function montar(m) {
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-m]');
      const bloque = e.target.closest('.bloque');
      if (b) {
        const id = bloque && bloque.dataset.id;
        switch (b.dataset.m) {
          case 'elegir': return elegirArchivo({});
          case 'escaneo': return elegirArchivo({ ocr: true });
          case 'pegar': return pegar('reemplazar');
          case 'pegar-anadir': return pegar('anadir');
          case 'abrir': return App.abrir();
          case 'ejemplo': return ejemplo();
          case 'anadir': return elegirArchivo({ modo: 'anadir' });
          case 'reemplazar': if (await App.confirmar('Reemplazar el manuscrito borra los bloques actuales, sus correcciones y las ilustraciones colocadas. Puedes deshacerlo con Ctrl+Z.', 'Elegir el archivo nuevo')) elegirArchivo({}); return;
          case 'exportar': return App.descargar((Folio.p.titulo || 'texto') + '.txt', Folio.p.bloques.map(x => (x.tipo === 'h1' ? '# ' : x.tipo === 'h2' ? '## ' : '') + x.texto).join('\n\n'));
          case 'tipo': e.stopPropagation(); return cambiarTipo(id, b);
          case 'editar': return editar(id);
          case 'original': return verOriginal(id);
          case 'grabado': return Archivo.abrir({ modo: 'insertar', despuesDe: id });
          case 'unir': { const i = Folio.p.bloques.findIndex(x => x.id === id); terminar(true); return Folio.cambiar('texto:unir', p => Folio.texto.unir(p, i)); }
          case 'eliminar': { const i = Folio.p.bloques.findIndex(x => x.id === id); sel = null; Folio.cambiar('texto:eliminar', p => { p.bloques.splice(i, 1); p.ilustraciones = (p.ilustraciones || []).map(il => il.despuesDe === id ? { ...il, despuesDe: (p.bloques[i - 1] || p.bloques[0] || {}).id } : il); }); return App.aviso('Bloque eliminado.', { accion: { texto: 'Deshacer', hacer: () => Folio.deshacerUltimo() } }); }
          case 'dividir': {
            const el = bloque.querySelector('.contenido');
            if (editando !== id) { App.aviso('Primero haz doble clic en el bloque y pon el cursor donde quieres cortar.'); return editar(id); }
            const pos = posicionCursor(el); terminar(true);
            const i = Folio.p.bloques.findIndex(x => x.id === id), t = Folio.p.bloques[i].texto;
            if (pos <= 0 || pos >= t.length) return App.aviso('Pon el cursor dentro del texto, no en un extremo.');
            return Folio.cambiar('texto:dividir', p => Folio.texto.dividir(p, i, pos));
          }
        }
      }
      const tl = e.target.closest('[data-tipo-libro]');
      if (tl) return Folio.cambiar('tipo-libro', p => { p.tipo = tl.dataset.tipoLibro; const t = Folio.TIPOS_LIBRO[p.tipo]; p.ajustes.alineacion = t.alineacion; p.ajustes.sangria = t.sangria; p.ajustes.entreParrafos = t.entreParrafos; });
      const s = e.target.closest('[data-ir-bloque]');
      if (s) { const el = m.querySelector(`.bloque[data-id="${s.dataset.irBloque}"]`); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
      if (bloque && bloque.dataset.id !== sel && !e.target.closest('.herr')) { if (editando && editando !== bloque.dataset.id) terminar(true); sel = bloque.dataset.id; marcarSel(m); }
    });
    m.addEventListener('dblclick', e => { const bl = e.target.closest('.bloque'); if (bl && editando !== bl.dataset.id) { sel = bl.dataset.id; marcarSel(m); editar(bl.dataset.id); } });
    m.addEventListener('keydown', e => {
      if (!editando) return;
      if (e.key === 'Escape') { e.preventDefault(); terminar(false); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); terminar(true); }
    });
    m.addEventListener('focusout', e => { if (editando && e.target.classList && e.target.classList.contains('contenido') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.herr'))) terminar(true); });
  }
  // marcar la selección sin redibujar todo (para no perder el desplazamiento)
  function marcarSel(m) {
    m.querySelectorAll('.bloque.sel').forEach(b => { b.classList.remove('sel'); const h = b.querySelector('.herr'); if (h) h.remove(); });
    const b = m.querySelector(`.bloque[data-id="${sel}"]`); if (!b) return;
    b.classList.add('sel');
    const i = Folio.p.bloques.findIndex(x => x.id === sel);
    b.insertAdjacentHTML('beforeend', `<div class="herr"><button class="boton chico" data-m="editar">Editar</button><button class="boton chico" data-m="unir" ${i === Folio.p.bloques.length - 1 ? 'disabled' : ''}>Unir con el siguiente</button><button class="boton chico" data-m="dividir" title="Edita el bloque, pon el cursor donde quieras cortar y pulsa aquí">Dividir en el cursor</button><button class="boton chico" data-m="original">Ver el original</button><button class="boton chico" data-m="grabado">Poner un grabado aquí</button><button class="boton chico" data-m="eliminar">Eliminar</button></div>`);
  }

  App.registrar({
    indice: 0, n: 'I', nombre: 'Manuscrito',
    estado: () => Folio.p.bloques.length ? `${Folio.p.bloques.length} bloques` : 'sin texto',
    render, montar,
    alCambiar(motivo) { if (motivo === 'importar' || motivo === 'cargar') { sel = null; } },
    salir() { terminar(true); },
    importar, ejemplo,
  });
})();
