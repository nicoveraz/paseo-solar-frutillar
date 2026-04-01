'use strict';

// ar-view.js — AR sin frameworks (no A-Frame, no AR.js)
// • getUserMedia para feed de cámara trasera
// • DeviceOrientationEvent para rumbo del dispositivo
// • Geolocation para GPS en tiempo real
// • DOM + rAF para proyección bearing → pantalla

/* ── Constantes ─────────────────────────────────────────────────── */
const FOV_H = 65;    // campo visual horizontal estimado (grados)
const PIN_Y = 0.44;  // posición vertical de pines (fracción de altura de pantalla)

/* ── Estado ─────────────────────────────────────────────────────── */
let _gpsLat    = null;
let _gpsLng    = null;
let _heading   = 0;
let _watchId   = null;
let _rafId     = null;
let _currentId = null;
window._currentId = null;
const _pinMap  = {};   // id → elemento .ar-pin

/* ── Haversine ──────────────────────────────────────────────────── */
function _dist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function _bearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function _fmtDist(m) {
  return m < 1000 ? m.toFixed(0) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
}

/* ── Rumbo del dispositivo ──────────────────────────────────────── */
function _onOrientation(e) {
  if (e.webkitCompassHeading != null) {
    _heading = e.webkitCompassHeading;              // iOS (0=N, sentido horario)
  } else if (e.absolute) {
    _heading = (360 - (e.alpha || 0)) % 360;        // Android absolute (convertir CCW a CW)
  }
}
window.addEventListener('deviceorientationabsolute', _onOrientation);
window.addEventListener('deviceorientation',         _onOrientation);

/* ── Proyección: bearing → posición X en pantalla ──────────────── */
function _project(bearing) {
  let diff = ((bearing - _heading) + 360) % 360;
  if (diff > 180) diff -= 360;                      // -180..+180 (neg=izq, pos=der)
  const pxPerDeg = window.innerWidth / FOV_H;
  return {
    x:      window.innerWidth / 2 + diff * pxPerDeg,
    diff,
    inView: Math.abs(diff) < FOV_H / 2
  };
}

