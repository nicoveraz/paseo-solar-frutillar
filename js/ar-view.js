'use strict';

// ar-view.js
// Posicionamiento en tiempo real mediante un componente A-Frame que corre
// en cada frame (tick). El bearing se recalcula continuamente a partir del
// GPS del usuario y la posición del planeta en la costanera.
// buildARScene() es global — invocado desde ar.html.

/* ── Constantes ─────────────────────────────────────────────────── */
const VISUAL_DIST = 8;   // metros fijos en escena

/* ── GPS compartido entre watchPosition y el componente ────────── */
let _gpsLat     = null;
let _gpsLng     = null;
let _gpsWatchId = null;

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

/* ── Componente A-Frame: actualiza posición cada frame ─────────── */
// Registrar ANTES de crear la escena
if (typeof AFRAME !== 'undefined' && !AFRAME.components['ar-compass-target']) {
  AFRAME.registerComponent('ar-compass-target', {
    schema: {
      lat: { type: 'float' },
      lng: { type: 'float' }
    },

    init() {
      this._lastDistUpdate = 0;
    },

    tick(time) {
      if (_gpsLat === null) return;

      // Posición de la cámara en espacio de escena (actualizada por gps-camera)
      const camEl = this.el.sceneEl.cameraEl;
      if (!camEl) return;
      const cp = camEl.object3D.position;

      // Bearing desde usuario hacia el planeta
      const brg = _bearing(_gpsLat, _gpsLng, this.data.lat, this.data.lng);
      const rad = brg * Math.PI / 180;

      // Mover entidad a VISUAL_DIST metros en la dirección correcta
      this.el.object3D.position.x = cp.x + Math.sin(rad) * VISUAL_DIST;
      this.el.object3D.position.z = cp.z - Math.cos(rad) * VISUAL_DIST;

      // Actualizar texto de distancia cada 2 s (solo si hay referencia)
      if (this.el._distEl && time - this._lastDistUpdate > 2000) {
        this._lastDistUpdate = time;
        const d = _dist(_gpsLat, _gpsLng, this.data.lat, this.data.lng);
        this.el._distEl.setAttribute('value', _fmtDist(d) + ' de aquí');
      }
    }
  });
}

