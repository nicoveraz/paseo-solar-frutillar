'use strict';

// ar.js — Realidad aumentada + Misión Solar (sin frameworks)
// • getUserMedia → cámara trasera
// • DeviceOrientation / AbsoluteOrientationSensor → rumbo y pitch
// • Geolocation → distancia y bearing a cada pedestal
// • DOM + rAF → proyección bearing → pantalla
// • Misión: capturar cada planeta al estar a ≤ COLLECT_RADIUS m

/* ── Constantes ─────────────────────────────────────────────────── */
const FOV_H = 65;                 // campo visual horizontal (grados)
const FOV_V = 60;                 // campo visual vertical, retrato (grados)
const HEADING_BACK_CAMERA = 180;  // el heading nativo apunta a la pantalla; la cámara trasera está 180° opuesta
const HEADING_ALPHA = 0.12;       // filtro paso-bajo del rumbo (ruido magnético)
const PITCH_ALPHA   = 0.4;        // el pitch (gravedad) es limpio → casi sin filtro
const COLLECT_RADIUS = 10;        // metros para poder capturar un planeta
const MISSION_KEY    = 'psf_mission_v1';

/* ── Estado ─────────────────────────────────────────────────────── */
let _gps            = null;   // { lat, lng }
let _heading        = 0;      // rumbo suavizado (0 = Norte)
let _pitch          = 0;      // + = cámara mirando arriba
let _usingAbsSensor = false;
let _watchId        = null;
let _rafId          = null;
let _currentId      = null;   // planeta seleccionado
let _nearId         = null;   // planeta capturable más cercano
const _pinMap       = {};     // id → elemento .ar-pin
let _mission        = { collected: {} };  // id → timestamp ms

/* ── Geometría ──────────────────────────────────────────────────── */
const _rad = d => d * Math.PI / 180;

