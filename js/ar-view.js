'use strict';

// ar-view.js — AR estilo Google Maps Live View
// • Pin 3D (esfera + tallo) para cada planeta, siempre visible
// • Etiqueta nombre + distancia en billboard sobre cada pin
// • Carta de detalles para el planeta seleccionado
// • Flecha HTML 2D en el borde de pantalla cuando el planeta está fuera de vista

/* ── Constantes ─────────────────────────────────────────────────── */
const VISUAL_DIST = 8;   // metros fijos en escena

/* ── Estado ─────────────────────────────────────────────────────── */
let _gpsLat      = null;
let _gpsLng      = null;
let _heading     = 0;     // rumbo del dispositivo (deviceorientationabsolute)
let _watchId     = null;
let _rafId       = null;
let _currentId   = null;
const _arMap     = {};    // id → entity (con .cardEl, ._distEl)

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
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function _fmtDist(m) {
  return m < 1000 ? m.toFixed(0) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
}

/* ── Rumbo del dispositivo ──────────────────────────────────────── */
function _onOrientation(e) {
  if (e.absolute || e.webkitCompassHeading != null) {
    _heading = e.webkitCompassHeading != null
      ? e.webkitCompassHeading            // iOS
      : (360 - (e.alpha || 0)) % 360;     // Android absolute
  }
}
window.addEventListener('deviceorientationabsolute', _onOrientation);
window.addEventListener('deviceorientation',         _onOrientation);

/* ── Componente A-Frame: posicionamiento tick-based ─────────────── */
if (typeof AFRAME !== 'undefined' && !AFRAME.components['ar-compass-target']) {
  AFRAME.registerComponent('ar-compass-target', {
    schema: { lat: { type: 'float' }, lng: { type: 'float' } },
    init() { this._td = 0; },
    tick(time) {
      if (_gpsLat === null) return;
      const rad = _bearing(_gpsLat, _gpsLng, this.data.lat, this.data.lng) * Math.PI / 180;
      this.el.object3D.position.x =  Math.sin(rad) * VISUAL_DIST;
      this.el.object3D.position.z = -Math.cos(rad) * VISUAL_DIST;
      // Actualizar distancia cada 2 s
      if (this.el._distEl && time - this._td > 2000) {
        this._td = time;
        const d = _dist(_gpsLat, _gpsLng, this.data.lat, this.data.lng);
        this.el._distEl.setAttribute('value', _fmtDist(d));
      }
    }
  });
}

/* ── Flecha 2D de dirección (rAF loop) ──────────────────────────── */
function _arrowLoop() {
  _rafId = requestAnimationFrame(_arrowLoop);
  const el = document.getElementById('ar-dir-arrow');
  if (!el) return;

  if (_gpsLat === null || !_currentId) {
    el.style.opacity = '0';
    return;
  }
  const p = SISTEMA_SOLAR[_currentId];
  if (!p || !p.coords) { el.style.opacity = '0'; return; }

  const brg  = _bearing(_gpsLat, _gpsLng, p.coords.lat, p.coords.lng);
  const diff = ((brg - _heading) + 360) % 360; // 0=ahead,90=right,180=behind,270=left
  const rad  = diff * Math.PI / 180;

  // Actualizar nombre y color
  const nameEl = document.getElementById('ar-dir-name');
  const iconEl = document.getElementById('ar-dir-icon');
  if (nameEl) nameEl.textContent = p.nombre;
  if (iconEl) iconEl.style.color = p.color;
  el.style.borderColor = p.color + '88';

  // Distancia
  const distEl = document.getElementById('ar-dir-dist');
  if (distEl) distEl.textContent = _fmtDist(_dist(_gpsLat, _gpsLng, p.coords.lat, p.coords.lng));

  // Rotar la flecha
  if (iconEl) iconEl.style.transform = `rotate(${diff}deg)`;

  // Posición en el borde de la pantalla
  const W = window.innerWidth, H = window.innerHeight;
  const cx = W / 2, cy = H / 2;
  const margin = 56;
  const maxR = Math.min(cx, cy) - margin;
  // punto sobre la circunferencia
  let px = cx + Math.sin(rad) * maxR * 1.5;
  let py = cy - Math.cos(rad) * maxR * 1.5;
  // clamp a borde de pantalla
  px = Math.max(margin, Math.min(W - margin, px));
  py = Math.max(margin + 20, Math.min(H - margin - 60, py));

  el.style.left = px + 'px';
  el.style.top  = py + 'px';

  // Ocultar cuando el planeta está en el campo de visión (±25°)
  const inView = diff < 25 || diff > 335;
  el.style.opacity = inView ? '0' : '1';
  el.style.pointerEvents = inView ? 'none' : 'auto';
}

