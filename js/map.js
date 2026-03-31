'use strict';

// map.js — Mapa Leaflet de la costanera con posiciones de los planetas

(function () {
  // Esperar a que el DOM esté listo
  document.addEventListener('DOMContentLoaded', initMap);

  function initMap() {
    const mapEl = document.getElementById('mapa');
    if (!mapEl) return;

    // Centrar el mapa en el Sol y zonar para ver toda la costanera
    const map = L.map('mapa', {
      center: [SOL_COORDS.lat, SOL_COORDS.lng + 0.007],
      zoom: 14,
      zoomControl: true,
      attributionControl: true
    });

    // Tiles oscuros CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Dibujar la línea de la costanera
    const costaneraCoords = ORDEN_PLANETAS.map(id => {
      const p = SISTEMA_SOLAR[id];
      return [p.coords.lat, p.coords.lng];
    });

    // Línea punteada desde el Sol hasta Neptuno
    L.polyline(costaneraCoords, {
      color: 'rgba(253, 184, 19, 0.25)',
      weight: 2,
      dashArray: '6 4'
    }).addTo(map);

    // Agregar marcador para cada planeta
    ORDEN_PLANETAS.forEach(id => {
      const planeta = SISTEMA_SOLAR[id];
      addPlanetMarker(map, planeta);
    });

    // Ajustar la vista para mostrar todos los planetas hasta Saturno (aprox.)
    // Neptune queda muy lejos, así que el zoom inicial muestra hasta Júpiter
    map.fitBounds([
      [SOL_COORDS.lat - 0.002, SOL_COORDS.lng - 0.005],
      [SOL_COORDS.lat + 0.002, SISTEMA_SOLAR.saturno.coords.lng + 0.003]
    ]);
  }

  function getPlanetSize(planeta) {
    // Escalar el tamaño del marcador para visualización (min 10px, max 40px)
    if (planeta.id === 'sol') return 36;
    // Los planetas son muy pequeños en escala real, así que usamos log scale visual
    const sizes = {
      mercurio: 8,
      venus: 12,
      tierra: 12,
      marte: 10,
      jupiter: 26,
      saturno: 22,
      urano: 16,
      neptuno: 16
    };
    return sizes[planeta.id] || 10;
  }

  function addPlanetMarker(map, planeta) {
    const size = getPlanetSize(planeta);
    const isSol = planeta.id === 'sol';

    // Crear icono personalizado
    const html = `
      <div class="planet-dot-marker" style="
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), ${planeta.color});
        border-radius: 50%;
        box-shadow: 0 0 ${isSol ? 16 : 6}px ${planeta.color};
        border: 1px solid rgba(255,255,255,0.3);
        ${planeta.id === 'saturno' ? 'outline: 3px solid rgba(228,209,145,0.4); outline-offset: 4px;' : ''}
      "></div>
    `;

    const icon = L.divIcon({
      html: html,
      className: 'planet-marker-icon',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2 - 4]
    });

    const marker = L.marker([planeta.coords.lat, planeta.coords.lng], { icon })
      .addTo(map);

    // Popup
    const esDistancia = planeta.id !== 'sol'
      ? `<p style="color:#aaa;margin:0.25rem 0 0;font-size:0.8rem">📍 ${planeta.distanciaModeloSol.toFixed(1)} m desde el Sol</p>`
      : '';

    const lunaInfo = planeta.lunas && planeta.lunas.length > 0
      ? `<p style="color:#aaa;margin:0.25rem 0 0;font-size:0.8rem">🌙 ${planeta.lunas.length} luna${planeta.lunas.length > 1 ? 's' : ''}: ${planeta.lunas.map(l => l.nombre).join(', ')}</p>`
      : '';

    const popupContent = `
      <div style="padding:0.75rem;min-width:160px">
        <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem">
          <div style="
            width:${Math.min(size * 1.2, 28)}px;
            height:${Math.min(size * 1.2, 28)}px;
            background:radial-gradient(circle at 35% 30%,rgba(255,255,255,0.5),${planeta.color});
            border-radius:50%;
            box-shadow:0 0 8px ${planeta.color};
            flex-shrink:0;
          "></div>
          <div>
            <strong style="font-size:1rem;color:#fff">${planeta.nombre}</strong>
            <div style="font-size:0.72rem;color:#888;text-transform:uppercase;letter-spacing:0.05em">${planeta.tipo}</div>
          </div>
        </div>
        ${planeta.id !== 'sol' ? `<p style="color:#aaa;margin:0;font-size:0.8rem">⌀ real: ${planeta.diametroReal.toLocaleString('es-CL')} km</p>` : ''}
        ${planeta.id !== 'sol' ? `<p style="color:#aaa;margin:0.2rem 0 0;font-size:0.8rem">⌀ modelo: ${formatearDiametro(planeta.diametroModelo)}</p>` : ''}
        ${esDistancia}
        ${lunaInfo}
        ${planeta.id !== 'sol'
          ? `<a href="planet.html?planet=${planeta.id}" style="display:inline-block;margin-top:0.75rem;padding:0.3rem 0.75rem;background:#fdb813;color:#000;border-radius:6px;font-size:0.8rem;font-weight:600;text-decoration:none">Ver detalles →</a>`
          : `<a href="planet.html?planet=sol" style="display:inline-block;margin-top:0.75rem;padding:0.3rem 0.75rem;background:#fdb813;color:#000;border-radius:6px;font-size:0.8rem;font-weight:600;text-decoration:none">Ver detalles →</a>`
        }
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 240,
      className: 'planet-popup-wrapper'
    });

    // Label de nombre encima del marcador para los más grandes
    if (['sol', 'jupiter', 'saturno', 'urano', 'neptuno'].includes(planeta.id)) {
      const label = L.tooltip({
        permanent: true,
        direction: 'top',
        offset: [0, -size / 2 - 4],
        className: 'planet-label-tooltip'
      });
      label.setContent(`<span style="color:${planeta.color};font-size:0.7rem;font-weight:700;text-shadow:0 0 4px #000,0 0 8px #000;white-space:nowrap">${planeta.nombre}</span>`);
      marker.bindTooltip(label);
    }
  }
})();
