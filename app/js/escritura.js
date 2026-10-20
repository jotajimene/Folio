/* Folio · herramientas de escritura que leen el manuscrito sin tocarlo
 *  · Nombres: encuentra variantes de un mismo nombre (Martín / Martin / Martím) y te deja unificarlas.
 *  · Ficha de personajes: el modelo local resume quién es cada uno y avisa contradicciones.
 *  · Radiografía: largo, ritmo, diálogo, legibilidad y quién aparece en cada capítulo.
 * Todo se calcula en este computador.
 */
(function () {
  'use strict';
  const { esc } = App;
  const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const COMUNES = new Set('El La Los Las Un Una Unos Unas Lo Al Del Y O Pero Si No Sí Que Qué Cuando Cuándo Donde Dónde Como Cómo Porque Por Para Con Sin Sobre Entre Hasta Desde Ya Aún Todavía Entonces Luego Después Antes Ahora Hoy Ayer Mañana Allí Ahí Aquí Allá Acá Así Tal Tan Muy Más Menos Nada Nadie Todo Todos Toda Todas Algo Alguien Cada Otro Otra Otros Otras Este Esta Esto Estos Estas Ese Esa Eso Esos Esas Aquel Aquella Aquello Mi Mis Tu Tus Su Sus Nuestro Nuestra Yo Tú Él Ella Ellos Ellas Usted Ustedes Nosotros Nosotras Me Te Se Le Les Nos Era Fue Es Son Hay Había Ha He Mientras Aunque Pues Quizá Quizás Tampoco También Siempre Nunca Jamás Dios Señor Señora Capítulo Parte Libro Primera Segunda Tercera Uno Dos Tres Bueno Claro Oh Ah Ay Eh Sí Vale Bien Mal Ni En De A E U Mira Oye Ven Vamos Espera Gracias Perdón Lunes Martes Miércoles Jueves Viernes Sábado Domingo Enero Febrero Marzo Abril Mayo Junio Julio Agosto Septiembre Octubre Noviembre Diciembre'.split(' '));
  const PAL = /[\p{L}][\p{L}'’-]*/gu;
  const limpio = t => t.replace(//g, '');

  // ---------- nombres propios ----------
  function nombres(p) {
    const cuenta = new Map(), medio = new Map(), dondes = new Map();
    for (const b of p.bloques) {
      if (b.tipo === 'separador') continue;
      const t = limpio(b.texto); let m; PAL.lastIndex = 0;
      while ((m = PAL.exec(t))) {
        const w = m[0]; if (!/^\p{Lu}\p{Ll}/u.test(w) || w.length < 3 || COMUNES.has(w)) continue;
        const antes = t.slice(Math.max(0, m.index - 3), m.index);
        const inicio = m.index === 0 || /[.!?¡¿:…«"“—–\n]\s*$/.test(antes);
        cuenta.set(w, (cuenta.get(w) || 0) + 1);
        if (!inicio) medio.set(w, (medio.get(w) || 0) + 1);
        if (!dondes.has(w)) dondes.set(w, []); dondes.get(w).push([b.id, m.index]);
      }
    }
    // nombre propio: aparece al menos una vez en medio de frase con mayúscula, y nunca o casi nunca en minúscula
    const minus = new Map();
    for (const b of p.bloques) { let m; PAL.lastIndex = 0; const t = limpio(b.texto); while ((m = PAL.exec(t))) if (/^\p{Ll}/u.test(m[0])) minus.set(m[0], (minus.get(m[0]) || 0) + 1); }
    const lista = [];
    for (const [w, n] of cuenta) { const me = medio.get(w) || 0, mi = minus.get(w.toLowerCase()) || 0; if (me >= 1 && mi <= n / 4) lista.push({ nombre: w, n, dondes: dondes.get(w) }); }
    return lista.sort((a, b) => b.n - a.n);
  }
  function distancia(a, b) { // Damerau-Levenshtein (transposición incluida)
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function variantes(lista) {
    const grupos = [], usado = new Set();
    for (let i = 0; i < lista.length; i++) {
      if (usado.has(i)) continue; const a = lista[i], g = [a];
      for (let j = i + 1; j < lista.length; j++) {
        if (usado.has(j)) continue; const b = lista[j];
        if (a.nombre[0] !== b.nombre[0] && sinTilde(a.nombre[0]) !== sinTilde(b.nombre[0])) continue;
        const A = sinTilde(a.nombre.toLowerCase()), B = sinTilde(b.nombre.toLowerCase()), L = Math.min(A.length, B.length);
        const parecidos = A === B || (L >= 5 && distancia(A, B) <= (L >= 9 ? 2 : 1));
        // plurales y femeninos comunes no son variantes (Juan/Juana, Pedro/Pedros)
        const flexion = (A + 's' === B || B + 's' === A || A + 'a' === B || B + 'a' === A || A.slice(0, -1) === B.slice(0, -1) && /[ao]$/.test(A) && /[ao]$/.test(B));
        if (parecidos && !flexion) { g.push(b); usado.add(j); }
      }
      if (g.length > 1) grupos.push(g);
    }
    return grupos;
  }
  function contextos(p, nombre, max = 4) {
    const out = [];
    for (const b of p.bloques) { const t = limpio(b.texto); const re = new RegExp('(?<![\\p{L}])' + nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'u'); const m = re.exec(t); if (m) { out.push({ id: b.id, t: '…' + t.slice(Math.max(0, m.index - 60), m.index) + '<b>' + esc(nombre) + '</b>' + t.slice(m.index + nombre.length, m.index + nombre.length + 60) + '…' }); if (out.length >= max) break; } }
    return out;
  }
  // unifica (con tu confirmación) todas las apariciones de una variante; se deshace con Ctrl+Z
  function unificar(desde, hacia) {
    let n = 0; const re = new RegExp('(?<![\\p{L}])' + desde.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'gu');
    Folio.cambiar('texto:nombres', p => {
      for (const b of p.bloques) {
        const pos = []; let m; re.lastIndex = 0; while ((m = re.exec(b.texto))) pos.push(m.index);
        for (const i of pos.reverse()) { Folio.texto.reemplazar(b, i, i + desde.length, hacia); n++; }
      }
      p.revision.decididas.push({ id: Folio.uid(), regla: 'nombres', cat: 'Nombres', bloque: '', inicio: 0, antes: desde, despues: hacia, multiple: n, fecha: new Date().toISOString() });
    });
    return n;
  }

  async function ventanaNombres() {
    const p = Folio.p; if (!p.bloques.length) return App.aviso('Primero trae el manuscrito.');
    const lista = nombres(p), grupos = variantes(lista);
    const fichas = p.biblia || {};
    const filaGrupo = (g, k) => `<div class="nm-grupo" data-g="${k}"><div class="nm-vars">${g.map((x, i) => `<button class="nm-var ${i ? '' : 'on'}" data-nombre="${esc(x.nombre)}"><b>${esc(x.nombre)}</b> <span>${x.n}</span></button>`).join('<span class="dim">/</span>')}</div>
      <div class="nm-ctx">${g.slice(1).map(x => contextos(p, x.nombre, 2).map(c => `<p>${c.t.replace(/<b>/, '<mark>').replace('</b>', '</mark>')}</p>`).join('')).join('')}</div>
      <div class="fila-botones">${g.slice(1).map(x => `<button class="boton chico" data-unificar="${esc(x.nombre)}" data-hacia="${esc(g[0].nombre)}">«${esc(x.nombre)}» → «${esc(g[0].nombre)}»</button>`).join('')}</div></div>`;
    App.modal({ titulo: 'Nombres y personajes', ancho: 860,
      cuerpo: `<div class="nm-cols"><div><div class="sub">Posibles variantes del mismo nombre</div>${grupos.length ? grupos.map(filaGrupo).join('') : '<p class="nota">No encontré nombres escritos de dos maneras. Bien.</p>'}
        <p class="nota">Unificar cambia todas las apariciones de una vez; queda en «Ya decididas» y se deshace con Ctrl+Z.</p></div>
        <div><div class="sub">Quién aparece y cuánto</div><ul class="lista nm-lista">${lista.slice(0, 40).map(x => `<li data-ficha="${esc(x.nombre)}"><a>${esc(x.nombre)}</a> <span>${x.n}</span></li>`).join('')}</ul>
        <div class="sub">Ficha de personajes</div><div class="nm-fichas">${Object.entries(fichas).map(([k, v]) => `<div class="nm-ficha"><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join('') || '<p class="nota">El modelo local puede leer los pasajes donde aparece cada nombre y resumir quién es, avisando si el texto se contradice (edad, ojos, parentescos…).</p>'}</div>
        <div class="fila-botones"><button class="boton chico" data-biblia>${Object.keys(fichas).length ? 'Rehacer las fichas' : 'Hacer las fichas con el modelo local'}</button></div></div></div>`,
      botones: [{ texto: 'Cerrar', valor: null }],
      alAbrir: (m, ctx) => m.addEventListener('click', async e => {
        const u = e.target.closest('[data-unificar]');
        if (u) { const d = u.dataset.unificar, h = u.dataset.hacia, cu = (lista.find(x => x.nombre === d) || {}).n || 0; if (await App.confirmar(`Cambiar las ${cu} apariciones de «${d}» por «${h}».`, 'Unificar')) { const n = unificar(d, h); App.aviso(`${n} cambios. Ctrl+Z para deshacer.`); ctx.cerrar(); ventanaNombres(); } return; }
        const v = e.target.closest('.nm-var'); if (v) { const g = v.closest('.nm-grupo'); g.querySelectorAll('.nm-var').forEach(x => x.classList.toggle('on', x === v)); const h = v.dataset.nombre; const otros = [...g.querySelectorAll('.nm-var')].map(x => x.dataset.nombre).filter(x => x !== h); g.querySelector('.fila-botones').innerHTML = otros.map(o => `<button class="boton chico" data-unificar="${esc(o)}" data-hacia="${esc(h)}">«${esc(o)}» → «${esc(h)}»</button>`).join(''); return; }
        if (e.target.closest('[data-biblia]')) { ctx.cerrar(); return hacerBiblia(lista.slice(0, 12)); }
      }) });
  }
  async function hacerBiblia(lista) {
    const p = Folio.p, nuevas = {};
    let detener = false;
    const pr = App.modal({ titulo: 'Ficha de personajes', ancho: 720, cuerpo: `<p class="nota estado-biblia">Leyendo…</p><div class="nm-fichas vivas"></div>`, botones: [{ texto: 'Descartar', valor: null }, { texto: 'Guardar en el proyecto', taco: true, valor: 'ok' }] });
    pr.then(() => { detener = true; });
    const est = () => document.querySelector('.estado-biblia'), caja = () => document.querySelector('.nm-fichas.vivas');
    try {
      for (const [i, x] of lista.entries()) {
        if (detener) break;
        if (est()) est().textContent = `Leyendo sobre ${x.nombre} (${i + 1} de ${lista.length})…`;
        const ids = [...new Set(x.dondes.map(d => d[0]))]; const paso = Math.max(1, Math.floor(ids.length / 8));
        const pasajes = ids.filter((_, k) => k % paso === 0).slice(0, 8).map(id => limpio(p.bloques.find(b => b.id === id).texto).slice(0, 500)).join('\n---\n');
        const r = await Asistente.pedir({ sistema: 'Eres editor de mesa. Lees con atención y no inventas: solo dices lo que está en los fragmentos.', mensaje: `Según estos fragmentos de una novela, describe a «${x.nombre}» en 2 o 3 frases: qué es (persona, lugar, cosa), rasgos, relaciones con otros. Si dos fragmentos se contradicen (edad, color de ojos, parentesco, nombre de alguien cercano), dilo al final empezando con «Ojo:». Si no hay datos, di «Sin datos claros». Responde solo el texto.\n\n${pasajes}`, maxTokens: 220, temperatura: 0.2 });
        nuevas[x.nombre] = r.texto.trim();
        if (caja()) caja().insertAdjacentHTML('beforeend', `<div class="nm-ficha ${/Ojo:/.test(r.texto) ? 'ojo' : ''}"><b>${esc(x.nombre)}</b><p>${esc(r.texto.trim())}</p></div>`);
      }
      if (est()) est().textContent = 'Listo. Es una lectura del modelo: compruébala.';
    } catch (e) { if (e.message !== 'sin-modelo' && est()) est().textContent = 'No se pudo: ' + e.message; else if (e.message === 'sin-modelo') return; }
    if ((await pr) === 'ok' && Object.keys(nuevas).length) { Folio.cambiar('notas:biblia', q => { q.biblia = nuevas; }, { silencioso: true }); App.aviso('Fichas guardadas en el proyecto (no van al libro).'); }
  }

  // ---------- radiografía ----------
  function silabas(w) {
    w = w.toLowerCase().replace(/[^a-záéíóúüñ]/g, ''); if (!w) return 0;
    w = w.replace(/qu|gu(?=[ei])/g, 'q').replace(/y$/, 'i');
    const g = w.match(/[aeiouáéíóúü]+/g) || []; let n = 0;
    for (const v of g) { let k = 1; for (let i = 1; i < v.length; i++) { const a = v[i - 1], b = v[i]; const fuerte = c => 'aeoáéó'.includes(c) || 'íú'.includes(c); if (fuerte(a) && fuerte(b)) k++; } n += k; }
    return Math.max(1, n);
  }
  function oraciones(t) { return limpio(t).split(/(?<=[.!?…])\s+(?=[¿¡«"“—\p{Lu}])/u).map(s => s.trim()).filter(s => /\p{L}/u.test(s)); }
  function radiografia(p) {
    const caps = []; let cap = { titulo: '(antes del primer capítulo)', bloques: [] };
    for (const b of p.bloques) { if (b.tipo === 'h1') { if (cap.bloques.length) caps.push(cap); cap = { titulo: b.texto, bloques: [] }; } else if (b.tipo !== 'separador') cap.bloques.push(b); }
    if (cap.bloques.length) caps.push(cap);
    const vacias = new Set('de la que el en y a los se del las un por con no una su para es al lo como más o pero sus le ha me si sin sobre este ya entre cuando todo esta ser son dos también fue había era muy años hasta desde está mi porque qué sólo solo han yo hay vez puede todos así nos ni parte tiene él uno donde bien tiempo mismo ese ahora cada e vida otro después te otros aunque esa eso hace otra gobierno tan durante siempre día tanto ella tres sí dijo sido gran país según menos mundo año antes estado contra sino forma caso nada hacer general estaba poco estos presidente mayor ante unos les algo hacia casa ellos ayer hecho primera mucho mientras además quien momento millones esto españa hombre están pues hoy lugar madrid nacional trabajo otras mejor nuevo decir algunos entonces todas días debe política cómo casi toda tal luego pasado primer medio va estas sea tenía nunca poder aquí ver veces embargo partido personas grupo cuenta pueden tienen misma nueva cual fueron mujer frente josé tras cosas fin ciudad he social manera tener sistema será historia muchos juan tipo cuatro dentro nos punto dice ello cualquier noche aún agua parece haber situación fuera bajo grandes nuestro ejemplo acuerdo habían usted estados hizo nadie países horas posible tarde ley importante guerra desarrollo proceso realidad sentido lado mí tu cambio allí mano eran estar san número sociedad unas centro padre gente final relación cuerpo obra incluso través último madre mis modo problema cinco carlos hombres información ojos muerte nombre algunas público mujeres siglo todavía meses mañana esos nosotros hora muchas pueblo alguna dar problemas don da tú derecho verdad maría unidos podría sería junto cabeza aquel luis cuanto tierra equipo segundo director dicho cierto casos manos nivel podía familia largo partir falta llegar propio ministro cosa primero seguridad hemos mal trata algún tuvo respecto semana varios real sé voz paso señor mil quiere existe pesar fondo pública pasa nuestra lugar'.split(' '));
    let total = 0, sil = 0, ors = 0, mente = 0, dialogo = 0, palabrasDialogo = 0;
    const largos = [], frec = new Map(), lexico = [], nombresL = nombres(p).slice(0, 8).map(x => x.nombre);
    const porCap = caps.map(c => {
      let w = 0, o = 0, d = 0, wd = 0; const apar = Object.fromEntries(nombresL.map(n => [n, 0]));
      for (const b of c.bloques) {
        const t = limpio(b.texto), pal = t.match(PAL) || [];
        w += pal.length; for (const x of pal) { sil += silabas(x); const l = x.toLowerCase(); lexico.push(l); if (/mente$/.test(l) && l.length > 6) mente++; if (l.length > 3 && !vacias.has(l) && !/^\p{Lu}/u.test(x)) frec.set(l, (frec.get(l) || 0) + 1); if (x in apar) apar[x]++; }
        const os = oraciones(t); o += os.length; for (const s of os) largos.push((s.match(PAL) || []).length);
        if (/^\s*[—–-]/.test(t)) { d++; wd += pal.length; }
      }
      total += w; ors += o; dialogo += d; palabrasDialogo += wd;
      return { titulo: c.titulo, palabras: w, media: o ? w / o : 0, dialogo: w ? wd / w : 0, apar };
    });
    // variedad léxica: MATTR en ventanas de 500 palabras
    let mattr = 0, nv = 0; for (let i = 0; i + 500 <= lexico.length; i += 250) { mattr += new Set(lexico.slice(i, i + 500)).size / 500; nv++; }
    const fh = total && ors ? 206.84 - 0.60 * (sil / total * 100) - 1.02 * (ors / total * 100) : 0;
    return { total, ors, porCap, largos, media: ors ? total / ors : 0, minutos: Math.round(total / 230), paginas: Math.round(total / 280), mente, mentePorMil: total ? mente / total * 1000 : 0, dialogo: total ? palabrasDialogo / total : 0, variedad: nv ? mattr / nv : (lexico.length ? new Set(lexico).size / lexico.length : 0), legibilidad: fh, frecuentes: [...frec].sort((a, b) => b[1] - a[1]).slice(0, 24), nombres: nombresL };
  }
  const n0 = x => Math.round(x).toLocaleString('es-CL');
  const escala = fh => fh >= 80 ? 'fácil' : fh >= 70 ? 'bastante fácil' : fh >= 60 ? 'normal' : fh >= 50 ? 'algo exigente' : fh >= 30 ? 'exigente' : 'muy exigente';
  // gráficos en tinta: una sola serie por gráfico, barras finas con extremo redondeado y título que la nombra
  function barras(datos, { alto = 120, etiqueta, valor, fmt = n0, ancho = 560 }) {
    if (!datos.length) return '';
    const max = Math.max(...datos.map(valor), 1), paso = ancho / datos.length, bw = Math.max(2, Math.min(28, paso - 2));
    return `<svg class="rx-graf" viewBox="0 -14 ${ancho} ${alto + 32}" role="img"><line x1="0" x2="${ancho}" y1="${alto}" y2="${alto}" class="eje"/>${datos.map((d, i) => { const h = Math.max(1, valor(d) / max * (alto - 6)), x = i * paso + (paso - bw) / 2; return `<g class="rx-barra"><rect x="${i * paso}" y="0" width="${paso}" height="${alto}" fill="transparent"/><path d="M${x},${alto} V${alto - h + Math.min(4, h)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${alto} Z"/><title>${esc(etiqueta(d, i))}: ${fmt(valor(d))}</title>${datos.length <= 12 ? `<text x="${x + bw / 2}" y="${alto - h - 5}" text-anchor="middle" class="rx-valor">${esc(fmt(valor(d)))}</text>` : ''}</g>`; }).join('')}${datos.length <= 30 ? datos.map((d, i) => `<text x="${i * paso + paso / 2}" y="${alto + 13}" text-anchor="middle">${i + 1}</text>`).join('') : ''}</svg>`;
  }
  function histograma(largos) {
    const tramos = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30], [31, 40], [41, 60], [61, 999]];
    const d = tramos.map(([a, b]) => ({ t: b > 900 ? `más de ${a - 1}` : `${a} a ${b}`, n: largos.filter(x => x >= a && x <= b).length }));
    return `<svg class="rx-graf" viewBox="0 -14 560 154" role="img"><line x1="0" x2="560" y1="118" y2="118" class="eje"/>${d.map((x, i) => { const max = Math.max(...d.map(y => y.n), 1), h = Math.max(1, x.n / max * 110), bw = 44, X = i * 62 + 9; return `<g class="rx-barra"><path d="M${X},118 V${118 - h + Math.min(4, h)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V118 Z"/><title>Oraciones de ${x.t} palabras: ${n0(x.n)}</title>${x.n ? `<text x="${X + bw / 2}" y="${118 - h - 5}" text-anchor="middle" class="rx-valor">${n0(x.n)}</text>` : ''}<text x="${X + bw / 2}" y="132" text-anchor="middle">${x.t.replace('más de ', '+')}</text></g>`; }).join('')}</svg>`;
  }
  function mapaNombres(r) {
    if (!r.nombres.length || r.porCap.length < 2) return '';
    const max = Math.max(1, ...r.porCap.flatMap(c => Object.values(c.apar)));
    const cw = Math.max(10, Math.min(30, 440 / r.porCap.length)), W = 110 + cw * r.porCap.length;
    return `<svg class="rx-graf rx-mapa" viewBox="0 0 ${W} ${r.nombres.length * 22 + 20}" role="img">${r.nombres.map((n, j) => `<text x="104" y="${j * 22 + 15}" text-anchor="end">${esc(n)}</text>${r.porCap.map((c, i) => { const v = c.apar[n]; return `<rect x="${110 + i * cw + 1}" y="${j * 22 + 2}" width="${cw - 2}" height="18" rx="2" style="opacity:${v ? 0.15 + 0.85 * v / max : 0.05}"><title>${esc(n)} en «${esc(c.titulo)}»: ${v}</title></rect>`; }).join('')}`).join('')}<text x="110" y="${r.nombres.length * 22 + 16}" class="dim">capítulos 1 a ${r.porCap.length} →</text></svg>`;
  }
  function ventanaRadiografia() {
    const p = Folio.p; if (!p.bloques.length) return App.aviso('Primero trae el manuscrito.');
    const r = radiografia(p);
    const ficha = (v, t, s = '') => `<div class="rx-dato"><b>${v}</b><span>${t}</span>${s ? `<small>${s}</small>` : ''}</div>`;
    const tabla = `<table class="rx-tabla"><thead><tr><th>#</th><th>Capítulo</th><th>Palabras</th><th>Palabras por oración</th><th>Diálogo</th></tr></thead><tbody>${r.porCap.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.titulo.slice(0, 50))}</td><td>${n0(c.palabras)}</td><td>${c.media.toFixed(1).replace('.', ',')}</td><td>${Math.round(c.dialogo * 100)} %</td></tr>`).join('')}</tbody></table>`;
    App.modal({ titulo: 'Radiografía del texto', ancho: 900,
      cuerpo: `<div class="rx-datos">${ficha(n0(r.total), 'palabras', `unas ${n0(r.paginas)} páginas en A5`)}${ficha(r.minutos >= 60 ? `${Math.floor(r.minutos / 60)} h ${r.minutos % 60} min` : r.minutos + ' min', 'de lectura', 'a 230 palabras por minuto')}${ficha(r.media.toFixed(1).replace('.', ','), 'palabras por oración', `${n0(r.ors)} oraciones`)}${ficha(Math.round(r.dialogo * 100) + ' %', 'en diálogo')}${ficha(Math.round(r.legibilidad), 'legibilidad', `Fernández-Huerta: ${escala(r.legibilidad)}`)}${ficha(Math.round(r.variedad * 100) + ' %', 'variedad léxica', 'palabras distintas cada 500')}${ficha(r.mentePorMil.toFixed(1).replace('.', ','), 'adverbios en -mente', 'cada mil palabras')}</div>
        ${r.porCap.length > 1 ? `<div class="sub">Palabras por capítulo</div>${barras(r.porCap, { etiqueta: c => c.titulo, valor: c => c.palabras })}
        <div class="sub">Largo medio de las oraciones por capítulo</div>${barras(r.porCap, { etiqueta: c => c.titulo, valor: c => c.media, fmt: x => x.toFixed(1).replace('.', ',') + ' palabras' })}
        <div class="sub">Diálogo por capítulo</div>${barras(r.porCap, { etiqueta: c => c.titulo, valor: c => c.dialogo * 100, fmt: x => Math.round(x) + ' %' })}` : ''}
        <div class="sub">Cuántas oraciones hay de cada largo</div>${histograma(r.largos)}
        ${mapaNombres(r) ? `<div class="sub">Quién aparece en cada capítulo</div>${mapaNombres(r)}` : ''}
        <div class="sub">Las palabras que más usas</div><p class="rx-frec">${r.frecuentes.map(([w, n]) => `<span>${esc(w)} <small>${n}</small></span>`).join('')}</p>
        <details><summary>Ver como tabla</summary>${tabla}</details>
        <p class="nota">Son medidas para mirar el texto desde lejos. No hay valores correctos: un capítulo corto o una frase larga pueden ser justo lo que el libro necesita.</p>`,
      botones: [{ texto: 'Cerrar', valor: null }] });
  }

  window.Escritura = { ventanaNombres, ventanaRadiografia, nombres, variantes, radiografia, silabas, unificar };
})();
