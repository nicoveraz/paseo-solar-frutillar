'use strict';

// ar-view.js — Una sola experiencia AR para todo el sistema solar.
// buildARScene(initialPlanetId) es global — invocado desde ar.html.
// window.arSelectPlanet(id) es global — invocado por HUD prev/next y tap.

/* ── Constantes ─────────────────────────────────────────────────── */
const VISUAL_DIST = 8;   // metros fijos en escena (siempre visible)

/* ── Estado global ──────────────────────────────────────────────── */
let _gpsLat     = null;
let _gpsLng     = null;
let _watchId    = null;
let _currentId  = null;
const _arMap    = {};    // id → { entity, cardEl, markerEl }

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

/* ── Componente A-Frame: posicionamiento en tiempo real por brújula ─ */
// Registrar ANTES de crear la escena (se ejecuta al cargar el script)
if (typeof AFRAME !== 'undefined' && !AFRAME.components['ar-compass-target']) {
  AFRAME.registerComponent('ar-compass-target', {
    schema: { lat: { type: 'float' }, lng: { type: 'float' } },
    init() { this._tDist = 0; },
    tick(time) {
      if (_gpsLat === null) return;
      const brg = _bearing(_gpsLat, _gpsLng, this.data.lat, this.data.lng);
      const rad = brg * Math.PI / 180;
      // Posición fija a VISUAL_DIST metros en la dirección del planeta
      this.el.object3D.position.x =  Math.sin(rad) * VISUAL_DIST;
      this.el.object3D.position.z = -Math.cos(rad) * VISUAL_DIST;
      // Actualizar distancia real cada 2 s
      if (this.el._distEl && time - this._tDist > 2000) {
        this._tDist = time;
        const d = _dist(_gpsLat, _gpsLng, this.data.lat, this.data.lng);
        this.el._distEl.setAttribute('value', _fmtDist(d) + ' de aquí');
      }
    }
  });
}

/* ── Selección de planeta (global — llamado por HUD y tap) ──────── */
window.arSelectPlanet = function (id) {
  if (!SISTEMA_SOLAR[id]) return;
  _currentId = id;
  ORDEN_PLANETAS.forEach(pid => {
    const e = _arMap[pid];
    if (!e) return;
    // object3D.visible es más fiable que setAttribute después del attach
    if (e.cardEl.object3D)   e.cardEl.object3D.visible   = pid === id;
    if (e.markerEl.object3D) e.markerEl.object3D.visible = pid !== id;
  });
  _updateHUD(SISTEMA_SOLAR[id]);
};

/* ── Actualizar HUD ─────────────────────────────────────────────── */
function _updateHUD(planeta) {
  const $ = id => document.getElementById(id);

  const dotEl = $('hud-dot');
  if (dotEl) {
    dotEl.style.background = `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4), ${planeta.color})`;
    dotEl.style.boxShadow  = `0 0 8px ${planeta.color}88`;
  }
  const nameEl = $('hud-name');
  if (nameEl) nameEl.textContent = planeta.nombre;

  const subEl = $('hud-sub');
  if (subEl) subEl.textContent = planeta.id !== 'sol'
    ? `⌀ ${planeta.diametroReal.toLocaleString('es-CL')} km · ${planeta.distanciaModeloSol.toFixed(1)} m del Sol`
    : '⌀ 1.392.000 km · Centro del sistema';

  const infoBtn = $('hud-btn-info');
  if (infoBtn) infoBtn.href = `planet.html?planet=${planeta.id}`;

  const prev = getPlanetaAnterior(planeta.id);
  const next = getPlanetaSiguiente(planeta.id);

  const prevBtn = $('hud-btn-prev');
  if (prevBtn) {
    prevBtn.style.display = prev ? 'flex' : 'none';
    if (prev) {
      prevBtn.onclick = e => { e.preventDefault(); arSelectPlanet(prev.id); };
      const lbl = $('hud-prev-label');
      if (lbl) lbl.textContent = prev.nombre;
    }
  }
  const nextBtn = $('hud-btn-next');
  if (nextBtn) {
    nextBtn.style.display = next ? 'flex' : 'none';
    if (next) {
      nextBtn.onclick = e => { e.preventDefault(); arSelectPlanet(next.id); };
      const lbl = $('hud-next-label');
      if (lbl) lbl.textContent = next.nombre;
    }
  }
}

