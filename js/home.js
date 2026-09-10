'use strict';

// home.js — Página principal: lista de planetas, progreso de la misión,
// ticker de comparaciones y distancias en tiempo real desde la Tierra.

(function () {
  const $ = id => document.getElementById(id);
  const MISSION_KEY = 'psf_mission_v1';

  /* ── Lista de planetas ──────────────────────────────────────────── */
  function renderPlanetas() {
    const grid = $('planetas-grid');
    const maxReal = SISTEMA_SOLAR.jupiter.diametroReal;
    ORDEN_PLANETAS.forEach(id => {
      const p = SISTEMA_SOLAR[id], isSol = id === 'sol';
      const size = isSol ? 48 : Math.max(14, Math.round(14 + (p.diametroReal / maxReal) * 30));
      const lunas = p.lunas.length === 0 ? 'Sin lunas'
        : p.lunas.length === 1 ? `1 luna: ${p.lunas[0].nombre}` : `${p.lunas.length} lunas`;
      const dist = isSol ? 'Centro del sistema' : `${formatearDistancia(p.distanciaModeloSol)} del Sol`;

      const card = document.createElement('a');
      card.href = `planet.html?planet=${id}`;
      card.className = 'planeta-card';
      card.innerHTML = `
        <div style="width:${size}px;height:${size}px;flex-shrink:0;filter:drop-shadow(0 0 ${isSol ? 10 : 5}px ${p.color}88)">
          <img src="${p.imagen}" alt="${p.nombre}" style="width:100%;height:100%;object-fit:contain"
               onerror="this.onerror=null;this.src='${p.imagenFallback}'" />
        </div>
        <div style="flex:1;min-width:0">
          <div class="planeta-card-nombre">${p.nombre}</div>
          <div class="planeta-card-tipo">${p.tipo}</div>
          <div class="planeta-card-stats"><span>${dist}</span><span>${lunas}</span></div>
        </div>
        <span class="material-symbols-outlined planeta-card-flecha" style="font-size:18px">chevron_right</span>`;
      grid.appendChild(card);
    });
  }

  /* ── Progreso de la misión (guardado por ar.js) ─────────────────── */
  function renderMision() {
    let collected = {};
    try { collected = JSON.parse(localStorage.getItem(MISSION_KEY) || '{}').collected || {}; } catch (_) {}
    const n = Object.keys(collected).length, total = ORDEN_PLANETAS.length;

    $('mision-num').innerHTML = `${n}<small> / ${total}</small>`;
    $('mision-fill').style.width = `${Math.round(n / total * 100)}%`;
    $('mision-btn-label').textContent = n === 0 ? 'Iniciar misión' : n >= total ? 'Misión completa · Explorar' : 'Continuar misión';
    $('mision-reset').style.display = n > 0 ? 'inline-flex' : 'none';
    $('mision-reset').onclick = () => {
      if (confirm('¿Borrar el progreso de la misión?')) { localStorage.removeItem(MISSION_KEY); renderMision(); }
    };

    const list = $('mision-planetas');
    list.innerHTML = '';
    ORDEN_PLANETAS.forEach(id => {
      const p = SISTEMA_SOLAR[id];
      const el = document.createElement('div');
      el.className = 'mision-planeta' + (collected[id] ? ' ok' : '');
      el.style.setProperty('--pc', p.color);
      el.title = p.nombre + (collected[id] ? ' ✓' : '');
      el.innerHTML = `<img src="${p.imagen}" alt="${p.nombre}" onerror="this.onerror=null;this.src='${p.imagenFallback}'">`;
      list.appendChild(el);
    });
  }

  /* ── Ticker de comparaciones ────────────────────────────────────── */
  function startTicker() {
    const items = [
      ...ORDEN_PLANETAS.map(id => ({ cat: 'Diámetros en el modelo', val: formatearDiametro(SISTEMA_SOLAR[id].diametroModelo), lbl: `⌀ ${SISTEMA_SOLAR[id].nombre}` })),
      { cat: 'Lunas — distancia al planeta', val: '60,9 cm', lbl: 'Júpiter → Calisto' },
      { cat: 'Lunas — distancia al planeta', val: '39,5 cm', lbl: 'Saturno → Titán' },
      { cat: 'Lunas — distancia al planeta', val: '12,4 cm', lbl: 'Tierra → Luna' },
      { cat: 'Lunas — distancia al planeta', val: '11,5 cm', lbl: 'Neptuno → Tritón' },
      { cat: 'Estrellas', val: '13.430 km',     lbl: 'Próxima Centauri · Chile → Noruega' },
      { cat: 'Galaxias',  val: '75.940.000 km', lbl: 'Centro de la Vía Láctea' },
    ];
    const cEl = $('ticker-categoria'), vEl = $('ticker-valor'), lEl = $('ticker-label');
    let idx = 0;
    function show() {
      const item = items[idx++ % items.length];
      vEl.style.opacity = lEl.style.opacity = '0';
      setTimeout(() => {
        cEl.textContent = item.cat; vEl.textContent = item.val; lEl.textContent = item.lbl;
        vEl.style.opacity = lEl.style.opacity = '1';
      }, 400);
    }
    show();
    setInterval(show, 3500);
  }

  /* ── Distancias Tierra → planeta ahora mismo (órbitas circulares) ── */
  function startDistanciasAhora() {
    // a: semieje (UA) · T: período (días) · L0: longitud media en J2000 (grados)
    const ORBITAS = {
      mercurio: { a: 0.387098, T: 87.969,   L0: 252.250906 },
      venus:    { a: 0.723332, T: 224.701,  L0: 181.979801 },
      tierra:   { a: 1.0,      T: 365.256,  L0: 100.464441 },
      marte:    { a: 1.523688, T: 686.971,  L0: 355.433275 },
      jupiter:  { a: 5.202534, T: 4332.589, L0: 34.396441  },
      saturno:  { a: 9.536764, T: 10759.22, L0: 49.944432  },
      urano:    { a: 19.18916, T: 30685.4,  L0: 313.232810 },
      neptuno:  { a: 30.06992, T: 60189.0,  L0: 304.880476 },
    };
    const AU_KM = 149597870, ESCALA_N = 3093333333, J2000 = Date.UTC(2000, 0, 1, 12);
    const pos = (o, days) => {
      const L = ((o.L0 + 360 * days / o.T) % 360) * Math.PI / 180;
      return [o.a * Math.cos(L), o.a * Math.sin(L)];
    };

    function compute() {
      const days = (Date.now() - J2000) / 86400000;
      const [ex, ey] = pos(ORBITAS.tierra, days);
      const grid = $('dist-ahora-grid');
      grid.innerHTML = '';
      for (const [id, o] of Object.entries(ORBITAS)) {
        if (id === 'tierra') continue;
        const [px, py] = pos(o, days);
        const au  = Math.hypot(px - ex, py - ey);
        const km  = au * AU_KM;
        const mod = km * 1000 / ESCALA_N;
        const kmStr = km >= 1e9 ? `${fmtNum(km / 1e9, 2)} mil M km` : `${fmtNum(Math.round(km / 1e6))} M km`;
        grid.innerHTML += `
          <div class="dist-ahora-item">
            <div class="dist-ahora-top">
              <span class="dist-ahora-dot" style="background:${SISTEMA_SOLAR[id].color}"></span>
              <span>${SISTEMA_SOLAR[id].nombre}</span>
            </div>
            <div class="dist-ahora-val">${formatearDistancia(mod)}</div>
            <div class="dist-ahora-sub">${kmStr} · ${fmtNum(au, 2)} UA</div>
          </div>`;
      }
      $('dist-timestamp').textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }
    compute();
    setInterval(compute, 60000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderPlanetas();
    renderMision();
    startTicker();
    startDistanciasAhora();
  });
})();
