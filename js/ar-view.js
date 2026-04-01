'use strict';

// ar-view.js — Construye la escena A-Frame GPS-AR
// buildARScene() es global — invocado desde ar.html

function buildARScene(planetaActual) {
  const wrapper = document.getElementById('ar-scene-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '';

  /* ── Escena A-Frame ────────────────────────────────────────────── */
  const scene = document.createElement('a-scene');
  scene.setAttribute('vr-mode-ui',      'enabled: false');
  scene.setAttribute('arjs',            'sourceType: webcam; videoTexture: true; debugUIEnabled: false; trackingMethod: best');
  scene.setAttribute('renderer',        'antialias: true; alpha: true; precision: medium');
  scene.setAttribute('embedded',        '');
  scene.setAttribute('loading-screen',  'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
  scene.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';

  scene.appendChild(document.createElement('a-assets'));

  /* Cámara GPS con raycaster para taps en marcadores */
  const camera = document.createElement('a-camera');
  camera.setAttribute('gps-camera',      '');
  camera.setAttribute('rotation-reader', '');
  camera.setAttribute('look-controls',   'enabled: false');
  camera.setAttribute('cursor',          'rayOrigin: mouse; fuse: false');
  camera.setAttribute('raycaster',       'objects: .ar-tap; far: 20000');
  scene.appendChild(camera);

  /* Luz ambiental */
  const light = document.createElement('a-light');
  light.setAttribute('type',      'ambient');
  light.setAttribute('color',     '#ffffff');
  light.setAttribute('intensity', '1.0');
  scene.appendChild(light);

  /* ── Entidades ──────────────────────────────────────────────────── */
  // Carta principal del planeta actual
  _placePlanetCard(scene, planetaActual, planetaActual, true);

  // Marcadores pequeños (tapables) para el resto
  ORDEN_PLANETAS.forEach(id => {
    if (id === planetaActual.id) return;
    _placePlanetCard(scene, SISTEMA_SOLAR[id], planetaActual, false);
  });

  wrapper.appendChild(scene);

  scene.addEventListener('loaded', () => {
    const el = document.getElementById('ar-loading');
    if (el) el.style.display = 'none';
  });
}

/* ── Construye y posiciona una entidad (carta o marcador) ──────────── */
function _placePlanetCard(scene, planeta, planetaActual, isPrimary) {
  if (!planeta.coords) return;

  /* Anchor GPS */
  const anchor = document.createElement('a-entity');
  anchor.setAttribute('gps-entity-place',
    `latitude: ${planeta.coords.lat}; longitude: ${planeta.coords.lng}`);

  /* Billboard: siempre mira a la cámara */
  const board = document.createElement('a-entity');
  board.setAttribute('look-at', '[gps-camera]');

  const Y = 2.2;   // altura del centro de la carta

  if (isPrimary) {
    /* ── Carta principal ─────────────────────────────────────────── */
    const W = 2.4, H = 1.1;

    // Fondo de la carta
    const bg = document.createElement('a-plane');
    bg.setAttribute('width',    W.toString());
    bg.setAttribute('height',   H.toString());
    bg.setAttribute('color',    '#060612');
    bg.setAttribute('opacity',  '0.91');
    bg.setAttribute('position', `0 ${Y} 0`);
    bg.setAttribute('animation',
      'property: material.opacity; from: 0.87; to: 0.95; dir: alternate; dur: 2500; loop: true; easing: easeInOutSine');
    board.appendChild(bg);

    // Franja de color izquierda
    const strip = document.createElement('a-plane');
    strip.setAttribute('width',    '0.07');
    strip.setAttribute('height',   H.toString());
    strip.setAttribute('color',    planeta.color);
    strip.setAttribute('position', `${-(W / 2 - 0.035)} ${Y} 0.01`);
    board.appendChild(strip);

    // Círculo coloreado (dot)
    const dot3d = document.createElement('a-circle');
    dot3d.setAttribute('radius',   '0.16');
    dot3d.setAttribute('color',    planeta.color);
    dot3d.setAttribute('position', `${-(W / 2 - 0.28)} ${Y + 0.12} 0.02`);
    board.appendChild(dot3d);

    // Nombre del planeta
    const nameEl = document.createElement('a-text');
    nameEl.setAttribute('value',    planeta.nombre);
    nameEl.setAttribute('color',    planeta.color);
    nameEl.setAttribute('align',    'left');
    nameEl.setAttribute('width',    '2.2');
    nameEl.setAttribute('position', `${-(W / 2 - 0.52)} ${Y + 0.30} 0.02`);
    board.appendChild(nameEl);

    // Tipo de cuerpo
    const typeEl = document.createElement('a-text');
    typeEl.setAttribute('value',    planeta.tipo);
    typeEl.setAttribute('color',    '#8888bb');
    typeEl.setAttribute('align',    'left');
    typeEl.setAttribute('width',    '1.6');
    typeEl.setAttribute('position', `${-(W / 2 - 0.52)} ${Y + 0.08} 0.02`);
    board.appendChild(typeEl);

    // Distancia al Sol + diámetro en modelo
    const distLine = planeta.id === 'sol'
      ? 'Centro del sistema solar'
      : `${planeta.distanciaModeloSol.toFixed(1)} m del Sol  ·  ⌀ ${formatearDiametro(planeta.diametroModelo)}`;
    const distEl = document.createElement('a-text');
    distEl.setAttribute('value',    distLine);
    distEl.setAttribute('color',    '#ccccdd');
    distEl.setAttribute('align',    'left');
    distEl.setAttribute('width',    '2.0');
    distEl.setAttribute('position', `${-(W / 2 - 0.52)} ${Y - 0.22} 0.02`);
    board.appendChild(distEl);

    // Línea vertical al suelo
    const vline = document.createElement('a-entity');
    vline.setAttribute('line',
      `start: 0 0.01 0; end: 0 ${Y - H / 2 - 0.05} 0; color: ${planeta.color}; opacity: 0.5`);
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
    /* ── Marcador pequeño (tapable → navega al planeta) ─────────── */
    const dotY = Y * 0.6;

    // Círculo tapable
    const dot = document.createElement('a-circle');
    dot.setAttribute('radius',   '0.22');
    dot.setAttribute('color',    planeta.color);
    dot.setAttribute('opacity',  '0.75');
    dot.setAttribute('position', `0 ${dotY} 0`);
    dot.classList.add('ar-tap');
    dot.addEventListener('click', () => {
      window.location.href = `ar.html?planet=${planeta.id}`;
    });
    // Feedback visual al tocar
    dot.addEventListener('mousedown', () => dot.setAttribute('opacity', '1'));
    dot.addEventListener('mouseup',   () => dot.setAttribute('opacity', '0.75'));
    board.appendChild(dot);

    // Nombre
    const lbl = document.createElement('a-text');
    lbl.setAttribute('value',    planeta.nombre);
    lbl.setAttribute('color',    planeta.color);
    lbl.setAttribute('align',    'center');
    lbl.setAttribute('width',    '1.4');
    lbl.setAttribute('position', `0 ${dotY + 0.46} 0`);
    board.appendChild(lbl);

    // Distancia desde el planeta actual
    const fromDist = planeta.id === 'sol'
      ? (planetaActual.id !== 'sol' ? planetaActual.distanciaModeloSol.toFixed(1) + ' m' : '')
      : Math.abs(
          planeta.distanciaModeloSol -
          (planetaActual.id !== 'sol' ? planetaActual.distanciaModeloSol : 0)
        ).toFixed(1) + ' m';
    if (fromDist) {
      const distLbl = document.createElement('a-text');
      distLbl.setAttribute('value',    fromDist);
      distLbl.setAttribute('color',    '#9999bb');
      distLbl.setAttribute('align',    'center');
      distLbl.setAttribute('width',    '1.1');
      distLbl.setAttribute('position', `0 ${dotY - 0.38} 0`);
      board.appendChild(distLbl);
    }

    // Línea vertical
    const vline = document.createElement('a-entity');
    vline.setAttribute('line',
      `start: 0 0.01 0; end: 0 ${dotY - 0.22} 0; color: ${planeta.color}; opacity: 0.25`);
    board.appendChild(vline);

    // Punto en suelo
    const gdot = document.createElement('a-circle');
    gdot.setAttribute('radius',   '0.07');
    gdot.setAttribute('color',    planeta.color);
    gdot.setAttribute('opacity',  '0.4');
    gdot.setAttribute('position', '0 0.02 0');
    gdot.setAttribute('rotation', '-90 0 0');
    board.appendChild(gdot);
  }

  anchor.appendChild(board);
  scene.appendChild(anchor);
}

/* ── Brújula ────────────────────────────────────────────────────────── */
function _updateCompass(e) {
  const el = document.getElementById('compass-arrow');
  if (!el) return;
  el.style.transform = `rotate(${-(e.alpha || 0)}deg)`;
}
window.addEventListener('deviceorientationabsolute', _updateCompass);
window.addEventListener('deviceorientation',         _updateCompass);