/* ── GPS status ─────────────────────────────────────────────────── */
function _setGpsStatus(msg, ok) {
  const el = document.getElementById('ar-gps-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#88ff88' : '#ffaa44';
}

/* ── buildARScene ───────────────────────────────────────────────── */
function buildARScene(initialPlanetId) {
  const startId = SISTEMA_SOLAR[initialPlanetId] ? initialPlanetId : ORDEN_PLANETAS[0];
  _currentId = startId;

  const wrapper = document.getElementById('ar-scene-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '';
  Object.keys(_arMap).forEach(k => delete _arMap[k]);

  // Limpiar GPS anterior
  _gpsLat = null; _gpsLng = null;
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }

  /* ── Escena ──────────────────────────────────────────────────── */
  const scene = document.createElement('a-scene');
  scene.setAttribute('vr-mode-ui',      'enabled: false');
  scene.setAttribute('arjs',            'sourceType: webcam; videoTexture: true; debugUIEnabled: false; trackingMethod: best');
  scene.setAttribute('renderer',        'antialias: true; alpha: true; precision: medium');
  scene.setAttribute('embedded',        '');
  scene.setAttribute('loading-screen',  'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
  scene.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';
  scene.appendChild(document.createElement('a-assets'));

  /* Cámara GPS (orientación de brújula) */
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

  /* ── Entidades ───────────────────────────────────────────────── */
  ORDEN_PLANETAS.forEach((id, i) => {
    const p = SISTEMA_SOLAR[id];
    if (!p.coords) return;

    // Posición inicial en abanico (antes de GPS)
    const angle = (i / ORDEN_PLANETAS.length) * 140 - 70;
    const ix = +(VISUAL_DIST * Math.sin(angle * Math.PI / 180)).toFixed(2);
    const iz = +(-VISUAL_DIST * Math.cos(angle * Math.PI / 180)).toFixed(2);

    const entity = document.createElement('a-entity');
    entity.setAttribute('position', `${ix} 0 ${iz}`);
    entity.setAttribute('look-at',  '[gps-camera]');
    entity.setAttribute('ar-compass-target', `lat: ${p.coords.lat}; lng: ${p.coords.lng}`);

    // Carta + marcador — visibilidad inicial aplicada en scene 'loaded'
    const { el: cardEl, distEl } = _buildCard(p);
    entity.appendChild(cardEl);
    entity.cardEl  = cardEl;
    entity._distEl = distEl;  // para el tick

    const markerEl = _buildMarker(p);
    entity.appendChild(markerEl);
    entity.markerEl = markerEl;

    scene.appendChild(entity);
    _arMap[id] = entity;
  });

  wrapper.appendChild(scene);
  scene.addEventListener('loaded', () => {
    // Aplicar visibilidad inicial DESPUÉS de que object3D esté listo
    ORDEN_PLANETAS.forEach(id => {
      const e = _arMap[id];
      if (!e) return;
      if (e.cardEl.object3D)   e.cardEl.object3D.visible   = id === startId;
      if (e.markerEl.object3D) e.markerEl.object3D.visible = id !== startId;
    });
    const el = document.getElementById('ar-loading');
    if (el) el.style.display = 'none';
  });

  // Inicializar HUD con el planeta de partida
  _updateHUD(SISTEMA_SOLAR[startId]);

  /* ── GPS ─────────────────────────────────────────────────────── */
  if (!('geolocation' in navigator)) {
    _setGpsStatus('GPS no disponible en este dispositivo', false);
    return;
  }

  _setGpsStatus('Buscando GPS…', false);

  // Primer fix rápido (baja precisión, acepta caché reciente)
  navigator.geolocation.getCurrentPosition(
    pos => {
      _gpsLat = pos.coords.latitude;
      _gpsLng = pos.coords.longitude;
      _setGpsStatus('GPS ✓', true);
    },
    () => { /* silencioso — watchPosition puede tener más suerte */ },
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
  );

  // Watch de alta precisión para actualizaciones continuas
  _watchId = navigator.geolocation.watchPosition(
    pos => {
      _gpsLat = pos.coords.latitude;
      _gpsLng = pos.coords.longitude;
      _setGpsStatus('GPS ✓', true);
    },
    err => {
      const msgs = ['', 'Permiso denegado', 'Posición no disponible', 'Tiempo de espera agotado'];
      _setGpsStatus('GPS: ' + (msgs[err.code] || err.message), false);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
}

/* ── Construye la carta 3D (estado seleccionado) ────────────────── */
function _buildCard(planeta) {
  const el = document.createElement('a-entity');
  const W = 2.5, H = 1.55, Y = 2.1;

  const bg = document.createElement('a-plane');
  bg.setAttribute('width',    W.toString());
  bg.setAttribute('height',   H.toString());
  bg.setAttribute('color',    '#060612');
  bg.setAttribute('opacity',  '0.92');
  bg.setAttribute('position', `0 ${Y} 0`);
  bg.setAttribute('animation', 'property: material.opacity; from: 0.87; to: 0.95; dir: alternate; dur: 2500; loop: true; easing: easeInOutSine');
  el.appendChild(bg);

  const strip = document.createElement('a-plane');
  strip.setAttribute('width',    '0.07');
  strip.setAttribute('height',   H.toString());
  strip.setAttribute('color',    planeta.color);
  strip.setAttribute('position', `${-(W / 2 - 0.035)} ${Y} 0.01`);
  el.appendChild(strip);

  const nameEl = document.createElement('a-text');
  nameEl.setAttribute('value',    planeta.nombre);
  nameEl.setAttribute('color',    planeta.color);
  nameEl.setAttribute('align',    'left');
  nameEl.setAttribute('width',    '2.4');
  nameEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.52} 0.02`);
  el.appendChild(nameEl);

  const realLine = planeta.id === 'sol'
    ? '\u2300 1.392.000 km'
    : `${planeta.distanciaRealSol.toLocaleString('es-CL')} M km  \u00b7  \u2300 ${planeta.diametroReal.toLocaleString('es-CL')} km`;
  const realEl = document.createElement('a-text');
  realEl.setAttribute('value',    realLine);
  realEl.setAttribute('color',    '#dde0f5');
  realEl.setAttribute('align',    'left');
  realEl.setAttribute('width',    '2.2');
  realEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.24} 0.02`);
  el.appendChild(realEl);

  const modelLine = planeta.id === 'sol'
    ? 'Modelo: \u2300 45 cm'
    : `Modelo: ${planeta.distanciaModeloSol.toFixed(1)} m  \u00b7  \u2300 ${formatearDiametro(planeta.diametroModelo)}`;
  const modelEl = document.createElement('a-text');
  modelEl.setAttribute('value',    modelLine);
  modelEl.setAttribute('color',    '#fdb813');
  modelEl.setAttribute('align',    'left');
  modelEl.setAttribute('width',    '2.2');
  modelEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y - 0.06} 0.02`);
  el.appendChild(modelEl);

  // Distancia real desde el usuario — actualizada por tick
  const distEl = document.createElement('a-text');
  distEl.setAttribute('value',    'Buscando GPS\u2026');
  distEl.setAttribute('color',    '#88bbff');
  distEl.setAttribute('align',    'left');
  distEl.setAttribute('width',    '2.2');
  distEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y - 0.38} 0.02`);
  el.appendChild(distEl);

  const vline = document.createElement('a-entity');
  vline.setAttribute('line', `start: 0 0.01 0; end: 0 ${Y - H / 2 - 0.04} 0; color: ${planeta.color}; opacity: 0.5`);
  el.appendChild(vline);

  const gdot = document.createElement('a-circle');
  gdot.setAttribute('radius',   '0.18');
  gdot.setAttribute('color',    planeta.color);
  gdot.setAttribute('opacity',  '0.65');
  gdot.setAttribute('position', '0 0.02 0');
  gdot.setAttribute('rotation', '-90 0 0');
  el.appendChild(gdot);

  return { el, distEl };
}

