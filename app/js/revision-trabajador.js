/* Folio · revisión (en un hilo aparte para no congelar la interfaz)
 * Ortografía: nspell con el diccionario español de LibreOffice (RLA-ES).
 * Ortotipografía: reglas propias para el español editorial.
 * Nunca cambia el texto: solo devuelve observaciones con su propuesta.
 */
importScripts('../vendor/herramientas.js');
let corrector = null;
async function cargar() {
  if (corrector) return corrector;
  const [aff, dic] = await Promise.all([fetch('../vendor/es.aff').then(r => r.text()), fetch('../vendor/es.dic').then(r => r.text())]);
  corrector = Herramientas.NSpell(aff, dic);
  return corrector;
}

const REGLAS = [
  { id: 'espacios', cat: 'Espacios', re: / {2,}/g, msg: 'Hay espacios seguidos.', nota: 'En poesía pueden ser intencionales.', prop: () => ' ' },
  { id: 'espacio-antes', cat: 'Espacios', re: / +([,.;:!?…»)\]])/g, msg: 'Espacio antes de un signo de puntuación.', prop: m => m[1] },
  { id: 'espacio-despues', cat: 'Espacios', re: /([,;:])(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, msg: 'Falta un espacio después del signo.', prop: m => m[1] + ' ', excluir: /\d[,.:]\d/ },
  { id: 'puntos', cat: 'Signos', re: /\.{3}/g, msg: 'Tres puntos: en edición se usa el carácter de puntos suspensivos.', prop: () => '…' },
  { id: 'raya', cat: 'Diálogo', re: /(^|\n)[-–] ?(?=\S)/g, msg: 'El diálogo se introduce con raya (—), no con guion.', prop: m => m[1] + '—' },
  { id: 'inciso', cat: 'Diálogo', re: / [-–] (?=\p{Ll})/gu, msg: 'Inciso del narrador: se marca con raya (—).', prop: () => ' —' },
  { id: 'comillas', cat: 'Signos', re: /"([^"\n]{1,200})"/g, msg: 'Comillas rectas: en español se prefieren las angulares.', prop: m => '«' + m[1] + '»' },
  { id: 'apertura-interrogacion', cat: 'Signos', re: /(^|[.!?…»]\s+|\n)([^¿?.!\n]{2,120})\?/g, msg: 'Falta el signo de apertura ¿.', prop: m => m[1] + '¿' + m[2] + '?', excluir: /¿/ },
  { id: 'apertura-exclamacion', cat: 'Signos', re: /(^|[.!?…»]\s+|\n)([^¡!.?\n]{2,120})!/g, msg: 'Falta el signo de apertura ¡.', prop: m => m[1] + '¡' + m[2] + '!', excluir: /¡/ },
  { id: 'repeticion', cat: 'Repeticiones', re: /(?<![\p{L}])(\p{L}+)\s+\1(?![\p{L}])/giu, msg: 'Palabra repetida.', prop: m => m[1] },
  { id: 'mayuscula', cat: 'Mayúsculas', re: /([.!?]\s+)(\p{Ll})/gu, msg: 'Después de punto va mayúscula.', prop: m => m[1] + m[2].toUpperCase(), excluir: /(etc|pág|p|vol|cap|núm|aprox|cf|ed|eds|trad|sr|sra|dr|dra|ej)\.\s+$/i },
  { id: 'porcentaje', cat: 'Espacios', re: /(\d)%/g, msg: 'El signo % va separado de la cifra.', prop: m => m[1] + ' %' },
];
// tildes frecuentes que el corrector no ve (palabras válidas sin tilde en otro uso): solo avisos
const DIACRITICAS = [
  { re: /\b(como|que|donde|cuando|quien|cual|cuanto)\s+(\p{Ll}+)\?/giu, msg: 'Pregunta: ¿falta tilde en el interrogativo?' },
];

