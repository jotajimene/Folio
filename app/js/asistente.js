/* Folio · asistente con el modelo de texto local
 * Corre en este computador (llama.cpp). Solo propone: nada de lo que escribe entra
 * al libro sin que lo aceptes.
 */
(function () {
  'use strict';
  const { esc } = App;
  const M = () => window.Escritorio && Escritorio.modelo;
  let estado = null, nPedido = 0;
  const oyentes = new Map();
  if (M()) {
    M().alTrozo(d => { const f = oyentes.get(d.pedido); if (f) f(d.t); });
    M().alProgreso(d => { const el = document.querySelector('.modelo-progreso'); if (el) { el.querySelector('i').style.width = Math.round(d.recibidos / d.total * 100) + '%'; el.querySelector('span').textContent = `${(d.recibidos / 1e9).toFixed(2).replace('.', ',')} de ${(d.total / 1e9).toFixed(2).replace('.', ',')} GB`; } if (d.listo) { estado = null; ventana(); } });
  }
  const gb = b => (b / 1e9).toFixed(1).replace('.', ',') + ' GB';

  async function leerEstado() { if (!M()) return null; estado = await M().estado(); return estado; }
  async function disponible() { const e = await leerEstado(); return !!(e && e.modelos.some(m => m.instalado)); }

  // ventana de instalación y estado
  async function ventana() {
    if (!M()) return App.aviso('El modelo local funciona en la aplicación de escritorio.');
    const e = await leerEstado();
    const filas = e.modelos.map(m => `<div class="modelo-fila ${m.instalado ? 'listo' : ''}"><div><b>${esc(m.nombre)}</b>${m.id === e.recomendado ? ' <em>recomendado para tu equipo</em>' : ''}<small>${esc(m.detalle || '')}${m.bytes ? ' · ' + gb(m.bytes) : ''}${m.licencia ? ' · ' + esc(m.licencia) : ''}${m.ramMin ? ' · pide ' + m.ramMin + ' GB de memoria' : ''}</small></div>
      ${m.instalado ? `<span class="ok">instalado</span>${m.propio ? '' : `<button class="boton chico" data-borrar="${m.id}">Borrar</button>`}` : e.descargando && e.descargando.id === m.id ? `<div class="modelo-progreso barra"><i style="width:${Math.round(e.descargando.recibidos / e.descargando.total * 100)}%"></i><span></span></div><button class="boton chico" data-cancelar>Pausar</button>` : `<button class="boton chico ${m.id === e.recomendado ? 'taco' : ''}" data-bajar="${m.id}" ${e.descargando ? 'disabled' : ''}>Descargar</button>`}</div>`).join('');
    App.modal({
      titulo: 'Modelo de texto local', ancho: 680,
      cuerpo: `<p>Folio puede usar un modelo de lenguaje que corre en este computador, sin internet y sin cuentas. Sirve para la lectura de estilo, borradores de contracubierta y sinopsis, y títulos. Todo llega como sugerencia.</p>
        <p class="nota">Tu equipo tiene ${e.ram} GB de memoria. La descarga se hace una sola vez desde Hugging Face y queda en tu carpeta de Folio; si se corta, sigue donde quedó.</p>
        <div class="modelos">${filas}</div>
        <p class="nota">Carpeta: ${esc(e.carpeta)}. Si pones ahí otro modelo .gguf, Folio también lo ofrece.</p>`,
      botones: [{ texto: 'Cerrar', valor: null }],
      alAbrir: (m, ctx) => {
        m.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-bajar]'), x = ev.target.closest('[data-borrar]'), c = ev.target.closest('[data-cancelar]');
          if (b) { const id = b.dataset.bajar; M().descargar(id).then(() => App.aviso('Modelo instalado. Ya puedes usarlo.')).catch(err => App.aviso('La descarga se detuvo: ' + err.message + '. Puedes retomarla.', { tipo: 'mal', ms: 8000 })); setTimeout(() => { ctx.cerrar(); ventana(); }, 300); }
          if (x && await App.confirmar('¿Borrar este modelo del disco? Podrás volver a descargarlo.', 'Borrar')) { await M().borrar(x.dataset.borrar); ventana(); }
          if (c) { await M().cancelarDescarga(); ctx.cerrar(); setTimeout(ventana, 300); }
        });
      },
    });
  }

  // pedido con texto que llega de a poco
  async function pedir({ sistema, mensaje, maxTokens, temperatura, alTrozo }) {
    if (!(await disponible())) { const r = await App.confirmar('Para esto hace falta el modelo de texto local, que aún no está instalado. ¿Abrir la ventana para descargarlo?', 'Ver el modelo'); if (r) ventana(); throw new Error('sin-modelo'); }
    const pedido = 'p' + (++nPedido) + Date.now();
    if (alTrozo) oyentes.set(pedido, alTrozo);
    try { return await M().generar({ pedido, sistema, mensaje, maxTokens, temperatura }); }
    finally { oyentes.delete(pedido); }
  }

  // ---------- tareas ----------
  const SIS_EDITOR = 'Eres editor y corrector de estilo de una editorial independiente chilena. Escribes en español, con claridad y sin adornos. Respetas la voz del autor: no la vuelves neutra ni la "mejoras" por gusto. Nunca inventas datos sobre el libro.';
  function muestraDelLibro(p, max = 9000) {
    const caps = p.bloques.filter(b => b.tipo === 'h1').map(b => b.texto).slice(0, 30);
    let t = '', i = 0; const cuerpo = p.bloques.filter(b => b.tipo !== 'h1');
    // inicio, medio y final del libro
    const tramos = [cuerpo.slice(0, 25), cuerpo.slice(Math.floor(cuerpo.length / 2), Math.floor(cuerpo.length / 2) + 12), cuerpo.slice(-8)];
    for (const tr of tramos) { for (const b of tr) { if (t.length > max) break; t += b.texto.replace(//g, '') + '\n\n'; } t += '[…]\n\n'; }
    return { caps, texto: t.slice(0, max) };
  }
  async function lecturaEstilo(texto, alTrozo) {
    const r = await pedir({
      sistema: SIS_EDITOR + ' Responde solo con JSON válido.',
      mensaje: `Lee este fragmento y señala hasta 6 problemas de estilo concretos: frases confusas, repeticiones, ritmo, ambigüedades, clichés, concordancias. Para cada uno copia el fragmento EXACTO del texto (pocas palabras), explica el problema en una oración y propone una alternativa breve que lo reemplace. Si el texto está bien, devuelve una lista vacía.\nFormato: [{"fragmento":"...","problema":"...","alternativa":"..."}]\n\nTexto:\n"""${texto.replace(//g, '')}"""`,
      maxTokens: 900, temperatura: 0.3, alTrozo,
    });
    return analizarJSON(r.texto);
  }
  function analizarJSON(t) {
    const a = t.indexOf('['), z = t.lastIndexOf(']');
    if (a < 0 || z < a) return [];
    try { const v = JSON.parse(t.slice(a, z + 1)); return Array.isArray(v) ? v.filter(x => x && x.fragmento) : []; } catch { return []; }
  }
  async function contracubierta(p, alTrozo) {
    const m = muestraDelLibro(p);
    const r = await pedir({ sistema: SIS_EDITOR, mensaje: `Escribe un texto de contracubierta para este libro (${(Folio.TIPOS_LIBRO[p.tipo] || {}).nombre || 'libro'}) titulado «${p.titulo}»${p.autor ? ', de ' + p.autor : ''}. Entre 90 y 140 palabras, en tercera persona, sin revelar el final, sin frases hechas como «una obra imprescindible». Que despierte ganas de leerlo y deje una imagen concreta del libro. Devuelve solo el texto.\n\nCapítulos: ${m.caps.join(' · ') || '(sin capítulos)'}\n\nExtractos:\n${m.texto}`, maxTokens: 400, temperatura: 0.75, alTrozo });
    return r.texto.trim();
  }
  async function sinopsis(p, alTrozo) {
    const m = muestraDelLibro(p);
    const r = await pedir({ sistema: SIS_EDITOR, mensaje: `Escribe una sinopsis de un párrafo (70 a 110 palabras) del libro «${p.titulo}», para fichas y prensa. Clara, informativa, sin juicios de valor. Devuelve solo el párrafo.\n\nCapítulos: ${m.caps.join(' · ')}\n\nExtractos:\n${m.texto}`, maxTokens: 300, temperatura: 0.5, alTrozo });
    return r.texto.trim();
  }
  async function titulos(texto, alTrozo) {
    const r = await pedir({ sistema: SIS_EDITOR + ' Responde solo con JSON válido.', mensaje: `Propón 5 títulos posibles para este capítulo o poema, breves y en el tono del texto. Formato: ["...","..."]\n\nTexto:\n"""${texto.slice(0, 6000)}"""`, maxTokens: 200, temperatura: 0.8, alTrozo });
    const a = r.texto.indexOf('['), z = r.texto.lastIndexOf(']');
    try { return JSON.parse(r.texto.slice(a, z + 1)).filter(x => typeof x === 'string'); } catch { return r.texto.split('\n').map(x => x.replace(/^[\d\-.•*\s"]+|"$/g, '').trim()).filter(Boolean).slice(0, 5); }
  }

  // ventana con texto que se va escribiendo; devuelve el texto si lo aceptas
  async function borrador(titulo, tarea) {
    let texto = '', listo = false, cancelar = null;
    const pr = App.modal({ titulo, ancho: 720, cuerpo: `<p class="nota">Escrito por el modelo local en este computador. Puedes editarlo antes de usarlo.</p><textarea class="area borrador-modelo" rows="12" placeholder="Pensando…" readonly></textarea><p class="nota estado-modelo">Escribiendo…</p>`, botones: [{ texto: 'Descartar', valor: null }, { texto: 'Otra versión', valor: 'otra' }, { texto: 'Usar este texto', taco: true, valor: c => c.querySelector('.borrador-modelo').value }] });
    const ta = () => document.querySelector('.borrador-modelo');
    tarea(t => { texto += t; const x = ta(); if (x) { x.value = texto; x.scrollTop = x.scrollHeight; } }).then(final => { listo = true; const x = ta(); if (x) { x.value = final; x.readOnly = false; } const s = document.querySelector('.estado-modelo'); if (s) s.textContent = 'Listo. Edítalo si quieres.'; }).catch(e => { const s = document.querySelector('.estado-modelo'); if (s && e.message !== 'sin-modelo') s.textContent = 'No se pudo: ' + e.message; });
    const v = await pr;
    if (v === 'otra') return borrador(titulo, tarea);
    return v;
  }

  window.Asistente = { ventana, disponible, pedir, lecturaEstilo, contracubierta, sinopsis, titulos, borrador, leerEstado };
})();