/* ── GPS status ─────────────────────────────────────────────────── */
function _setGpsStatus(msg, ok) {
  const el = document.getElementById('ar-gps-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#88ff88' : '#ffaa44';
}

/* ── HUD ────────────────────────────────────────────────────────── */
function _updateHUD(planeta) {
  const $ = id => document.getElementById(id);
  const dot = $('hud-dot');
  if (dot) {
    dot.style.background = `radial-gradient(circle at 35% 30%,rgba(255,255,255,.4),${planeta.color})`;
    dot.style.boxShadow  = `0 0 8px ${planeta.color}88`;
  }
  const nm = $('hud-name'); if (nm) nm.textContent = planeta.nombre;
  const sb = $('hud-sub');
  if (sb) sb.textContent = planeta.id !== 'sol'
    ? `⌀ ${planeta.diametroReal.toLocaleString('es-CL')} km · ${planeta.distanciaModeloSol.toFixed(1)} m del Sol`
    : '⌀ 1.392.000 km · Centro del sistema';
  const ib = $('hud-btn-info'); if (ib) ib.href = `planet.html?planet=${planeta.id}`;
  const prev = getPlanetaAnterior(planeta.id);
  const next = getPlanetaSiguiente(planeta.id);
  const pb = $('hud-btn-prev');
  if (pb) {
    pb.style.display = prev ? 'flex' : 'none';
    if (prev) {
      pb.onclick = e => { e.preventDefault(); window.arSelectPlanet(prev.id); };
      $('hud-prev-label').textContent = prev.nombre;
    }
  }
  const nb = $('hud-btn-next');
  if (nb) {
    nb.style.display = next ? 'flex' : 'none';
    if (next) {
      nb.onclick = e => { e.preventDefault(); window.arSelectPlanet(next.id); };
      $('hud-next-label').textContent = next.nombre;
    }
  }
}

/* ── Crea el elemento DOM de un pin ─────────────────────────────── */
function _createPin(planeta) {
  const div = document.createElement('div');
  div.className = 'ar-pin';
  div.id = `ar-pin-${planeta.id}`;
  div.style.setProperty('--pc', planeta.color);

  const realLine = planeta.id === 'sol'
    ? '⌀ 1.392.000 km'
    : `${planeta.distanciaRealSol.toLocaleString('es-CL')} M km · ⌀ ${planeta.diametroReal.toLocaleString('es-CL')} km`;
  const modelLine = planeta.id === 'sol'
    ? 'Modelo: ⌀ 45 cm'
    : `Modelo: ${planeta.distanciaModeloSol.toFixed(1)} m · ⌀ ${formatearDiametro(planeta.diametroModelo)}`;

  div.innerHTML = `
    <div class="ar-pin-card">
      <div class="ar-pin-card-bar"></div>
      <div class="ar-pin-card-name">${planeta.nombre}</div>
      <div class="ar-pin-card-real">${realLine}</div>
      <div class="ar-pin-card-model">${modelLine}</div>
    </div>
    <div class="ar-pin-visual">
      <div class="ar-pin-head"></div>
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

/* ── rAF loop de posicionamiento ────────────────────────────────── */
function _loop() {
  _rafId = requestAnimationFrame(_loop);
  const W = window.innerWidth, H = window.innerHeight;
  const pinY = H * PIN_Y;

  let leftSlot = 0, rightSlot = 0;

  ORDEN_PLANETAS.forEach(id => {
    const pin = _pinMap[id];
    if (!pin) return;
    const p = SISTEMA_SOLAR[id];
    if (!p || !p.coords) return;

    // Actualizar distancia
    if (_gpsLat !== null) {
      const d = _dist(_gpsLat, _gpsLng, p.coords.lat, p.coords.lng);
      const t = _fmtDist(d);
      const de  = pin.querySelector('.ar-pin-dist');
      const ede = pin.querySelector('.ar-edge-dist');
      if (de)  de.textContent  = t;
      if (ede) ede.textContent = t;
    }

    if (_gpsLat === null) {
      // Sin GPS: distribuir pines uniformemente frente al usuario
      const idx    = ORDEN_PLANETAS.indexOf(id);
      const total  = ORDEN_PLANETAS.length;
      const spread = (idx - (total - 1) / 2) * (W / total);
      pin.style.left      = (W / 2 + spread) + 'px';
      pin.style.top       = pinY + 'px';
      pin.style.transform = 'translate(-50%, -100%)';
      pin.classList.remove('ar-at-edge');
      return;
    }

    const brg = _bearing(_gpsLat, _gpsLng, p.coords.lat, p.coords.lng);
    const { x, diff, inView } = _project(brg);

    if (inView) {
      pin.style.left      = x + 'px';
      pin.style.top       = pinY + 'px';
      pin.style.transform = 'translate(-50%, -100%)';
      pin.classList.remove('ar-at-edge');
    } else if (diff < 0) {
      // Fuera de vista a la izquierda — apilar verticalmente
      const slotY = H * 0.22 + leftSlot * 50;
      leftSlot++;
      pin.style.left      = '10px';
      pin.style.top       = Math.min(slotY, H - 60) + 'px';
      pin.style.transform = 'translateY(-50%)';
      pin.classList.add('ar-at-edge');
      const ch = pin.querySelector('.ar-edge-chevron');
      if (ch) ch.textContent = '◀';
    } else {
      // Fuera de vista a la derecha — apilar verticalmente
      const slotY = H * 0.22 + rightSlot * 50;
      rightSlot++;
      pin.style.left      = (W - 10) + 'px';
      pin.style.top       = Math.min(slotY, H - 60) + 'px';
      pin.style.transform = 'translate(-100%, -50%)';
      pin.classList.add('ar-at-edge');
      const ch = pin.querySelector('.ar-edge-chevron');
      if (ch) ch.textContent = '▶';
    }
  });

  _updateDirArrow();
}

/* ── Flecha de dirección (planeta seleccionado fuera de vista) ──── */
function _updateDirArrow() {
  const el = document.getElementById('ar-dir-arrow');
  if (!el) return;
  if (_gpsLat === null || !_currentId) { el.style.opacity = '0'; return; }
  const p = SISTEMA_SOLAR[_currentId];
  if (!p || !p.coords) { el.style.opacity = '0'; return; }

  const brg = _bearing(_gpsLat, _gpsLng, p.coords.lat, p.coords.lng);
  const { diff, inView } = _project(brg);

  if (inView) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }

  const W = window.innerWidth, H = window.innerHeight;
  const rad = ((brg - _heading) + 360) % 360 * Math.PI / 180;
  let px = W / 2 + Math.sin(rad) * W * 2;
  let py = H / 2 - Math.cos(rad) * H * 2;

  // Escalar al borde de pantalla con margen
  const margin = 58;
  const sx = px !== W / 2 ? (W / 2 - margin) / Math.abs(px - W / 2) : 1;
  const sy = py !== H / 2 ? (H / 2 - margin) / Math.abs(py - H / 2) : 1;
  const s  = Math.min(sx, sy);
  if (s < 1) { px = W / 2 + (px - W / 2) * s; py = H / 2 + (py - H / 2) * s; }

  const nameEl = document.getElementById('ar-dir-name');
  const iconEl = document.getElementById('ar-dir-icon');
  const distEl = document.getElementById('ar-dir-dist');
  if (nameEl) nameEl.textContent = p.nombre;
  if (iconEl) {
    iconEl.style.color     = p.color;
    iconEl.style.transform = `rotate(${((brg - _heading) + 360) % 360}deg)`;
  }
  if (distEl) distEl.textContent = _fmtDist(_dist(_gpsLat, _gpsLng, p.coords.lat, p.coords.lng));
  el.style.borderColor   = p.color + '88';
  el.style.left          = px + 'px';
  el.style.top           = py + 'px';
  el.style.opacity       = '1';
  el.style.pointerEvents = 'auto';
}

/* ── Selección de planeta ───────────────────────────────────────── */
window.arSelectPlanet = function (id) {
  if (!SISTEMA_SOLAR[id]) return;
  const prev = _currentId;
  _currentId = id;
  window._currentId = id;
  if (prev && _pinMap[prev]) _pinMap[prev].classList.remove('ar-selected');
  if (_pinMap[id]) _pinMap[id].classList.add('ar-selected');
  _updateHUD(SISTEMA_SOLAR[id]);
};

/* ── buildARScene ────────────────────────────────────────────────── */
async function buildARScene(initialPlanetId) {
  const startId = SISTEMA_SOLAR[initialPlanetId] ? initialPlanetId : ORDEN_PLANETAS[0];
  _currentId = startId;
  window._currentId = startId;

  const wrapper = document.getElementById('ar-scene-wrapper');
  if (!wrapper) return;

  // Limpieza de sesión anterior
  wrapper.innerHTML = '';
  Object.keys(_pinMap).forEach(k => delete _pinMap[k]);
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
  if (_rafId   !== null) { cancelAnimationFrame(_rafId); _rafId = null; }

  // iOS 13+: pedir permiso de orientación del dispositivo
  // (debe ocurrir antes del primer await para contar como gesto del usuario)
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch (_) { /* usuario rechazó */ }
  }

  // Elemento <video> para cámara trasera
  const video = document.createElement('video');
  video.id = 'ar-video';
  video.setAttribute('autoplay',    '');
  video.setAttribute('playsinline', '');
  video.setAttribute('muted',       '');
  wrapper.appendChild(video);

  // Contenedor para los pines AR
  const overlay = document.createElement('div');
  overlay.id = 'ar-overlay';
  wrapper.appendChild(overlay);

  // Iniciar cámara trasera (con fallback)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    video.srcObject = stream;
  } catch (_) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
    } catch (err) {
      _setGpsStatus('Cámara no disponible', false);
    }
  }

  // Crear pin DOM para cada planeta
  ORDEN_PLANETAS.forEach(id => {
    const p = SISTEMA_SOLAR[id];
    if (!p) return;
    const pin = _createPin(p);
    overlay.appendChild(pin);
    _pinMap[id] = pin;
  });

  // Selección inicial
  if (_pinMap[startId]) _pinMap[startId].classList.add('ar-selected');
  _updateHUD(SISTEMA_SOLAR[startId]);

  // Ocultar indicador de carga
  const loading = document.getElementById('ar-loading');
  if (loading) loading.style.display = 'none';

  // Iniciar loop de posicionamiento
  _loop();

  // GPS — paso 1: posición rápida desde caché (sin esperar fix preciso)
  if (!('geolocation' in navigator)) { _setGpsStatus('GPS no disponible', false); return; }
  _setGpsStatus('Buscando GPS…', false);

  navigator.geolocation.getCurrentPosition(
    pos => {
      _gpsLat = pos.coords.latitude;
      _gpsLng = pos.coords.longitude;
      _setGpsStatus('GPS ✓', true);
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
  );

  // GPS — paso 2: seguimiento continuo de alta precisión
  _watchId = navigator.geolocation.watchPosition(
    pos => {
      _gpsLat = pos.coords.latitude;
      _gpsLng = pos.coords.longitude;
      _setGpsStatus('GPS ✓', true);
    },
    err => {
      const msgs = ['', 'Permiso denegado', 'Posición no disponible', 'Tiempo agotado'];
      _setGpsStatus('GPS: ' + (msgs[err.code] || err.message), false);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
}
