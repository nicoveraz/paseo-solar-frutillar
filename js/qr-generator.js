'use strict';

// qr-generator.js — Genera códigos QR para cada planeta

(function () {
  document.addEventListener('DOMContentLoaded', initQRPage);

  // URL base configurable — cambiar por la URL real de producción
  const BASE_URL = window.location.origin + window.location.pathname.replace('qr-codes.html', '');

  function initQRPage() {
    const container = document.getElementById('qr-grid');
    if (!container) return;

    const urlInput = document.getElementById('base-url-input');
    if (urlInput) {
      urlInput.value = BASE_URL;
      urlInput.addEventListener('input', () => renderAll(container, urlInput.value.trim()));
    }

    renderAll(container, BASE_URL);

    const btnDescargar = document.getElementById('btn-descargar-todos');
    if (btnDescargar) {
      btnDescargar.addEventListener('click', () => downloadAll());
    }
  }

  function renderAll(container, baseUrl) {
    container.innerHTML = '';
    ORDEN_PLANETAS.forEach(id => {
      const planeta = SISTEMA_SOLAR[id];
      const card = createQRCard(planeta, baseUrl);
      container.appendChild(card);
    });
  }

  function createQRCard(planeta, baseUrl) {
    const url = `${baseUrl.replace(/\/$/, '')}/planet.html?planet=${planeta.id}`;

    const card = document.createElement('div');
    card.className = 'qr-card';
    card.id = `qr-card-${planeta.id}`;

    // Canvas para el QR
    const canvas = document.createElement('canvas');
    canvas.id = `qr-canvas-${planeta.id}`;
    canvas.style.borderRadius = '8px';

    // Generar QR con QRCode.js
    if (typeof QRCode !== 'undefined') {
      new QRCode(canvas.parentNode || document.createElement('div'), {
        text: url,
        width: 180,
        height: 180,
        colorDark: '#ffffff',
        colorLight: '#0d0d24',
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    const sphere = document.createElement('div');
    sphere.style.cssText = `
      width: 48px; height: 48px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), ${planeta.color});
      box-shadow: 0 0 16px ${planeta.color};
      margin: 0 auto 0.75rem;
    `;

    const nombre = document.createElement('h3');
    nombre.textContent = planeta.nombre;
    nombre.style.color = planeta.color;

    const urlText = document.createElement('p');
    urlText.textContent = `planet.html?planet=${planeta.id}`;
    urlText.style.cssText = 'font-size:0.72rem;color:#666;word-break:break-all;';

    const btnDesc = document.createElement('button');
    btnDesc.textContent = 'Descargar QR';
    btnDesc.className = 'btn btn-secondary btn-sm';
    btnDesc.style.width = '100%';
    btnDesc.addEventListener('click', () => downloadQR(planeta, url));

    card.appendChild(sphere);

    // Crear QR
    const qrDiv = document.createElement('div');
    qrDiv.id = `qr-div-${planeta.id}`;
    qrDiv.style.margin = '0 auto 0.75rem';
    qrDiv.style.display = 'flex';
    qrDiv.style.justifyContent = 'center';
    card.appendChild(qrDiv);

    card.appendChild(nombre);
    card.appendChild(urlText);
    card.appendChild(btnDesc);

    // Generar QR en el div
    setTimeout(() => {
      if (typeof QRCode !== 'undefined') {
        try {
          new QRCode(qrDiv, {
            text: url,
            width: 160,
            height: 160,
            colorDark: '#ffffff',
            colorLight: '#0d0d24',
            correctLevel: QRCode.CorrectLevel.M
          });
        } catch (e) {
          qrDiv.innerHTML = `<div style="width:160px;height:160px;display:flex;align-items:center;justify-content:center;color:#666;font-size:0.8rem;text-align:center;border:1px dashed #333;border-radius:8px">QR no disponible en localhost</div>`;
        }
      } else {
        // Fallback: mostrar la URL
        qrDiv.innerHTML = `
          <div style="width:160px;padding:1rem;text-align:center;border:1px dashed #444;border-radius:8px">
            <div style="font-size:0.7rem;color:#888;word-break:break-all">${url}</div>
          </div>
        `;
      }
    }, 50);

    return card;
  }

  function downloadQR(planeta, url) {
    // Intentar descargar el canvas
    const qrDiv = document.getElementById(`qr-div-${planeta.id}`);
    if (!qrDiv) return;

    const qrCanvas = qrDiv.querySelector('canvas');
    if (!qrCanvas) {
      alert('El QR aún no se ha generado. Intenta de nuevo en un momento.');
      return;
    }

    // Crear un canvas con etiqueta
    const canvas = document.createElement('canvas');
    const padding = 24;
    const labelHeight = 40;
    canvas.width = qrCanvas.width + padding * 2;
    canvas.height = qrCanvas.height + padding * 2 + labelHeight;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d0d24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(qrCanvas, padding, padding);

    // Etiqueta con nombre del planeta
    ctx.fillStyle = planeta.color;
    ctx.font = 'bold 18px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(planeta.nombre, canvas.width / 2, qrCanvas.height + padding + 28);

    const link = document.createElement('a');
    link.download = `qr-${planeta.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function downloadAll() {
    ORDEN_PLANETAS.forEach((id, index) => {
      setTimeout(() => {
        const planeta = SISTEMA_SOLAR[id];
        const baseUrl = document.getElementById('base-url-input')?.value || BASE_URL;
        const url = `${baseUrl.replace(/\/$/, '')}/planet.html?planet=${id}`;
        downloadQR(planeta, url);
      }, index * 500);
    });
  }
})();
