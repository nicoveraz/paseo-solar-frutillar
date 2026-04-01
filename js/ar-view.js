'use strict';

// ar-view.js — Escena AR con brújula real + GPS
// Cada carta se coloca a VISUAL_DIST metros en la dirección exacta del planeta,
// independientemente de cuán lejos esté el usuario de la costanera.
// buildARScene() es global — invocado desde ar.html.

/* ── Constantes ───────────────────────────────────────────────────── */
const VISUAL_DIST = 8;   // distancia visual fija en escena (metros)

/* ── Estado ───────────────────────────────────────────────────────── */
const _arMap   = {};     // id → { anchor, distEl }
let   _watchId = null;

/* ── Haversine helpers ────────────────────────────────────────────── */
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

// Punto GPS a `distM` metros en dirección `bearingDeg` desde (lat, lon)
function _destPoint(lat, lon, bearingDeg, distM) {
  const R = 6371000, d = distM / R, θ = bearingDeg * Math.PI / 180;
  const φ1 = lat * Math.PI / 180, λ1 = lon * Math.PI / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ)
  );
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(d) * Math.cos(φ1),
    Math.cos(d) - Math.sin(φ1) * Math.sin(φ2)
  );
  return { lat: φ2 * 180 / Math.PI, lng: ((λ2 * 180 / Math.PI) + 540) % 360 - 180 };
}

function _fmtDist(m) {
  if (m < 1000)  return m.toFixed(0) + ' m';
  if (m < 10000) return (m / 1000).toFixed(2) + ' km';
  return (m / 1000).toFixed(1) + ' km';
}

