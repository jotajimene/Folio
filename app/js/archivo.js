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
      <dl class="ar-ficha"><dt>Obra</dt><dd>${esc(fu.obra || fu.nombre)}</dd><dt>Autoría</dt><dd>${esc(pg.a || 'Autor desconocido')}</dd>${pg.y ? `<dt>Fecha</dt><dd>${esc(pg.y)}</dd>` : ''}<dt>Licencia</dt><dd>${esc(pg.l || 'Dominio público')}</dd><dt>Archivo</dt><dd>${esc(pg.t)}</dd>${pg.c ? `<dt>Procedencia</dt><dd class="chica">${esc(pg.c)}</dd>` : ''}<dt>Lámina</dt><dd>${l.id} · ${l.w}×${l.h} px · ${({ figura: 'figura', escena: 'escena', orla: 'orla', inicial: 'inicial' })[l.tipo]}</dd></dl>
      <div class="fila-botones"><button class="boton chico" data-a="copiar">Copiar la atribución</button>${pg.u ? `<button class="boton chico" data-a="commons" title="Abre la ficha en el navegador (necesita internet)">Ficha en Commons ↗</button>` : ''}</div>
      <div class="ar-acciones">${acciones.join('')}</div>`;
  }
  function dibujar() {
    const L = lista(), vis = L.slice(0, limite);
    const cuenta = {}; for (const l of ARCHIVO.laminas) { const f = (ARCHIVO.paginas[l.p] || {}).f; cuenta[f] = (cuenta[f] || 0) + 1; }
    capa.innerHTML = `<div class="ar-marco">
      <div class="rotulo"><span>Archivo de grabados</span> <i>${ARCHIVO.laminas.length.toLocaleString('es-CL')} láminas de ${Object.keys(ARCHIVO.paginas).length.toLocaleString('es-CL')} páginas originales, todas de dominio público o con licencia libre</i><button class="cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>
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
  function atribucion(id) { const f = ARCHIVO.ficha(id); return `${f.fuente.obra || f.fuente.nombre}. ${f.pagina.a || 'Autor desconocido'}${f.pagina.y ? ', ' + f.pagina.y : ''}. ${f.pagina.l || 'Dominio público'}. Vía Wikimedia Commons: ${f.pagina.u}`; }

  capa.addEventListener('click', e => {
    const m = e.target.closest('[data-id]'); if (m) { elegida = m.dataset.id; verPagina = false; capa.querySelectorAll('.ar-mini.on').forEach(x => x.classList.remove('on')); m.classList.add('on'); capa.querySelector('.ar-detalle').innerHTML = ficha(elegida); return; }
    const t = e.target.closest('[data-tipo]'); if (t) { tipo = t.dataset.tipo; limite = 160; return dibujar(); }
    const f = e.target.closest('[data-fuente]'); if (f) { fuente = f.dataset.fuente; limite = 160; return dibujar(); }
    const a = e.target.closest('[data-a]'); if (!a) return;
    switch (a.dataset.a) {
      case 'cerrar': return cerrar();
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

  window.Archivo = { abrir, cerrar, atribucion };
})();