/* ── Selección de planeta ───────────────────────────────────────── */
window.arSelectPlanet = function (id) {
  if (!SISTEMA_SOLAR[id]) return;
  _currentId = id;
  ORDEN_PLANETAS.forEach(pid => {
    const e = _arMap[pid];
    if (!e || !e.cardEl.object3D) return;
    e.cardEl.object3D.visible = pid === id;
  });
  _updateHUD(SISTEMA_SOLAR[id]);
};

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
    if (prev) { pb.onclick = e => { e.preventDefault(); arSelectPlanet(prev.id); }; $('hud-prev-label').textContent = prev.nombre; }
  }
  const nb = $('hud-btn-next');
  if (nb) {
    nb.style.display = next ? 'flex' : 'none';
    if (next) { nb.onclick = e => { e.preventDefault(); arSelectPlanet(next.id); }; $('hud-next-label').textContent = next.nombre; }
  }
}

function _setGpsStatus(msg, ok) {
  const el = document.getElementById('ar-gps-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color  = ok ? '#88ff88' : '#ffaa44';
}

/* ── buildARScene ───────────────────────────────────────────────── */
function buildARScene(initialPlanetId) {
  const startId = SISTEMA_SOLAR[initialPlanetId] ? initialPlanetId : ORDEN_PLANETAS[0];
  _currentId = startId;

  const wrapper = document.getElementById('ar-scene-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '';
  Object.keys(_arMap).forEach(k => delete _arMap[k]);
  _gpsLat = null; _gpsLng = null;
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
  if (_rafId  !== null) { cancelAnimationFrame(_rafId); _rafId = null; }

  /* Escena */
  const scene = document.createElement('a-scene');
  scene.setAttribute('vr-mode-ui',      'enabled: false');
  scene.setAttribute('arjs',            'sourceType: webcam; videoTexture: true; debugUIEnabled: false; trackingMethod: best');
  scene.setAttribute('renderer',        'antialias: true; alpha: true; precision: medium');
  scene.setAttribute('embedded',        '');
  scene.setAttribute('loading-screen',  'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
  scene.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';
  scene.appendChild(document.createElement('a-assets'));

  const camera = document.createElement('a-camera');
  camera.setAttribute('gps-camera',      '');
  camera.setAttribute('rotation-reader', '');
  camera.setAttribute('look-controls',   'enabled: false');
  camera.setAttribute('cursor',          'rayOrigin: mouse; fuse: false');
  camera.setAttribute('raycaster',       'objects: .ar-tap; far: 1000');
  scene.appendChild(camera);

  const light = document.createElement('a-light');
  light.setAttribute('type', 'ambient'); light.setAttribute('color', '#fff'); light.setAttribute('intensity', '1');
  scene.appendChild(light);

  /* Entidades */
  ORDEN_PLANETAS.forEach((id, i) => {
    const p = SISTEMA_SOLAR[id];
    if (!p.coords) return;
    const angle = (i / ORDEN_PLANETAS.length) * 140 - 70;
    const ix = +(VISUAL_DIST * Math.sin(angle * Math.PI / 180)).toFixed(2);
    const iz = +(-VISUAL_DIST * Math.cos(angle * Math.PI / 180)).toFixed(2);
    const entity = _buildEntity(p, id === startId, ix, iz);
    scene.appendChild(entity);
    _arMap[id] = entity;
  });

  wrapper.appendChild(scene);

  scene.addEventListener('loaded', () => {
    // Visibilidad inicial de cartas
    ORDEN_PLANETAS.forEach(id => {
      const e = _arMap[id];
      if (e && e.cardEl && e.cardEl.object3D) e.cardEl.object3D.visible = id === startId;
    });
    const el = document.getElementById('ar-loading');
    if (el) el.style.display = 'none';
  });

  _updateHUD(SISTEMA_SOLAR[startId]);
  _arrowLoop(); // inicia el loop de la flecha

  /* GPS */
  if (!('geolocation' in navigator)) { _setGpsStatus('GPS no disponible', false); return; }
  _setGpsStatus('Buscando GPS…', false);
  navigator.geolocation.getCurrentPosition(
    pos => { _gpsLat = pos.coords.latitude; _gpsLng = pos.coords.longitude; _setGpsStatus('GPS ✓', true); },
    () => {},
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
  );
  _watchId = navigator.geolocation.watchPosition(
    pos => { _gpsLat = pos.coords.latitude; _gpsLng = pos.coords.longitude; _setGpsStatus('GPS ✓', true); },
    err  => { const m = ['','Permiso denegado','Posición no disponible','Tiempo agotado']; _setGpsStatus('GPS: ' + (m[err.code] || err.message), false); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
}

/* ── Construye la entidad completa de un planeta ────────────────── */
function _buildEntity(planeta, isSelected, ix, iz) {
  const entity = document.createElement('a-entity');
  entity.setAttribute('position', `${ix} 0 ${iz}`);
  entity.setAttribute('ar-compass-target', `lat: ${planeta.coords.lat}; lng: ${planeta.coords.lng}`);

  /* ── Pin 3D (siempre visible) ──────────────────────────────── */
  // Esfera (cabeza del pin)
  const head = document.createElement('a-sphere');
  head.setAttribute('radius',   '0.22');
  head.setAttribute('color',    planeta.color);
  head.setAttribute('position', '0 2.4 0');
  head.setAttribute('shader',   'flat');
  head.classList.add('ar-tap');
  head.addEventListener('click', () => arSelectPlanet(planeta.id));
  entity.appendChild(head);

  // Tallo del pin
  const stem = document.createElement('a-cylinder');
  stem.setAttribute('radius',   '0.05');
  stem.setAttribute('height',   '0.55');
  stem.setAttribute('color',    planeta.color);
  stem.setAttribute('position', '0 1.97 0');
  stem.setAttribute('shader',   'flat');
  entity.appendChild(stem);

  // Anillo en el suelo
  const ring = document.createElement('a-ring');
  ring.setAttribute('radius-inner', '0.10');
  ring.setAttribute('radius-outer', '0.28');
  ring.setAttribute('color',        planeta.color);
  ring.setAttribute('opacity',      '0.40');
  ring.setAttribute('position',     '0 0.01 0');
  ring.setAttribute('rotation',     '-90 0 0');
  entity.appendChild(ring);

  /* ── Etiquetas billboard (nombre + distancia, siempre visible) ─ */
  const labels = document.createElement('a-entity');
  labels.setAttribute('look-at', '[gps-camera]');

  const nameEl = document.createElement('a-text');
  nameEl.setAttribute('value',    planeta.nombre);
  nameEl.setAttribute('color',    '#ffffff');
  nameEl.setAttribute('align',    'center');
  nameEl.setAttribute('width',    '1.6');
  nameEl.setAttribute('position', '0 2.88 0');
  labels.appendChild(nameEl);

  const distEl = document.createElement('a-text');
  distEl.setAttribute('value',    '…');
  distEl.setAttribute('color',    '#aaccff');
  distEl.setAttribute('align',    'center');
  distEl.setAttribute('width',    '1.2');
  distEl.setAttribute('position', '0 2.56 0');
  labels.appendChild(distEl);

  entity.appendChild(labels);
  entity._distEl = distEl;  // tick lo actualiza

  /* ── Carta de detalles (solo planeta seleccionado) ─────────── */
  const cardEl = _buildInfoCard(planeta);
  entity.appendChild(cardEl);
  entity.cardEl = cardEl;

  return entity;
}

/* ── Carta de detalles flotante (estilo Google Maps place card) ─── */
function _buildInfoCard(planeta) {
  const el   = document.createElement('a-entity');
  const look = document.createElement('a-entity');
  look.setAttribute('look-at', '[gps-camera]');

  const W = 2.6, H = 1.3, Y = 4.0;

  // Fondo
  const bg = document.createElement('a-plane');
  bg.setAttribute('width',    W.toString());
  bg.setAttribute('height',   H.toString());
  bg.setAttribute('color',    '#080818');
  bg.setAttribute('opacity',  '0.93');
  bg.setAttribute('position', `0 ${Y} 0`);
  look.appendChild(bg);

  // Barra de color superior
  const bar = document.createElement('a-plane');
  bar.setAttribute('width',    W.toString());
  bar.setAttribute('height',   '0.18');
  bar.setAttribute('color',    planeta.color);
  bar.setAttribute('position', `0 ${Y + H / 2 - 0.09} 0.01`);
  look.appendChild(bar);

  // Nombre
  const nm = document.createElement('a-text');
  nm.setAttribute('value',    planeta.nombre);
  nm.setAttribute('color',    planeta.color);
  nm.setAttribute('align',    'left');
  nm.setAttribute('width',    '2.4');
  nm.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.36} 0.02`);
  look.appendChild(nm);

  // Datos reales
  const realLine = planeta.id === 'sol'
    ? '\u2300 1.392.000 km'
    : `${planeta.distanciaRealSol.toLocaleString('es-CL')} M km  \u00b7  \u2300 ${planeta.diametroReal.toLocaleString('es-CL')} km`;
  const rl = document.createElement('a-text');
  rl.setAttribute('value',    realLine);
  rl.setAttribute('color',    '#dde0f5');
  rl.setAttribute('align',    'left');
  rl.setAttribute('width',    '2.3');
  rl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.10} 0.02`);
  look.appendChild(rl);

  // Datos en modelo (amarillo)
  const modelLine = planeta.id === 'sol'
    ? 'Modelo: \u2300 45 cm'
    : `Modelo: ${planeta.distanciaModeloSol.toFixed(1)} m  \u00b7  \u2300 ${formatearDiametro(planeta.diametroModelo)}`;
  const ml = document.createElement('a-text');
  ml.setAttribute('value',    modelLine);
  ml.setAttribute('color',    '#fdb813');
  ml.setAttribute('align',    'left');
  ml.setAttribute('width',    '2.3');
  ml.setAttribute('position', `${-(W / 2 - 0.18)} ${Y - 0.18} 0.02`);
  look.appendChild(ml);

  // Línea de conexión pin → carta
  const line = document.createElement('a-entity');
  line.setAttribute('line', `start: 0 2.63 0; end: 0 ${Y - H / 2} 0; color: ${planeta.color}; opacity: 0.4`);
  look.appendChild(line);

  el.appendChild(look);
  return el;
}
