'use strict';

// ar-view.js — Lógica de la vista AR (A-Frame + AR.js GPS)

(function () {
  document.addEventListener('DOMContentLoaded', initAR);

  function initAR() {
    const params = new URLSearchParams(window.location.search);
    const planetaId = params.get('planet') || 'tierra';
    const planetaActual = getPlaneta(planetaId);

    if (!planetaActual) {
      window.location.href = 'index.html';
      return;
    }

    // Actualizar HUD con datos del planeta actual
    updateHUD(planetaActual);

    // Mostrar/ocultar pantalla de permisos hasta que AR.js cargue
    const permisoScreen = document.getElementById('ar-permiso-screen');
    const arScene = document.getElementById('ar-scene');

    // Botón de iniciar AR
    const btnIniciar = document.getElementById('btn-iniciar-ar');
    if (btnIniciar) {
      btnIniciar.addEventListener('click', () => {
        if (permisoScreen) permisoScreen.classList.add('hidden');
        if (arScene) arScene.style.display = 'block';
        buildARScene(planetaActual);
      });
    }

    // Botón de volver
    const btnVolver = document.getElementById('ar-back-btn');
    if (btnVolver) {
      btnVolver.href = `planet.html?planet=${planetaId}`;
    }
  }

  function updateHUD(planeta) {
    const elNombre = document.getElementById('hud-nombre');
    const elDiametro = document.getElementById('hud-diametro');
    const elDistancia = document.getElementById('hud-distancia');
    const elColor = document.getElementById('hud-color-dot');

    if (elNombre) elNombre.textContent = planeta.nombre;
    if (elDiametro) elDiametro.textContent = `⌀ real: ${planeta.diametroReal.toLocaleString('es-CL')} km`;
    if (elDistancia && planeta.id !== 'sol') {
      elDistancia.textContent = `Dist. al Sol: ${planeta.distanciaModeloSol.toFixed(2)} m (modelo)`;
    }
    if (elColor) {
      elColor.style.background = `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), ${planeta.color})`;
      elColor.style.boxShadow = `0 0 10px ${planeta.color}`;
    }
  }

  function buildARScene(planetaActual) {
    const sceneEl = document.getElementById('ar-scene');
    if (!sceneEl) return;

    // Crear escena A-Frame dinámicamente
    sceneEl.innerHTML = '';

    const aScene = document.createElement('a-scene');
    aScene.setAttribute('vr-mode-ui', 'enabled: false');
    aScene.setAttribute('arjs', 'sourceType: webcam; videoTexture: true; debugUIEnabled: false; trackingMethod: best');
    aScene.setAttribute('renderer', 'antialias: true; alpha: true; precision: medium');
    aScene.setAttribute('embedded', '');
    aScene.setAttribute('loading-screen', 'enabled: false');
    aScene.setAttribute('device-orientation-permission-ui', 'enabled: false');
    aScene.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';

    // Assets
    const assets = document.createElement('a-assets');
    aScene.appendChild(assets);

    // Cámara GPS
    const camera = document.createElement('a-camera');
    camera.setAttribute('gps-camera', '');
    camera.setAttribute('rotation-reader', '');
    camera.setAttribute('look-controls', 'enabled: false');
    aScene.appendChild(camera);

    // Agregar entidades para cada planeta (excepto el Sol que es el centro)
    ORDEN_PLANETAS.forEach(id => {
      const planeta = SISTEMA_SOLAR[id];
      if (!planeta.coords) return;

      const esPlanetaActual = id === planetaActual.id;
      const esSol = id === 'sol';

      // Tamaño visual del planeta en AR (metros)
      // El Sol = 2m, los demás proporcionales pero con mínimo visible
      let arRadius;
      if (esSol) {
        arRadius = 2.0;
      } else {
        // Escalar proporcionalmente al diámetro real, con mínimo de 0.3m y máximo de 1.8m
        const ratio = planeta.diametroReal / SISTEMA_SOLAR.sol.diametroReal;
        arRadius = Math.max(0.3, Math.min(1.8, ratio * 60));
      }

      // Grupo contenedor
      const group = document.createElement('a-entity');
      group.setAttribute('gps-entity-place', `latitude: ${planeta.coords.lat}; longitude: ${planeta.coords.lng}`);

      // Esfera del planeta
      const sphere = document.createElement('a-sphere');
      sphere.setAttribute('radius', arRadius.toString());
      sphere.setAttribute('color', planeta.color);
      sphere.setAttribute('roughness', '0.7');
      sphere.setAttribute('metalness', '0.1');
      sphere.setAttribute('position', `0 ${arRadius + 0.5} 0`);

      if (esPlanetaActual) {
        sphere.setAttribute('animation', 'property: scale; to: 1.1 1.1 1.1; dir: alternate; dur: 1500; loop: true; easing: easeInOutSine');
      }

      if (esSol) {
        sphere.setAttribute('emission', '#ff8800');
        sphere.setAttribute('emissive', planeta.color);
        sphere.setAttribute('emissiveIntensity', '0.5');
      }

      // Anillos de Saturno
      if (id === 'saturno') {
        const ring = document.createElement('a-ring');
        ring.setAttribute('color', '#e4d191');
        ring.setAttribute('radius-inner', (arRadius * 1.4).toString());
        ring.setAttribute('radius-outer', (arRadius * 2.2).toString());
        ring.setAttribute('rotation', '75 0 0');
        ring.setAttribute('position', `0 ${arRadius + 0.5} 0`);
        ring.setAttribute('opacity', '0.6');
        group.appendChild(ring);
      }

      // Panel de texto con nombre y distancia
      const panel = document.createElement('a-entity');
      panel.setAttribute('position', `0 ${arRadius * 2 + 1.2} 0`);
      panel.setAttribute('look-at', '[gps-camera]');

      const bg = document.createElement('a-plane');
      bg.setAttribute('width', '3');
      bg.setAttribute('height', esPlanetaActual ? '1.4' : '1');
      bg.setAttribute('color', esPlanetaActual ? planeta.color : '#0d0d24');
      bg.setAttribute('opacity', '0.85');
      bg.setAttribute('rounded', 'true');
      panel.appendChild(bg);

      const text = document.createElement('a-text');
      text.setAttribute('value', buildPlanetLabel(planeta, planetaActual));
      text.setAttribute('color', esPlanetaActual ? '#000000' : '#ffffff');
      text.setAttribute('align', 'center');
      text.setAttribute('width', '2.8');
      text.setAttribute('position', '0 0 0.01');
      text.setAttribute('wrap-count', '30');
      panel.appendChild(text);

      group.appendChild(sphere);
      group.appendChild(panel);

      // Línea vertical al suelo (solo para el planeta actual)
      if (esPlanetaActual) {
        const line = document.createElement('a-entity');
        line.setAttribute('line', `start: 0 0 0; end: 0 ${arRadius + 0.5} 0; color: ${planeta.color}; opacity: 0.4`);
        group.appendChild(line);
      }

      aScene.appendChild(group);
    });

    // Iluminación
    const ambientLight = document.createElement('a-light');
    ambientLight.setAttribute('type', 'ambient');
    ambientLight.setAttribute('color', '#ffffff');
    ambientLight.setAttribute('intensity', '0.6');
    aScene.appendChild(ambientLight);

    const directionalLight = document.createElement('a-light');
    directionalLight.setAttribute('type', 'directional');
    directionalLight.setAttribute('color', '#fffadd');
    directionalLight.setAttribute('intensity', '1');
    directionalLight.setAttribute('position', '-1 2 1');
    aScene.appendChild(directionalLight);

    sceneEl.appendChild(aScene);

    // Escuchar cuando A-Frame está listo
    aScene.addEventListener('loaded', () => {
      console.log('Escena AR lista');
      document.getElementById('ar-loading')?.classList.add('hidden');
    });
  }

  function buildPlanetLabel(planeta, planetaActual) {
    const esCurrent = planeta.id === planetaActual.id;
    if (esCurrent) {
      return `${planeta.nombre}\n⌀ ${planeta.diametroReal.toLocaleString('es-CL')} km\n${planeta.id !== 'sol' ? planeta.distanciaModeloSol.toFixed(1) + ' m del Sol' : 'Centro del sistema'}`;
    }
    if (planeta.id === 'sol') {
      return `☉ El Sol\n${planetaActual.distanciaModeloSol.toFixed(1)} m de aquí`;
    }
    const distEntreEllos = Math.abs(planeta.distanciaModeloSol - planetaActual.distanciaModeloSol);
    return `${planeta.nombre}\n${distEntreEllos.toFixed(1)} m de aquí`;
  }

  // Compass indicator
  window.addEventListener('deviceorientationabsolute', updateCompass);
  window.addEventListener('deviceorientation', updateCompass);

  function updateCompass(e) {
    const compassEl = document.getElementById('compass-arrow');
    if (!compassEl) return;
    const alpha = e.alpha || 0;
    compassEl.style.transform = `rotate(${-alpha}deg)`;
  }
})();
