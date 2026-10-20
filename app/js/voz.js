/* Folio · escuchar el texto con la voz del sistema (en Windows funciona sin internet) */
(function () {
  'use strict';
  let leyendo = false, cola = [], voz = null, velocidad = 1;
  function elegirVoz() {
    const vs = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
    return vs.find(v => /es-(CL|419|MX|AR|US)/i.test(v.lang) && v.localService) || vs.find(v => v.localService) || vs[0] || null;
  }
  function marcar(id) { document.querySelectorAll('.bloque.oyendo').forEach(b => b.classList.remove('oyendo')); if (!id) return; const el = document.querySelector(`.bloque[data-id="${id}"]`); if (el) { el.classList.add('oyendo'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
  function siguiente() {
    if (!leyendo || !cola.length) { detener(); return; }
    const b = cola.shift(); marcar(b.id);
    const u = new SpeechSynthesisUtterance(b.texto.replace(//g, '').replace(/—/g, ', '));
    u.lang = 'es-ES'; if (voz) u.voice = voz; u.rate = velocidad;
    u.onend = () => siguiente(); u.onerror = () => siguiente();
    speechSynthesis.speak(u);
  }
  function leer(desdeId) {
    if (!('speechSynthesis' in window)) return App.aviso('Este equipo no tiene voces de lectura.');
    detener(); voz = elegirVoz();
    if (!voz) App.aviso('No encontré una voz en español instalada; uso la que hay. En Windows: Configuración → Hora e idioma → Voz.', { ms: 7000 });
    const B = Folio.p.bloques, i = Math.max(0, B.findIndex(b => b.id === desdeId));
    cola = B.slice(i).filter(b => b.tipo !== 'separador' && b.texto.trim()); leyendo = true; siguiente();
    App.aviso('Leyendo en voz alta. Esc o el botón «Detener lectura» para parar.', { ms: 4000 });
    document.body.classList.add('con-voz');
  }
  function detener() { leyendo = false; cola = []; try { speechSynthesis.cancel(); } catch {} marcar(null); document.body.classList.remove('con-voz'); }
  addEventListener('keydown', e => { if (leyendo && e.key === 'Escape') detener(); });
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voz = elegirVoz(); };
  window.Voz = { leer, detener, leyendo: () => leyendo, velocidad: v => { velocidad = v; } };
})();