/* ── Construye el marcador 3D (estado no seleccionado, tapable) ─── */
function _buildMarker(planeta) {
  const el   = document.createElement('a-entity');
  const dotY = 1.5;

  const dot = document.createElement('a-circle');
  dot.setAttribute('radius',   '0.20');
  dot.setAttribute('color',    planeta.color);
  dot.setAttribute('opacity',  '0.75');
  dot.setAttribute('position', `0 ${dotY} 0`);
  dot.classList.add('ar-tap');
  dot.addEventListener('click',     () => arSelectPlanet(planeta.id));
  dot.addEventListener('mousedown', () => dot.setAttribute('opacity', '1'));
  dot.addEventListener('mouseup',   () => dot.setAttribute('opacity', '0.75'));
  el.appendChild(dot);

  const lbl = document.createElement('a-text');
  lbl.setAttribute('value',    planeta.nombre);
  lbl.setAttribute('color',    planeta.color);
  lbl.setAttribute('align',    'center');
  lbl.setAttribute('width',    '1.3');
  lbl.setAttribute('position', `0 ${dotY + 0.42} 0`);
  el.appendChild(lbl);

  const vline = document.createElement('a-entity');
  vline.setAttribute('line', `start: 0 0.01 0; end: 0 ${dotY - 0.20} 0; color: ${planeta.color}; opacity: 0.22`);
  el.appendChild(vline);

  const gdot = document.createElement('a-circle');
  gdot.setAttribute('radius',   '0.06');
  gdot.setAttribute('color',    planeta.color);
  gdot.setAttribute('opacity',  '0.35');
  gdot.setAttribute('position', '0 0.02 0');
  gdot.setAttribute('rotation', '-90 0 0');
  el.appendChild(gdot);

  return el;
}

/* ── Brújula HUD ────────────────────────────────────────────────── */
function _updateCompass(e) {
  const el = document.getElementById('compass-arrow');
  if (!el) return;
  el.style.transform = `rotate(${-(e.alpha || 0)}deg)`;
}
window.addEventListener('deviceorientationabsolute', _updateCompass);
window.addEventListener('deviceorientation',         _updateCompass);
