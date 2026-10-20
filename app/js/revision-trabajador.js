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

const P = '[\\p{L}]';
// reglas: capa = ortotipografia | gramatica | estilo. Todas son propuestas; nada se aplica solo.
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
const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|lunes|martes|miércoles|jueves|viernes|sábado|domingo';
const cap = w => w[0].toUpperCase() + w.slice(1);
const R2 = [
  // ---- gramática y uso ----
  { id: 'dequeismo', capa: 'gramatica', cat: 'Gramática', re: /(?<!\p{L})(pienso|piensa|pensaba|creo|cree|creía|opino|opina|considero|supongo|imagino|dijo|dije|digo|dice|afirmó|afirma|aseguró|me parece|le parece|es posible|resulta)\s+de\s+que(?!\p{L})/giu, msg: 'Posible dequeísmo: con este verbo va «que», sin «de».', prop: m => m[1] + ' que' },
  { id: 'queismo', capa: 'gramatica', cat: 'Gramática', re: /(?<!\p{L})(me alegro|te alegras|se alegra|estoy seguro|estoy segura|me acuerdo|te acuerdas|se acuerda|me olvidé|me di cuenta|te diste cuenta|se dio cuenta|nos dimos cuenta|a pesar|en caso|estoy convencido|estoy convencida|tengo la certeza|con tal)\s+que(?!\p{L})/giu, msg: 'Posible queísmo: esta construcción pide «de que».', prop: m => m[1] + ' de que' },
  { id: 'tilde-diacritica-obsoleta', capa: 'gramatica', cat: 'Tildes', re: /(?<!\p{L})(sólo|éste|ésta|éstos|éstas|ése|ésa|ésos|ésas|aquél|aquélla|aquéllos|aquéllas)(?!\p{L})/giu, msg: 'Desde 2010 la RAE recomienda escribirla sin tilde (solo si hay ambigüedad real se admite).', prop: m => m[1].normalize('NFD').replace(/\u0301/, '').normalize('NFC') },
  { id: 'monosilabo', capa: 'gramatica', cat: 'Tildes', re: /(?<!\p{L})(fué|fuí|dió|vió|guión|truhán|rió|crié|lié|pié|tí)(?!\p{L})/giu, msg: 'Monosílabo: se escribe sin tilde.', prop: m => m[1].normalize('NFD').replace(/\u0301/, '').normalize('NFC') },
  { id: 'haber-impersonal', capa: 'gramatica', cat: 'Gramática', re: /(?<!\p{L})(habían|hubieron|habrán|habrían|han habido)\s+(muchos|muchas|varios|varias|algunos|algunas|pocos|pocas|dos|tres|cuatro|cinco|demasiados|demasiadas|unos|unas|\d+)(?!\p{L})/giu, msg: '«Haber» impersonal va en singular: «había muchos», «hubo varios».', prop: m => ({ 'habían': 'había', 'hubieron': 'hubo', 'habrán': 'habrá', 'habrían': 'habría', 'han habido': 'ha habido' }[m[1].toLowerCase()]) + ' ' + m[2] },
  { id: 'adverbio-posesivo', capa: 'gramatica', cat: 'Gramática', re: /(?<!\p{L})(detrás|delante|encima|debajo|cerca|enfrente|alrededor|dentro|lejos)\s+(mío|mía|tuyo|tuya|suyo|suya|nuestro|nuestra)(?!\p{L})/giu, msg: 'En la norma culta se prefiere «detrás de mí», «cerca de ti».', prop: m => m[1] + ' de ' + ({ 'mío': 'mí', 'mía': 'mí', 'tuyo': 'ti', 'tuya': 'ti', 'suyo': 'él', 'suya': 'ella', 'nuestro': 'nosotros', 'nuestra': 'nosotras' }[m[2].toLowerCase()]) },
  { id: 'laismo', capa: 'gramatica', cat: 'Gramática', re: /(?<!\p{L})(la|las)\s+(dije|dijo|dijimos|dijeron|pregunté|preguntó|preguntaron|pedí|pidió|pidieron|conté|contó|regalé|regaló|escribí|escribió|hablé|habló|di|dio|dieron)(?!\p{L})/giu, msg: 'Posible laísmo: si es complemento indirecto, va «le».', prop: m => (m[1].toLowerCase() === 'la' ? 'le' : 'les') + ' ' + m[2], nota: 'Si «la» es lo que se dice o se da (complemento directo), está bien.' },
  { id: 'mas-mejor', capa: 'gramatica', cat: 'Gramática', re: /(?<!\p{L})más\s+(mejor|peor|mayor|menor)(?!\p{L})/giu, msg: 'Comparativo doble: «mejor» ya significa «más bueno».', prop: m => m[1] },
  { id: 'en-base-a', capa: 'gramatica', cat: 'Uso', re: /(?<!\p{L})(en base a|a nivel de)(?!\p{L})/giu, msg: 'Expresión desaconsejada: se prefiere «con base en», «a partir de» o «en cuanto a».', prop: m => m[1].toLowerCase() === 'en base a' ? 'con base en' : 'en cuanto a', nota: '«A nivel de» es correcto cuando hay niveles reales (a nivel del mar).' },
  // ---- estilo ----
  { id: 'pleonasmo', capa: 'estilo', cat: 'Estilo', re: /(?<!\p{L})(subir arriba|subió arriba|bajar abajo|bajó abajo|salir afuera|salió afuera|entrar adentro|entró adentro|volver a repetir|volvió a repetir|lapso de tiempo|accidente fortuito|erario público|opinión personal|prever con antelación|totalmente gratis|protagonista principal|persona humana|mis propios ojos|sus propios ojos|hemorragia de sangre|nexo de unión|base fundamental|requisito indispensable|falso pretexto|regalo gratis)(?!\p{L})/giu, msg: 'Pleonasmo: una parte ya está dicha en la otra.', prop: m => ({ 'subir arriba': 'subir', 'subió arriba': 'subió', 'bajar abajo': 'bajar', 'bajó abajo': 'bajó', 'salir afuera': 'salir', 'salió afuera': 'salió', 'entrar adentro': 'entrar', 'entró adentro': 'entró', 'volver a repetir': 'repetir', 'volvió a repetir': 'repitió', 'lapso de tiempo': 'lapso', 'accidente fortuito': 'accidente', 'erario público': 'erario', 'opinión personal': 'opinión', 'prever con antelación': 'prever', 'totalmente gratis': 'gratis', 'protagonista principal': 'protagonista', 'persona humana': 'persona', 'mis propios ojos': 'mis ojos', 'sus propios ojos': 'sus ojos', 'hemorragia de sangre': 'hemorragia', 'nexo de unión': 'nexo', 'base fundamental': 'base', 'requisito indispensable': 'requisito', 'falso pretexto': 'pretexto', 'regalo gratis': 'regalo' }[m[1].toLowerCase()]), nota: 'A veces se usa a propósito, por énfasis o por la voz del personaje.' },
  { id: 'pasiva', capa: 'estilo', cat: 'Estilo', re: /(?<!\p{L})(fue|fueron|era|eran|será|serán|ha sido|han sido)\s+(\p{L}+(?:ado|ada|ados|adas|ido|ida|idos|idas|cho|cha|to|ta))\s+por(?!\p{L})/giu, msg: 'Voz pasiva: en español suele sonar más natural la activa.', nota: 'Solo un aviso; la pasiva es correcta.' },
  // ---- ortotipografía editorial ----
  { id: 'meses', capa: 'ortotipografia', cat: 'Mayúsculas', re: new RegExp('(?<=[\\p{Ll}\\d,;:]\\s+(?:de\\s+|el\\s+|los\\s+|en\\s+)?)(' + MESES.split('|').map(cap).join('|') + ')(?!\\p{L})', 'gu'), msg: 'Los meses y los días de la semana van en minúscula.', prop: m => m[1].toLowerCase() },
  { id: 'abreviaturas', capa: 'ortotipografia', cat: 'Abreviaturas', re: /(?<!\p{L})(nº|Nº|n°|1º|2º|3º|1ª|2ª|3ª|etc\.\.\.|etc…|hrs\.?|Sr(?=\s)|Sra(?=\s))/gu, msg: 'Abreviatura con la forma recomendada.', prop: m => ({ 'nº': 'n.º', 'Nº': 'N.º', 'n°': 'n.º', '1º': '1.º', '2º': '2.º', '3º': '3.º', '1ª': '1.ª', '2ª': '2.ª', '3ª': '3.ª', 'etc...': 'etc.', 'etc…': 'etc.', 'hrs': 'h', 'hrs.': 'h', 'Sr': 'Sr.', 'Sra': 'Sra.' }[m[1]]) },
  { id: 'comillas-inglesas', capa: 'ortotipografia', cat: 'Signos', re: /“([^”\n]{1,200})”/g, msg: 'Comillas inglesas: en español el primer nivel son las angulares.', prop: m => '«' + m[1] + '»' },
  { id: 'signo-doble', capa: 'ortotipografia', cat: 'Signos', re: /([?!]{2,}|[¿¡]{2,})/g, msg: 'Signos repetidos: en edición se usa uno.', prop: m => m[1][0] },
  { id: 'cifra-suelta', capa: 'ortotipografia', cat: 'Números', re: /(?<![\d.,:])(?<!\p{L})([1-9])(?![\d.,:%º°ª])\s+(?!(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|%|km|kg|m|cm|mm|g|h|min)\b)(\p{L}+)/giu, msg: 'En un texto literario los números del uno al nueve suelen ir en letras.', prop: m => ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'][+m[1] - 1] + ' ' + m[2], nota: 'Si es una cifra técnica, una fecha o un dato, déjala así.' },
];
for (const r of REGLAS) r.capa = r.capa || 'ortotipografia';
REGLAS.push(...R2);
const EXTRANJERISMOS = ['online', 'email', 'e-mail', 'marketing', 'software', 'hardware', 'show', 'look', 'feedback', 'casting', 'performance', 'sexy', 'spoiler', 'selfie', 'stand', 'ranking', 'delivery', 'living', 'link', 'post', 'mouse', 'jeans', 'sándwich', 'hobby', 'staff', 'timing', 'brunch', 'gourmet', 'déjà vu', 'kitsch', 'collage', 'boutique', 'souvenir', 'leitmotiv'];
const MULETILLAS = ['en realidad', 'básicamente', 'de alguna manera', 'obviamente', 'evidentemente', 'realmente', 'por así decirlo', 'de hecho', 'literalmente', 'en definitiva', 'sin duda', 'en cierto modo', 'de repente', 'tal vez', 'quizás'];
const VACIAS = new Set('para pero porque como cuando donde entre sobre desde hasta hacia contra según durante mediante tanto también cada otro otra otros otras este esta estos estas ese esa esos esas aquel aquella ellos ellas nosotros vosotros usted ustedes había habían hacia estaba estaban todos todas siempre nunca entonces después antes mientras mismo misma mismos mismas sido tiene tenía tenían puede podía porque cuál quien quién donde dónde cómo qué algo nada nadie mucho mucha muchos muchas poco poca pocos pocas solo sólo muy más menos bien aunque desde luego'.split(' '));

// tildes frecuentes que el corrector no ve (palabras válidas sin tilde en otro uso): solo avisos
const DIACRITICAS = [
  { re: /\b(como|que|donde|cuando|quien|cual|cuanto)\s+(\p{Ll}+)\?/giu, msg: 'Pregunta: ¿falta tilde en el interrogativo?' },
];

function observar(bloques, opciones) {
  const obs = [], dicc = new Set(opciones.diccionario || []), ignorar = new Set(opciones.ignorar || []);
  const capas = new Set(opciones.capas || ['ortografia', 'ortotipografia', 'gramatica', 'estilo']);
  const poesia = opciones.tipo === 'poesia';
  const empuja = o => { if (!ignorar.has(o.clave)) obs.push(o); };
  for (const b of bloques) {
    // las remisiones de librojuego [[…]] no se revisan
    const t = b.texto.replace(/\[\[[^\]]*\]\]/g, m => ' '.repeat(m.length));
    if (b.tipo === 'separador' || b.tipo === 'seccion') continue;
    for (const r of REGLAS) {
      if (!capas.has(r.capa)) continue;
      if (b.tipo === 'verso' && (r.id === 'espacios' || r.id === 'mayuscula' || r.capa === 'estilo' || r.id === 'cifra-suelta')) continue;
      r.re.lastIndex = 0; let m;
      while ((m = r.re.exec(t))) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        const ini = m.index, fin = m.index + m[0].length;
        if (r.excluir && (r.excluir.test(m[0]) || (r.id === 'mayuscula' && r.excluir.test(t.slice(Math.max(0, ini - 6), ini + m[1].length))))) continue;
        let prop = r.prop ? r.prop(m) : null;
        if (prop && r.id !== 'meses' && /^\p{Lu}/u.test(m[0]) && /^\p{Ll}/u.test(prop)) prop = prop[0].toUpperCase() + prop.slice(1);
        if (prop === m[0]) continue;
        const clave = r.id + ':' + b.id + ':' + m[0];
        if (ignorar.has(clave)) continue;
        obs.push({ id: clave + ':' + ini, clave, bloque: b.id, inicio: ini, fin, antes: m[0], despues: prop, cat: r.cat, capa: r.capa, regla: r.id, msg: r.msg, nota: r.nota || '' });
      }
    }
    // ortografía
    if (corrector && capas.has('ortografia')) {
      const re = /\p{L}[\p{L}'’]*/gu; let m;
      while ((m = re.exec(t))) {
        const w = m[0].replace(/[’']$/, '');
        if (w.length < 3 || dicc.has(w.toLowerCase()) || EXTRANJERISMOS.includes(w.toLowerCase())) continue;
        const ini = m.index;
        // nombres propios: mayúscula que no inicia oración
        const previo = t.slice(Math.max(0, ini - 3), ini);
        if (/^\p{Lu}/u.test(w) && ini > 0 && !/[.!?¿¡—«"\n]\s*$/.test(previo)) continue;
        if (/^\p{Lu}+$/u.test(w) && w.length <= 5) continue;           // siglas
        if (corrector.correct(w) || corrector.correct(w.toLowerCase())) continue;
        const clave = 'ortografia:' + w;
        if (ignorar.has(clave)) continue;
        const sug = corrector.suggest(w).slice(0, 4);
        obs.push({ id: clave + ':' + b.id + ':' + ini, clave, bloque: b.id, inicio: ini, fin: ini + w.length, antes: w, despues: sug[0] || null, alternativas: sug, cat: 'Ortografía', capa: 'ortografia', regla: 'ortografia', msg: sug.length ? 'Palabra que no está en el diccionario.' : 'Palabra desconocida: no hay sugerencias.', nota: 'Si es correcta, añádela al diccionario del proyecto.' });
      }
    }
    // párrafos muy largos: aviso sin propuesta
    const palabras = t.split(/\s+/).length;
    if (capas.has('estilo') && b.tipo === 'p' && palabras > 320) empuja({ id: 'largo:' + b.id, clave: 'largo:' + b.id, bloque: b.id, inicio: 0, fin: 0, antes: '', despues: null, cat: 'Estilo', capa: 'estilo', regla: 'largo', msg: 'Párrafo de ' + palabras + ' palabras: quizá convenga dividirlo.', nota: '' });
    if (capas.has('estilo') && b.tipo !== 'verso' && !poesia) estilo(b, empuja);
    if (capas.has('ortotipografia')) extranjerismos(b, empuja);
    if (capas.has('gramatica')) for (const d of DIACRITICAS) { d.re.lastIndex = 0; let m; while ((m = d.re.exec(t))) { const clave = 'tilde:' + b.id + ':' + m[0]; if (!ignorar.has(clave)) obs.push({ capa: 'gramatica', id: clave, clave, bloque: b.id, inicio: m.index, fin: m.index + m[1].length, antes: m[1], despues: { como: 'cómo', que: 'qué', donde: 'dónde', cuando: 'cuándo', quien: 'quién', cual: 'cuál', cuanto: 'cuánto' }[m[1].toLowerCase()].replace(/^./, c => m[1][0] === m[1][0].toUpperCase() ? c.toUpperCase() : c), cat: 'Tildes', regla: 'tilde', msg: d.msg, nota: '' }); } }
  }
  if (capas.has('estilo') && !poesia) muletillas(bloques, empuja);
  // en el mismo bloque, si dos observaciones se pisan, se queda la primera
  obs.sort((a, b) => a.bloque === b.bloque ? a.inicio - b.inicio : 0);
  return obs.filter((o, i) => !obs.slice(0, i).some(p => p.bloque === o.bloque && p.fin > o.inicio && p.inicio < o.fin && p.fin > p.inicio && o.fin > o.inicio));
}

// ---- estilo: frases largas, adverbios en -mente, ecos ----
function estilo(b, empuja) {
  const t = b.texto;
  const reFrase = /[^.!?…]+[.!?…]*/g; let m;
  while ((m = reFrase.exec(t))) {
    const f = m[0], ini = m.index, palabras = (f.match(/\p{L}+/gu) || []).length;
    if (palabras > 60) empuja({ id: 'frase:' + b.id + ':' + ini, clave: 'frase:' + b.id + ':' + f.slice(0, 20), bloque: b.id, inicio: ini, fin: ini + Math.min(f.length, 60), antes: f.slice(0, 60), despues: null, cat: 'Estilo', capa: 'estilo', regla: 'frase-larga', msg: `Oración de ${palabras} palabras: puede costar seguirla.`, nota: 'Si es un recurso buscado, descártalo.' });
    const mente = [...f.matchAll(/(?<!\p{L})(\p{L}{3,}mente)(?!\p{L})/gu)];
    if (mente.length >= 2) { const s = mente[1]; empuja({ id: 'mente:' + b.id + ':' + (ini + s.index), clave: 'mente:' + b.id + ':' + s[1], bloque: b.id, inicio: ini + s.index, fin: ini + s.index + s[1].length, antes: s[1], despues: null, cat: 'Estilo', capa: 'estilo', regla: 'mente', msg: 'Dos adverbios en -mente en la misma oración (' + mente.map(x => x[1]).join(', ') + ').', nota: '' }); }
  }
  // ecos: misma palabra (de 5 letras o más) repetida a menos de 18 palabras
    const vista = new Map(); let n = 0;
  let ecos = 0;
  for (const p of [...t.matchAll(/\p{L}+/gu)]) { n++; const w = p[0].toLowerCase(); if (w.length < 6 || VACIAS.has(w) || ecos >= 3) continue; const raiz = w.slice(0, Math.max(5, w.length - 2)); const prev = vista.get(raiz); if (prev != null && n - prev < 15 && ++ecos) empuja({ id: 'eco:' + b.id + ':' + p.index, clave: 'eco:' + b.id + ':' + w, bloque: b.id, inicio: p.index, fin: p.index + p[0].length, antes: p[0], despues: null, cat: 'Estilo', capa: 'estilo', regla: 'eco', msg: `«${p[0]}» se repite muy cerca.`, nota: 'Puede ser un recurso; si no, busca un sinónimo o reorganiza.' }); vista.set(raiz, n); }
}
function extranjerismos(b, empuja) {
  const t = b.texto, cursivas = b.cursivas || [];
  for (const w of EXTRANJERISMOS) {
    const re = new RegExp('(?<!\\p{L})' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\p{L})', 'giu'); let m;
    while ((m = re.exec(t))) { const i = m.index, f = i + m[0].length; if (cursivas.some(([a, z]) => a <= i && z >= f)) continue; empuja({ id: 'extr:' + b.id + ':' + i, clave: 'extr:' + b.id + ':' + m[0].toLowerCase(), bloque: b.id, inicio: i, fin: f, antes: m[0], despues: null, accion: 'cursiva', cat: 'Extranjerismos', capa: 'ortotipografia', regla: 'extranjerismo', msg: 'Extranjerismo sin adaptar: va en cursiva.', nota: 'Aceptar la pone en cursiva sin cambiar las letras.' }); }
  }
}
function muletillas(bloques, empuja) {
  for (const mu of MULETILLAS) {
    const re = new RegExp('(?<!\\p{L})' + mu + '(?!\\p{L})', 'giu'), hits = [];
    for (const b of bloques) { if (b.tipo === 'verso') continue; let m; re.lastIndex = 0; while ((m = re.exec(b.texto))) hits.push({ b, i: m.index, t: m[0] }); }
    if (hits.length >= 4) for (const h of hits) empuja({ id: 'mul:' + h.b.id + ':' + h.i, clave: 'muletilla:' + mu, bloque: h.b.id, inicio: h.i, fin: h.i + h.t.length, antes: h.t, despues: null, cat: 'Muletillas', capa: 'estilo', regla: 'muletilla', msg: `«${mu}» aparece ${hits.length} veces en el libro.`, nota: 'Descartar una la descarta en todo el libro.' });
  }
}

onmessage = async e => {
  const { id, bloques, opciones } = e.data;
  try {
    if (opciones.ortografia !== false && (!opciones.capas || opciones.capas.includes('ortografia'))) await cargar();
    postMessage({ id, obs: observar(bloques, opciones) });
  } catch (err) { postMessage({ id, error: String(err && err.message || err) }); }
};
