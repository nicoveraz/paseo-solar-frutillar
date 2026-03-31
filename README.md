# Paseo Solar Frutillar

Modelo a escala del sistema solar emplazado en la costanera de Frutillar, Chile.

**Escala:** 1:3.093.330.000
**El Sol:** 45 cm de diámetro — ubicado en la costanera (-41.129990, -73.027325)
**Neptuno:** a 1.456 metros al sureste del Sol

## Estructura

```
paseo-solar-frutillar/
├── index.html          Página principal con mapa Leaflet
├── planet.html         Ficha individual de cada planeta (?planet=mercurio)
├── ar.html             Vista en Realidad Aumentada (?planet=mercurio)
├── qr-codes.html       Generador de códigos QR para los pedestales
├── css/styles.css      Estilos (dark space theme, mobile-first)
├── js/
│   ├── planets-data.js Datos de todos los planetas (en español)
│   ├── map.js          Mapa Leaflet de la costanera
│   ├── ar-view.js      Escena A-Frame + AR.js (GPS-based AR)
│   └── qr-generator.js Generador de QR con qrcode.js
├── assets/textures/    Texturas de planetas (opcional)
└── qr-codes/           Output de QR generados
```

## Tecnologías

- HTML5 / CSS3 / Vanilla JS — sin build tools
- [Leaflet.js](https://leafletjs.com/) — mapa interactivo
- [A-Frame](https://aframe.io/) + [AR.js](https://ar-js-org.github.io/AR.js-Docs/) — Realidad Aumentada basada en GPS
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) — generación de códigos QR
- [Google Material Symbols](https://fonts.google.com/icons) — iconografía

## Datos de escala

| Planeta  | ⌀ modelo   | Dist. al Sol (modelo) | Coordenadas GPS           |
|----------|------------|----------------------|---------------------------|
| Sol      | 45 cm      | —                    | -41.129990, -73.027325    |
| Mercurio | 1.577 mm   | 18.72 m              | -41.130096, -73.027152    |
| Venus    | 3.912 mm   | 34.98 m              | -41.130188, -73.027001    |
| Tierra   | 4.119 mm   | 48.36 m              | -41.130264, -73.026877    |
| Marte    | 2.191 mm   | 73.67 m              | -41.130408, -73.026643    |
| Júpiter  | 4.519 cm   | 251.7 m              | -41.131417, -73.024996    |
| Saturno  | 3.766 cm   | 463.3 m              | -41.132618, -73.023037    |
| Urano    | 1.640 cm   | 930.1 m              | -41.135265, -73.018716    |
| Neptuno  | 1.592 cm   | 1456 m               | -41.138249, -73.013850    |

## Uso local

```bash
# Cualquier servidor HTTP estático sirve
npx serve .
# o
python3 -m http.server 8080
```

Luego abrir `http://localhost:8080`

> La vista AR requiere HTTPS en producción (excepto en localhost) y permisos de cámara y GPS.

## Despliegue

El sitio es 100% estático. Funciona en GitHub Pages, Netlify, Vercel o cualquier hosting de archivos estáticos.

Para GitHub Pages:
```bash
git push origin main
# Activar Pages desde Settings → Pages → Branch: main
```

## Licencia

Datos astronómicos: NASA/JPL (dominio público)
Código: MIT
