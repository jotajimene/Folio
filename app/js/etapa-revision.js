/* Folio · etapa II · Revisión
 * Ortografía (diccionario libre RLA-ES de LibreOffice, vía nspell) y reglas de
 * ortotipografía española. Cada observación es una propuesta: el texto solo
 * cambia cuando la aceptas, y toda aceptación se puede revertir.
 */
(function () {
  'use strict';
  const { esc, panel } = App;
  let trabajador = null, pedido = 0, obs = [], filtro = 'Todas', idx = 0, estado = 'sin-revisar', ultimoTiempo = 0, revisadoDe = null;

  let leyendo = null, detenerModelo = false;
  async function leerConModelo(bloques) {
    detenerModelo = false; let hechos = 0, encontradas = 0;
    try {
      for (const b of bloques) {
        if (detenerModelo) break;
        leyendo = `Leyendo ${++hechos} de ${bloques.length}…`; App.refrescar();
        const lista = await Asistente.lecturaEstilo(b.texto);
        for (const x of lista) {
          let ini = b.texto.indexOf(x.fragmento); if (ini < 0) ini = b.texto.toLowerCase().indexOf(String(x.fragmento).toLowerCase());
          const clave = 'modelo:' + b.id + ':' + String(x.fragmento).slice(0, 40);
          if (Folio.p.revision.ignorar.includes(clave)) continue;
          obs.push({ id: clave + ':' + Date.now(), clave, bloque: b.id, inicio: Math.max(0, ini), fin: ini >= 0 ? ini + x.fragmento.length : 0, antes: ini >= 0 ? b.texto.slice(ini, ini + x.fragmento.length) : '', despues: ini >= 0 && x.alternativa ? String(x.alternativa) : null, cat: 'Lectura del modelo', capa: 'modelo', regla: 'modelo', msg: String(x.problema || 'Observación del modelo.'), nota: ini >= 0 ? 'Propuesta del modelo local: tómala como la opinión de un lector.' : `Sobre «${x.fragmento}». ${x.alternativa ? 'Sugiere: ' + x.alternativa : ''}` });
          encontradas++;
        }
      }
      App.aviso(encontradas ? `El modelo dejó ${encontradas} comentarios.` : 'El modelo no encontró nada que comentar.');
      if (encontradas) { filtro = 'Lectura del modelo'; idx = 0; }
    } catch (e) { if (e.message !== 'sin-modelo') App.aviso('El modelo no pudo leer: ' + e.message, { tipo: 'mal' }); }
    leyendo = null; App.refrescar(); App.camino();
  }
  function bloquesDelCapitulo(id) {
    const B = Folio.p.bloques; let i = Math.max(0, B.findIndex(b => b.id === id));
    let a = i; while (a > 0 && B[a].tipo !== 'h1') a--;
    let z = i + 1; while (z < B.length && B[z].tipo !== 'h1') z++;
    return B.slice(a, z).filter(b => (b.tipo === 'p' || b.tipo === 'verso' || b.tipo === 'cita') && b.texto.length > 80).slice(0, 15);
  }
  const CAPAS = { ortografia: 'Ortografía', ortotipografia: 'Ortotipografía', gramatica: 'Gramática y uso', estilo: 'Estilo' };
  const capasActivas = () => Folio.p.revision.capas || Object.keys(CAPAS);
  function cursivas(b) { const out = []; let pos = 0; for (const r of b.runs || []) { if (r.italic) out.push([pos, pos + r.text.length]); pos += r.text.length; } return out; }
  // pone en cursiva un tramo sin cambiar las letras
  function ponerCursiva(b, ini, fin) {
    const runs = b.runs && b.runs.length ? b.runs : [{ text: b.texto }], out = []; let pos = 0;
    for (const r of runs) {
      const a = pos, z = pos + r.text.length; pos = z;
      if (z <= ini || a >= fin) { out.push({ ...r }); continue; }
      const i0 = Math.max(ini, a) - a, i1 = Math.min(fin, z) - a;
      if (i0 > 0) out.push({ ...r, text: r.text.slice(0, i0) });
      out.push({ ...r, text: r.text.slice(i0, i1), italic: true });
      if (i1 < r.text.length) out.push({ ...r, text: r.text.slice(i1) });
    }
    b.runs = out.filter(x => x.text);
  }
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
      w.postMessage({ id, bloques: bloques.map(b => ({ id: b.id, tipo: b.tipo, texto: b.texto, cursivas: cursivas(b) })), opciones: { diccionario: [...p.revision.diccionario, ...((window.Perfil && Perfil.datos.diccionario) || [])], ignorar: p.revision.ignorar, ortografia: true, capas: capasActivas(), tipo: p.tipo } });
    });
  }
  async function revisarTodo() {
    estado = 'revisando'; App.refrescar();
    try {
      obs = juntar(await revisar(Folio.p.bloques)); revisadoDe = huella(); estado = 'listo'; idx = 0;
    } catch (e) { estado = 'error'; App.aviso('La revisión falló: ' + e.message, { tipo: 'mal' }); }
    App.refrescar(); App.camino();
  }
  // propuestas que vienen de afuera (el corrector humano) y viven en el proyecto hasta que las decides
  const externas = () => (Folio.p.revision.externas || []);
  function juntar(propias) {
    const orden = new Map(Folio.p.bloques.map((b, i) => [b.id, i]));
    return [...externas().filter(o => orden.has(o.bloque)), ...propias].sort((a, b) => (orden.get(a.bloque) - orden.get(b.bloque)) || (a.inicio - b.inicio));
  }
  function quitarExterna(o) { Folio.cambiar('revision:externa', p => { p.revision.externas = (p.revision.externas || []).filter(x => x.id !== o.id); }, { silencioso: true }); }
  async function aceptarExterna(o, propuesta) {
    const p = Folio.p, b = p.bloques.find(x => x.id === o.bloque);
    if (o.accion === 'nuevo-bloque') { Folio.cambiar('revision:aceptar', q => { const i = q.bloques.findIndex(x => x.id === o.bloque); q.bloques.splice(i + 1, 0, { id: Folio.uid(), tipo: 'p', texto: propuesta ?? o.despues, runs: null }); q.revision.externas = q.revision.externas.filter(x => x.id !== o.id); q.revision.decididas.push({ id: Folio.uid(), regla: 'corrector', bloque: o.bloque, inicio: 0, antes: '', despues: o.despues, nuevo: true, fecha: new Date().toISOString() }); }, { silencioso: true }); obs = obs.filter(x => x.id !== o.id); App.refrescar(); App.camino(); return; }
    if (o.accion === 'eliminar-bloque') { Folio.cambiar('revision:aceptar', q => { q.bloques = q.bloques.filter(x => x.id !== o.bloque); q.revision.externas = q.revision.externas.filter(x => x.id !== o.id && x.bloque !== o.bloque); }, { silencioso: true }); obs = obs.filter(x => x.bloque !== o.bloque); App.refrescar(); App.camino(); return; }
    let ini = o.inicio;
    if (!b) return;
    if (b.texto.slice(ini, o.fin) !== o.antes) { const k = b.texto.indexOf(o.antes, Math.max(0, ini - 40)); if (o.antes && k >= 0) ini = k; else return App.aviso('Ese tramo cambió desde que llegó la corrección; edítalo a mano.'); }
    Folio.cambiar('revision:aceptar', q => { const x = q.bloques.find(y => y.id === o.bloque); Folio.texto.reemplazar(x, ini, ini + o.antes.length, propuesta ?? o.despues); q.revision.externas = q.revision.externas.filter(y => y.id !== o.id); q.revision.decididas.push({ id: Folio.uid(), regla: 'corrector', cat: o.cat, bloque: o.bloque, inicio: ini, antes: o.antes, despues: propuesta ?? o.despues, fecha: new Date().toISOString() }); }, { silencioso: true });
    // las demás propuestas externas de ese bloque se corren
    const delta = (propuesta ?? o.despues).length - o.antes.length;
    Folio.cambiar('revision:externa', q => { for (const x of q.revision.externas || []) if (x.bloque === o.bloque && x.inicio >= ini + o.antes.length) { x.inicio += delta; x.fin += delta; } }, { silencioso: true, sinHistorial: true });
    await revisarBloque(o.bloque); App.refrescar(); App.camino();
  }
  const huella = () => Folio.p.bloques.map(b => b.id + ':' + b.texto.length).join('|');
  const visibles = () => filtro === 'Todas' ? obs : obs.filter(o => o.cat === filtro);
  // vuelve a revisar solo un bloque (tras aceptar una corrección cambian sus posiciones)
  async function revisarBloque(id) {
    const b = Folio.p.bloques.find(x => x.id === id); if (!b) { obs = obs.filter(o => o.bloque !== id); return; }
    const nuevas = [...externas().filter(o => o.bloque === id), ...(await revisar([b]))];
    const actualId = (visibles()[idx] || {}).id;
    const pos = obs.findIndex(o => o.bloque === id);
    obs = obs.filter(o => o.bloque !== id);
    obs.splice(pos < 0 ? obs.length : pos, 0, ...nuevas);
    revisadoDe = huella();
    const v = visibles(); const j = v.findIndex(o => o.id === actualId); if (j >= 0) idx = j; idx = Math.min(idx, Math.max(0, v.length - 1));
  }

  async function aceptar(o, propuesta) {
    if (String(o.id).startsWith('ext:')) return aceptarExterna(o, propuesta);
    if (o.accion === 'cursiva') {
      Folio.cambiar('revision:aceptar', p => { const x = p.bloques.find(y => y.id === o.bloque); ponerCursiva(x, o.inicio, o.fin); p.revision.decididas.push({ id: Folio.uid(), regla: o.regla, cat: o.cat, bloque: o.bloque, inicio: o.inicio, antes: o.antes, despues: o.antes, cursiva: true, fecha: new Date().toISOString() }); }, { silencioso: true });
      await revisarBloque(o.bloque); App.refrescar(); App.camino(); return;
    }
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
    if (String(o.id).startsWith('ext:')) { quitarExterna(o); obs = obs.filter(x => x.id !== o.id); idx = Math.min(idx, Math.max(0, visibles().length - 1)); App.refrescar(); App.camino(); return; }
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
    if (d.cursiva) { Folio.cambiar('revision:revertir', p => { const x = p.bloques.find(y => y.id === d.bloque); if (x.runs) { let pos = 0; for (const r of x.runs) { if (pos >= d.inicio && pos < d.inicio + d.antes.length) delete r.italic; pos += r.text.length; } if (!x.runs.some(r => r.italic || r.bold)) x.runs = null; } p.revision.decididas = p.revision.decididas.filter(y => y.id !== d.id); }, { silencioso: true }); revisarBloque(d.bloque).then(() => { App.refrescar(); App.camino(); }); return; }
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
    const nota = s => s.replace(/\uE000/g, '<sup class="llamada">*</sup>');
    const marcado = nota(esc(b.texto.slice(0, o.inicio))) + `<mark class="marca-obs">${o.fin > o.inicio ? visible(b.texto.slice(o.inicio, o.fin)) : '&nbsp;'}</mark>` + nota(esc(b.texto.slice(o.fin)));
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
      <div class="sub">Qué revisar</div>${Object.entries(CAPAS).map(([k, v]) => `<label class="chequeo"><input type="checkbox" data-capa="${k}" ${capasActivas().includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}
      ${p.tipo === 'poesia' ? '<p class="nota">Libro de poesía: en los versos no se revisan estilo ni mayúsculas.</p>' : ''}
      <div class="sub">Lectura con el modelo local</div>
      <p class="nota">${leyendo ? esc(leyendo) : 'Un lector atento que corre en tu computador: comenta ritmo, claridad y repeticiones.'}</p>
      <div class="fila-botones">${leyendo ? '<button class="boton chico" data-r="parar-modelo">Detener</button>' : '<button class="boton chico" data-r="modelo-bloque">Leer este bloque</button><button class="boton chico" data-r="modelo-capitulo">Leer el capítulo</button>'}</div>
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
      const props = o.accion === 'eliminar-bloque' ? [''] : o.regla === 'comentario' ? [] : o.accion === 'cursiva' ? [o.antes] : o.alternativas && o.alternativas.length ? o.alternativas : (o.despues != null ? [o.despues] : []);
      const mismas = obs.filter(x => x.regla === o.regla && x.despues != null).length;
      der = panel('decision', `Observación ${idx + 1} de ${v.length}`, o.cat.toLowerCase(), `<p class="msg-obs">${esc(o.msg)}</p>${o.nota ? `<p class="nota">${esc(o.nota)}</p>` : ''}
        <div class="antes"><small>Antes</small>${o.antes ? visible(o.antes) : '—'}</div>
        ${o.accion === 'eliminar-bloque' ? '<div class="despues"><small>Después</small><i>Párrafo eliminado</i></div>' : ''}
        ${o.accion !== 'eliminar-bloque' && props.length ? props.map((x, i) => `<button class="despues ${i ? 'alt' : ''}" data-aceptar="${esc(x)}"><small>${i ? 'Otra propuesta' : 'Después'}</small>${o.accion === 'cursiva' ? `<i>${visible(x)}</i>` : visible(x)}</button>`).join('') : '<div class="despues"><small>Después</small><i>Sin propuesta: decide tú en el manuscrito.</i></div>'}
        <div class="fila-botones">${props.length ? `<button class="boton taco" data-r="aceptar">${o.accion === 'cursiva' ? 'Poner en cursiva · A' : 'Aceptar · A'}</button>` : ''}<button class="boton" data-r="descartar">${o.regla === 'comentario' ? 'Entendido · D' : 'Descartar · D'}</button><button class="boton" data-r="saltar">Saltar · →</button></div>
        <div class="fila-botones" style="margin-top:8px">${o.regla === 'ortografia' ? '<button class="boton chico" data-r="diccionario">Es correcta: al diccionario</button>' : ''}${mismas > 1 && o.regla !== 'ortografia' ? `<button class="boton chico" data-r="todas">Aceptar las ${mismas} de este tipo</button>` : ''}<button class="boton chico" data-r="editar">Editar a mano</button></div>`, App.seguir(2, 'Seguir a los datos del libro →'));
    }
    return { cols: '236px 1fr 340px', html: izq + centro + der };
  }

  function montar(m) {
    m.addEventListener('change', e => { const c = e.target.dataset.capa; if (!c) return; const act = new Set(capasActivas()); if (e.target.checked) act.add(c); else act.delete(c); Folio.cambiar('revision:capas', p => { p.revision.capas = [...act]; }, { silencioso: true }); revisarTodo(); });
    m.addEventListener('click', e => {
      const f = e.target.closest('[data-filtro]'); if (f) { filtro = f.dataset.filtro; idx = 0; return App.refrescar(); }
      const rv = e.target.closest('[data-revertir]'); if (rv) { const d = Folio.p.revision.decididas.find(x => x.id === rv.dataset.revertir); if (d) revertir(d); return; }
      const ac = e.target.closest('[data-aceptar]'); const o = visibles()[idx];
      if (ac && o) return aceptar(o, o.accion === 'cursiva' ? undefined : ac.dataset.aceptar);
      const r = e.target.closest('[data-r]'); if (!r) return;
      switch (r.dataset.r) {
        case 'aceptar': return o && aceptar(o);
        case 'descartar': return o && descartar(o);
        case 'saltar': idx = (idx + 1) % Math.max(1, visibles().length); return App.refrescar();
        case 'diccionario': return o && alDiccionario(o);
        case 'todas': return o && aceptarTodas(o);
        case 'otra-vez': return revisarTodo();
        case 'modelo-bloque': { const id = (o && o.bloque) || (Folio.p.bloques.find(b => b.tipo === 'p') || {}).id; const b = Folio.p.bloques.find(x => x.id === id); return b && leerConModelo([b]); }
        case 'modelo-capitulo': return leerConModelo(bloquesDelCapitulo((o && o.bloque) || Folio.p.bloques[0].id));
        case 'parar-modelo': detenerModelo = true; leyendo = 'Deteniendo después de este bloque…'; return App.refrescar();
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
      if ((e.key === 'a' || e.key === 'A') && (o.despues != null || o.accion)) { e.preventDefault(); aceptar(o); }
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); descartar(o); }
      else if (e.key === 'ArrowRight' || e.key === 's') { e.preventDefault(); idx = (idx + 1) % visibles().length; App.refrescar(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); idx = (idx - 1 + visibles().length) % visibles().length; App.refrescar(); }
    },
    alCambiar(motivo) {
      if (motivo === 'revision:externas') { estado = 'sin-revisar'; return; }
      if (/^revision:/.test(motivo)) return false;
      if (motivo === 'deshacer' || motivo === 'rehacer' || motivo === 'cargar' || motivo === 'importar' || /^texto:/.test(motivo)) { estado = 'sin-revisar'; }
    },
    // para las pruebas automáticas
    _obs: () => obs, _estado: () => estado, revisarTodo, aceptar, descartar,
  });
  Folio.al(m => { if (m === 'importar' || m === 'cargar' || m === 'revision:externas' || /^texto:/.test(m)) { if (App.actual !== 1) estado = 'sin-revisar'; } });
})();