function _dist(a, b) {
  const R = 6371000;
  const dLat = _rad(b.lat - a.lat), dLon = _rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(_rad(a.lat)) * Math.cos(_rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function _bearing(a, b) {
  const φ1 = _rad(a.lat), φ2 = _rad(b.lat), Δλ = _rad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function _fmtDist(m) {
  if (m < 1)     return `${Math.round(m * 100)} cm`;
  if (m < 1000)  return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
function _smoothAngle(current, raw) {
  let diff = raw - current;
  if (diff >  180) diff -= 360;
  if (diff < -180) diff += 360;
  return (current + diff * HEADING_ALPHA + 360) % 360;
}

/* ── Orientación del dispositivo ────────────────────────────────── */
function _onOrientation(e) {
  if (!_usingAbsSensor) {
    let raw = null;
    if (e.webkitCompassHeading != null) raw = e.webkitCompassHeading;       // iOS
    else if (e.absolute)                raw = (360 - (e.alpha || 0)) % 360;  // Android
    if (raw !== null) _heading = _smoothAngle(_heading, (raw + HEADING_BACK_CAMERA) % 360);
  }
  // beta = 90 → teléfono vertical. beta > 90 → cámara mirando arriba.
  if (e.beta != null) _pitch += ((e.beta - 90) - _pitch) * PITCH_ALPHA;
}
window.addEventListener('deviceorientationabsolute', _onOrientation);
window.addEventListener('deviceorientation',         _onOrientation);

// Chrome/Android: sensor fusion (giroscopio + acelerómetro + magnetómetro)
async function _startCompass() {
  if (!('AbsoluteOrientationSensor' in window)) return;
  try {
    const perms = await Promise.all(['accelerometer', 'magnetometer', 'gyroscope']
      .map(name => navigator.permissions.query({ name })));
    if (perms.some(p => p.state === 'denied')) return;

    const sensor = new AbsoluteOrientationSensor({ frequency: 30 });
    sensor.addEventListener('reading', () => {
      if (!sensor.quaternion) return;
      const [x, y, z, w] = sensor.quaternion;
      // Yaw en marco ENU: 0 = Norte, positivo = antihorario → brújula = 360 - yaw
      const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180 / Math.PI;
      _heading = _smoothAngle(_heading, (360 - ((yaw + 360) % 360) + HEADING_BACK_CAMERA) % 360);
    });
    sensor.addEventListener('error', () => { _usingAbsSensor = false; });
    sensor.start();
    _usingAbsSensor = true;
  } catch (_) { /* sin sensor → deviceorientation */ }
}

/* ── GPS ────────────────────────────────────────────────────────── */
function _setGpsStatus(msg, ok) {
  const el = document.getElementById('ar-gps-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#88ff88' : '#ffaa44';
}
function _startGPS() {
  if (!('geolocation' in navigator)) { _setGpsStatus('GPS no disponible', false); return; }
  _setGpsStatus('Buscando GPS…', false);
  const onFix = pos => { _gps = { lat: pos.coords.latitude, lng: pos.coords.longitude }; _setGpsStatus('GPS ✓', true); };
  const onErr = err => {
    const msgs = ['', 'Permiso denegado', 'Posición no disponible', 'Tiempo agotado'];
    _setGpsStatus(`GPS: ${msgs[err.code] || err.message}`, false);
  };
  // Fix rápido (red/caché) y luego seguimiento de alta precisión
  navigator.geolocation.getCurrentPosition(onFix, () => {}, { enableHighAccuracy: false, maximumAge: 120000, timeout: 8000 });
  _watchId = navigator.geolocation.watchPosition(onFix, onErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: Infinity });
}

/* ── Tamaño aparente del planeta según distancia ────────────────── */
function _apparentPx(planeta, distM) {
  const MIN_PX = 44;
  const MAX_PX = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.6);
  const px = (planeta.diametroModelo / 100 / Math.max(distM, 0.05)) * (window.innerWidth / _rad(FOV_H));
  return Math.max(MIN_PX, Math.min(MAX_PX, Math.round(px)));
}

/* ── Proyección bearing → pantalla ──────────────────────────────── */
function _project(bearing) {
  let diff = ((bearing - _heading) + 360) % 360;
  if (diff > 180) diff -= 360;
  return { x: window.innerWidth / 2 + diff * (window.innerWidth / FOV_H), diff, inView: Math.abs(diff) < FOV_H / 2 };
}

/* ── HUD ────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function _updateHUD(planeta) {
  $('hud-dot').style.background = `radial-gradient(circle at 35% 30%,rgba(255,255,255,.4),${planeta.color})`;
  $('hud-dot').style.boxShadow  = `0 0 8px ${planeta.color}88`;
  $('hud-name').textContent     = planeta.nombre;
  $('hud-sub').textContent      = planeta.id === 'sol'
    ? `⌀ ${fmtNum(planeta.diametroReal)} km · Centro del sistema`
    : `⌀ ${fmtNum(planeta.diametroReal)} km · ${formatearDistancia(planeta.distanciaModeloSol)} del Sol`;
  $('hud-btn-info').href = `planet.html?planet=${planeta.id}`;

  const prev = getPlanetaAnterior(planeta.id), next = getPlanetaSiguiente(planeta.id);
  $('hud-btn-prev').style.display = prev ? 'flex' : 'none';
  $('hud-btn-next').style.display = next ? 'flex' : 'none';
  if (prev) $('hud-prev-label').textContent = prev.nombre;
  if (next) $('hud-next-label').textContent = next.nombre;
}

window.arSelectPlanet = function (id) {
  if (!SISTEMA_SOLAR[id]) return;
  if (_currentId && _pinMap[_currentId]) _pinMap[_currentId].classList.remove('ar-selected');
  _currentId = id;
  window._currentId = id;
  if (_pinMap[id]) _pinMap[id].classList.add('ar-selected');
  _updateHUD(SISTEMA_SOLAR[id]);
};

/* ── Pin DOM ────────────────────────────────────────────────────── */
function _createPin(planeta) {
  const div = document.createElement('div');
  div.className = 'ar-pin';
  div.id = `ar-pin-${planeta.id}`;
  div.style.setProperty('--pc', planeta.color);

  const realLine = planeta.id === 'sol'
    ? `⌀ ${fmtNum(planeta.diametroReal)} km`
    : `${fmtNum(planeta.distanciaRealSol, 1)} M km · ⌀ ${fmtNum(planeta.diametroReal)} km`;
  const modelLine = planeta.id === 'sol'
    ? `Modelo: ⌀ ${formatearDiametro(planeta.diametroModelo)}`
    : `Modelo: ${formatearDistancia(planeta.distanciaModeloSol)} · ⌀ ${formatearDiametro(planeta.diametroModelo)}`;

  div.innerHTML = `
    <div class="ar-pin-card">
      <div class="ar-pin-card-bar"></div>
      <div class="ar-pin-card-name">${planeta.nombre}</div>
      <div class="ar-pin-card-real">${realLine}</div>
      <div class="ar-pin-card-model">${modelLine}</div>
    </div>
    <div class="ar-pin-visual">
      <div class="ar-pin-head">
        <img src="${planeta.imagen}" onerror="this.onerror=null;this.src='${planeta.imagenFallback}'" alt="${planeta.nombre}" draggable="false">
      </div>
      <div class="ar-pin-stem"></div>
    </div>
    <div class="ar-pin-labels">
      <span class="ar-pin-name-lbl">${planeta.nombre}</span>
      <span class="ar-pin-dist"></span>
    </div>
    <div class="ar-edge-pill">
      <div class="ar-edge-dot"></div>
      <span class="ar-edge-chevron">▶</span>
      <span class="ar-edge-name">${planeta.nombre}</span>
      <span class="ar-edge-dist"></span>
    </div>`;
  div.addEventListener('click', () => window.arSelectPlanet(planeta.id));
  return div;
}

/* ── Loop de posicionamiento ────────────────────────────────────── */
function _loop() {
  _rafId = requestAnimationFrame(_loop);
  const W = window.innerWidth, H = window.innerHeight;

  // Los pedestales están al nivel del suelo → sobre el horizonte, que sube/baja con el pitch
  const horizonY = H / 2 + _pitch * (H / FOV_V);
  const pinY = Math.max(H * 0.05, Math.min(H * 0.9, horizonY));

  let leftSlot = 0, rightSlot = 0;
  let nearId = null, nearDist = Infinity;

  ORDEN_PLANETAS.forEach((id, idx) => {
    const pin = _pinMap[id], p = SISTEMA_SOLAR[id];
    if (!pin) return;

    if (!_gps) {
      // Sin GPS: repartir los pines frente al usuario
      const spread = (idx - (ORDEN_PLANETAS.length - 1) / 2) * (W / ORDEN_PLANETAS.length);
      _place(pin, W / 2 + spread, pinY, 'translate(-50%, -100%)', false);
      return;
    }

    const distM = _dist(_gps, p.coords);
    const txt = _fmtDist(distM);
    pin.querySelector('.ar-pin-dist').textContent  = txt;
    pin.querySelector('.ar-edge-dist').textContent = txt;

    // Misión: candidato a captura
    if (!_isCollected(id) && distM <= COLLECT_RADIUS) {
      pin.classList.add('game-catchable');
      if (distM < nearDist) { nearDist = distM; nearId = id; }
    } else {
      pin.classList.remove('game-catchable');
    }

    const { x, diff, inView } = _project(_bearing(_gps, p.coords));
    if (inView) {
      _place(pin, x, pinY, 'translate(-50%, -100%)', false);
      pin.style.setProperty('--ps', _apparentPx(p, distM) + 'px');
    } else if (diff < 0) {
      _place(pin, 10, Math.min(H * 0.22 + leftSlot++ * 50, H - 60), 'translateY(-50%)', true);
      pin.querySelector('.ar-edge-chevron').textContent = '◀';
    } else {
      _place(pin, W - 10, Math.min(H * 0.22 + rightSlot++ * 50, H - 60), 'translate(-100%, -50%)', true);
      pin.querySelector('.ar-edge-chevron').textContent = '▶';
    }
  });

  _updateCaptureBtn(nearId, nearDist);
  _updateDirArrow();
}
function _place(pin, x, y, transform, atEdge) {
  pin.style.left = x + 'px';
  pin.style.top  = y + 'px';
  pin.style.transform = transform;
  pin.classList.toggle('ar-at-edge', atEdge);
}

/* ── Flecha hacia el planeta seleccionado (fuera de vista) ──────── */
function _updateDirArrow() {
  const el = $('ar-dir-arrow');
  const p = _currentId && SISTEMA_SOLAR[_currentId];
  if (!_gps || !p) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }

  const brg = _bearing(_gps, p.coords);
  if (_project(brg).inView) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }

  const W = window.innerWidth, H = window.innerHeight, margin = 58;
  const rel = ((brg - _heading) + 360) % 360;
  const rad = _rad(rel);
  let px = W / 2 + Math.sin(rad) * W * 2;
  let py = H / 2 - Math.cos(rad) * H * 2;
  // Recortar al borde de la pantalla
  const sx = px !== W / 2 ? (W / 2 - margin) / Math.abs(px - W / 2) : 1;
  const sy = py !== H / 2 ? (H / 2 - margin) / Math.abs(py - H / 2) : 1;
  const s  = Math.min(sx, sy);
  if (s < 1) { px = W / 2 + (px - W / 2) * s; py = H / 2 + (py - H / 2) * s; }

  $('ar-dir-name').textContent = p.nombre;
  $('ar-dir-dist').textContent = _fmtDist(_dist(_gps, p.coords));
  $('ar-dir-icon').style.color     = p.color;
  $('ar-dir-icon').style.transform = `rotate(${rel}deg)`;
  el.style.borderColor   = p.color + '88';
  el.style.left          = px + 'px';
  el.style.top           = py + 'px';
  el.style.opacity       = '1';
  el.style.pointerEvents = 'auto';
}

/* ═════════════════════════════════════════════════════════════════
   Misión Solar
   ═════════════════════════════════════════════════════════════════ */
function _loadMission() {
  try { _mission = Object.assign({ collected: {} }, JSON.parse(localStorage.getItem(MISSION_KEY) || '{}')); }
  catch (_) { _mission = { collected: {} }; }
}
function _saveMission() {
  try { localStorage.setItem(MISSION_KEY, JSON.stringify(_mission)); } catch (_) {}
}
const _isCollected = id => !!_mission.collected[id];
const _collectedCount = () => Object.keys(_mission.collected).length;

window.missionReset = function () { localStorage.removeItem(MISSION_KEY); location.reload(); };

function _updateCounter() {
  const n = _collectedCount(), total = ORDEN_PLANETAS.length;
  $('game-counter').querySelector('.gc-num').textContent = n;
  $('game-counter').style.color = n === total ? '#fdb813' : '#fff';
}

function _markCollected(pin) {
  pin.classList.add('game-collected');
  pin.classList.remove('game-catchable');
  if (!pin.querySelector('.game-check')) {
    const b = document.createElement('div');
    b.className = 'game-check';
    b.textContent = '✓';
    pin.appendChild(b);
  }
}

function _updateCaptureBtn(nearId, dist) {
  const btn = $('game-capture-btn');
  if (!nearId) {
    if (_nearId) { btn.style.display = 'none'; _nearId = null; }
    return;
  }
  if (nearId !== _nearId) {
    _nearId = nearId;
    const p = SISTEMA_SOLAR[nearId];
    btn.style.display = 'flex';
    btn.style.borderColor = p.color;
    btn.querySelector('.gcb-icon').style.color   = p.color;
    btn.querySelector('.gcb-label').textContent  = `Capturar ${p.nombre}`;
    btn.onclick = () => _collect(nearId);
  }
  btn.querySelector('.gcb-dist').textContent = _fmtDist(dist);
}

function _collect(id) {
  if (_isCollected(id)) return;
  _mission.collected[id] = Date.now();
  _saveMission();

  const planeta = SISTEMA_SOLAR[id], pin = _pinMap[id];
  if (pin) {
    _markCollected(pin);
    ['game-burst-1', 'game-burst-2'].forEach((cls, i) => {
      const r = document.createElement('div');
      r.className = `game-burst ${cls}`;
      r.style.setProperty('--bc', planeta.color);
      r.style.animationDelay = `${i * 0.15}s`;
      pin.appendChild(r);
      setTimeout(() => r.remove(), 1000);
    });
  }
  _toast(`✦ ¡${planeta.nombre} capturado!`, planeta.color);
  $('game-capture-btn').style.display = 'none';
  _nearId = null;
  _updateCounter();

  if (_collectedCount() >= ORDEN_PLANETAS.length) setTimeout(_showEnding, 2200);
}

function _toast(msg, color) {
  const t = document.createElement('div');
  t.className = 'game-toast';
  t.style.setProperty('--tc', color);
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('game-toast-in'));
  setTimeout(() => { t.classList.remove('game-toast-in'); setTimeout(() => t.remove(), 400); }, 2400);
}

