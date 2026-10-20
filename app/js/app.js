/* Folio · armazón de la interfaz: etapas, cabecera, avisos, ventanas y teclado */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const App = {
    etapas: [], actual: 0, ocupado: false, esc, $, $$,
    registrar(e) { App.etapas[e.indice] = e; },
    panel(zona, titulo, sub, cuerpo, pie = '', extra = '') {
      return `<section class="panel ${extra}" data-zona="${zona}"><div class="rotulo"><span>${titulo}</span> <i>${sub}</i></div><div class="cuerpo">${cuerpo}</div>${pie ? `<div class="seguir">${pie}</div>` : ''}</section>`;
    },
    seguir: (n, txt) => `<button class="boton taco" data-ir="${n}">${txt}</button>`,

    // ---------- camino de etapas ----------
    camino() {
      $('.camino').innerHTML = App.etapas.map((e, i) => `<button class="paso" data-ir="${i}" ${i === App.actual ? 'aria-current="step"' : ''}><span class="n">${e.n}</span><span><b>${e.nombre}</b><small>${esc(e.estado ? e.estado() : '')}</small></span></button>`).join('');
    },
    pintar() {
      const e = App.etapas[App.actual], viejo = $('.mesa');
      // una mesa nueva en cada dibujo: así los manejadores de la etapa no se acumulan
      const m = viejo.cloneNode(false); viejo.replaceWith(m);
      const r = e.render();
      App.colsPrevias = m.style.gridTemplateColumns;
      m.style.gridTemplateColumns = r.cols;
      m.innerHTML = r.html;
      document.title = `Folio · ${e.nombre}`;
      if (e.montar) e.montar(m);
    },
    // vuelve a dibujar la etapa actual conservando el desplazamiento de cada panel
    refrescar() {
      const pos = {}; $$('.mesa [data-zona] .cuerpo').forEach(c => { pos[c.parentElement.dataset.zona] = c.scrollTop; });
      const antes = $('.mesa').style.gridTemplateColumns + '|' + $$('.mesa [data-zona]').map(z => z.dataset.zona).join();
      App.pintar(); App.camino(); App.cabecera();
      const despues = $('.mesa').style.gridTemplateColumns + '|' + $$('.mesa [data-zona]').map(z => z.dataset.zona).join();
      if (antes !== despues) window.Bestiario.poblar();
      $$('.mesa [data-zona] .cuerpo').forEach(c => { const v = pos[c.parentElement.dataset.zona]; if (v) c.scrollTop = v; });
    },
    async ir(i, { sinPrensa = false, forzar = false } = {}) {
      if (App.ocupado || i < 0 || i >= App.etapas.length || (i === App.actual && !forzar)) return;
      App.ocupado = true;
      const anterior = App.etapas[App.actual];
      if (anterior && anterior.salir) anterior.salir();
      const m = $('.mesa');
      if (!sinPrensa && !quieto) {
        $$('.criatura').forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
        m.classList.add('sale'); $('.cenefa').classList.add('rueda'); $('.prensa').classList.add('baja');
        await new Promise(r => setTimeout(r, 240));
      }
      App.actual = i; App.camino(); App.pintar();
      const m2 = $('.mesa');
      m2.classList.remove('sale'); void m2.offsetWidth; m2.classList.add('entra');
      await new Promise(r => setTimeout(r, quieto || sinPrensa ? 0 : 260));
      await window.Bestiario.poblar();
      setTimeout(() => { $('.mesa').classList.remove('entra'); $('.cenefa').classList.remove('rueda'); $('.prensa').classList.remove('baja'); App.ocupado = false; }, quieto ? 0 : 500);
    },

    // ---------- avisos flotantes ----------
    aviso(msg, { tipo = '', ms = 4200, accion = null } = {}) {
      const el = document.createElement('div'); el.className = 'flotante ' + tipo;
      el.innerHTML = `<span>${esc(msg)}</span>${accion ? `<button class="boton chico">${esc(accion.texto)}</button>` : ''}`;
      if (accion) el.querySelector('button').onclick = () => { accion.hacer(); el.remove(); };
      $('.avisos-flotantes').appendChild(el);
      setTimeout(() => { el.classList.add('fuera'); setTimeout(() => el.remove(), 400); }, ms);
    },

    // ---------- ventanas ----------
    modal({ titulo, cuerpo, botones = [{ texto: 'Cerrar', valor: null }], ancho = 560, alAbrir }) {
      return new Promise(res => {
        const capa = $('.modal-capa'); capa.hidden = false;
        capa.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="width:min(${ancho}px,calc(100vw - 48px))"><div class="rotulo"><span>${titulo}</span><button class="cerrar" aria-label="Cerrar">✕</button></div><div class="modal-cuerpo">${cuerpo}</div><div class="modal-botones">${botones.map((b, i) => `<button class="boton ${b.taco ? 'taco' : ''}" data-i="${i}">${esc(b.texto)}</button>`).join('')}</div></div>`;
        const cerrar = v => { capa.hidden = true; capa.innerHTML = ''; document.removeEventListener('keydown', tecla, true); res(v); };
        const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(null); } };
        document.addEventListener('keydown', tecla, true);
        capa.querySelector('.cerrar').onclick = () => cerrar(null);
        capa.querySelectorAll('.modal-botones button').forEach(b => b.onclick = () => { const bt = botones[+b.dataset.i]; cerrar(typeof bt.valor === 'function' ? bt.valor(capa) : bt.valor); });
        const ctx = { cerrar, el: capa };
        if (alAbrir) alAbrir(capa.querySelector('.modal'), ctx);
        const f = capa.querySelector('input,textarea,select,.modal-botones .taco'); if (f) f.focus();
      });
    },
    confirmar(msg, si = 'Sí', no = 'Cancelar') { return App.modal({ titulo: 'Confirmar', cuerpo: `<p>${msg}</p>`, botones: [{ texto: no, valor: false }, { texto: si, valor: true, taco: true }] }); },

    // ---------- cabecera ----------
    cabecera() {
      const p = Folio.p;
      $('#titulo-proyecto').textContent = p.titulo || 'Libro sin título';
      const hora = d => d ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
      const disco = Folio.ruta ? (Folio.sucio ? `Cambios sin guardar · ${Folio.ruta.split(/[\\/]/).pop()}` : `Guardado ${hora(Folio.guardadoDisco)} · ${Folio.ruta.split(/[\\/]/).pop()}`) : 'Sin guardar en disco';
      $('#estado-guardado').textContent = disco + (Folio.guardadoAuto ? ` · copia automática ${hora(Folio.guardadoAuto)}` : '');
      const d = Folio.deshacer[Folio.deshacer.length - 1], r = Folio.rehacer[Folio.rehacer.length - 1];
      $('#b-deshacer').disabled = !d; $('#b-deshacer').title = d ? `Deshacer: ${etiquetaHumana(d.etiqueta)} (Ctrl+Z)` : 'Nada que deshacer';
      $('#b-rehacer').disabled = !r; $('#b-rehacer').title = r ? `Rehacer: ${etiquetaHumana(r.etiqueta)} (Ctrl+Y)` : 'Nada que rehacer';
    },
    async guardar(como) {
      try { const r = await Folio.guardar(como); if (r && !r.cancelado) App.aviso('Proyecto guardado en ' + (r.ruta || 'disco') + '.'); }
      catch (e) { App.aviso('No se pudo guardar: ' + e.message, { tipo: 'mal', ms: 8000 }); }
    },
    async abrir() {
      if (Folio.sucio && Folio.p.bloques.length && !(await App.confirmar('Hay cambios sin guardar en disco (la copia automática sí los tiene). ¿Abrir otro proyecto igualmente?', 'Abrir otro'))) return;
      try { const r = await Folio.abrir(); if (r && !r.cancelado) { App.aviso('Proyecto abierto.'); App.ir(Folio.p.bloques.length ? 0 : 0, { forzar: true }); } }
      catch (e) { App.aviso('No se pudo abrir: ' + e.message, { tipo: 'mal', ms: 8000 }); }
    },
  };
  const ETIQUETAS = { importar: 'importación', 'texto:editar': 'edición de texto', 'texto:tipo': 'cambio de función', 'texto:unir': 'unión de bloques', 'texto:dividir': 'división de bloque', 'texto:eliminar': 'eliminación de bloque', 'revision:aceptar': 'corrección aceptada', 'revision:descartar': 'observación descartada', 'revision:revertir': 'corrección revertida', coleccion: 'cambio de colección' };
  function etiquetaHumana(e) { return ETIQUETAS[e] || String(e).replace(/^[a-z]+:/, '').replace(/-/g, ' '); }
  App.etiquetaHumana = etiquetaHumana;

  // ---------- eventos globales ----------
  document.addEventListener('click', e => {
    const ir = e.target.closest('[data-ir]'); if (ir && !ir.disabled) { App.ir(+ir.dataset.ir); return; }
    const a = e.target.closest('[data-accion]'); if (!a) return;
    switch (a.dataset.accion) {
      case 'deshacer': deshacer(); break;
      case 'rehacer': rehacer(); break;
      case 'archivo': window.Archivo && Archivo.abrir(); break;
      case 'sortear': window.Bestiario.poblar(); break;
      case 'concentracion': { const on = document.body.classList.toggle('concentracion'); a.setAttribute('aria-pressed', on); break; }
      case 'abrir': App.abrir(); break;
      case 'guardar': App.guardar(false); break;
      case 'inicio': e.preventDefault(); App.ir(0); break;
    }
  });
  function deshacer() { const t = Folio.deshacerUltimo(); if (t) App.aviso('Deshecho: ' + etiquetaHumana(t) + '.', { ms: 2500 }); }
  function rehacer() { const t = Folio.rehacerUltimo(); if (t) App.aviso('Rehecho: ' + etiquetaHumana(t) + '.', { ms: 2500 }); }
  const editable = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  document.addEventListener('keydown', e => {
    if (!$('.modal-capa').hidden) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && !editable(document.activeElement)) { e.preventDefault(); deshacer(); }
    else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !editable(document.activeElement)) { e.preventDefault(); rehacer(); }
    else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); App.guardar(e.shiftKey); }
    else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); App.abrir(); }
    else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); App.ir(App.actual + (e.key === 'ArrowRight' ? 1 : -1)); }
    else { const et = App.etapas[App.actual]; if (et && et.tecla && !editable(document.activeElement)) et.tecla(e); }
  });
  if (window.Escritorio) Escritorio.alMenu(a => {
    if (a === 'abrir') App.abrir();
    if (a === 'guardar') App.guardar(false);
    if (a === 'guardar-como') App.guardar(true);
    if (a === 'nuevo') nuevo();
    if (a === 'deshacer') { if (editable(document.activeElement)) document.execCommand('undo'); else deshacer(); }
    if (a === 'rehacer') { if (editable(document.activeElement)) document.execCommand('redo'); else rehacer(); }
    if (a === 'archivo-grabados') window.Archivo && Archivo.abrir();
  });
  async function nuevo() {
    if (Folio.p.bloques.length && Folio.sucio && !(await App.confirmar('¿Empezar un proyecto nuevo? Los cambios no guardados en disco quedan solo en la copia automática de hoy.', 'Empezar uno nuevo'))) return;
    Folio.nuevoProyecto(); App.ir(0, { forzar: true });
  }
  App.nuevo = nuevo;

  // cambios del modelo → cabecera y etapa
  let pendiente = null;
  Folio.al(motivo => {
    App.cabecera();
    const e = App.etapas[App.actual];
    if (motivo === 'autoguardado' || motivo === 'guardado') return;
    if (e && e.alCambiar && e.alCambiar(motivo) === false) { App.camino(); return; }
    if (pendiente) return;
    pendiente = requestAnimationFrame(() => { pendiente = null; App.refrescar(); });
  });
  setInterval(() => App.cabecera(), 30000);

  // grano de papel, discreto
  (function () {
    const c = document.querySelector('.papel'), s = 256; c.width = c.height = s; const g = c.getContext('2d'), im = g.createImageData(s, s);
    let x = 7; const r = () => (x = (x * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < im.data.length; i += 4) { const v = 210 + r() * 45; im.data[i] = v; im.data[i + 1] = v - 6; im.data[i + 2] = v - 18; im.data[i + 3] = r() < .35 ? 22 : 0; }
    g.putImageData(im, 0, 0); c.style.background = `url(${c.toDataURL()})`; c.width = c.height = 1; c.style.width = '100%'; c.style.height = '100%';
  })();

  // leer archivos locales como data URL o base64
  App.leerDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  App.descargar = (nombre, contenido, tipo = 'text/plain') => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenido], { type: tipo })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  App.dinero = n => '$' + Math.round(n).toLocaleString('es-CL');

  window.App = App;
})();
