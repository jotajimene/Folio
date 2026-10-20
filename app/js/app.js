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
      if (i < 0 || i >= App.etapas.length || (i === App.actual && !forzar)) return;
      // si hay una transición en curso, se recuerda el destino y se va al terminar
      if (App.ocupado) { App.pendienteIr = { i, sinPrensa, forzar }; return; }
      App.ocupado = true;
      try {
        const anterior = App.etapas[App.actual];
        try { if (anterior && anterior.salir) anterior.salir(); } catch (e) { console.error(e); }
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
        // el bestiario nunca puede trabar la navegación
        await Promise.race([window.Bestiario.poblar().catch(e => console.error(e)), new Promise(r => setTimeout(r, 2500))]);
        await new Promise(r => setTimeout(r, quieto || sinPrensa ? 0 : 500));
      } catch (e) { console.error(e); }
      finally {
        $('.mesa').classList.remove('entra'); $('.cenefa').classList.remove('rueda'); $('.prensa').classList.remove('baja');
        App.ocupado = false;
        const p = App.pendienteIr; App.pendienteIr = null;
        if (p) App.ir(p.i, { sinPrensa: p.sinPrensa, forzar: p.forzar });
      }
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
      try { const r = await Folio.guardar(como); if (r && !r.cancelado) { App.aviso('Proyecto guardado en ' + (r.ruta || 'disco') + (r.respaldo && r.respaldo.ruta ? ', con copia de respaldo' : '') + '.'); if (r.respaldo && r.respaldo.error) App.aviso('No pude dejar la copia de respaldo: ' + r.respaldo.error, { tipo: 'mal', ms: 8000 }); } }
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
      case 'estanteria': window.Estanteria && Estanteria.abrir(); break;
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
    if (a === 'modelo') window.Asistente && Asistente.ventana();
    if (a === 'herramientas') window.HerrLocal && HerrLocal.ventana();
    if (a === 'actualizar') buscarActualizacion();
    if (a === 'carpeta-trabajo') carpetaTrabajo();
  });
  // carpeta de trabajo: los proyectos, el perfil y el archivo ampliado en una carpeta que ven tus computadores
  async function carpetaTrabajo() {
    const e = await Escritorio.trabajo.estado();
    const v = await App.modal({ titulo: 'Carpeta de trabajo', ancho: 640,
      cuerpo: `<p>Si trabajas en más de un computador, elige en cada uno la misma carpeta (por ejemplo, una carpeta de Google Drive). Ahí quedan tus proyectos, el perfil de la editorial con sus tipografías y paletas, y las láminas que traigas de Commons. El modelo de texto y las herramientas se quedan en cada equipo.</p>
        ${e.carpeta ? `<p>Este computador (<b>${esc(e.equipo)}</b>) usa <b>${esc(e.carpeta)}</b>.</p>` : e.elegida ? `<p class="mal">Este computador tiene elegida <b>${esc(e.elegida)}</b>, pero ahora no la encuentro (¿Drive está abierto?). Mientras tanto Folio trabaja con lo de este equipo.</p>` : '<p>Ahora todo se guarda solo en este computador.</p>'}
        <p class="nota">Si un libro está abierto en el otro computador, Folio te avisa. Si alguien lo guardó allá después de que lo abriste acá, te pregunta antes de pisarlo. La carpeta la sincroniza tu programa de Drive, no Folio.</p>`,
      botones: [{ texto: 'Cerrar', valor: null }, ...(e.elegida ? [{ texto: 'Dejar de usarla', valor: 'dejar' }] : []), { texto: e.elegida ? 'Elegir otra carpeta' : 'Elegir la carpeta', taco: true, valor: 'elegir' }] });
    if (!v) return;
    const r = v === 'dejar' ? await Escritorio.trabajo.dejar() : await Escritorio.trabajo.elegir();
    if (!r || r.cancelado) return;
    await Perfil.cargar(); try { Tipografias.registrarCSS(); } catch {}
    ARCHIVO.extra.slice().forEach(l => ARCHIVO.quitarExtra(l.id)); await ARCHIVO.cargarExtra();
    App.aviso(r.carpeta ? (r.usoPerfilExistente ? 'Listo. Encontré el perfil que dejó tu otro computador y lo estoy usando.' : 'Listo. Copié tu perfil a la carpeta; desde ahora tus libros nuevos se guardan en Proyectos.') : 'Listo. Este computador vuelve a guardar todo localmente, con una copia de tu perfil.', { ms: 8000 });
    App.refrescar();
  }
  App.carpetaTrabajo = carpetaTrabajo;
  // solo cuando lo pides: pregunta a GitHub si hay una versión nueva y abre la página de descarga
  async function buscarActualizacion() {
    App.aviso('Buscando una versión nueva…', { ms: 2500 });
    const r = await Escritorio.herr.actualizar();
    if (r.error) return App.modal({ titulo: 'Actualizaciones', cuerpo: r.error === 'privado' ? `<p>Tienes Folio ${esc(r.actual)}. No pude ver las versiones publicadas: el repositorio de Folio es privado. Para que esta búsqueda funcione, las versiones tienen que publicarse en un repositorio público.</p>` : `<p>Tienes Folio ${esc(r.actual)}. No pude conectarme para revisar (${esc(r.mensaje)}). Folio sigue funcionando igual sin internet.</p>`, botones: [{ texto: 'Cerrar', valor: null }] });
    const v = await App.modal({ titulo: 'Actualizaciones', cuerpo: r.hay ? `<p>Hay una versión nueva: <b>Folio ${esc(r.version)}</b> (tienes la ${esc(r.actual)}).</p>${r.notas ? `<pre class="notas-version">${esc(r.notas)}</pre>` : ''}<p class="nota">Se abre la página de descarga en tu navegador. Tus proyectos, perfil y herramientas quedan donde están.</p>` : `<p>Tienes la última versión: Folio ${esc(r.actual)}.</p>`, botones: r.hay ? [{ texto: 'Ahora no', valor: null }, { texto: 'Abrir la página de descarga', taco: true, valor: 'ok' }] : [{ texto: 'Cerrar', valor: null }] });
    if (v === 'ok') Escritorio.externo(r.pagina);
  }
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
    if (motivo === 'importar' && window.Perfil) Perfil.registrarNumero(Folio.p.coleccion, Folio.p.numero);
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
  // grabados vectorizados (Potrace) para los que usa el libro: se generan una vez y quedan en el equipo
  App.vectores = [];
  App.asegurarVectores = async (extra = []) => {
    if (!window.Escritorio || !Escritorio.herr) return App.vectores;
    const p = Folio.p, ids = new Set([...(p.ilustraciones || []).map(i => i.lamina).filter(Boolean), ...(window.Libro ? Libro.vinetas(p) : []), ...extra]);
    if (p.cubierta && p.cubierta.imagen && /^L\d+$/.test(p.cubierta.imagen)) ids.add(p.cubierta.imagen);
    const faltan = [...ids].filter(id => !App.vectores.includes(id));
    if (faltan.length) { const hechos = await Escritorio.herr.vectorizar(faltan); App.vectores = [...new Set([...App.vectores, ...hechos])]; }
    return App.vectores;
  };
  App.miniIl = il => il.lamina ? ARCHIVO.mini(il.lamina) : (il.recurso && Folio.recursos[il.recurso]) || '';
  App.MODOS_IL = { pagina: 'Página completa', media: 'Media página', vineta: 'Viñeta', sangre: 'Página a sangre', doble: 'Doble página a sangre', blanca: 'Página en blanco (respiro)' };
  App.dinero = n => '$' + Math.round(n).toLocaleString('es-CL');

  window.App = App;
})();