function _showEnding() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }

  let stars = '';
  for (let i = 0; i < 80; i++) {
    const size = 1 + Math.random() * 3;
    stars += `<div class="end-star" style="left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-delay:${Math.random() * 4}s;animation-duration:${2 + Math.random() * 3}s"></div>`;
  }
  const items = ORDEN_PLANETAS.map(id => {
    const p = SISTEMA_SOLAR[id];
    const t = new Date(_mission.collected[id]).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    return `<div class="end-planet-item">
      <span class="end-dot" style="background:${p.color};box-shadow:0 0 6px ${p.color}"></span>
      <span class="end-name">${p.nombre}</span><span class="end-time">${t}</span></div>`;
  }).join('');

  const ts = Object.values(_mission.collected);
  const mins = Math.round((Math.max(...ts) - Math.min(...ts)) / 60000);
  const durTxt = mins < 1 ? 'menos de 1 minuto' : mins === 1 ? '1 minuto' : `${mins} minutos`;
  const neptuno = SISTEMA_SOLAR.neptuno;

  const ov = document.createElement('div');
  ov.id = 'game-ending';
  ov.innerHTML = `
    <div class="end-stars">${stars}</div>
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
      <p class="end-sub">Descubriste los <strong>${ORDEN_PLANETAS.length} planetas</strong><br>del Paseo Solar de Frutillar</p>
      <div class="end-award">
        <div class="end-award-seal">⭐</div>
        <div>
          <div class="end-award-title">Explorador del Sistema Solar</div>
          <div class="end-award-detail">Paseo Solar Frutillar · ${new Date().getFullYear()}</div>
        </div>
      </div>
      <div class="end-stat">⏱ Completado en <strong>${durTxt}</strong></div>
      <details class="end-planets-detail">
        <summary>Ver todos los planetas capturados</summary>
        <div class="end-planet-list">${items}</div>
      </details>
      <div class="end-fact">
        <span class="end-fact-icon">🔭</span>
        <span>En este modelo ${ESCALA_TEXTO}, Neptuno está a <strong>${formatearDistancia(neptuno.distanciaModeloSol)}</strong> del Sol.
        La distancia real son <strong>${fmtNum(neptuno.distanciaRealSol)} millones de km</strong>.</span>
      </div>
      <div class="end-actions">
        <button class="btn btn-ar" onclick="window.missionReset()" style="justify-content:center;width:100%">
          <span class="material-symbols-outlined">refresh</span> Jugar de nuevo
        </button>
        <a href="index.html" class="btn btn-secondary" style="justify-content:center;width:100%">
          <span class="material-symbols-outlined">home</span> Inicio
        </a>
      </div>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('end-visible'));
}

/* ═════════════════════════════════════════════════════════════════
   Arranque
   ═════════════════════════════════════════════════════════════════ */
async function startAR(initialPlanetId) {
  _loadMission();
  const startId = SISTEMA_SOLAR[initialPlanetId] ? initialPlanetId
    : (ORDEN_PLANETAS.find(id => !_isCollected(id)) || ORDEN_PLANETAS[0]);

  const wrapper = $('ar-scene-wrapper');
  wrapper.innerHTML = '';
  Object.keys(_pinMap).forEach(k => delete _pinMap[k]);
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
  if (_rafId   !== null) { cancelAnimationFrame(_rafId); _rafId = null; }

  // iOS 13+: el permiso de orientación debe pedirse antes del primer await (gesto del usuario)
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch (_) {}
  }
  _startCompass();

  const video = document.createElement('video');
  video.id = 'ar-video';
  video.autoplay = true; video.muted = true; video.playsInline = true;
  video.setAttribute('playsinline', '');
  wrapper.appendChild(video);

  const overlay = document.createElement('div');
  overlay.id = 'ar-overlay';
  wrapper.appendChild(overlay);

  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
    });
  } catch (_) {
    try { video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
    catch (err) { _setGpsStatus('Cámara no disponible', false); }
  }

  ORDEN_PLANETAS.forEach(id => {
    const pin = _createPin(SISTEMA_SOLAR[id]);
    if (_isCollected(id)) _markCollected(pin);
    overlay.appendChild(pin);
    _pinMap[id] = pin;
  });

  window.arSelectPlanet(startId);
  _updateCounter();
  $('ar-loading').style.display = 'none';
  _loop();
  _startGPS();
}

/* ── Pantalla de bienvenida ─────────────────────────────────────── */
(function init() {
  _loadMission();
  const planetaId = new URLSearchParams(location.search).get('planet');
  const n = _collectedCount(), total = ORDEN_PLANETAS.length;

  $('ar-back-btn').href = SISTEMA_SOLAR[planetaId] ? `planet.html?planet=${planetaId}` : 'index.html';
  $('gc-total').textContent = total;

  if (n > 0) {
    $('welcome-progress').style.display = 'block';
    $('wp-num').textContent = `${n} / ${total}`;
    $('btn-iniciar-label').textContent = n >= total ? 'Volver a explorar' : 'Continuar misión';
  }

  $('btn-iniciar-ar').addEventListener('click', () => {
    $('ar-welcome').classList.add('hidden');
    $('ar-loading').style.display       = 'block';
    $('ar-scene-wrapper').style.display = 'block';
    $('ar-hud').style.display           = 'block';
    $('game-counter').style.display     = 'flex';
    startAR(planetaId);
  });
})();
