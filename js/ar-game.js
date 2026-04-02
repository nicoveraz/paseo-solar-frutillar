'use strict';
// ar-game.js — Misión Solar: encuentra los planetas en la costanera
// Requiere planets-data.js cargado antes; se inyecta sobre juego-ar.html

/* ── Configuración ──────────────────────────────────────────────── */
const COLLECT_RADIUS = 10;        // metros para poder capturar
const GAME_KEY       = 'psf_mission_v1';

/* ── Estado ─────────────────────────────────────────────────────── */
let _gs   = { collected: {} };    // id → timestamp ms
let _gps  = null;                  // { lat, lng } de nuestra propia suscripción
let _rafId = null;
let _nearId = null;               // id del planeta más cercano capturable

/* ── Persistencia ────────────────────────────────────────────────── */
function _load() {
  try { _gs = Object.assign({ collected: {} }, JSON.parse(localStorage.getItem(GAME_KEY) || '{}')); }
  catch (_) { _gs = { collected: {} }; }
}
function _save() {
  try { localStorage.setItem(GAME_KEY, JSON.stringify(_gs)); } catch (_) {}
}
window.gameReset = function () { localStorage.removeItem(GAME_KEY); location.reload(); };

const _isCollected = id => !!_gs.collected[id];
const _count       = ()  => Object.keys(_gs.collected).length;

/* ── Haversine ──────────────────────────────────────────────────── */
function _dist(lat1, lon1, lat2, lon2) {
  const R = 6371000, dl = (lat2 - lat1) * Math.PI / 180, dL = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dl / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dL / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── GPS propio ─────────────────────────────────────────────────── */
function _startGPS() {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    p => { _gps = { lat: p.coords.latitude, lng: p.coords.longitude }; },
    () => {},
    { enableHighAccuracy: false, maximumAge: 120000, timeout: 8000 }
  );
  navigator.geolocation.watchPosition(
    p => { _gps = { lat: p.coords.latitude, lng: p.coords.longitude }; },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: Infinity }
  );
}

/* ── Captura ─────────────────────────────────────────────────────── */
function _collect(id) {
  if (_isCollected(id)) return;
  _gs.collected[id] = Date.now();
  _save();

  const planeta = SISTEMA_SOLAR[id];
  const pin     = document.getElementById(`ar-pin-${id}`);

  if (pin) {
    pin.classList.add('game-collected');
    pin.classList.remove('game-catchable');
    _addCheckBadge(pin);
    _burstAnimation(pin, planeta.color);
  }

  _toast(`✦ ¡${planeta.nombre} capturado!`, planeta.color);
  _hideCaptureBtn();
  _updateCounter();

  const n = _count(), total = ORDEN_PLANETAS.length;
  if (n >= total) setTimeout(_showEnding, 2200);
}

/* ── Checkmark badge ─────────────────────────────────────────────── */
function _addCheckBadge(pin) {
  if (pin.querySelector('.game-check')) return;
  const b = document.createElement('div');
  b.className = 'game-check';
  b.textContent = '✓';
  pin.style.position = 'relative';
  pin.appendChild(b);
}

/* ── Burst animation ─────────────────────────────────────────────── */
function _burstAnimation(pin, color) {
  ['game-burst-1','game-burst-2'].forEach((cls, i) => {
    const r = document.createElement('div');
    r.className = `game-burst ${cls}`;
    r.style.setProperty('--bc', color);
    r.style.animationDelay = `${i * 0.15}s`;
    pin.appendChild(r);
    setTimeout(() => r.remove(), 1000);
  });
}

/* ── Toast ───────────────────────────────────────────────────────── */
function _toast(msg, color) {
  const t = document.createElement('div');
  t.className = 'game-toast';
  t.style.setProperty('--tc', color);
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('game-toast-in'));
  setTimeout(() => {
    t.classList.remove('game-toast-in');
    setTimeout(() => t.remove(), 400);
  }, 2400);
}

/* ── Botón capturar ──────────────────────────────────────────────── */
function _showCaptureBtn(id, dist) {
  const btn = document.getElementById('game-capture-btn');
  if (!btn || _isCollected(id)) return;
  const p = SISTEMA_SOLAR[id];
  btn.style.display     = 'flex';
  btn.style.borderColor = p.color;
  btn.querySelector('.gcb-icon').style.color = p.color;
  btn.querySelector('.gcb-label').textContent = `Capturar ${p.nombre}`;
  btn.querySelector('.gcb-dist').textContent  = dist < 1 ? `${Math.round(dist * 100)} cm` : `${dist.toFixed(1)} m`;
  btn.onclick = () => _collect(id);
}
function _hideCaptureBtn() {
  const btn = document.getElementById('game-capture-btn');
  if (btn) btn.style.display = 'none';
  _nearId = null;
}

/* ── Counter ─────────────────────────────────────────────────────── */
function _updateCounter() {
  const el = document.getElementById('game-counter');
  if (!el) return;
  const n = _count(), tot = ORDEN_PLANETAS.length;
  el.querySelector('.gc-num').textContent = n;
  el.style.color = n === tot ? '#fdb813' : '#fff';
}