/* ── buildARScene ───────────────────────────────────────────────── */
function buildARScene(planetaActual) {
  const wrapper = document.getElementById('ar-scene-wrapper');
  if (!wrapper) return;

  wrapper.innerHTML = '';
  _gpsLat = null;
  _gpsLng = null;
  if (_gpsWatchId !== null) { navigator.geolocation.clearWatch(_gpsWatchId); _gpsWatchId = null; }

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

  /* Cámara GPS (orientación + tracking) */
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

  /* Crear entidades — posición inicial en abanico al norte hasta que llegue GPS */
  ORDEN_PLANETAS.forEach((id, i) => {
    const p = SISTEMA_SOLAR[id];
    if (!p.coords) return;

    const angle = (i / ORDEN_PLANETAS.length) * 140 - 70; // -70° … +70°
    const ix = VISUAL_DIST * Math.sin(angle * Math.PI / 180);
    const iz = -VISUAL_DIST * Math.cos(angle * Math.PI / 180);

    const entity = _buildCard(p, id === planetaActual.id, ix, iz);
    // Registrar componente de posicionamiento en tiempo real
    entity.setAttribute('ar-compass-target', `lat: ${p.coords.lat}; lng: ${p.coords.lng}`);
    scene.appendChild(entity);
  });

  wrapper.appendChild(scene);
  scene.addEventListener('loaded', () => {
    const el = document.getElementById('ar-loading');
    if (el) el.style.display = 'none';
  });

  /* GPS watch — actualiza estado compartido (el tick lo lee cada frame) */
  if ('geolocation' in navigator) {
    _gpsWatchId = navigator.geolocation.watchPosition(
      pos => { _gpsLat = pos.coords.latitude; _gpsLng = pos.coords.longitude; },
      err  => console.warn('AR GPS:', err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }
}

/* ── Construye la entidad (carta principal o marcador secundario) ─ */
function _buildCard(planeta, isPrimary, ix, iz) {
  const entity = document.createElement('a-entity');
  entity.setAttribute('position', `${ix.toFixed(2)} 0 ${iz.toFixed(2)}`);
  entity.setAttribute('look-at', '[gps-camera]');

  if (isPrimary) {
    /* ── Carta completa ─────────────────────────────────────────── */
    const W = 2.5, H = 1.55, Y = 2.1;

    // Fondo
    const bg = document.createElement('a-plane');
    bg.setAttribute('width',    W.toString());
    bg.setAttribute('height',   H.toString());
    bg.setAttribute('color',    '#060612');
    bg.setAttribute('opacity',  '0.92');
    bg.setAttribute('position', `0 ${Y} 0`);
    bg.setAttribute('animation',
      'property: material.opacity; from: 0.87; to: 0.95; dir: alternate; dur: 2500; loop: true; easing: easeInOutSine');
    entity.appendChild(bg);

    // Franja de color izquierda
    const strip = document.createElement('a-plane');
    strip.setAttribute('width',    '0.07');
    strip.setAttribute('height',   H.toString());
    strip.setAttribute('color',    planeta.color);
    strip.setAttribute('position', `${-(W / 2 - 0.035)} ${Y} 0.01`);
    entity.appendChild(strip);

    // Nombre del planeta
    const nameEl = document.createElement('a-text');
    nameEl.setAttribute('value',    planeta.nombre);
    nameEl.setAttribute('color',    planeta.color);
    nameEl.setAttribute('align',    'left');
    nameEl.setAttribute('width',    '2.4');
    nameEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.52} 0.02`);
    entity.appendChild(nameEl);

    // Datos reales: distancia al Sol + diámetro
    const realLine = planeta.id === 'sol'
      ? '\u2300 1.392.000 km'
      : `${planeta.distanciaRealSol.toLocaleString('es-CL')} M km  \u00b7  \u2300 ${planeta.diametroReal.toLocaleString('es-CL')} km`;
    const realEl = document.createElement('a-text');
    realEl.setAttribute('value',    realLine);
    realEl.setAttribute('color',    '#dde0f5');
    realEl.setAttribute('align',    'left');
    realEl.setAttribute('width',    '2.2');
    realEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y + 0.24} 0.02`);
    entity.appendChild(realEl);

    // Datos en modelo (amarillo)
    const modelLine = planeta.id === 'sol'
      ? 'Modelo: \u2300 45 cm'
      : `Modelo: ${planeta.distanciaModeloSol.toFixed(1)} m  \u00b7  \u2300 ${formatearDiametro(planeta.diametroModelo)}`;
    const modelEl = document.createElement('a-text');
    modelEl.setAttribute('value',    modelLine);
    modelEl.setAttribute('color',    '#fdb813');
    modelEl.setAttribute('align',    'left');
    modelEl.setAttribute('width',    '2.2');
    modelEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y - 0.06} 0.02`);
    entity.appendChild(modelEl);

    // Distancia real del usuario — actualizada en tiempo real por tick
    const distEl = document.createElement('a-text');
    distEl.setAttribute('value',    'Obteniendo GPS\u2026');
    distEl.setAttribute('color',    '#88bbff');
    distEl.setAttribute('align',    'left');
    distEl.setAttribute('width',    '2.2');
    distEl.setAttribute('position', `${-(W / 2 - 0.18)} ${Y - 0.38} 0.02`);
    entity.appendChild(distEl);
    entity._distEl = distEl;  // referencia para el componente tick

    // Línea vertical al suelo
    const vline = document.createElement('a-entity');
    vline.setAttribute('line',
      `start: 0 0.01 0; end: 0 ${Y - H / 2 - 0.04} 0; color: ${planeta.color}; opacity: 0.5`);
    entity.appendChild(vline);

    // Punto en el suelo
    const gdot = document.createElement('a-circle');
    gdot.setAttribute('radius',   '0.18');
    gdot.setAttribute('color',    planeta.color);
    gdot.setAttribute('opacity',  '0.65');
    gdot.setAttribute('position', '0 0.02 0');
    gdot.setAttribute('rotation', '-90 0 0');
    entity.appendChild(gdot);

  } else {
    /* ── Marcador pequeño tapable ───────────────────────────────── */
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

/* ── Brújula HUD (indicador externo opcional) ───────────────────── */
function _updateCompass(e) {
  const el = document.getElementById('compass-arrow');
  if (!el) return;
  el.style.transform = `rotate(${-(e.alpha || 0)}deg)`;
}
window.addEventListener('deviceorientationabsolute', _updateCompass);
window.addEventListener('deviceorientation',         _updateCompass);
