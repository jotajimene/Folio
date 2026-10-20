/* Folio · herramientas del computador: estado, descargas opcionales y sus usos (ampliar, dictar, voces, gramática) */
(function () {
  'use strict';
  const { esc } = App;
  const H = () => window.Escritorio && Escritorio.herr;
  let estado = null;
  if (H()) H().alProgreso(d => {
    const el = document.querySelector(`.herr-progreso[data-id="${d.id}"]`);
    if (el && d.tot) { el.querySelector('i').style.width = Math.round(d.rec / d.tot * 100) + '%'; el.querySelector('span').textContent = `parte ${d.parte} de ${d.partes} · ${(d.rec / 1e6).toFixed(0)} de ${(d.tot / 1e6).toFixed(0)} MB`; }
    if (d.listo) { estado = null; App.aviso('Herramienta instalada.'); const c = document.querySelector('.modal .cerrar'); if (c && document.querySelector('.herr-lista')) { c.click(); ventana(); } }
  });
  async function leer() { if (!H()) return null; estado = await H().estado(); return estado; }
  const instalada = id => !!(estado && estado.opcionales.find(o => o.id === id && o.instalada));

  async function ventana() {
    if (!H()) return App.aviso('Estas herramientas funcionan en la aplicación de escritorio.');
    const e = await leer();
    const fila = o => `<div class="modelo-fila ${o.instalada ? 'listo' : ''}"><div><b>${esc(o.nombre)}</b><small>${esc(o.para)} · ${(o.bytes / 1e6).toFixed(0)} MB · ${esc(o.licencia)}</small></div>${o.instalada ? '<span class="ok">instalada</span>' : e.descargando === o.id ? `<div class="herr-progreso barra modelo-progreso" data-id="${o.id}"><i></i><span></span></div><button class="boton chico" data-cancelar>Detener</button>` : `<button class="boton chico" data-instalar="${o.id}" ${e.descargando || !e.windows ? 'disabled' : ''}>Descargar</button>`}</div>`;
    App.modal({ titulo: 'Herramientas de Folio', ancho: 720,
      cuerpo: `<p>Todo corre en este computador. Las opcionales se descargan una sola vez desde sus sitios oficiales y quedan en tu carpeta de Folio.</p>
        <div class="modelos"><div class="modelo-fila listo"><div><b>Potrace</b><small>Vectoriza los grabados para imprimirlos nítidos · incluida · GPL</small></div><span class="ok">incluida</span></div>
        <div class="modelo-fila ${e.ghostscript ? 'listo' : ''}"><div><b>Ghostscript</b><small>PDF/X-3 en CMYK y medición de tinta · incluida · AGPL</small></div><span class="ok">${e.ghostscript ? 'incluida' : 'no encontrada'}</span></div></div>
        <div class="sub">Opcionales</div><div class="modelos herr-lista">${e.opcionales.map(fila).join('')}</div>
        <p class="nota">El modelo de texto local tiene su propia ventana (Archivo → Modelo de texto local).</p>`,
      botones: [{ texto: 'Cerrar', valor: null }],
      alAbrir: (m, ctx) => m.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-instalar]'); if (b) { H().instalar(b.dataset.instalar).catch(err => App.aviso('La descarga se detuvo: ' + err.message, { tipo: 'mal', ms: 8000 })); setTimeout(() => { ctx.cerrar(); ventana(); }, 400); }
        if (ev.target.closest('[data-cancelar]')) { await H().cancelar(); ctx.cerrar(); setTimeout(ventana, 300); }
      }) });
  }
  async function pedirInstalar(id, que) {
    await leer();
    if (instalada(id)) return true;
    if (await App.confirmar(`${que} necesita una herramienta que aún no está instalada. ¿Abrir la ventana de herramientas para descargarla?`, 'Ver herramientas')) ventana();
    return false;
  }

  // ---------- ampliar una imagen (Real-ESRGAN) ----------
  async function ampliar(dataURL, factor = 4) {
    if (!(await pedirInstalar('realesrgan', 'Ampliar imágenes'))) return null;
    App.aviso('Ampliando la imagen en la tarjeta de video… puede tardar un poco.', { ms: 5000 });
    const png = await (async () => { const img = new Image(); img.src = dataURL; await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL('image/png').split(',')[1]; })();
    const out = await H().ampliar(png, factor);
    return 'data:image/png;base64,' + out;
  }

  // ---------- audio a WAV 16 kHz mono (lo que pide whisper) ----------
  async function aWav16k(buffer) {
    const ctx = new AudioContext(); const audio = await ctx.decodeAudioData(buffer.slice ? buffer.slice(0) : buffer); ctx.close();
    const off = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
    const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
    const r = await off.startRendering(), d = r.getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + d.length * 2)); const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + d.length * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
    let s = ''; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return btoa(s);
  }
  async function transcribirBuffer(buf) { App.aviso('Transcribiendo en este computador…', { ms: 4000 }); return H().transcribir(await aWav16k(buf)); }
  // dictar: graba del micrófono hasta que pulses «Listo»
  async function dictar() {
    if (!(await pedirInstalar('whisper', 'El dictado'))) return null;
    let rec, partes = [], flujo;
    try { flujo = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { App.aviso('No pude usar el micrófono: ' + e.message, { tipo: 'mal' }); return null; }
    rec = new MediaRecorder(flujo); rec.ondataavailable = e => partes.push(e.data); rec.start();
    const t0 = Date.now(); let reloj;
    const r = await App.modal({ titulo: 'Dictado', cuerpo: `<p class="dictando">● Grabando <span class="t">0:00</span></p><p class="nota">Habla con naturalidad; puedes decir «punto», «coma» o «punto y aparte». Al terminar, pulsa «Listo» y el texto se transcribe en este computador.</p>`, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Listo', taco: true, valor: 'ok' }], alAbrir: m => { reloj = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); m.querySelector('.t').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500); } });
    clearInterval(reloj);
    await new Promise(res => { rec.onstop = res; rec.stop(); }); flujo.getTracks().forEach(t => t.stop());
    if (r !== 'ok') return null;
    const buf = await new Blob(partes).arrayBuffer();
    const texto = await transcribirBuffer(buf);
    return limpiarDictado(texto);
  }
  function limpiarDictado(t) {
    return t.replace(/\s*punto y aparte\s*/gi, '.\n\n').replace(/\s*punto y seguido\s*/gi, '. ').replace(/\s+coma\b/gi, ',').replace(/\s+dos puntos\b/gi, ':').replace(/\s+punto\b(?!\s*y)/gi, '.').replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim();
  }
  async function transcribirArchivo() {
    if (!(await pedirInstalar('whisper', 'Transcribir audio'))) return null;
    const f = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm'; i.onchange = () => res(i.files[0] || null); i.click(); });
    if (!f) return null;
    return transcribirBuffer(await f.arrayBuffer());
  }

  window.HerrLocal = { ventana, leer, instalada, ampliar, dictar, transcribirArchivo, pedirInstalar, estado: () => estado, _aWav16k: aWav16k, _limpiarDictado: limpiarDictado };
})();
