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


  function mezclar(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

  // versión suave para ampliar: interpola y vuelve a entintar con borde antialias (no se ven los píxeles)
  function tintarSuave(img, color, recorte, ow, oh) {
    const [sx, sy, sw, sh] = recorte;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(ow)); c.height = Math.max(1, Math.round(oh));
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    // dos pasos de ampliación con desenfoque leve: los escalones del 1 bit se vuelven curvas
    const m = document.createElement('canvas'); const k1 = Math.min(4, ow / sw); m.width = Math.max(1, Math.round(sw * k1)); m.height = Math.max(1, Math.round(sh * k1));
    const mg = m.getContext('2d'); mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high'; mg.filter = `blur(${Math.max(.5, k1 * .35)}px)`; mg.drawImage(img, sx, sy, sw, sh, 0, 0, m.width, m.height);
    g.filter = 'blur(.6px)'; g.drawImage(m, 0, 0, c.width, c.height); g.filter = 'none';
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data, [r, gg, b] = rgb(color);
    for (let i = 0; i < a.length; i += 4) { const l = a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11; a[i] = r; a[i + 1] = gg; a[i + 2] = b; a[i + 3] = Math.max(0, Math.min(255, (150 - l) * 6 + 128)); }
    g.putImageData(d, 0, 0); return c;
  }

  // lámina elegida (o sorteada con la semilla). Para tapas solo se usan láminas limpias (sin cortes ni bordes de papel).
  let recActual = {};
  const srcDe = l => l.src || ARCHIVO.src(l.id);
  function laminaPara(p, gen, sem, n = 1) {
    if (!window.ARCHIVO || !ARCHIVO.listo) return [];
    // imagen propia (agregada al proyecto)
    if (p.cubierta.imagen && String(p.cubierta.imagen).startsWith('recurso:')) { const nombre = p.cubierta.imagen.slice(8), d = p.cubierta.imagenDims || [1000, 1000]; if (recActual[nombre]) { const l = { id: p.cubierta.imagen, src: recActual[nombre], w: d[0], h: d[1], q: 1, tipo: 'figura', propia: true }; if (gen !== 'reticula') return [l]; } }
    const elegida = p.cubierta.imagen && ARCHIVO.porId[p.cubierta.imagen];
    if (gen === 'reticula') {
      const hierba = l => l.hb && l.q !== undefined ? true : !!l.hb;
      const base = elegida && elegida.hb ? elegida : ARCHIVO.elegir(hierba, sem, 1)[0];
      if (!base) return [];
      return [base, ...ARCHIVO.elegir(l => l.id !== base.id && l.hb, sem + 7, n - 1)];
    }
    if (elegida && n === 1) return [elegida];
    const filtro = {
      detalle: l => l.q && l.w >= 500 && l.h >= 400,
      teselacion: l => l.q && l.tipo === 'figura' && Math.min(l.w, l.h) >= 300,
      cenefas: l => l.q && l.tipo === 'figura' && l.w >= 200,
      umbral: l => l.q && l.tipo === 'figura' && !l.hb,
    }[gen] || (l => l.q && l.tipo === 'figura' && l.w > 260 && l.h > 260);
    return ARCHIVO.elegir(filtro, sem, n);
  }
  // recorte del fragmento: centro (x,y) en 0..1 y acercamiento z (1 = ancho completo)
  function recorteFragmento(l, p, r, aspecto) {
    const rc = p.cubierta.recorte || { x: .3 + r() * .4, y: .3 + r() * .4, z: 2.4 + r() * 1.4 };
    const z = Math.max(1, Math.min(Fragmento.zMax(l), rc.z));
    let sw = l.w / z, sh = sw / aspecto; if (sh > l.h) { sh = l.h; sw = sh * aspecto; }
    const sx = Math.max(0, Math.min(l.w - sw, rc.x * l.w - sw / 2)), sy = Math.max(0, Math.min(l.h - sh, rc.y * l.h - sh / 2));
    return { caja: [sx, sy, sw, sh], rc: { x: rc.x, y: rc.y, z } };
  }
  // el máximo acercamiento: que el recorte tenga al menos ~260 px de ancho (más se vería blando)
  const Fragmento = { zMax: l => Math.max(1, Math.min(6, l.w / 260)) };

  // ---------------- generadores ----------------
  // g: contexto; D: {W,H,fx,fy,fw,fh (frente), k: px por mm}; pal: [fondo,tinta,acento]; r(): azar con semilla
  const GEN = {
    async grabado(g, D, pal, r, p) {
      const [l] = laminaPara(p, 'grabado', p.cubierta.semilla); const img = l && await cargarImg(srcDe(l));
      const k = D.k;
      g.strokeStyle = pal[1]; g.lineWidth = .5 * k; g.strokeRect(D.fx + 6 * k, D.fy + 6 * k, D.fw - 12 * k, D.fh - 12 * k);
      g.lineWidth = 1.4 * k; g.strokeRect(D.fx + 7.6 * k, D.fy + 7.6 * k, D.fw - 15.2 * k, D.fh - 15.2 * k);
      if (img) { const t = tintar(img, pal[1]); const [w, h] = contener(t.width, t.height, D.fw * .72, D.fh * .5 * p.cubierta.escalaImagen || D.fh * .5); g.drawImage(t, D.fx + (D.fw - w) / 2, D.fy + D.fh * .3 + (D.fh * .5 - h) / 2, w, h); }
      return { laminas: l ? [l.id] : [] };
    },
    async teselacion(g, D, pal, r, p) {
      // caleidoscopio de ocho espejos (simetría p4m): una cuña triangular del grabado se refleja hasta formar la pieza
      const [l] = laminaPara(p, 'teselacion', p.cubierta.semilla); const img = l && await cargarImg(srcDe(l));
      if (!img) return { laminas: [] };
      const lado = Math.min(img.naturalWidth, img.naturalHeight) * (0.32 + r() * 0.3);
      const sx = img.naturalWidth * .1 + r() * Math.max(0, img.naturalWidth * .8 - lado), sy = img.naturalHeight * .1 + r() * Math.max(0, img.naturalHeight * .8 - lado);
      const piezas = 4 + Math.floor(r() * 4);               // piezas a lo ancho del frente
      const S = Math.round(D.fw / piezas), h = Math.round(S / 2);
      const t = tintarSuave(img, pal[1], [sx, sy, lado, lado], h, h);
      const q = document.createElement('canvas'); q.width = q.height = h; const qg = q.getContext('2d');
      const tri = () => { qg.beginPath(); qg.moveTo(0, 0); qg.lineTo(h, 0); qg.lineTo(h, h); qg.closePath(); };
      qg.save(); tri(); qg.clip(); qg.drawImage(t, 0, 0); qg.restore();
      qg.save(); qg.setTransform(0, 1, 1, 0, 0, 0); tri(); qg.clip(); qg.drawImage(t, 0, 0); qg.restore();
      const m = document.createElement('canvas'); m.width = m.height = S; const mg = m.getContext('2d');
      for (const [ax, ay] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { mg.save(); mg.translate(ax < 0 ? S : 0, ay < 0 ? S : 0); mg.scale(ax, ay); mg.drawImage(q, 0, 0); mg.restore(); }
      // trama de rombos opcional: piezas alternadas giradas 45°
      const pat = g.createPattern(m, 'repeat'); g.save(); g.translate(D.fx + D.fw / 2 - S / 2, 0); g.fillStyle = pat; g.fillRect(-D.fx - D.fw, -S, D.W * 2 + S * 2, D.H + 2 * S); g.restore();
      return { laminas: [l.id] };
    },
    async foto(g, D, pal, r, p, opt) {
      const src = p.cubierta.foto && opt.recursos && opt.recursos[p.cubierta.foto];
      let img = src ? await cargarImg(src) : null, ids = [];
      if (!img) { const [l] = laminaPara(p, 'foto', p.cubierta.semilla); img = l && await cargarImg(srcDe(l)); if (l) ids = [l.id]; }
      if (!img) return { laminas: [] };
      // en la tapa extendida la trama corre por contra, lomo y frente
      const s = D.sangrado || 0, ext = D.W > D.fw + 2 * s + 2;
      const ax = ext ? 0 : D.fx, ay = 0, aw = ext ? D.W : D.fw + s, ah = D.fh * .66 + s;
      const src2 = document.createElement('canvas'); src2.width = 320; src2.height = Math.round(320 * ah / aw);
      const sg = src2.getContext('2d'); const ar = img.naturalWidth / img.naturalHeight, br = aw / ah;
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0; if (ar > br) { sw = sh * br; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / br; sy = (img.naturalHeight - sh) / 2; }
      sg.fillStyle = '#fff'; sg.fillRect(0, 0, src2.width, src2.height); sg.drawImage(img, sx, sy, sw, sh, 0, 0, src2.width, src2.height);
      const px = sg.getImageData(0, 0, src2.width, src2.height).data;
      const paso = D.fw / (55 + r() * 25), ang = Math.PI / 4;
      g.save(); g.beginPath(); g.rect(ax, ay, aw, ah); g.clip(); g.fillStyle = pal[2]; g.fillRect(ax, ay, aw, ah); g.fillStyle = pal[1];
      const cx = ax + aw / 2, cy = ay + ah / 2, R = Math.hypot(aw, ah) / 2 + paso;
      for (let u = -R; u < R; u += paso) for (let v = -R; v < R; v += paso) {
        const x = cx + u * Math.cos(ang) - v * Math.sin(ang), y = cy + u * Math.sin(ang) + v * Math.cos(ang);
        if (x < ax - paso || y < ay - paso || x > ax + aw + paso || y > ay + ah + paso) continue;
        const ix = Math.min(src2.width - 1, Math.max(0, ((x - ax) / aw * src2.width) | 0)), iy = Math.min(src2.height - 1, Math.max(0, ((y - ay) / ah * src2.height) | 0));
        const o = (iy * src2.width + ix) * 4, lu = (px[o] * .3 + px[o + 1] * .59 + px[o + 2] * .11) / 255;
        const rad = paso * .62 * Math.sqrt(1 - lu); if (rad > .3) { g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill(); }
      }
      g.restore();
      // filete bajo la trama
      g.fillStyle = pal[1]; g.fillRect(ax, ay + ah, aw, Math.max(1, .8 * D.k));
      return { laminas: ids };
    },
    async umbral(g, D, pal, r, p) {
      // composición de formas planas con el área de texto arriba (estilo editorial contemporáneo)
      const k = D.k, s = D.sangrado || 0, x0 = D.fx, x1 = D.fx + D.fw + s, y1 = D.fy + D.fh + s, top = D.fy + D.fh * .40, w = x1 - x0, h = y1 - top;
      const c1 = pal[1], c2 = pal[2], c3 = mezclar(pal[0], '#ffffff', .55);
      const plantilla = Math.floor(r() * 4);
      let forma = null; // ruta donde puede ir el grabado
      g.save(); g.beginPath(); g.rect(x0, D.fy - s, w, D.fh + 2 * s); g.clip();
      if (plantilla === 0) { // arco: una puerta
        const aw = w * (.46 + r() * .18), ax = x0 + (w - aw) * (.15 + r() * .7), ay = top + h * .08;
        g.fillStyle = c1; g.fillRect(x0, y1 - h * .22, w, h * .22 + s);
        forma = new Path2D(); forma.moveTo(ax, y1 + s); forma.lineTo(ax, ay + aw / 2); forma.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); forma.lineTo(ax + aw, y1 + s); forma.closePath();
        g.fillStyle = c2; g.fill(forma);
      } else if (plantilla === 1) { // sol y horizonte
        const R = w * (.28 + r() * .14), cx = x0 + w * (.25 + r() * .5), cy = top + h * .42;
        g.fillStyle = c1; g.fillRect(x0, top + h * .5, w, h * .5 + s);
        forma = new Path2D(); forma.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = c2; g.fill(forma);
        g.fillStyle = c3; g.fillRect(x0, top + h * .5 + R * .25, w, Math.max(2, 2.2 * k));
      } else if (plantilla === 2) { // escalones
        const n = 3 + Math.floor(r() * 3), paso = w / n, alto = h / (n + 1);
        for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(x0 + i * paso, y1 - alto * (i + 1), paso + 1, alto * (i + 1) + s); }
        forma = new Path2D(); const R = paso * .8; forma.arc(x0 + paso * (n - .5), y1 - alto * (n + .2) - R * .2, R * .5, 0, Math.PI * 2); g.fillStyle = c3; g.fill(forma);
      } else { // cuartos de círculo
        const R = Math.min(w, h) / 2;
        const cuartos = [[x0, top, 0], [x0 + w, top, Math.PI / 2], [x0 + w, y1, Math.PI], [x0, y1, Math.PI * 1.5]];
        cuartos.forEach(([cx, cy, a0], i) => { const pth = new Path2D(); pth.moveTo(cx, cy); pth.arc(cx, cy, R * (i % 2 ? .9 : 1.05), a0, a0 + Math.PI / 2); pth.closePath(); g.fillStyle = [c1, c2, c3, c1][i]; g.fill(pth); if (i === 0) forma = pth; });
      }
      // grabado recortado dentro de la forma (la mitad de las veces)
      let ids = [];
      if (forma && r() < .6) {
        const [l] = laminaPara(p, 'umbral', p.cubierta.semilla); const img = l && await cargarImg(srcDe(l));
        if (img) { ids = [l.id]; g.save(); g.clip(forma); const t = tintar(img, pal[0]); const [iw, ih] = contener(t.width, t.height, w * .55, h * .62); g.drawImage(t, x0 + (w - iw) / 2 + (r() - .5) * w * .2, top + h - ih - h * .06, iw, ih); g.restore(); }
      }
      g.restore();
      return { laminas: ids };
    },
    async cenefas(g, D, pal, r, p) {
      // friso: una figura del archivo repetida en banda, alternando su sentido, arriba y abajo
      const [l] = laminaPara(p, 'cenefas', p.cubierta.semilla);
      const img = l && await cargarImg(srcDe(l)); if (!img) return { laminas: [] };
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
    async detalle(g, D, pal, r, p) {
      const [l] = laminaPara(p, 'detalle', p.cubierta.semilla); const img = l && await cargarImg(srcDe(l));
      if (!img) return { laminas: [] };
      const s = D.sangrado || 0, aw = D.fw + s, ah = D.fh + 2 * s;
      const { caja, rc } = recorteFragmento(l, p, r, aw / ah);
      const t = tintarSuave(img, pal[1], caja, aw, ah);
      g.drawImage(t, D.fx, D.fy - s, aw, ah);
      return { laminas: [l.id], recorte: rc };
    },
    async reticula(g, D, pal, r, p) {
      const ls = laminaPara(p, 'reticula', p.cubierta.semilla, 9); const k = D.k, ids = [];
      const m = 10 * k, top = D.fy + D.fh * .27, gw = D.fw - 2 * m, gh = D.fh - (top - D.fy) - m, cw = gw / 3, ch = gh / 3;
      g.strokeStyle = pal[1]; g.lineWidth = .5 * k;
      for (let i = 0; i < 9; i++) {
        const x = D.fx + m + (i % 3) * cw, y = top + Math.floor(i / 3) * ch; g.strokeRect(x, y, cw, ch);
        const l = ls[i]; if (!l) continue; const img = await cargarImg(srcDe(l)); if (!img) continue; ids.push(l.id);
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
      case 'umbral': return `<div class="cabeza"><div class="a">${a}</div><div class="t">${t}</div>${sub}</div><div class="col">${col}</div>`;
      case 'cenefas': return `<div class="centro"><div class="a">${a}</div><div class="t">${t}</div>${sub}<div class="col">${col}</div></div>`;
      case 'detalle': return `<div class="caja"><div class="t">${t}</div><div class="a">${a}</div></div><div class="col">${col}</div>`;
      case 'reticula': return `<div class="cab"><div class="t">${t}</div><div class="a">${a}</div><div class="col">${col}</div></div>`;
      case 'texto': return `<div class="caja"><div class="t">${t}</div><div class="a">${a}</div><div class="col">${col}</div></div>`;
      case 'puntos': return `<div class="pie"><div class="col">${col}</div><div class="t">${t}</div><div class="a">${a}</div></div>`;
    }
    return '';
  }
  function cssSistema(gen, f, k) {
    const T = `font-family:${f};font-weight:400;`;
    const comun = `.cub,.cub *{box-sizing:border-box}.cub{position:relative;overflow:hidden;background:var(--fondo);color:var(--tinta)}.cub>img.arte{position:absolute;left:0;top:0;width:100%;height:100%}
.frente{position:absolute;display:flex;flex-direction:column}.frente>*{position:relative}
.frente .t{${T}line-height:1.05;hyphens:none;overflow-wrap:break-word}`;
    const s = {
      grabado: `.frente{padding:13mm 13mm 12mm;text-align:center}.frente .col{font-family:FellSC,Fell;letter-spacing:.14em;font-size:8pt;border-bottom:.5pt solid var(--tinta);padding-bottom:2mm}.frente .t{font-family:Fell;font-size:calc(25pt * var(--esc));margin-top:5mm}.frente .sub{font-family:Fell;font-style:italic;font-size:10pt;margin-top:2mm}.frente .a{margin-top:auto;font-family:Fell;font-style:italic;font-size:11pt;border-top:.5pt solid var(--tinta);padding-top:2mm}`,
      teselacion: `.frente{justify-content:flex-end;padding:0 0 22mm}.banda{background:var(--acento);color:var(--tinta);padding:6mm 9mm 7mm;margin:0 -1px}.banda .col{font-family:FGothic;font-size:7pt;letter-spacing:.2em}.banda .t{${T}text-transform:uppercase;font-size:calc(22pt * var(--esc));letter-spacing:.02em;margin:2mm 0}.banda .a{font-family:FPalatino;font-style:italic;font-size:10pt}`,
      foto: `.frente{justify-content:flex-end;padding:0 10mm 10mm}.ficha{font-family:FMono;font-size:8pt;line-height:1.35;border-top:1.2pt solid var(--tinta);padding-top:3mm}.ficha .t{font-family:FMono;font-size:calc(17pt * var(--esc));text-transform:uppercase;margin:2mm 0;line-height:1.1}.ficha .a{font-size:10pt}.ficha .s{margin-top:3mm;opacity:.7}`,
      umbral: `.frente{padding:11mm 10mm 9mm}.cabeza .a{font-family:FSans;font-size:10.5pt;margin-bottom:2.5mm;color:var(--tinta)}.cabeza .t{font-family:FSans;font-weight:700;font-size:calc(30pt * var(--esc));letter-spacing:-.02em;line-height:.98;color:var(--tinta)}.cabeza .sub{font-family:FSans;font-size:10pt;margin-top:2mm}.frente>.col{position:absolute;right:9mm;bottom:8mm;font-family:FSans;font-weight:700;font-size:7pt;letter-spacing:.2em;background:var(--fondo);padding:1mm 2mm}`,
      cenefas: `.frente{justify-content:center;padding:0 16mm;text-align:center}.centro .a{font-family:FBookman;font-size:9pt;letter-spacing:.16em;text-transform:uppercase}.centro .t{font-family:FBookman;font-size:calc(22pt * var(--esc));margin:5mm 0 3mm}.centro .sub{font-family:FBookman;font-style:italic;font-size:9.5pt}.centro .col{font-family:FBookman;font-size:7pt;letter-spacing:.2em;margin-top:6mm;color:var(--acento)}`,
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
.contra .logo{height:11mm;width:auto;display:block}
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
    const gen = c.generador, pal = (p.cubierta.colores && p.cubierta.colores.length === 3) ? p.cubierta.colores : c.paletas[(p.cubierta.paleta || 0) % c.paletas.length];
    recActual = opt.recursos || {};
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
      html += `<div class="contra" style="left:${M.s}mm;top:${fy}mm;width:${M.W}mm;height:${M.H}mm"><div class="texto">${esc(p.contracubierta)}</div><div class="base">${opt.logo ? `<img class="logo" src="${opt.logo}" alt="">` : ''}<small>${esc(p.sello || '')}${p.sello ? ' · ' : ''}${esc(c.nombre)}</small>${cod && cod.src ? `<div class="isbn"><img src="${cod.src}" alt="ISBN ${esc(p.isbn)}"></div>` : ''}</div></div>`;
    }
    html += `</div>`;
    const css = `@page{size:${M.total[0]}mm ${M.total[1]}mm;margin:0}html,body{margin:0}` + cssSistema(gen, fT, k);
    return { html, css, mm: M.total, medidas: M, laminas: info.laminas, recorte: info.recorte, avisos, paleta: pal };
  }

  window.Cubiertas = { imprimible, medidas, codigoISBN, tintar, tintarSuave, cargarImg, GEN, Fragmento };
})();
