'use strict';

// ar-view.js
// Cada carta se posiciona a VISUAL_DIST metros en la dirección de brújula
// hacia el planeta, usando la posición GPS real del usuario.
// Los entities NO usan gps-entity-place — se colocan directamente en
// coordenadas de escena (origin = inicio sesión) para garantizar visibilidad
// sin importar la distancia real a la costanera.
// buildARScene() es global — invocado desde ar.html.

const VISUAL_DIST = 8;   // metros visuales fijos en escena
const _arMap      = {};  // id → { entity, distEl }
let   _watchId    = null;

/* ── Haversine ─────────────────────────────────────────────────── */
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

/* ── buildARScene ─────────────────────────────────────────────── */
function buildARScene(planetaActual) {
  const wrapper = document.getElementById('ar-scene-wrapper');
  if (!wrapper) return;

  wrapper.innerHTML = '';
  Object.keys(_arMap).forEach(k => delete _arMap[k]);
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }

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

  /* Cámara — gps-camera para orientación + brújula */
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

  /* Crear entidades en posición inicial (8 m al norte) — serán
     reposicionadas cuando llegue el GPS */
  ORDEN_PLANETAS.forEach((id, i) => {
    const p = SISTEMA_SOLAR[id];
    if (!p.coords) return;
    const isPrimary = id === planetaActual.id;

    // Posición inicial: distribuidas en abanico al norte para que al menos
    // algo sea visible mientras espera el GPS
    const initAngle = (i / ORDEN_PLANETAS.length) * 120 - 60; // -60° … +60°
    const ix = VISUAL_DIST * Math.sin(initAngle * Math.PI / 180);
    const iz = -VISUAL_DIST * Math.cos(initAngle * Math.PI / 180);

    const entity = _buildCard(p, planetaActual, isPrimary, ix, iz);
    scene.appendChild(entity);
    _arMap[id] = entity;
  });

  wrapper.appendChild(scene);
  scene.addEventListener('loaded', () => {
    const el = document.getElementById('ar-loading');
    if (el) el.style.display = 'none';
  });

  /* GPS watch — reposiciona en tiempo real */
  if ('geolocation' in navigator) {
    _watchId = navigator.geolocation.watchPosition(
      pos => _reposition(pos.coords.latitude, pos.coords.longitude),
      err => console.warn('AR GPS:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  }
}

/* Calcula la posición de escena para cada planeta y actualiza */
function _reposition(userLat, userLng) {
  ORDEN_PLANETAS.forEach(id => {
    const entity = _arMap[id];
    if (!entity) return;
    const p = SISTEMA_SOLAR[id];
    if (!p.coords) return;

    const brg = _bearing(userLat, userLng, p.coords.lat, p.coords.lng);
    const x   = (VISUAL_DIST * Math.sin(brg * Math.PI / 180)).toFixed(2);
    const z   = (-VISUAL_DIST * Math.cos(brg * Math.PI / 180)).toFixed(2);
    entity.setAttribute('position', `${x} 0 ${z}`);
  });
}

/* ── Construye una entidad (carta o marcador) ─────────────────── */
function _buildCard(planeta, planetaActual, isPrimary, ix, iz) {
  const entity = document.createElement('a-entity');
  entity.setAttribute('position', `${ix.toFixed(2)} 0 ${iz.toFixed(2)}`);
  entity.setAttribute('look-at',  '[gps-camera]');

  if (isPrimary) {
    const W = 2.5, H = 1.2, Y = 2.0;

    /* Fondo */
    const bg = document.createElement('a-plane');
    bg.setAttribute('width',    W.toString());
    bg.setAttribute('height',   H.toString());
    bg.setAttribute('color',    '#060612');
    bg.setAttribute('opacity',  '0.92');
    bg.setAttribute('position', `0 ${Y} 0`);
    bg.setAttribute('animation',
      'property: material.opacity; from: 0.87; to: 0.95; dir: alternate; dur: 2500; loop: true; easing: easeInOutSine');
    entity.appendChild(bg);

    /* Franja de color izquierda */
    const strip = document.createElement('a-plane');
    strip.setAttribute('width',    '0.07');
    strip.setAttribute('height',   H.toString());
    strip.setAttribute('color',    planeta.color);
    strip.setAttribute('position', `${-(W / 2 - 0.035)} ${Y} 0.01`);
    entity.appendChild(strip);

    /* Nombre */
    const nameEl = document.createElement('a-text');
    nameEl.setAttribute('value',    planeta.nombre);
    nameEl.setAttribute('color',    planeta.color);
    nameEl.setAttribute('align',    'left');
    nameEl.setAttribute('width',    '2.4');
    nameEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.36} 0.02`);
    entity.appendChild(nameEl);

    /* Datos reales: distancia al Sol + diámetro */
    const realLine = planeta.id === 'sol'
      ? '\u2300 1.392.000 km'
      : `${planeta.distanciaRealSol.toLocaleString('es-CL')} M km  \u00b7  \u2300 ${planeta.diametroReal.toLocaleString('es-CL')} km`;
    const realEl = document.createElement('a-text');
    realEl.setAttribute('value',    realLine);
    realEl.setAttribute('color',    '#e0e0f0');
    realEl.setAttribute('align',    'left');
    realEl.setAttribute('width',    '2.2');
    realEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.10} 0.02`);
    entity.appendChild(realEl);

    /* Datos en modelo (amarillo) */
    const modelLine = planeta.id === 'sol'
      ? 'Modelo: \u2300 45 cm'
      : `Modelo: ${planeta.distanciaModeloSol.toFixed(1)} m  \u00b7  \u2300 ${formatearDiametro(planeta.diametroModelo)}`;
    const modelEl = document.createElement('a-text');
    modelEl.setAttribute('value',    modelLine);
    modelEl.setAttribute('color',    '#fdb813');
    modelEl.setAttribute('align',    'left');
    modelEl.setAttribute('width',    '2.2');
    modelEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y - 0.18} 0.02`);
    entity.appendChild(modelEl);

    /* Línea vertical al suelo */
    const vline = document.createElement('a-entity');
    vline.setAttribute('line',
      `start: 0 0.01 0; end: 0 ${Y - H / 2 - 0.04} 0; color: ${planeta.color}; opacity: 0.5`);
    entity.appendChild(vline);

    /* Punto en el suelo */
    const gdot = document.createElement('a-circle');
    gdot.setAttribute('radius',   '0.18');
    gdot.setAttribute('color',    planeta.color);
    gdot.setAttribute('opacity',  '0.65');
    gdot.setAttribute('position', '0 0.02 0');
    gdot.setAttribute('rotation', '-90 0 0');
    entity.appendChild(gdot);

  } else {
    /* ── Marcador pequeño tapable ─────────────────────────────── */
    const dotY = 1.5;

    const dot = document.createElement('a-circle');
    dot.setAttribute('radius',   '0.20');
    dot.setAttribute('color',    planeta.color);
    dot.setAttribute('opacity',  '0.75');
    dot.setAttribute('position', `0 ${dotY} 0`);
    dot.classList.add('ar-tap');
    dot.addEventListener('click',     () => { window.location.href = `ar.html?planet=${planeta.id}`; });
    dot.addEventListener('mousedown', () => dot.setAttribute('opacity', '1'));
    dot.addEventListener('mouseup',   () => dot.setAttribute('opacity', '0.75'));
    entity.appendChild(dot);

    const lbl = document.createElement('a-text');
    lbl.setAttribute('value',    planeta.nombre);
    lbl.setAttribute('color',    planeta.color);
    lbl.setAttribute('align',    'center');
    lbl.setAttribute('width',    '1.3');
    lbl.setAttribute('position', `0 ${dotY + 0.42} 0`);
    entity.appendChild(lbl);

    const vline = document.createElement('a-entity');
    vline.setAttribute('line',
      `start: 0 0.01 0; end: 0 ${dotY - 0.20} 0; color: ${planeta.color}; opacity: 0.22`);
    entity.appendChild(vline);

    const gdot = document.createElement('a-circle');
    gdot.setAttribute('radius',   '0.06');
    gdot.setAttribute('color',    planeta.color);
    gdot.setAttribute('opacity',  '0.35');
    gdot.setAttribute('position', '0 0.02 0');
    gdot.setAttribute('rotation', '-90 0 0');
    entity.appendChild(gdot);
  }

  return entity;
}

/* ── Brújula externa (indicador HUD opcional) ─────────────────── */
function _updateCompass(e) {
  const el = document.getElementById('compass-arrow');
  if (!el) return;
  el.style.transform = `rotate(${-(e.alpha || 0)}deg)`;
}
window.addEventListener('deviceorientationabsolute', _updateCompass);
window.addEventListener('deviceorientation',         _updateCompass);
