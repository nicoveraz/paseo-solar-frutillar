'use strict';

// ar-view.js — Construye la escena A-Frame GPS-AR (invocado desde ar.html)
// Las funciones son globales para que ar.html pueda llamarlas directamente.

function buildARScene(planetaActual) {
  const wrapper = document.getElementById('ar-scene-wrapper');
  if (!wrapper) return;

  wrapper.innerHTML = '';

  const aScene = document.createElement('a-scene');
  aScene.setAttribute('vr-mode-ui',      'enabled: false');
  aScene.setAttribute('arjs',            'sourceType: webcam; videoTexture: true; debugUIEnabled: false; trackingMethod: best');
  aScene.setAttribute('renderer',        'antialias: true; alpha: true; precision: medium');
  aScene.setAttribute('embedded',        '');
  aScene.setAttribute('loading-screen',  'enabled: false');
  aScene.setAttribute('device-orientation-permission-ui', 'enabled: false');
  aScene.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';

  aScene.appendChild(document.createElement('a-assets'));

  const camera = document.createElement('a-camera');
  camera.setAttribute('gps-camera',       '');
  camera.setAttribute('rotation-reader',  '');
  camera.setAttribute('look-controls',    'enabled: false');
  aScene.appendChild(camera);

  // ── Planetas ───────────────────────────────────────────────────────────
  ORDEN_PLANETAS.forEach(id => {
    const planeta = SISTEMA_SOLAR[id];
    if (!planeta.coords) return;

    const esPlanetaActual = id === planetaActual.id;
    const esSol           = id === 'sol';

    // Radio visual en AR (metros) — proporcional pero con límites visibles
    let arRadius;
    if (esSol) {
      arRadius = 2.0;
    } else {
      const ratio = planeta.diametroReal / SISTEMA_SOLAR.sol.diametroReal;
      arRadius = Math.max(0.3, Math.min(1.8, ratio * 60));
    }

    const group = document.createElement('a-entity');
    group.setAttribute('gps-entity-place',
      `latitude: ${planeta.coords.lat}; longitude: ${planeta.coords.lng}`);

    // Esfera
    const sphere = document.createElement('a-sphere');
    sphere.setAttribute('radius',    arRadius.toString());
    sphere.setAttribute('color',     planeta.color);
    sphere.setAttribute('roughness', '0.7');
    sphere.setAttribute('metalness', '0.1');
    sphere.setAttribute('position',  `0 ${arRadius + 0.5} 0`);
    if (esPlanetaActual) {
      sphere.setAttribute('animation',
        'property: scale; to: 1.1 1.1 1.1; dir: alternate; dur: 1500; loop: true; easing: easeInOutSine');
    }
    if (esSol) {
      sphere.setAttribute('emissive',          planeta.color);
      sphere.setAttribute('emissiveIntensity', '0.5');
    }
    group.appendChild(sphere);

    // Anillos de Saturno
    if (id === 'saturno') {
      const ring = document.createElement('a-ring');
      ring.setAttribute('color',        '#e4d191');
      ring.setAttribute('radius-inner', (arRadius * 1.4).toString());
      ring.setAttribute('radius-outer', (arRadius * 2.2).toString());
      ring.setAttribute('rotation',     '75 0 0');
      ring.setAttribute('position',     `0 ${arRadius + 0.5} 0`);
      ring.setAttribute('opacity',      '0.6');
      group.appendChild(ring);
    }

    // Panel de etiqueta
    const panel = document.createElement('a-entity');
    panel.setAttribute('position', `0 ${arRadius * 2 + 1.2} 0`);
    panel.setAttribute('look-at',  '[gps-camera]');

    const bg = document.createElement('a-plane');
    bg.setAttribute('width',   '3');
    bg.setAttribute('height',  esPlanetaActual ? '1.4' : '1');
    bg.setAttribute('color',   esPlanetaActual ? planeta.color : '#0d0d24');
    bg.setAttribute('opacity', '0.85');
    panel.appendChild(bg);

    const text = document.createElement('a-text');
    text.setAttribute('value',      buildPlanetLabel(planeta, planetaActual));
    text.setAttribute('color',      esPlanetaActual ? '#000000' : '#ffffff');
    text.setAttribute('align',      'center');
    text.setAttribute('width',      '2.8');
    text.setAttribute('position',   '0 0 0.01');
    text.setAttribute('wrap-count', '30');
    panel.appendChild(text);

    group.appendChild(panel);

    // Línea vertical al suelo solo para el planeta actual
    if (esPlanetaActual) {
      const line = document.createElement('a-entity');
      line.setAttribute('line',
        `start: 0 0 0; end: 0 ${arRadius + 0.5} 0; color: ${planeta.color}; opacity: 0.4`);
      group.appendChild(line);
    }

    aScene.appendChild(group);
  });

  // ── Iluminación ────────────────────────────────────────────────────────
  const ambient = document.createElement('a-light');
  ambient.setAttribute('type',      'ambient');
  ambient.setAttribute('color',     '#ffffff');
  ambient.setAttribute('intensity', '0.6');
  aScene.appendChild(ambient);

  const directional = document.createElement('a-light');
  directional.setAttribute('type',      'directional');
  directional.setAttribute('color',     '#fffadd');
  directional.setAttribute('intensity', '1');
  directional.setAttribute('position',  '-1 2 1');
  aScene.appendChild(directional);

  wrapper.appendChild(aScene);

  aScene.addEventListener('loaded', () => {
    const loadingEl = document.getElementById('ar-loading');
    if (loadingEl) loadingEl.style.display = 'none';
  });
}

function buildPlanetLabel(planeta, planetaActual) {
  const esCurrent = planeta.id === planetaActual.id;
  if (esCurrent) {
    return `${planeta.nombre}\n⌀ ${planeta.diametroReal.toLocaleString('es-CL')} km\n` +
      (planeta.id !== 'sol'
        ? `${planeta.distanciaModeloSol.toFixed(1)} m del Sol`
        : 'Centro del sistema');
  }
  if (planeta.id === 'sol') {
    return `☉ El Sol\n${planetaActual.id !== 'sol' ? planetaActual.distanciaModeloSol.toFixed(1) + ' m de aquí' : ''}`;
  }
  const dist = Math.abs(planeta.distanciaModeloSol - planetaActual.distanciaModeloSol);
  return `${planeta.nombre}\n${dist.toFixed(1)} m de aquí`;
}

// ── Brújula (opcional) ─────────────────────────────────────────────────
function _updateCompass(e) {
  const el = document.getElementById('compass-arrow');
  if (!el) return;
  el.style.transform = `rotate(${-(e.alpha || 0)}deg)`;
}
window.addEventListener('deviceorientationabsolute', _updateCompass);
window.addEventListener('deviceorientation',         _updateCompass);
