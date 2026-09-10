'use strict';

// map.js — Mapa Leaflet de la costanera con posiciones de los planetas

(function () {
  // Esperar a que el DOM esté listo
  document.addEventListener('DOMContentLoaded', initMap);

  function initMap() {
    const mapEl = document.getElementById('mapa');
    if (!mapEl) return;

    const map = L.map('mapa', { zoomControl: true, attributionControl: true });

    // Tiles oscuros CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Línea punteada desde el Sol hasta Neptuno
    const costaneraCoords = ORDEN_PLANETAS.map(id => [SISTEMA_SOLAR[id].coords.lat, SISTEMA_SOLAR[id].coords.lng]);
    L.polyline(costaneraCoords, {
      color: 'rgba(253, 184, 19, 0.25)',
      weight: 2,
      dashArray: '6 4'
    }).addTo(map);

    ORDEN_PLANETAS.forEach(id => addPlanetMarker(map, SISTEMA_SOLAR[id]));

    // Encuadrar todo el recorrido (Sol → Neptuno, ~1,5 km hacia el sur)
    map.fitBounds(L.latLngBounds(costaneraCoords), { padding: [30, 30] });
  }

  // Tamaño visual del marcador (los planetas reales serían invisibles a esta escala)
  const MARKER_SIZES = { sol: 36, mercurio: 8, venus: 12, tierra: 12, marte: 10, jupiter: 26, saturno: 22, urano: 16, neptuno: 16 };
  const getPlanetSize = planeta => MARKER_SIZES[planeta.id] || 10;

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
    const line = txt => `<p style="color:#aaa;margin:0.2rem 0 0;font-size:0.8rem">${txt}</p>`;
    const esDistancia = isSol ? '' : line(`📍 ${formatearDistancia(planeta.distanciaModeloSol)} desde el Sol`);
    const lunaInfo = planeta.lunas.length
      ? line(`🌙 ${planeta.lunas.length} luna${planeta.lunas.length > 1 ? 's' : ''}: ${planeta.lunas.map(l => l.nombre).join(', ')}`)
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
        ${line(`⌀ real: ${fmtNum(planeta.diametroReal)} km`)}
        ${line(`⌀ modelo: ${formatearDiametro(planeta.diametroModelo)}`)}
        ${esDistancia}
        ${lunaInfo}
        <a href="planet.html?planet=${planeta.id}" class="btn btn-primary btn-sm" style="margin-top:0.75rem">Ver detalles →</a>
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