/* ── Punto de entrada ─────────────────────────────────────────────── */
function buildARScene(planetaActual) {
  const wrapper = document.getElementById('ar-scene-wrapper');
  if (!wrapper) return;

  // Limpiar escena y estado anteriores
  wrapper.innerHTML = '';
  Object.keys(_arMap).forEach(k => delete _arMap[k]);
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }

  /* ── Escena A-Frame ─────────────────────────────────────────────── */
  const scene = document.createElement('a-scene');
  scene.setAttribute('vr-mode-ui',      'enabled: false');
  scene.setAttribute('arjs',            'sourceType: webcam; videoTexture: true; debugUIEnabled: false; trackingMethod: best');
  scene.setAttribute('renderer',        'antialias: true; alpha: true; precision: medium');
  scene.setAttribute('embedded',        '');
  scene.setAttribute('loading-screen',  'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
  scene.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';
  scene.appendChild(document.createElement('a-assets'));

  /* Cámara GPS + raycaster para taps */
  const camera = document.createElement('a-camera');
  camera.setAttribute('gps-camera',      '');
  camera.setAttribute('rotation-reader', '');
  camera.setAttribute('look-controls',   'enabled: false');
  camera.setAttribute('cursor',          'rayOrigin: mouse; fuse: false');
  camera.setAttribute('raycaster',       'objects: .ar-tap; far: 1000');
  scene.appendChild(camera);

  /* Luz */
  const light = document.createElement('a-light');
  light.setAttribute('type', 'ambient'); light.setAttribute('color', '#fff'); light.setAttribute('intensity', '1');
  scene.appendChild(light);

  /* Crear entidades con posición inicial = coords reales del planeta
     (se actualizan al recibir el GPS del usuario) */
  ORDEN_PLANETAS.forEach(id => {
    const p = SISTEMA_SOLAR[id];
    if (!p.coords) return;
    const entry = _buildCard(scene, p, planetaActual, id === planetaActual.id,
                             p.coords.lat, p.coords.lng);
    _arMap[id] = entry;
  });

  wrapper.appendChild(scene);
  scene.addEventListener('loaded', () => {
    const el = document.getElementById('ar-loading');
    if (el) el.style.display = 'none';
  });

  /* ── GPS watch: reposiciona cartas en tiempo real ─────────────── */
  if ('geolocation' in navigator) {
    _watchId = navigator.geolocation.watchPosition(
      pos => _reposition(pos.coords.latitude, pos.coords.longitude),
      err => console.warn('AR GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  }
}

/* Recalcula bearings y mueve todas las cartas a VISUAL_DIST en la
   dirección correcta desde la posición actual del usuario. */
function _reposition(userLat, userLng) {
  ORDEN_PLANETAS.forEach(id => {
    const entry = _arMap[id];
    if (!entry) return;
    const p = SISTEMA_SOLAR[id];
    if (!p.coords) return;

    const brg      = _bearing(userLat, userLng, p.coords.lat, p.coords.lng);
    const realDist = _dist(userLat, userLng, p.coords.lat, p.coords.lng);

    // Punto GPS a VISUAL_DIST metros en la dirección del planeta
    const vp = _destPoint(userLat, userLng, brg, VISUAL_DIST);
    entry.anchor.setAttribute('gps-entity-place',
      `latitude: ${vp.lat}; longitude: ${vp.lng}`);

    // Actualizar texto de distancia real
    if (entry.distEl) {
      entry.distEl.setAttribute('value', `📍 ${_fmtDist(realDist)} de aquí`);
    }
  });
}

/* ── Construye una carta o marcador en la escena ──────────────────── */
function _buildCard(scene, planeta, planetaActual, isPrimary, lat, lng) {
  const anchor = document.createElement('a-entity');
  anchor.setAttribute('gps-entity-place', `latitude: ${lat}; longitude: ${lng}`);

  // Billboard: siempre mira hacia la cámara
  const board = document.createElement('a-entity');
  board.setAttribute('look-at', '[gps-camera]');

  let distEl = null;

  if (isPrimary) {
    /* ── Carta completa para el planeta actual ─────────────────── */
    const W = 2.5, H = 1.4, Y = 2.2;

    // Fondo
    const bg = document.createElement('a-plane');
    bg.setAttribute('width',    W.toString());
    bg.setAttribute('height',   H.toString());
    bg.setAttribute('color',    '#060612');
    bg.setAttribute('opacity',  '0.92');
    bg.setAttribute('position', `0 ${Y} 0`);
    bg.setAttribute('animation',
      'property: material.opacity; from: 0.88; to: 0.96; dir: alternate; dur: 2500; loop: true; easing: easeInOutSine');
    board.appendChild(bg);

    // Franja de color izquierda
    const strip = document.createElement('a-plane');
    strip.setAttribute('width',    '0.07');
    strip.setAttribute('height',   H.toString());
    strip.setAttribute('color',    planeta.color);
    strip.setAttribute('position', `${-(W / 2 - 0.035)} ${Y} 0.01`);
    board.appendChild(strip);

    // Nombre
    const nameEl = document.createElement('a-text');
    nameEl.setAttribute('value',    planeta.nombre);
    nameEl.setAttribute('color',    planeta.color);
    nameEl.setAttribute('align',    'left');
    nameEl.setAttribute('width',    '2.4');
    nameEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.44} 0.02`);
    board.appendChild(nameEl);

    // Tipo
    const typeEl = document.createElement('a-text');
    typeEl.setAttribute('value',    planeta.tipo);
    typeEl.setAttribute('color',    '#8888bb');
    typeEl.setAttribute('align',    'left');
    typeEl.setAttribute('width',    '1.8');
    typeEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.20} 0.02`);
    board.appendChild(typeEl);

    // Info del modelo
    const modelLine = planeta.id === 'sol'
      ? '⌀ 45 cm · Centro del sistema'
      : `${planeta.distanciaModeloSol.toFixed(1)} m del Sol  ·  ⌀ ${formatearDiametro(planeta.diametroModelo)}`;
    const modelEl = document.createElement('a-text');
    modelEl.setAttribute('value',    modelLine);
    modelEl.setAttribute('color',    '#ccccdd');
    modelEl.setAttribute('align',    'left');
    modelEl.setAttribute('width',    '2.2');
    modelEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y - 0.06} 0.02`);
    board.appendChild(modelEl);

    // Distancia real (dinámica — se actualiza con el GPS)
    distEl = document.createElement('a-text');
    distEl.setAttribute('value',    'Obteniendo GPS…');
    distEl.setAttribute('color',    '#fdb813');
    distEl.setAttribute('align',    'left');
    distEl.setAttribute('width',    '2.2');
    distEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y - 0.34} 0.02`);
    board.appendChild(distEl);

    // Línea vertical al suelo
    const vline = document.createElement('a-entity');
    vline.setAttribute('line',
      `start: 0 0.01 0; end: 0 ${Y - H / 2 - 0.04} 0; color: ${planeta.color}; opacity: 0.5`);
    board.appendChild(vline);

    // Punto en el suelo
    const gdot = document.createElement('a-circle');
    gdot.setAttribute('radius',   '0.18');
    gdot.setAttribute('color',    planeta.color);
    gdot.setAttribute('opacity',  '0.65');
    gdot.setAttribute('position', '0 0.02 0');
    gdot.setAttribute('rotation', '-90 0 0');
    board.appendChild(gdot);

  } else {
    /* ── Marcador pequeño (tapable → navega) ─────────────────────── */
    const dotY = 1.6;

    // Círculo coloreado
    const dot = document.createElement('a-circle');
    dot.setAttribute('radius',   '0.22');
    dot.setAttribute('color',    planeta.color);
    dot.setAttribute('opacity',  '0.75');
    dot.setAttribute('position', `0 ${dotY} 0`);
    dot.classList.add('ar-tap');
    dot.addEventListener('click',     () => { window.location.href = `ar.html?planet=${planeta.id}`; });
    dot.addEventListener('mousedown', () => dot.setAttribute('opacity', '1'));
    dot.addEventListener('mouseup',   () => dot.setAttribute('opacity', '0.75'));
    board.appendChild(dot);

    // Nombre (solo)
    const lbl = document.createElement('a-text');
    lbl.setAttribute('value',    planeta.nombre);
    lbl.setAttribute('color',    planeta.color);
    lbl.setAttribute('align',    'center');
    lbl.setAttribute('width',    '1.4');
    lbl.setAttribute('position', `0 ${dotY + 0.44} 0`);
    board.appendChild(lbl);

    // Línea vertical sutil + punto suelo
    const vline = document.createElement('a-entity');
    vline.setAttribute('line',
      `start: 0 0.01 0; end: 0 ${dotY - 0.22} 0; color: ${planeta.color}; opacity: 0.25`);
    board.appendChild(vline);
    const gdot = document.createElement('a-circle');
    gdot.setAttribute('radius',   '0.07');
    gdot.setAttribute('color',    planeta.color);
    gdot.setAttribute('opacity',  '0.4');
    gdot.setAttribute('position', '0 0.02 0');
    gdot.setAttribute('rotation', '-90 0 0');
    board.appendChild(gdot);

    // distEl = null (sin texto de distancia en marcadores secundarios)
  }

  anchor.appendChild(board);
  scene.appendChild(anchor);
  return { anchor, distEl };
}

/* ── Brújula (opcional, para indicador UI externo) ────────────────── */
function _updateCompass(e) {
  const el = document.getElementById('compass-arrow');
  if (!el) return;
  el.style.transform = `rotate(${-(e.alpha || 0)}deg)`;
}
window.addEventListener('deviceorientationabsolute', _updateCompass);
window.addEventListener('deviceorientation',         _updateCompass);
