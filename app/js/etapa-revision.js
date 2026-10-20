/* Folio · etapa II · Revisión
 * Ortografía (diccionario libre RLA-ES de LibreOffice, vía nspell) y reglas de
 * ortotipografía española. Cada observación es una propuesta: el texto solo
 * cambia cuando la aceptas, y toda aceptación se puede revertir.
 */
(function () {
  'use strict';
  const { esc, panel } = App;
  let trabajador = null, pedido = 0, obs = [], filtro = 'Todas', idx = 0, estado = 'sin-revisar', ultimoTiempo = 0, revisadoDe = null;

  function obtenerTrabajador() {
    if (!trabajador) { trabajador = new Worker('js/revision-trabajador.js'); }
    return trabajador;
  }
  function revisar(bloques) {
    const p = Folio.p; const id = ++pedido; const t0 = performance.now();
    return new Promise((res, rej) => {
      const w = obtenerTrabajador();
      const al = e => { if (e.data.id !== id) return; w.removeEventListener('message', al); ultimoTiempo = performance.now() - t0; e.data.error ? rej(new Error(e.data.error)) : res(e.data.obs); };
      w.addEventListener('message', al);
      w.postMessage({ id, bloques: bloques.map(b => ({ id: b.id, tipo: b.tipo, texto: b.texto })), opciones: { diccionario: p.revision.diccionario, ignorar: p.revision.ignorar, ortografia: true } });
    });
  }
  async function revisarTodo() {
    estado = 'revisando'; App.refrescar();
    try {
      obs = await revisar(Folio.p.bloques); revisadoDe = huella(); estado = 'listo'; idx = 0;
    } catch (e) { estado = 'error'; App.aviso('La revisión falló: ' + e.message, { tipo: 'mal' }); }
    App.refrescar(); App.camino();
  }
  const huella = () => Folio.p.bloques.map(b => b.id + ':' + b.texto.length).join('|');
  const visibles = () => filtro === 'Todas' ? obs : obs.filter(o => o.cat === filtro);
  // vuelve a revisar solo un bloque (tras aceptar una corrección cambian sus posiciones)
  async function revisarBloque(id) {
    const b = Folio.p.bloques.find(x => x.id === id); if (!b) { obs = obs.filter(o => o.bloque !== id); return; }
    const nuevas = await revisar([b]);
    const actualId = (visibles()[idx] || {}).id;
    const pos = obs.findIndex(o => o.bloque === id);
    obs = obs.filter(o => o.bloque !== id);
    obs.splice(pos < 0 ? obs.length : pos, 0, ...nuevas);
    revisadoDe = huella();
    const v = visibles(); const j = v.findIndex(o => o.id === actualId); if (j >= 0) idx = j; idx = Math.min(idx, Math.max(0, v.length - 1));
  }

  async function aceptar(o, propuesta) {
    const despues = propuesta ?? o.despues; if (despues == null) return;
    const b = Folio.p.bloques.find(x => x.id === o.bloque);
    if (!b || b.texto.slice(o.inicio, o.fin) !== o.antes) { App.aviso('El texto cambió desde la revisión; vuelvo a revisar este bloque.'); await revisarBloque(o.bloque); App.refrescar(); return; }
    Folio.cambiar('revision:aceptar', p => {
      const x = p.bloques.find(y => y.id === o.bloque);
      Folio.texto.reemplazar(x, o.inicio, o.fin, despues);
      p.revision.decididas.push({ id: Folio.uid(), regla: o.regla, cat: o.cat, bloque: o.bloque, inicio: o.inicio, antes: o.antes, despues, fecha: new Date().toISOString() });
    }, { silencioso: true });
    await revisarBloque(o.bloque); App.refrescar(); App.camino();
  }
  function descartar(o) {
    Folio.cambiar('revision:descartar', p => { p.revision.ignorar.push(o.clave); }, { silencioso: true });
    obs = obs.filter(x => x.clave !== o.clave || x.bloque !== o.bloque || (o.regla === 'ortografia' && x.clave !== o.clave));
    if (o.regla === 'ortografia') obs = obs.filter(x => x.clave !== o.clave);
    idx = Math.min(idx, Math.max(0, visibles().length - 1)); App.refrescar(); App.camino();
  }
  function alDiccionario(o) {
    const w = o.antes.toLowerCase();
    Folio.cambiar('revision:diccionario', p => { if (!p.revision.diccionario.includes(w)) p.revision.diccionario.push(w); }, { silencioso: true });
    obs = obs.filter(x => !(x.regla === 'ortografia' && x.antes.toLowerCase() === w));
    idx = Math.min(idx, Math.max(0, visibles().length - 1)); App.aviso(`«${o.antes}» quedó en el diccionario de este libro.`); App.refrescar(); App.camino();
  }
  async function aceptarTodas(o) {
    const mismas = obs.filter(x => x.regla === o.regla && x.despues != null && x.regla !== 'ortografia');
    if (!(await App.confirmar(`Aceptar las ${mismas.length} observaciones de «${o.msg}». Podrás revertirlas una a una en «Ya decididas» o deshacer todo con Ctrl+Z.`, `Aceptar ${mismas.length}`))) return;
    // de atrás hacia adelante dentro de cada bloque, para no mover las posiciones
    const orden = [...mismas].sort((a, b) => a.bloque === b.bloque ? b.inicio - a.inicio : 0);
    Folio.cambiar('revision:aceptar', p => {
      for (const x of orden) {
        const bl = p.bloques.find(y => y.id === x.bloque); if (!bl || bl.texto.slice(x.inicio, x.fin) !== x.antes) continue;
        Folio.texto.reemplazar(bl, x.inicio, x.fin, x.despues);
        p.revision.decididas.push({ id: Folio.uid(), regla: x.regla, cat: x.cat, bloque: x.bloque, inicio: x.inicio, antes: x.antes, despues: x.despues, fecha: new Date().toISOString() });
      }
    }, { silencioso: true });
    for (const id of new Set(orden.map(x => x.bloque))) await revisarBloque(id);
    App.refrescar(); App.camino();
  }
  function revertir(d) {
    const b = Folio.p.bloques.find(x => x.id === d.bloque);
    if (!b) return App.aviso('Ese bloque ya no existe.');
    let i = b.texto.slice(d.inicio, d.inicio + d.despues.length) === d.despues ? d.inicio : b.texto.indexOf(d.despues);
    if (i < 0) return App.aviso('No encuentro la corrección en el texto: quizá lo editaste después.');
    Folio.cambiar('revision:revertir', p => {
      const x = p.bloques.find(y => y.id === d.bloque); Folio.texto.reemplazar(x, i, i + d.despues.length, d.antes);
      p.revision.decididas = p.revision.decididas.filter(y => y.id !== d.id);
    }, { silencioso: true });
    revisarBloque(d.bloque).then(() => { App.refrescar(); App.camino(); });
  }

  const visible = s => esc(s).replace(/ /g, '<span class="esp">␣</span>');
  function contexto(o) {
    const b = Folio.p.bloques.find(x => x.id === o.bloque); if (!b) return '';
    const i = Folio.p.bloques.indexOf(b), ant = Folio.p.bloques[i - 1], sig = Folio.p.bloques[i + 1];
    const marcado = esc(b.texto.slice(0, o.inicio)) + `<mark class="marca-obs">${o.fin > o.inicio ? visible(b.texto.slice(o.inicio, o.fin)) : '&nbsp;'}</mark>` + esc(b.texto.slice(o.fin));
    return `<div class="manuscrito">${ant ? `<p class="bloque tenue">${esc(ant.texto)}</p>` : ''}<p class="bloque t-${b.tipo}">${marcado.replace(/\n/g, '<br>')}</p>${sig ? `<p class="bloque tenue">${esc(sig.texto)}</p>` : ''}</div>`;
  }

  function render() {
    const p = Folio.p;
    if (!p.bloques.length) return { cols: '1fr', html: panel('vacio', 'Revisión', 'sin texto', `<div class="vacio"><h2>No hay texto que revisar</h2><p>Primero trae el manuscrito.</p><button class="boton taco" data-ir="0">← Ir al manuscrito</button></div>`) };
    if (estado === 'sin-revisar' || (estado === 'listo' && revisadoDe !== huella() && !p.bloques.length)) { setTimeout(revisarTodo, 0); estado = 'revisando'; }
    const cats = {}; for (const o of obs) cats[o.cat] = (cats[o.cat] || 0) + 1;
    const v = visibles(), o = v[idx];
    const decididas = p.revision.decididas.slice(-30).reverse();
    const izq = panel('filtros', 'Observaciones', estado === 'revisando' ? 'revisando…' : `${obs.length} pendientes`, `<ul class="lista">${['Todas', ...Object.keys(cats).sort()].map(c => `<li class="${c === filtro ? 'on' : ''}" data-filtro="${c}"><a>${c}</a> <span>${c === 'Todas' ? obs.length : cats[c]}</span></li>`).join('')}</ul>
      <div class="sub">Ya decididas</div>${decididas.length ? `<ul class="lista decididas">${decididas.map(d => `<li><span class="d-txt">«${esc(d.antes.slice(0, 18))}» → «${esc(d.despues.slice(0, 18))}»</span><button class="enlace" data-revertir="${d.id}" title="Devolver el texto a como estaba">↶</button></li>`).join('')}</ul>` : '<p class="nota">Ninguna todavía.</p>'}
      ${p.revision.diccionario.length ? `<div class="sub">Diccionario del libro</div><p class="nota">${p.revision.diccionario.map(esc).join(', ')}</p>` : ''}
      <p class="nota">${estado === 'listo' ? `Revisado en ${(ultimoTiempo / 1000).toFixed(1)} s con el diccionario RLA-ES.` : ''} <button class="enlace" data-r="otra-vez">Volver a revisar todo</button></p>`);
    let centro, der;
    if (estado === 'revisando') {
      centro = panel('texto', 'El texto', 'leyendo', `<div class="vacio"><h2>Leyendo el manuscrito…</h2><p>Ortografía, espacios, signos, diálogos y repeticiones.</p></div>`, '', 'texto-panel');
      der = panel('decision', 'Observación', '', '<p class="nota">Un momento.</p>');
    } else if (!o) {
      centro = panel('texto', 'El texto', 'sin pendientes', `<div class="vacio"><h2>${obs.length ? 'Nada en este filtro' : 'Sin observaciones pendientes'}</h2><p>${obs.length ? 'Elige otro tipo a la izquierda.' : 'Lo que quedaba lo aceptaste o lo descartaste.'}</p></div>`, '', 'texto-panel');
      der = panel('decision', 'Observación', '', '<p class="nota">Puedes seguir a los datos del libro.</p>', App.seguir(2, 'Seguir a los datos del libro →'));
    } else {
      const n = Folio.p.bloques.findIndex(b => b.id === o.bloque) + 1;
      centro = panel('texto', 'El texto', `bloque ${n} de ${p.bloques.length}`, contexto(o), '', 'texto-panel');
      const props = o.alternativas && o.alternativas.length ? o.alternativas : (o.despues != null ? [o.despues] : []);
      const mismas = obs.filter(x => x.regla === o.regla && x.despues != null).length;
      der = panel('decision', `Observación ${idx + 1} de ${v.length}`, o.cat.toLowerCase(), `<p class="msg-obs">${esc(o.msg)}</p>${o.nota ? `<p class="nota">${esc(o.nota)}</p>` : ''}
        <div class="antes"><small>Antes</small>${o.antes ? visible(o.antes) : '—'}</div>
        ${props.length ? props.map((x, i) => `<button class="despues ${i ? 'alt' : ''}" data-aceptar="${esc(x)}"><small>${i ? 'Otra propuesta' : 'Después'}</small>${visible(x)}</button>`).join('') : '<div class="despues"><small>Después</small><i>Sin propuesta: decide tú en el manuscrito.</i></div>'}
        <div class="fila-botones">${props.length ? '<button class="boton taco" data-r="aceptar">Aceptar · A</button>' : ''}<button class="boton" data-r="descartar">Descartar · D</button><button class="boton" data-r="saltar">Saltar · →</button></div>
        <div class="fila-botones" style="margin-top:8px">${o.regla === 'ortografia' ? '<button class="boton chico" data-r="diccionario">Es correcta: al diccionario</button>' : ''}${mismas > 1 && o.regla !== 'ortografia' ? `<button class="boton chico" data-r="todas">Aceptar las ${mismas} de este tipo</button>` : ''}<button class="boton chico" data-r="editar">Editar a mano</button></div>`, App.seguir(2, 'Seguir a los datos del libro →'));
    }
    return { cols: '236px 1fr 340px', html: izq + centro + der };
  }

  function montar(m) {
    m.addEventListener('click', e => {
      const f = e.target.closest('[data-filtro]'); if (f) { filtro = f.dataset.filtro; idx = 0; return App.refrescar(); }
      const rv = e.target.closest('[data-revertir]'); if (rv) { const d = Folio.p.revision.decididas.find(x => x.id === rv.dataset.revertir); if (d) revertir(d); return; }
      const ac = e.target.closest('[data-aceptar]'); const o = visibles()[idx];
      if (ac && o) return aceptar(o, ac.dataset.aceptar);
      const r = e.target.closest('[data-r]'); if (!r) return;
      switch (r.dataset.r) {
        case 'aceptar': return o && aceptar(o);
        case 'descartar': return o && descartar(o);
        case 'saltar': idx = (idx + 1) % Math.max(1, visibles().length); return App.refrescar();
        case 'diccionario': return o && alDiccionario(o);
        case 'todas': return o && aceptarTodas(o);
        case 'otra-vez': return revisarTodo();
        case 'editar': return editarAMano(o);
      }
    });
  }
  async function editarAMano(o) {
    const b = Folio.p.bloques.find(x => x.id === o.bloque);
    const t = await App.modal({ titulo: 'Editar el bloque', ancho: 720, cuerpo: `<textarea class="area" rows="10">${esc(b.texto)}</textarea><p class="nota">Si el bloque tiene cursivas, se conservan solo si editas en la etapa Manuscrito.</p>`, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', taco: true, valor: c => c.querySelector('textarea').value }] });
    if (t == null || t === b.texto) return;
    Folio.cambiar('texto:editar', p => { const x = p.bloques.find(y => y.id === o.bloque); x.texto = t; x.runs = null; }, { silencioso: true });
    await revisarBloque(o.bloque); App.refrescar();
  }

  App.registrar({
    indice: 1, n: 'II', nombre: 'Revisión',
    estado: () => estado === 'listo' ? (obs.length ? `${obs.length} pendientes` : 'al día') : estado === 'revisando' ? 'revisando…' : 'por revisar',
    render, montar,
    tecla(e) {
      const o = visibles()[idx]; if (!o) return;
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); aceptar(o); }
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); descartar(o); }
      else if (e.key === 'ArrowRight' || e.key === 's') { e.preventDefault(); idx = (idx + 1) % visibles().length; App.refrescar(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); idx = (idx - 1 + visibles().length) % visibles().length; App.refrescar(); }
    },
    alCambiar(motivo) {
      if (/^revision:/.test(motivo)) return false;
      if (motivo === 'deshacer' || motivo === 'rehacer' || motivo === 'cargar' || motivo === 'importar' || /^texto:/.test(motivo)) { estado = 'sin-revisar'; }
    },
    // para las pruebas automáticas
    _obs: () => obs, _estado: () => estado, revisarTodo, aceptar, descartar,
  });
  Folio.al(m => { if (m === 'importar' || m === 'cargar' || /^texto:/.test(m)) { if (App.actual !== 1) estado = 'sin-revisar'; } });
})();
