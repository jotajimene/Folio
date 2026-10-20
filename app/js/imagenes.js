/* Folio · tus imágenes: agregarlas al libro o a la tapa, tal cual o convertidas en grabado, semitono o línea */
(function () {
  'use strict';
  const { esc } = App;
  const cargar = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  // tratamientos: todo en canvas, sin red
  function tratar(img, modo, fuerza = 0.5, max = 2400) {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    if (modo === 'original') return c;
    const d = g.getImageData(0, 0, w, h), a = d.data, L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) L[i] = a[4 * i] * .3 + a[4 * i + 1] * .59 + a[4 * i + 2] * .11;
    const out = new Uint8ClampedArray(w * h);
    if (modo === 'gris') { for (let i = 0; i < w * h; i++) out[i] = L[i]; }
    else if (modo === 'grabado') {
      // umbral adaptativo con imagen integral (como el archivo) + trama de líneas en los medios tonos
      const I = new Float64Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) { s += L[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + s; } }
      const r = Math.max(6, Math.round(Math.min(w, h) / 40)), kk = 0.78 + fuerza * 0.2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r);
        const m = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        const v = L[y * w + x]; let negro = v < m * kk;
        if (!negro && v < 150 + fuerza * 60) { const linea = ((x + y) % Math.max(3, Math.round(4 + (v / 255) * 6))) === 0; negro = linea && v < 200; }
        out[y * w + x] = negro ? 0 : 255;
      }
    } else if (modo === 'semitono') {
      const paso = Math.max(4, Math.round(Math.min(w, h) / (60 + fuerza * 80)));
      out.fill(255);
      const g2 = document.createElement('canvas'); g2.width = w; g2.height = h; const x2 = g2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, w, h); x2.fillStyle = '#000';
      for (let y = 0; y < h; y += paso) for (let x = 0; x < w; x += paso) { const v = L[Math.min(h - 1, y + (paso >> 1)) * w + Math.min(w - 1, x + (paso >> 1))] / 255; const rad = paso * .6 * Math.sqrt(1 - v); if (rad > .3) { x2.beginPath(); x2.arc(x + paso / 2, y + paso / 2, rad, 0, 6.3); x2.fill(); } }
      return g2;
    } else if (modo === 'linea') {
      // bordes (Sobel) a tinta, como dibujo a pluma
      const um = 40 + (1 - fuerza) * 120;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const p = (dx, dy) => L[(y + dy) * w + x + dx];
        const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1), gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
        out[y * w + x] = Math.hypot(gx, gy) > um ? 0 : 255;
      }
    }
    for (let i = 0; i < w * h; i++) { a[4 * i] = a[4 * i + 1] = a[4 * i + 2] = out[i]; a[4 * i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  }

  // ventana: eliges tratamiento con vista previa; devuelve el nombre del recurso guardado en el proyecto
  async function agregar({ titulo = 'Agregar tu imagen', archivo } = {}) {
    const f = archivo || await new Promise(res => { const inp = document.getElementById('entrada-imagen'); inp.value = ''; inp.accept = '.png,.jpg,.jpeg,.webp'; inp.onchange = () => res(inp.files[0] || null); inp.click(); });
    if (!f) return null;
    const src = await App.leerDataURL(f); let img = await cargar(src);
    let modo = 'original', fuerza = 0.5;
    const r = await App.modal({
      titulo, ancho: 760,
      cuerpo: `<div class="tratamientos"><div class="previa-trat"><canvas></canvas></div><div><div class="sub">Tratamiento</div>${[['original', 'Tal cual'], ['grabado', 'Grabado (tinta)'], ['semitono', 'Semitono'], ['linea', 'Línea']].map(([k, v]) => `<label class="chequeo"><input type="radio" name="trat" value="${k}" ${k === 'original' ? 'checked' : ''}> ${v}</label>`).join('')}<label class="ajuste"><span>Intensidad</span><input type="range" min="0" max="1" step="0.05" value="0.5" class="fuerza"></label><p class="nota tam">${esc(f.name)} · ${img.naturalWidth}×${img.naturalHeight} px. Queda guardada dentro del proyecto.</p>${window.Escritorio && Escritorio.herr ? '<button class="boton chico" data-ampliar title="Real-ESRGAN, en este computador: para fotos chicas que se verían borrosas impresas">Ampliar ×4 sin perder nitidez</button>' : ''}</div></div>`,
      botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Usar esta imagen', taco: true, valor: 'ok' }],
      alAbrir: m => {
        const cv = m.querySelector('canvas');
        const pintar = () => { const t = tratar(img, modo, fuerza, 700); cv.width = t.width; cv.height = t.height; cv.getContext('2d').drawImage(t, 0, 0); };
        m.addEventListener('change', e => { if (e.target.name === 'trat') { modo = e.target.value; pintar(); } });
        m.addEventListener('input', e => { if (e.target.classList.contains('fuerza')) { fuerza = +e.target.value; pintar(); } });
        m.addEventListener('click', async e => { const b = e.target.closest('[data-ampliar]'); if (!b) return; b.disabled = true; b.textContent = 'Ampliando…'; try { const u = await HerrLocal.ampliar(img.src); if (u) { img = await cargar(u); m.querySelector('.tam').textContent = `${f.name} · ampliada a ${img.naturalWidth}×${img.naturalHeight} px.`; pintar(); b.textContent = 'Ampliada'; } else { b.disabled = false; b.textContent = 'Ampliar ×4 sin perder nitidez'; } } catch (err) { App.aviso('No se pudo ampliar: ' + err.message, { tipo: 'mal' }); b.disabled = false; b.textContent = 'Ampliar ×4 sin perder nitidez'; } });
        pintar();
      },
    });
    if (r !== 'ok') return null;
    const final = tratar(img, modo, fuerza, img.naturalWidth > 2400 ? 4800 : 2400);
    const nombre = 'img-' + Date.now().toString(36) + (modo === 'original' ? '.jpg' : '.png');
    Folio.recursos[nombre] = modo === 'original' ? final.toDataURL('image/jpeg', .92) : final.toDataURL('image/png');
    return { nombre, w: final.width, h: final.height, modo };
  }

  // varias imágenes a la vez (secuencia de fotolibro), sin tratamiento
  async function agregarVarias() {
    const files = await new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.png,.jpg,.jpeg,.webp'; inp.onchange = () => res([...inp.files]); inp.click(); });
    const out = [];
    for (const f of files) { const img = await cargar(await App.leerDataURL(f)); const t = tratar(img, 'original', 0, 3000); const nombre = 'img-' + Date.now().toString(36) + out.length + '.jpg'; Folio.recursos[nombre] = t.toDataURL('image/jpeg', .92); out.push({ nombre, w: t.width, h: t.height, pie: f.name.replace(/\.[^.]+$/, '') }); }
    return out;
  }

  window.Imagenes = { agregar, agregarVarias, tratar };
})();
