/* Folio · cubiertas
 * Diez sistemas, uno por colección. Cada sistema tiene un generador de imagen
 * (canvas, con semilla: la misma semilla da siempre la misma cubierta) y su
 * propia composición tipográfica en HTML (texto vectorial en el PDF).
 * Las imágenes vienen del archivo de grabados de dominio público o de una
 * fotografía que tú agregas al proyecto.
 */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cache = new Map();
  function cargarImg(src) {
    if (!src) return Promise.resolve(null);
    if (cache.has(src)) return cache.get(src);
    const p = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    cache.set(src, p); return p;
  }
  // convierte un grabado (negro sobre blanco) en tinta de un color sobre transparente
  function tintar(img, color, recorte) {
    const [sx, sy, sw, sh] = recorte || [0, 0, img.naturalWidth, img.naturalHeight];
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw)); c.height = Math.max(1, Math.round(sh));
    const g = c.getContext('2d'); g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    const [r, gg, b] = rgb(color);
    for (let i = 0; i < a.length; i += 4) { const l = (a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11); a[i] = r; a[i + 1] = gg; a[i + 2] = b; a[i + 3] = Math.max(0, Math.min(255, (235 - l) * 1.6)) * (a[i + 3] / 255); }
    g.putImageData(d, 0, 0); return c;
  }
  function rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  function contener(cw, ch, bw, bh) { const k = Math.min(bw / cw, bh / ch); return [cw * k, ch * k]; }

  // lámina elegida (o sorteada con la semilla, según lo que pide el sistema)
  function laminaPara(p, gen, sem, n = 1) {
    if (!window.ARCHIVO || !ARCHIVO.listo) return [];
    if (p.cubierta.imagen && n === 1 && ARCHIVO.porId[p.cubierta.imagen]) return [ARCHIVO.porId[p.cubierta.imagen]];
    const tipos = { cenefas: ['orla'], detalle: ['figura', 'escena'], reticula: ['figura'] }[gen] || ['figura'];
    const grande = l => l.w > 220 && l.h > 220;
    let filtro = l => tipos.includes(l.tipo) && (gen === 'cenefas' || grande(l));
    if (gen === 'reticula' && p.cubierta.imagen && ARCHIVO.porId[p.cubierta.imagen]) {
      const base = ARCHIVO.porId[p.cubierta.imagen], fuente = (ARCHIVO.paginas[base.p] || {}).f;
      const mismos = ARCHIVO.elegir(l => l.id !== base.id && l.tipo === 'figura' && (ARCHIVO.paginas[l.p] || {}).f === fuente && l.w > 120, sem, n - 1);
      return [base, ...mismos];
    }
    if (gen === 'reticula') {
      const una = ARCHIVO.elegir(filtro, sem, 1)[0]; const fuente = (ARCHIVO.paginas[una.p] || {}).f;
      return [una, ...ARCHIVO.elegir(l => l.id !== una.id && l.tipo === 'figura' && (ARCHIVO.paginas[l.p] || {}).f === fuente && l.w > 120, sem + 7, n - 1)];
    }
    return ARCHIVO.elegir(filtro, sem, n);
  }

  // ---------------- generadores ----------------
  // g: contexto; D: {W,H,fx,fy,fw,fh (frente), k: px por mm}; pal: [fondo,tinta,acento]; r(): azar con semilla
  const GEN = {
    async grabado(g, D, pal, r, p) {
      const [l] = laminaPara(p, 'grabado', p.cubierta.semilla); const img = l && await cargarImg(ARCHIVO.src(l.id));
      const k = D.k;
      g.strokeStyle = pal[1]; g.lineWidth = .5 * k; g.strokeRect(D.fx + 6 * k, D.fy + 6 * k, D.fw - 12 * k, D.fh - 12 * k);
      g.lineWidth = 1.4 * k; g.strokeRect(D.fx + 7.6 * k, D.fy + 7.6 * k, D.fw - 15.2 * k, D.fh - 15.2 * k);
      if (img) { const t = tintar(img, pal[1]); const [w, h] = contener(t.width, t.height, D.fw * .72, D.fh * .5 * p.cubierta.escalaImagen || D.fh * .5); g.drawImage(t, D.fx + (D.fw - w) / 2, D.fy + D.fh * .3 + (D.fh * .5 - h) / 2, w, h); }
      return { laminas: l ? [l.id] : [] };
    },
    async teselacion(g, D, pal, r, p) {
      const [l] = laminaPara(p, 'teselacion', p.cubierta.semilla); const img = l && await cargarImg(ARCHIVO.src(l.id));
      if (!img) return { laminas: [] };
      const lado = Math.min(img.naturalWidth, img.naturalHeight) * (0.45 + r() * 0.35);
      const sx = r() * (img.naturalWidth - lado), sy = r() * (img.naturalHeight - lado);
      const t = tintar(img, pal[1], [sx, sy, lado, lado]);
      const celda = D.fw / (2 + Math.floor(r() * 3));
      const m = document.createElement('canvas'); m.width = m.height = Math.round(celda * 2); const mg = m.getContext('2d');
      const espejos = [[1, 1, 0, 0], [-1, 1, 2, 0], [1, -1, 0, 2], [-1, -1, 2, 2]];
      for (const [ax, ay, ox, oy] of espejos) { mg.save(); mg.translate(ox * celda, oy * celda); mg.scale(ax, ay); mg.drawImage(t, 0, 0, celda, celda); mg.restore(); }
      const pat = g.createPattern(m, 'repeat'); g.save(); g.translate(D.fx % m.width, D.fy); g.fillStyle = pat; g.fillRect(-D.fx % m.width - m.width, 0, D.W + 2 * m.width, D.H); g.restore();
      return { laminas: [l.id] };
    },
    async foto(g, D, pal, r, p, opt) {
      const src = p.cubierta.foto && opt.recursos && opt.recursos[p.cubierta.foto];
      let img = src ? await cargarImg(src) : null, ids = [];
      if (!img) { const [l] = laminaPara(p, 'foto', p.cubierta.semilla); img = l && await cargarImg(ARCHIVO.src(l.id)); if (l) ids = [l.id]; }
      if (!img) return { laminas: [] };
      // trama de semitono a 45° sobre la parte alta del frente, a sangre
      const ax = D.fx, ay = D.fy - (D.sangrado || 0), aw = D.fw + (D.sangrado || 0), ah = D.fh * .66 + (D.sangrado || 0);
      const src2 = document.createElement('canvas'); src2.width = 240; src2.height = Math.round(240 * ah / aw);
      const sg = src2.getContext('2d'); const ar = img.naturalWidth / img.naturalHeight, br = aw / ah;
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0; if (ar > br) { sw = sh * br; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / br; sy = (img.naturalHeight - sh) / 2; }
      sg.fillStyle = '#fff'; sg.fillRect(0, 0, src2.width, src2.height); sg.drawImage(img, sx, sy, sw, sh, 0, 0, src2.width, src2.height);
      const px = sg.getImageData(0, 0, src2.width, src2.height).data;
      const paso = aw / (55 + r() * 25), ang = Math.PI / 4;
      g.save(); g.beginPath(); g.rect(ax, ay, aw, ah); g.clip(); g.fillStyle = pal[2]; g.fillRect(ax, ay, aw, ah); g.fillStyle = pal[1];
      const cx = ax + aw / 2, cy = ay + ah / 2, R = Math.hypot(aw, ah) / 2 + paso;
      for (let u = -R; u < R; u += paso) for (let v = -R; v < R; v += paso) {
        const x = cx + u * Math.cos(ang) - v * Math.sin(ang), y = cy + u * Math.sin(ang) + v * Math.cos(ang);
        if (x < ax - paso || y < ay - paso || x > ax + aw + paso || y > ay + ah + paso) continue;
        const ix = Math.min(src2.width - 1, Math.max(0, ((x - ax) / aw * src2.width) | 0)), iy = Math.min(src2.height - 1, Math.max(0, ((y - ay) / ah * src2.height) | 0));
        const o = (iy * src2.width + ix) * 4, l = (px[o] * .3 + px[o + 1] * .59 + px[o + 2] * .11) / 255;
        const rad = paso * .62 * Math.sqrt(1 - l); if (rad > .3) { g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill(); }
      }
      g.restore();
      return { laminas: ids };
    },
    async campos(g, D, pal, r, p) {
      const k = D.k, x0 = D.fx, y0 = D.fy - (D.sangrado || 0), w = D.fw + (D.sangrado || 0), h = D.fh * .68 + (D.sangrado || 0);
      const cols = [pal[1], pal[2]];
      const n = 2 + Math.floor(r() * 3);
      const cortes = Array.from({ length: n - 1 }, () => .2 + r() * .6).sort();
      const vertical = r() < .5; let prev = 0;
      [...cortes, 1].forEach((c, i) => {
        g.fillStyle = cols[i % 2];
        if (vertical) g.fillRect(x0 + prev * w, y0, (c - prev) * w + 1, h); else g.fillRect(x0, y0 + prev * h, w, (c - prev) * h + 1);
        prev = c;
      });
      // un arco o un círculo que cruza los campos
      g.fillStyle = cols[n % 2];
      const R = w * (.18 + r() * .2); g.beginPath(); g.arc(x0 + w * (.2 + r() * .6), y0 + h * (.25 + r() * .5), R, 0, Math.PI * (r() < .5 ? 1 : 2)); g.fill();
      const [l] = laminaPara(p, 'campos', p.cubierta.semilla); const img = l && await cargarImg(ARCHIVO.src(l.id));
      if (img) { const t = tintar(img, pal[0]); const [iw, ih] = contener(t.width, t.height, w * .44, h * .44); g.drawImage(t, x0 + w * (.08 + r() * .45), y0 + h * (.1 + r() * .42), iw, ih); }
      return { laminas: l ? [l.id] : [] };
    },
    async cenefas(g, D, pal, r, p) {
      // friso: una figura del archivo repetida en banda, alternando su sentido, arriba y abajo
      const [l] = laminaPara({ cubierta: { ...p.cubierta, imagen: p.cubierta.imagen } }, 'campos', p.cubierta.semilla);
      const img = l && await cargarImg(ARCHIVO.src(l.id)); if (!img) return { laminas: [] };
      const k = D.k, t = tintar(img, pal[1]);
      for (const y of [D.fy + 11 * k, D.fy + D.fh - 11 * k - D.fh * .14]) {
        const bh = D.fh * .14, bw = t.width * bh / t.height, x0 = D.fx + 11 * k, x1 = D.fx + D.fw - 11 * k;
        g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, bh); g.clip();
        const n = Math.max(1, Math.round((x1 - x0) / (bw * 1.15))), paso = (x1 - x0) / n;
        for (let i = 0; i < n; i++) { g.save(); const cx = x0 + paso * (i + .5); g.translate(cx, y); if (i % 2) g.scale(-1, 1); g.drawImage(t, -Math.min(bw, paso * .92) / 2, 0, Math.min(bw, paso * .92), bh * Math.min(1, paso * .92 / bw)); g.restore(); }
        g.restore();
        g.strokeStyle = pal[1]; g.lineWidth = .5 * k; g.strokeRect(x0 - 2 * k, y - 2.4 * k, x1 - x0 + 4 * k, bh + 4.8 * k);
        g.lineWidth = 1.2 * k; g.strokeRect(x0 - 3.4 * k, y - 3.8 * k, x1 - x0 + 6.8 * k, bh + 7.6 * k);
      }
      return { laminas: [l.id] };
    },
    async tipografica(g, D, pal, r, p) {
      const letra = ((p.titulo || 'F').trim()[0] || 'F').toUpperCase();
      await document.fonts.load('400 200px Fraktur').catch(() => {});
      const tam = D.fh * (1.0 + r() * .25);
      g.save(); g.beginPath(); g.rect(D.fx, D.fy - (D.sangrado || 0), D.fw + (D.sangrado || 0), D.fh + 2 * (D.sangrado || 0)); g.clip();
      g.fillStyle = pal[1]; g.font = `${tam}px Fraktur`; g.textBaseline = 'alphabetic';
      const m = g.measureText(letra);
      g.fillText(letra, D.fx + D.fw * (.55 - r() * .2) - m.width / 2, D.fy + D.fh * .82);
      g.restore();
      return { laminas: [] };
    },
    async detalle(g, D, pal, r, p) {
      const [l] = laminaPara(p, 'detalle', p.cubierta.semilla); const img = l && await cargarImg(ARCHIVO.src(l.id));
      if (!img) return { laminas: [] };
      const s = D.sangrado || 0, aw = D.fw + s, ah = D.fh + 2 * s, br = aw / ah;
      const f = .28 + r() * .22; let sw = img.naturalWidth * f, sh = sw / br; if (sh > img.naturalHeight * .9) { sh = img.naturalHeight * .6; sw = sh * br; }
      const sx = img.naturalWidth * .1 + r() * Math.max(0, img.naturalWidth * .8 - sw), sy = img.naturalHeight * .1 + r() * Math.max(0, img.naturalHeight * .8 - sh);
      const t = tintar(img, pal[1], [sx, sy, sw, sh]);
      g.imageSmoothingEnabled = false; g.drawImage(t, D.fx, D.fy - s, aw, ah); g.imageSmoothingEnabled = true;
      return { laminas: [l.id] };
    },
    async reticula(g, D, pal, r, p) {
      const ls = laminaPara(p, 'reticula', p.cubierta.semilla, 9); const k = D.k, ids = [];
      const m = 10 * k, top = D.fy + D.fh * .27, gw = D.fw - 2 * m, gh = D.fh - (top - D.fy) - m, cw = gw / 3, ch = gh / 3;
      g.strokeStyle = pal[1]; g.lineWidth = .5 * k;
      for (let i = 0; i < 9; i++) {
        const x = D.fx + m + (i % 3) * cw, y = top + Math.floor(i / 3) * ch; g.strokeRect(x, y, cw, ch);
        const l = ls[i]; if (!l) continue; const img = await cargarImg(ARCHIVO.src(l.id)); if (!img) continue; ids.push(l.id);
        const t = tintar(img, i === 4 ? pal[2] : pal[1]); const [w, h] = contener(t.width, t.height, cw * .82, ch * .82); g.drawImage(t, x + (cw - w) / 2, y + (ch - h) / 2, w, h);
      }
      return { laminas: ids };
    },
    async texto(g, D, pal, r, p) {
      const t = (p.titulo || 'Sin título').toUpperCase() + ' · ';
      await document.fonts.load('400 40px FMono').catch(() => {});
      const tam = D.fh / (14 + Math.floor(r() * 10)); g.font = `${tam}px FMono`; g.textBaseline = 'top';
      const linea = t.repeat(Math.ceil(D.W / g.measureText(t).width) + 2), destacada = Math.floor(r() * (D.H / tam));
      for (let i = 0, y = 0; y < D.H; i++, y += tam * 1.05) {
        g.fillStyle = i === destacada ? pal[2] : pal[1]; g.globalAlpha = i === destacada ? 1 : .18 + (i % 3) * .2;
        g.fillText(linea, -(i * tam * (1.7 + r() * .3)) % g.measureText(t).width, y);
      }
      g.globalAlpha = 1; return { laminas: [] };
    },
    async puntos(g, D, pal, r, p) {
      const t = (p.titulo || 'Folio').replace(/\s+/g, ''), k = D.k;
      for (let i = 0; i < 260; i++) { g.fillStyle = pal[1]; g.globalAlpha = .25 + r() * .5; g.beginPath(); g.arc(r() * D.W, r() * D.H, (.15 + r() * .35) * k, 0, 6.3); g.fill(); }
      g.globalAlpha = 1;
      const pts = [...t].map((c, i) => { const h = (c.codePointAt(0) * 2654435761 + i * 97) >>> 0; return [D.fx + D.fw * (.12 + ((h & 1023) / 1023) * .76), D.fy + D.fh * (.12 + (((h >>> 10) & 1023) / 1023) * .5), 1 + ((h >>> 20) & 3)]; });
      g.strokeStyle = pal[1]; g.lineWidth = .35 * k; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      for (const [x, y, s] of pts) { g.fillStyle = s > 2 ? pal[2] : pal[1]; g.beginPath(); g.arc(x, y, s * .8 * k, 0, 6.3); g.fill(); }
      return { laminas: [] };
    },
  };

  // ---------------- composición tipográfica por sistema ----------------
  function frenteHTML(p, c, gen) {
    const t = esc(p.titulo || 'Sin título'), a = esc(p.autor || ''), col = `${esc(c.nombre.toUpperCase())} · ${esc(p.numero || '')}`, sub = p.subtitulo ? `<div class="sub">${esc(p.subtitulo)}</div>` : '';
    switch (gen) {
      case 'grabado': return `<div class="col">${col}</div><div class="t">${t}</div>${sub}<div class="a">${a}</div>`;
      case 'teselacion': return `<div class="banda"><div class="col">${col}</div><div class="t">${t}</div><div class="a">${a}</div></div>`;
      case 'foto': return `<div class="ficha"><div>N.º ${esc(p.numero || '')} — ${esc(c.nombre)}</div><div class="t">${t}</div>${sub}<div class="a">${a}</div><div class="s">${esc(p.sello || '')}</div></div>`;
      case 'campos': return `<div class="pie"><div class="t">${t}</div><div class="a">${a}</div><div class="col">${col}</div></div>`;
      case 'cenefas': return `<div class="centro"><div class="a">${a}</div><div class="t">${t}</div>${sub}<div class="col">${col}</div></div>`;
      case 'tipografica': return `<div class="col">${col}</div><div class="bloque"><div class="t">${t}</div><div class="a">${a}</div></div>`;
      case 'detalle': return `<div class="caja"><div class="t">${t}</div><div class="a">${a}</div></div><div class="col">${col}</div>`;
      case 'reticula': return `<div class="cab"><div class="t">${t}</div><div class="a">${a}</div><div class="col">${col}</div></div>`;
      case 'texto': return `<div class="caja"><div class="t">${t}</div><div class="a">${a}</div><div class="col">${col}</div></div>`;
      case 'puntos': return `<div class="pie"><div class="col">${col}</div><div class="t">${t}</div><div class="a">${a}</div></div>`;
    }
    return '';
  }
  function cssSistema(gen, f, k) {
    const T = `font-family:${f};font-weight:400;`;
    const comun = `.cub{position:relative;overflow:hidden;background:var(--fondo);color:var(--tinta)}.cub>img.arte{position:absolute;left:0;top:0;width:100%;height:100%}
.frente{position:absolute;display:flex;flex-direction:column}.frente>*{position:relative}
.frente .t{${T}line-height:1.05;hyphens:none;overflow-wrap:break-word}`;
    const s = {
      grabado: `.frente{padding:13mm 13mm 12mm;text-align:center}.frente .col{font-family:FellSC,Fell;letter-spacing:.14em;font-size:8pt;border-bottom:.5pt solid var(--tinta);padding-bottom:2mm}.frente .t{font-family:Fell;font-size:calc(25pt * var(--esc));margin-top:5mm}.frente .sub{font-family:Fell;font-style:italic;font-size:10pt;margin-top:2mm}.frente .a{margin-top:auto;font-family:Fell;font-style:italic;font-size:11pt;border-top:.5pt solid var(--tinta);padding-top:2mm}`,
      teselacion: `.frente{justify-content:flex-end;padding:0 0 22mm}.banda{background:var(--acento);color:var(--tinta);padding:6mm 9mm 7mm;margin:0 -1px}.banda .col{font-family:FGothic;font-size:7pt;letter-spacing:.2em}.banda .t{${T}text-transform:uppercase;font-size:calc(22pt * var(--esc));letter-spacing:.02em;margin:2mm 0}.banda .a{font-family:FPalatino;font-style:italic;font-size:10pt}`,
      foto: `.frente{justify-content:flex-end;padding:0 10mm 10mm}.ficha{font-family:FMono;font-size:8pt;line-height:1.35;border-top:1.2pt solid var(--tinta);padding-top:3mm}.ficha .t{font-family:FMono;font-size:calc(17pt * var(--esc));text-transform:uppercase;margin:2mm 0;line-height:1.1}.ficha .a{font-size:10pt}.ficha .s{margin-top:3mm;opacity:.7}`,
      campos: `.frente{justify-content:flex-end;padding:0 9mm 10mm}.pie .t{${T}font-weight:700;font-size:calc(26pt * var(--esc));letter-spacing:-.01em;line-height:1}.pie .a{font-family:FSans;font-size:10pt;margin-top:2.5mm}.pie .col{font-family:FSans;font-size:6.5pt;letter-spacing:.18em;margin-top:5mm}`,
      cenefas: `.frente{justify-content:center;padding:0 16mm;text-align:center}.centro .a{font-family:FBookman;font-size:9pt;letter-spacing:.16em;text-transform:uppercase}.centro .t{font-family:FBookman;font-size:calc(22pt * var(--esc));margin:5mm 0 3mm}.centro .sub{font-family:FBookman;font-style:italic;font-size:9.5pt}.centro .col{font-family:FBookman;font-size:7pt;letter-spacing:.2em;margin-top:6mm;color:var(--acento)}`,
      tipografica: `.frente{padding:11mm 10mm}.frente .col{font-family:FSchool;font-size:7.5pt;letter-spacing:.2em}.bloque{margin-top:auto;align-self:flex-end;text-align:right;max-width:70%}.bloque .t{font-family:FSchool;font-style:italic;font-size:calc(19pt * var(--esc));color:var(--acento)}.bloque .a{font-family:FSchool;font-size:10pt;margin-top:2mm}`,
      detalle: `.frente{padding:0 0 12mm;justify-content:flex-end}.caja{background:var(--fondo);margin-right:22%;padding:5mm 7mm 6mm 9mm;border-top:1.4pt solid var(--tinta)}.caja .t{${T}font-size:calc(20pt * var(--esc));text-transform:uppercase;letter-spacing:.01em}.caja .a{font-family:FNarrow;font-size:10pt;margin-top:2mm}.frente>.col{position:absolute;top:8mm;right:8mm;background:var(--fondo);font-family:FNarrow;font-size:7pt;letter-spacing:.18em;padding:1.2mm 2mm}`,
      reticula: `.frente{padding:10mm 10mm 0}.cab .t{font-family:FPalatino;font-size:calc(19pt * var(--esc));color:var(--acento)}.cab .a{font-family:FPalatino;font-style:italic;font-size:10pt;margin-top:1.5mm}.cab .col{font-family:FSchool;font-size:6.5pt;letter-spacing:.2em;margin-top:2mm}`,
      texto: `.frente{justify-content:center;align-items:flex-start;padding:0 9mm}.caja{background:var(--fondo);border:1.2pt solid var(--tinta);padding:5mm 6mm}.caja .t{font-family:FMono;font-size:calc(17pt * var(--esc));text-transform:uppercase}.caja .a{font-family:FMono;font-size:9pt;margin-top:2mm}.caja .col{font-family:FMono;font-size:7pt;margin-top:3mm;color:var(--acento)}`,
      puntos: `.frente{justify-content:flex-end;padding:0 10mm 11mm}.pie .col{font-family:FNarrow;font-size:7pt;letter-spacing:.24em;color:var(--acento)}.pie .t{${T}font-size:calc(24pt * var(--esc));margin:2mm 0;line-height:1}.pie .a{font-family:FSans;font-size:9.5pt}`,
    };
    return comun + (s[gen] || '') + `
.lomo{position:absolute;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;font-size:7.5pt;gap:4mm;white-space:nowrap;overflow:hidden}
.lomo b{font-weight:400;font-family:${f}}
.contra{position:absolute;display:flex;flex-direction:column;padding:14mm 12mm 12mm}
.contra .texto{font-family:${f === 'FMono' ? 'FMono' : 'FPalatino'};font-size:9.5pt;line-height:1.45;white-space:pre-line;background:var(--fondo);padding:2mm}
.contra .base{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:6mm}
.contra .base small{font-size:7pt;letter-spacing:.12em;text-transform:uppercase;background:var(--fondo);padding:1mm}
.contra .isbn{background:#fff;padding:1.5mm;width:38mm}
.contra .isbn img{width:100%;display:block}`;
  }

  // calcula medidas (mm) de la cubierta
  function medidas(p, modo, paginas, sangrado) {
    const [W, H] = Folio.FORMATOS[p.formato] || Folio.FORMATOS.A5;
    const s = modo === 'extendida' ? sangrado : 0;
    const lomo = modo === 'extendida' ? Math.max(2, Math.round((Math.ceil((paginas || 48) / 2) * (p.impresion.grosorHoja || 0.1) + 0.6) * 10) / 10) : 0;
    const total = modo === 'extendida' ? [s + W + lomo + W + s, H + 2 * s] : [W, H];
    return { W, H, s, lomo, total };
  }

  function codigoISBN(isbn) {
    const d = String(isbn || '').replace(/[^0-9Xx]/g, '');
    if (d.length !== 13) return null;
    const suma = [...d.slice(0, 12)].reduce((a, c, i) => a + (+c) * (i % 2 ? 3 : 1), 0);
    if ((10 - suma % 10) % 10 !== +d[12]) return { error: 'El dígito de control del ISBN no coincide.' };
    try {
      const c = document.createElement('canvas');
      Herramientas.bwipjs.toCanvas(c, { bcid: 'isbn', text: `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}-${d[12]}`, scale: 4, includetext: true, textxalign: 'center', guardwhitespace: true });
      return { src: c.toDataURL('image/png') };
    } catch (e) { return { error: 'No se pudo generar el código: ' + e.message }; }
  }

  // HTML + CSS completos (para la vista y para el PDF)
  async function imprimible(p, opt = {}) {
    const modo = opt.modo || 'frente', k = opt.k || 11.811; // px por mm (11,81 = 300 ppp)
    const c = Folio.COLECCIONES.find(x => x.id === p.coleccion) || Folio.COLECCIONES[0];
    const gen = c.generador, pal = c.paletas[p.cubierta.paleta % c.paletas.length];
    const M = medidas(p, modo, opt.paginas, opt.sangrado ?? 3);
    const fx = modo === 'extendida' ? M.s + M.W + M.lomo : 0, fy = M.s;
    const cv = document.createElement('canvas'); cv.width = Math.round(M.total[0] * k); cv.height = Math.round(M.total[1] * k);
    const g = cv.getContext('2d'); g.fillStyle = pal[0]; g.fillRect(0, 0, cv.width, cv.height);
    const r = ARCHIVO.azar(p.cubierta.semilla * 7919 + c.id.length);
    const D = { W: cv.width, H: cv.height, fx: fx * k, fy: fy * k, fw: M.W * k, fh: M.H * k, k, sangrado: M.s * k };
    let info = { laminas: [] };
    try { info = await GEN[gen](g, D, pal, r, p, opt) || info; } catch (e) { console.error(e); }
    const arte = cv.toDataURL('image/png');
    const fT = { Fell: 'Fell', FGothic: 'FGothic', FMono: 'FMono', FSans: 'FSans', FBookman: 'FBookman', Fraktur: 'Fraktur', FNarrow: 'FNarrow', FPalatino: 'FPalatino' }[p.ajustes.fuenteTitulos || c.titulos] || c.titulos;
    let html = `<div class="cub cub-${gen}" style="--fondo:${pal[0]};--tinta:${pal[1]};--acento:${pal[2]};--esc:${p.cubierta.escalaTitulo || 1};width:${M.total[0]}mm;height:${M.total[1]}mm"><img class="arte" src="${arte}" alt="">`;
    html += `<div class="frente" style="left:${fx}mm;top:${fy}mm;width:${M.W}mm;height:${M.H}mm">${frenteHTML(p, c, gen)}</div>`;
    let avisos = [];
    if (modo === 'extendida') {
      html += `<div class="lomo" style="left:${M.s + M.W}mm;top:${fy}mm;width:${M.lomo}mm;height:${M.H}mm">${M.lomo >= 5 ? `<b>${esc(p.titulo)}</b><span>${esc(p.autor)}</span><span>${esc(c.nombre)} ${esc(p.numero)}</span>` : ''}</div>`;
      const cod = p.isbn ? codigoISBN(p.isbn) : null;
      if (cod && cod.error) avisos.push(cod.error);
      if (M.lomo < 5) avisos.push('El lomo mide menos de 5 mm: no lleva texto.');
      html += `<div class="contra" style="left:${M.s}mm;top:${fy}mm;width:${M.W}mm;height:${M.H}mm"><div class="texto">${esc(p.contracubierta)}</div><div class="base"><small>${esc(p.sello || '')}${p.sello ? ' · ' : ''}${esc(c.nombre)}</small>${cod && cod.src ? `<div class="isbn"><img src="${cod.src}" alt="ISBN ${esc(p.isbn)}"></div>` : ''}</div></div>`;
    }
    html += `</div>`;
    const css = `@page{size:${M.total[0]}mm ${M.total[1]}mm;margin:0}html,body{margin:0}` + cssSistema(gen, fT, k);
    return { html, css, mm: M.total, medidas: M, laminas: info.laminas, avisos };
  }

  window.Cubiertas = { imprimible, medidas, codigoISBN, tintar, cargarImg, GEN };
})();
