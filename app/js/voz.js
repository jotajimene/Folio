/* Folio · escuchar el texto
 * Con las voces de Piper (si las descargaste) suena natural y corre en este computador;
 * si no, usa la voz del sistema (en Windows también funciona sin internet). */
(function () {
  'use strict';
  let leyendo = false, cola = [], voz = null, velocidad = 1, audio = null, siguienteWav = null, piper = null;
  function elegirVoz() {
    const vs = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
    return vs.find(v => /es-(CL|419|MX|AR|US)/i.test(v.lang) && v.localService) || vs.find(v => v.localService) || vs[0] || null;
  }
  function marcar(id) { document.querySelectorAll('.bloque.oyendo').forEach(b => b.classList.remove('oyendo')); if (!id) return; const el = document.querySelector(`.bloque[data-id="${id}"]`); if (el) { el.classList.add('oyendo'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
  const limpio = t => t.replace(//g, '').replace(/—/g, ', ');
  const sintetizar = b => Escritorio.herr.hablar(limpio(b.texto), piper, velocidad).then(w => 'data:audio/wav;base64,' + w);
  function siguiente() {
    if (!leyendo || !cola.length) { detener(); return; }
    const b = cola.shift(); marcar(b.id);
    if (piper) {
      const wav = siguienteWav || sintetizar(b); siguienteWav = cola[0] ? sintetizar(cola[0]) : null; // la frase siguiente se prepara mientras suena esta
      wav.then(src => { if (!leyendo) return; audio = new Audio(src); audio.onended = siguiente; audio.onerror = siguiente; audio.play().catch(siguiente); })
        .catch(e => { App.aviso('Piper no pudo leer; sigo con la voz del sistema. ' + e.message, { tipo: 'mal' }); piper = null; siguienteWav = null; cola.unshift(b); siguiente(); });
      return;
    }
    const u = new SpeechSynthesisUtterance(limpio(b.texto));
    u.lang = 'es-ES'; if (voz) u.voice = voz; u.rate = velocidad;
    u.onend = () => siguiente(); u.onerror = () => siguiente();
    speechSynthesis.speak(u);
  }
  async function leer(desdeId) {
    detener();
    piper = null;
    try { const e = window.Escritorio && Escritorio.herr ? await Escritorio.herr.estado() : null; if (e && e.voces && e.voces.length) piper = (window.Perfil && Perfil.datos.vozPiper && e.voces.includes(Perfil.datos.vozPiper)) ? Perfil.datos.vozPiper : e.voces[0]; } catch {}
    if (!piper) {
      if (!('speechSynthesis' in window)) return App.aviso('Este equipo no tiene voces de lectura.');
      voz = elegirVoz();
      if (!voz) App.aviso('No encontré una voz en español instalada; uso la que hay. Puedes descargar voces naturales en Archivo → Herramientas de Folio.', { ms: 7000 });
    }
    const B = Folio.p.bloques, i = Math.max(0, B.findIndex(b => b.id === desdeId));
    cola = B.slice(i).filter(b => b.tipo !== 'separador' && b.texto.trim()); leyendo = true; siguiente();
    App.aviso(`Leyendo en voz alta${piper ? ' con ' + piper.split('-')[1] : ''}. Esc o «Detener lectura» para parar.`, { ms: 4000 });
    document.body.classList.add('con-voz');
  }
  function detener() { leyendo = false; cola = []; siguienteWav = null; try { speechSynthesis.cancel(); } catch {} if (audio) { audio.pause(); audio = null; } marcar(null); document.body.classList.remove('con-voz'); }
  addEventListener('keydown', e => { if (leyendo && e.key === 'Escape') detener(); });
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voz = elegirVoz(); };
  window.Voz = { leer, detener, leyendo: () => leyendo, velocidad: v => { velocidad = v; }, conPiper: () => piper };
})();
