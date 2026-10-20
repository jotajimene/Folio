/* Folio · Archivo de grabados
 * Las láminas recortadas y las páginas originales de donde salen, con su ficha
 * de procedencia (obra, autor, fecha, licencia y enlace a Wikimedia Commons).
 */
(function () {
  'use strict';
  const { esc } = App;
  const capa = document.querySelector('.archivo-capa');
  let op = {}, tipo = 'todas', fuente = '', busca = '', limite = 160, elegida = null, verPagina = false;
  const TIPOS = { todas: 'Todo', figura: 'Figuras', hierbas: 'Plantas (herbario)', escena: 'Escenas enmarcadas', orla: 'Orlas y cenefas', inicial: 'Iniciales' };

  function lista() {
    const q = busca.trim().toLowerCase();
    return ARCHIVO.mezcla.filter(l => {
      if (tipo === 'hierbas' ? !l.hb : (tipo !== 'todas' && l.tipo !== tipo)) return false;
      const pg = ARCHIVO.paginas[l.p] || {};
      if (fuente && pg.f !== fuente) return false;
      if (q && !(`${pg.f} ${pg.t} ${pg.a} ${pg.y}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }
  function ficha(id) {
    const f = ARCHIVO.ficha(id); if (!f) return '<p class="nota">Elige una lámina para ver su ficha.</p>';
    const { lamina: l, pagina: pg, fuente: fu } = f;
    const caja = l.b ? `left:${l.b[0] / pg.w * 100}%;top:${l.b[1] / pg.h * 100}%;width:${(l.b[2] - l.b[0]) / pg.w * 100}%;height:${(l.b[3] - l.b[1]) / pg.h * 100}%` : '';
    const bloques = Folio.p.bloques;
    const acciones = [];
    if (op.modo === 'cubierta') acciones.push(`<button class="boton taco" data-a="cubierta">Usar en la cubierta</button>`);
    if (op.modo === 'insertar') acciones.push(`<label class="campo"><span>Ponerlo después de</span><select class="pos">${bloques.map((b, i) => `<option value="${b.id}" ${(op.despuesDe ? b.id === op.despuesDe : i === bloques.length - 1) ? 'selected' : ''}>${esc((b.tipo === 'h1' ? '§ ' : '') + b.texto.slice(0, 60))}</option>`).join('')}</select></label><label class="campo"><span>Cómo</span><select class="modo-il"><option value="media">Media página</option><option value="pagina">Página completa</option><option value="vineta">Viñeta</option><option value="sangre">Página a sangre</option></select></label><button class="boton taco" data-a="insertar" ${bloques.length ? '' : 'disabled'}>Poner en el libro</button>`);
    if (!op.modo || op.modo === 'ver') acciones.push(`<button class="boton" data-a="cubierta">Usar en la cubierta</button>${bloques.length ? '<button class="boton" data-a="a-insertar">Poner en el libro…</button>' : ''}`);
    return `<div class="ar-imagen ${verPagina ? 'pagina' : ''}">${verPagina ? `<div class="ar-pag"><img src="${ARCHIVO.paginaSrc(l.p)}" alt="Página original"><i style="${caja}"></i></div>` : `<img src="${ARCHIVO.src(l.id)}" alt="">`}</div>
      <div class="fila-botones centrada"><button class="boton chico ${verPagina ? '' : 'taco'}" data-a="lamina">La lámina</button><button class="boton chico ${verPagina ? 'taco' : ''}" data-a="pagina">La página original</button></div>
      <dl class="ar-ficha"><dt>Obra</dt><dd>${esc(pg.o || fu.obra || fu.nombre)}</dd><dt>Autoría</dt><dd>${esc(pg.a || 'Autor desconocido')}</dd>${pg.y ? `<dt>Fecha</dt><dd>${esc(pg.y)}</dd>` : ''}<dt>Licencia</dt><dd>${esc(pg.l || 'Dominio público')}</dd><dt>Archivo</dt><dd>${esc(pg.t)}</dd>${pg.c ? `<dt>Procedencia</dt><dd class="chica">${esc(pg.c)}</dd>` : ''}<dt>Lámina</dt><dd>${l.id} · ${l.w}×${l.h} px · ${({ figura: 'figura', escena: 'escena', orla: 'orla', inicial: 'inicial' })[l.tipo]}${l.extra ? ' · traída por ti' : ''}</dd></dl>
      <div class="fila-botones"><button class="boton chico" data-a="copiar">Copiar la atribución</button>${pg.u ? `<button class="boton chico" data-a="commons" title="Abre la ficha en el navegador (necesita internet)">Ficha en Commons ↗</button>` : ''}${l.extra ? '<button class="boton chico" data-a="quitar-extra">Quitar de mi archivo</button>' : ''}</div>
      <div class="ar-acciones">${acciones.join('')}</div>`;
  }
  function dibujar() {
    const L = lista(), vis = L.slice(0, limite);
    const cuenta = {}; for (const l of ARCHIVO.laminas) { const f = (ARCHIVO.paginas[l.p] || {}).f; cuenta[f] = (cuenta[f] || 0) + 1; }
    capa.innerHTML = `<div class="ar-marco">
      <div class="rotulo"><span>Archivo de grabados</span> <i>${ARCHIVO.laminas.length.toLocaleString('es-CL')} láminas de ${Object.keys(ARCHIVO.paginas).length.toLocaleString('es-CL')} páginas originales, todas de dominio público o con licencia libre</i>${window.Escritorio && Escritorio.herr && Escritorio.herr.buscarCommons ? '<button class="boton chico ar-traer" data-a="traer" title="Busca grabados de dominio público en Wikimedia Commons y guárdalos en tu archivo (necesita internet)">Traer de Commons…</button>' : ''}<button class="cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>
      <div class="ar-cuerpo">
        <aside class="ar-filtros"><input type="search" class="ar-busca" placeholder="Buscar por obra, autor, año…" value="${esc(busca)}">
          <div class="sub">Tipo</div><ul class="lista">${Object.entries(TIPOS).map(([k, t]) => `<li class="${k === tipo ? 'on' : ''}" data-tipo="${k}"><a>${t}</a> <span>${k === 'todas' ? ARCHIVO.laminas.length : k === 'hierbas' ? ARCHIVO.laminas.filter(l => l.hb).length : ARCHIVO.laminas.filter(l => l.tipo === k).length}</span></li>`).join('')}</ul>
          <div class="sub">Fuente</div><ul class="lista fuentes"><li class="${!fuente ? 'on' : ''}" data-fuente=""><a>Todas</a></li>${ARCHIVO.fuentes.slice().sort((a, b) => (cuenta[b.nombre] || 0) - (cuenta[a.nombre] || 0)).map(f => `<li class="${fuente === f.nombre ? 'on' : ''}" data-fuente="${esc(f.nombre)}"><a>${esc(f.nombre)}</a> <span>${cuenta[f.nombre] || 0}</span></li>`).join('')}</ul></aside>
        <div class="ar-rejilla"><p class="nota">${L.length.toLocaleString('es-CL')} láminas${op.modo === 'insertar' ? ' · elige una para ponerla en el libro' : op.modo === 'cubierta' ? ' · elige una para la cubierta' : ''}</p><div class="ar-minis">${vis.map(l => `<button class="ar-mini ${l.id === elegida ? 'on' : ''}" data-id="${l.id}" title="${esc((ARCHIVO.paginas[l.p] || {}).f || '')}"><img src="${ARCHIVO.mini(l.id)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>${L.length > limite ? `<button class="boton" data-a="mas" style="margin:14px auto;display:block">Mostrar más (${(L.length - limite).toLocaleString('es-CL')} restantes)</button>` : ''}</div>
        <aside class="ar-detalle">${ficha(elegida)}</aside>
      </div></div>`;
  }
  async function abrir(o = {}) {
    op = o; await ARCHIVO.cargar();
    if (o.ficha) { elegida = o.ficha; verPagina = false; }
    else if (!elegida) elegida = ARCHIVO.laminas[(Math.random() * ARCHIVO.laminas.length) | 0].id;
    capa.hidden = false; document.body.classList.add('con-archivo'); dibujar();
    const b = capa.querySelector('.ar-busca'); if (b && !o.ficha) b.focus();
  }
  function cerrar() { capa.hidden = true; document.body.classList.remove('con-archivo'); capa.innerHTML = ''; }
  function atribucion(id) { const f = ARCHIVO.ficha(id); return `${f.pagina.o || f.fuente.obra || f.fuente.nombre}. ${f.pagina.a || 'Autor desconocido'}${f.pagina.y ? ', ' + f.pagina.y : ''}. ${f.pagina.l || 'Dominio público'}. Vía Wikimedia Commons: ${f.pagina.u}`; }

  capa.addEventListener('click', e => {
    const m = e.target.closest('[data-id]'); if (m) { elegida = m.dataset.id; verPagina = false; capa.querySelectorAll('.ar-mini.on').forEach(x => x.classList.remove('on')); m.classList.add('on'); capa.querySelector('.ar-detalle').innerHTML = ficha(elegida); return; }
    const t = e.target.closest('[data-tipo]'); if (t) { tipo = t.dataset.tipo; limite = 160; return dibujar(); }
    const f = e.target.closest('[data-fuente]'); if (f) { fuente = f.dataset.fuente; limite = 160; return dibujar(); }
    const a = e.target.closest('[data-a]'); if (!a) return;
    switch (a.dataset.a) {
      case 'cerrar': return cerrar();
      case 'traer': return traerDeCommons();
      case 'quitar-extra': { const id = elegida; App.confirmar('Quitar esta lámina de tu archivo. Los libros que ya la usan dejarán de mostrarla.', 'Quitar').then(async ok => { if (!ok) return; await Escritorio.herr.extraQuitar(id); ARCHIVO.quitarExtra(id); elegida = ARCHIVO.mezcla[0] && ARCHIVO.mezcla[0].id; dibujar(); }); return; }
      case 'mas': limite += 320; return dibujar();
      case 'lamina': verPagina = false; capa.querySelector('.ar-detalle').innerHTML = ficha(elegida); return;
      case 'pagina': verPagina = true; capa.querySelector('.ar-detalle').innerHTML = ficha(elegida); return;
      case 'copiar': navigator.clipboard.writeText(atribucion(elegida)).then(() => App.aviso('Atribución copiada.')); return;
      case 'commons': { const u = (ARCHIVO.ficha(elegida).pagina || {}).u; if (u && window.Escritorio) Escritorio.externo(u); return; }
      case 'cubierta': { const id = elegida; Folio.cambiar('cubierta:imagen', p => { p.cubierta.imagen = id; const c = Folio.coleccion(); if (['tipografica', 'texto', 'puntos'].includes(c.generador)) p.coleccion = 'bestiario'; }); cerrar(); App.aviso('Grabado puesto en la cubierta.'); if (App.actual !== 4) App.ir(4); return; }
      case 'a-insertar': op = { modo: 'insertar' }; capa.querySelector('.ar-detalle').innerHTML = ficha(elegida); return;
      case 'insertar': {
        const pos = capa.querySelector('.pos').value, modo = capa.querySelector('.modo-il').value, id = elegida;
        Folio.cambiar('ajuste:ilustracion', p => { p.ilustraciones.push({ id: Folio.uid(), lamina: id, despuesDe: pos, modo, pie: '' }); });
        cerrar(); App.aviso('Grabado puesto en el libro. Su procedencia se agrega a los créditos.'); return;
      }
    }
  });
  let tb = null;
  capa.addEventListener('input', e => { if (e.target.matches('.ar-busca')) { clearTimeout(tb); tb = setTimeout(() => { busca = e.target.value; limite = 160; const pos = e.target.selectionStart; dibujar(); const b = capa.querySelector('.ar-busca'); b.focus(); b.setSelectionRange(pos, pos); }, 220); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !capa.hidden && document.querySelector('.modal-capa').hidden) cerrar(); });

  // ---- traer grabados de Wikimedia Commons (solo dominio público o licencias libres) ----
  const aB64 = c => c.toDataURL('image/png').split(',')[1];
  const escalar = (img, max) => { const k = Math.min(1, max / Math.max(img.width || img.naturalWidth, img.height || img.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.round((img.width || img.naturalWidth) * k); c.height = Math.round((img.height || img.naturalHeight) * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); return c; };
  async function traerDeCommons() {
    let resultados = [], marcado = null, buscando = false;
    const r = await App.modal({ titulo: 'Traer grabados de Wikimedia Commons', ancho: 900,
      cuerpo: `<div class="cm-busca"><input type="search" class="campo-texto cm-q" placeholder="Por ejemplo: dragón, ballena, Durero, astrolabio, herbario…"><label class="chequeo"><input type="checkbox" class="cm-solo" checked> solo grabados e ilustraciones</label><button class="boton taco" data-cm="buscar">Buscar</button></div>
        <p class="nota cm-estado">Solo se envía a Commons la palabra que buscas. Se muestran únicamente imágenes de dominio público o con licencia libre; su procedencia queda en la ficha y en los créditos del libro.</p>
        <div class="cm-rejilla"></div>`,
      botones: [{ texto: 'Cerrar', valor: null }, { texto: 'Traer la elegida', taco: true, valor: () => marcado }],
      alAbrir: m => {
        const est = m.querySelector('.cm-estado'), rej = m.querySelector('.cm-rejilla');
        const buscar = async () => {
          const q = m.querySelector('.cm-q').value.trim(); if (!q || buscando) return;
          buscando = true; est.textContent = 'Buscando en Commons…'; rej.innerHTML = '';
          try { resultados = await Escritorio.herr.buscarCommons(q, m.querySelector('.cm-solo').checked); }
          catch (e) { est.textContent = 'No pude buscar: ' + e.message + ' ¿Hay conexión a internet?'; buscando = false; return; }
          buscando = false; marcado = null;
          est.textContent = resultados.length ? `${resultados.length} imágenes libres. Elige una.` : 'Nada libre con esa búsqueda; prueba otra palabra (en inglés suele haber más).';
          rej.innerHTML = resultados.map((x, i) => `<button class="cm-item" data-i="${i}" title="${esc(x.titulo)}"><img src="${x.miniB64}" alt=""><small>${esc(x.licencia)}</small></button>`).join('');
        };
        m.querySelector('.cm-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
        m.addEventListener('click', e => {
          if (e.target.closest('[data-cm="buscar"]')) return buscar();
          const it = e.target.closest('.cm-item'); if (!it) return;
          m.querySelectorAll('.cm-item.on').forEach(x => x.classList.remove('on')); it.classList.add('on'); marcado = resultados[+it.dataset.i];
          est.innerHTML = `<b>${esc(marcado.obra)}</b> · ${esc(marcado.autor)}${marcado.fecha ? ' · ' + esc(marcado.fecha) : ''} · ${esc(marcado.licencia)} · ${marcado.w}×${marcado.h} px`;
        });
        setTimeout(() => m.querySelector('.cm-q').focus(), 50);
      } });
    if (!r) return;
    App.aviso('Trayendo la imagen…', { ms: 3000 });
    let img; try { const b64 = await Escritorio.herr.traerCommons(r); img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode(); }
    catch (e) { return App.aviso('No pude traerla: ' + e.message, { tipo: 'mal' }); }
    // tratamiento: a tinta como el resto del archivo, o tal cual
    let modo = 'grabado', fuerza = 0.5;
    const ok = await App.modal({ titulo: 'Guardar en tu archivo', ancho: 760,
      cuerpo: `<div class="tratamientos"><div class="previa-trat"><canvas></canvas></div><div><div class="sub">Cómo guardarla</div>${[['grabado', 'A tinta (como el archivo)'], ['original', 'Tal cual, en grises']].map(([k, v]) => `<label class="chequeo"><input type="radio" name="trat" value="${k}" ${k === modo ? 'checked' : ''}> ${v}</label>`).join('')}<label class="ajuste"><span>Intensidad</span><input type="range" min="0" max="1" step="0.05" value="0.5" class="fuerza"></label><label class="campo"><span>Tipo</span><select class="cm-tipo"><option value="figura">Figura</option><option value="escena">Escena</option><option value="orla">Orla</option><option value="inicial">Inicial</option></select></label><p class="nota">${esc(r.obra)} · ${esc(r.licencia)}</p></div></div>`,
      botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar en el archivo', taco: true, valor: c => c.querySelector('.cm-tipo').value }],
      alAbrir: m => { const cv = m.querySelector('canvas'); const pintar = () => { const t = Imagenes.tratar(img, modo === 'original' ? 'gris' : modo, fuerza, 700); cv.width = t.width; cv.height = t.height; cv.getContext('2d').drawImage(t, 0, 0); }; m.addEventListener('change', e => { if (e.target.name === 'trat') { modo = e.target.value; pintar(); } }); m.addEventListener('input', e => { if (e.target.classList.contains('fuerza')) { fuerza = +e.target.value; pintar(); } }); pintar(); } });
    if (!ok) return;
    const lam = Imagenes.tratar(img, modo === 'original' ? 'gris' : modo, fuerza, 1600), mini = escalar(lam, 200), pag = escalar(img, 1600);
    const id = await Escritorio.herr.extraGuardar({ ficha: { ...r, tipo: ok, w: lam.width, h: lam.height, pw: pag.width, ph: pag.height, miniB64: undefined }, laminaB64: aB64(lam), miniB64: aB64(mini), paginaB64: pag.toDataURL('image/jpeg', .85).split(',')[1] });
    await ARCHIVO.cargarExtra(); elegida = id; tipo = 'todas'; fuente = ''; busca = ''; dibujar();
    App.aviso('Guardada en tu archivo. Queda en tu carpeta de Folio y funciona sin internet.');
  }

  window.Archivo = { abrir, cerrar, atribucion, traerDeCommons };
})();