/* ── Game loop ───────────────────────────────────────────────────── */
function _loop() {
  _rafId = requestAnimationFrame(_loop);
  if (!_gps) return;

  let nearId = null, nearDist = Infinity;

  ORDEN_PLANETAS.forEach(id => {
    const pin = document.getElementById(`ar-pin-${id}`);
    if (!pin) return;
    if (_isCollected(id)) {
      pin.classList.add('game-collected');
      pin.classList.remove('game-catchable');
      return;
    }
    const p = SISTEMA_SOLAR[id];
    if (!p.coords) return;
    const d = _dist(_gps.lat, _gps.lng, p.coords.lat, p.coords.lng);
    if (d <= COLLECT_RADIUS) {
      pin.classList.add('game-catchable');
      if (d < nearDist) { nearDist = d; nearId = id; }
    } else {
      pin.classList.remove('game-catchable');
    }
  });

  if (nearId !== _nearId) {
    _nearId = nearId;
    if (nearId) _showCaptureBtn(nearId, nearDist);
    else        _hideCaptureBtn();
  } else if (nearId) {
    // actualizar distancia en el botón sin cambiar planet
    const db = document.querySelector('.gcb-dist');
    if (db) db.textContent = nearDist < 1 ? `${Math.round(nearDist * 100)} cm` : `${nearDist.toFixed(1)} m`;
  }
}

/* ── Pantalla final ──────────────────────────────────────────────── */
function _showEnding() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }

  const ov = document.createElement('div');
  ov.id = 'game-ending';

  // Estrellas de fondo
  let starsHtml = '';
  for (let i = 0; i < 80; i++) {
    const size = 1 + Math.random() * 3;
    starsHtml += `<div class="end-star" style="
      left:${Math.random()*100}%;top:${Math.random()*100}%;
      width:${size}px;height:${size}px;
      animation-delay:${Math.random()*4}s;
      animation-duration:${2 + Math.random()*3}s"></div>`;
  }

  // Lista de planetas capturados
  const planetItems = ORDEN_PLANETAS.map(id => {
    const p  = SISTEMA_SOLAR[id];
    const ts = _gs.collected[id];
    const t  = ts ? new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—';
    return `<div class="end-planet-item">
      <span class="end-dot" style="background:${p.color};box-shadow:0 0 6px ${p.color}"></span>
      <span class="end-name">${p.nombre}</span>
      <span class="end-time">${t}</span>
    </div>`;
  }).join('');

  const first = Math.min(...Object.values(_gs.collected));
  const last  = Math.max(...Object.values(_gs.collected));
  const mins  = Math.round((last - first) / 60000);
  const durTxt = mins < 1 ? 'menos de 1 minuto' : mins === 1 ? '1 minuto' : `${mins} minutos`;

  ov.innerHTML = `
    <div class="end-stars">${starsHtml}</div>
    <div class="end-scroll">
      <div class="end-content">
        <div class="end-solar-anim">
          <div class="end-sun">☀</div>
          <div class="end-orbit end-o1"><div class="end-orb" style="--oc:#b5b5b5">●</div></div>
          <div class="end-orbit end-o2"><div class="end-orb" style="--oc:#e8cda0">●</div></div>
          <div class="end-orbit end-o3"><div class="end-orb" style="--oc:#4fa3e0">●</div></div>
          <div class="end-orbit end-o4"><div class="end-orb" style="--oc:#c1440e">●</div></div>
        </div>
        <div class="end-badge">🏆</div>
        <h1 class="end-title">¡Misión Completa!</h1>
        <p class="end-sub">Descubriste los <strong>9 planetas</strong><br>del Paseo Solar de Frutillar</p>
        <div class="end-award">
          <div class="end-award-seal">⭐</div>
          <div>
            <div class="end-award-title">Explorador del Sistema Solar</div>
            <div class="end-award-detail">Paseo Solar Frutillar · ${new Date().getFullYear()}</div>
          </div>
        </div>
        <div class="end-stat">
          ⏱ Completado en <strong>${durTxt}</strong>
        </div>
        <details class="end-planets-detail">
          <summary>Ver todos los planetas capturados</summary>
          <div class="end-planet-list">${planetItems}</div>
        </details>
        <div class="end-fact">
          <span class="end-fact-icon">🔭</span>
          <span>En este modelo 1:3.093.333.333, Neptuno está a <strong>1.455 m</strong> del Sol —
          la distancia real son <strong>4.500 millones de km</strong>.</span>
        </div>
        <div class="end-actions">
          <button class="btn btn-ar" onclick="window.gameReset()" style="justify-content:center;width:100%">
            <span class="material-symbols-outlined">refresh</span> Jugar de nuevo
          </button>
          <a href="juego.html" class="btn" style="justify-content:center;width:100%;background:var(--surface-2);border:1px solid var(--border-hi);color:var(--text);text-decoration:none">
            <span class="material-symbols-outlined">home</span> Inicio
          </a>
        </div>
      </div>
    </div>`;

  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('end-visible'));
}

/* ── Init (llamar tras buildARScene) ────────────────────────────── */
function initGame() {
  _load();
  _updateCounter();
  _startGPS();

  // Esperar a que los pines existan en el DOM (buildARScene es async)
  const ready = () => {
    const first = document.querySelector('.ar-pin');
    if (!first) { setTimeout(ready, 100); return; }
    ORDEN_PLANETAS.forEach(id => {
      if (!_isCollected(id)) return;
      const pin = document.getElementById(`ar-pin-${id}`);
      if (!pin) return;
      pin.classList.add('game-collected');
      _addCheckBadge(pin);
    });
    _loop();
  };
  ready();
}
window.initGame = initGame;