function observar(bloques, opciones) {
  const obs = [], dicc = new Set(opciones.diccionario || []), ignorar = new Set(opciones.ignorar || []);
  for (const b of bloques) {
    const t = b.texto;
    if (b.tipo === 'separador') continue;
    for (const r of REGLAS) {
      if (b.tipo === 'verso' && (r.id === 'espacios' || r.id === 'mayuscula')) continue;
      r.re.lastIndex = 0; let m;
      while ((m = r.re.exec(t))) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        const ini = m.index, fin = m.index + m[0].length;
        if (r.excluir && (r.excluir.test(m[0]) || (r.id === 'mayuscula' && r.excluir.test(t.slice(Math.max(0, ini - 6), ini + m[1].length))))) continue;
        const prop = r.prop(m);
        if (prop === m[0]) continue;
        const clave = r.id + ':' + b.id + ':' + m[0];
        if (ignorar.has(clave)) continue;
        obs.push({ id: clave + ':' + ini, clave, bloque: b.id, inicio: ini, fin, antes: m[0], despues: prop, cat: r.cat, regla: r.id, msg: r.msg, nota: r.nota || '' });
      }
    }
    // ortografía
    if (corrector) {
      const re = /\p{L}[\p{L}'’]*/gu; let m;
      while ((m = re.exec(t))) {
        const w = m[0].replace(/[’']$/, '');
        if (w.length < 3 || dicc.has(w.toLowerCase())) continue;
        const ini = m.index;
        // nombres propios: mayúscula que no inicia oración
        const previo = t.slice(Math.max(0, ini - 3), ini);
        if (/^\p{Lu}/u.test(w) && ini > 0 && !/[.!?¿¡—«"\n]\s*$/.test(previo)) continue;
        if (/^\p{Lu}+$/u.test(w) && w.length <= 5) continue;           // siglas
        if (corrector.correct(w) || corrector.correct(w.toLowerCase())) continue;
        const clave = 'ortografia:' + w;
        if (ignorar.has(clave)) continue;
        const sug = corrector.suggest(w).slice(0, 4);
        obs.push({ id: clave + ':' + b.id + ':' + ini, clave, bloque: b.id, inicio: ini, fin: ini + w.length, antes: w, despues: sug[0] || null, alternativas: sug, cat: 'Ortografía', regla: 'ortografia', msg: sug.length ? 'Palabra que no está en el diccionario.' : 'Palabra desconocida: no hay sugerencias.', nota: 'Si es correcta, añádela al diccionario del proyecto.' });
      }
    }
    // párrafos muy largos: aviso sin propuesta
    const palabras = t.split(/\s+/).length;
    if (b.tipo === 'p' && palabras > 320) obs.push({ id: 'largo:' + b.id, clave: 'largo:' + b.id, bloque: b.id, inicio: 0, fin: 0, antes: '', despues: null, cat: 'Estilo', regla: 'largo', msg: 'Párrafo de ' + palabras + ' palabras: quizá convenga dividirlo.', nota: '' });
    for (const d of DIACRITICAS) { d.re.lastIndex = 0; let m; while ((m = d.re.exec(t))) { const clave = 'tilde:' + b.id + ':' + m[0]; if (!ignorar.has(clave)) obs.push({ id: clave, clave, bloque: b.id, inicio: m.index, fin: m.index + m[1].length, antes: m[1], despues: { como: 'cómo', que: 'qué', donde: 'dónde', cuando: 'cuándo', quien: 'quién', cual: 'cuál', cuanto: 'cuánto' }[m[1].toLowerCase()].replace(/^./, c => m[1][0] === m[1][0].toUpperCase() ? c.toUpperCase() : c), cat: 'Tildes', regla: 'tilde', msg: d.msg, nota: '' }); } }
  }
  // en el mismo bloque, si dos observaciones se pisan, se queda la primera
  obs.sort((a, b) => a.bloque === b.bloque ? a.inicio - b.inicio : 0);
  return obs.filter((o, i) => !obs.slice(0, i).some(p => p.bloque === o.bloque && p.fin > o.inicio && p.inicio < o.fin && p.fin > p.inicio && o.fin > o.inicio));
}

onmessage = async e => {
  const { id, bloques, opciones } = e.data;
  try {
    if (opciones.ortografia !== false) await cargar();
    postMessage({ id, obs: observar(bloques, opciones) });
  } catch (err) { postMessage({ id, error: String(err && err.message || err) }); }
};
