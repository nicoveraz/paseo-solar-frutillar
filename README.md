# Paseo Solar Frutillar

Modelo a escala del sistema solar emplazado en la costanera de Frutillar, Chile.

**Escala:** 1:3.977.140.000
**El Sol:** 35 cm de diámetro — ubicado en el centro (41°8'36"S, 73°1'27"O)
**Neptuno:** a 1.132 metros al este del Sol

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

| Planeta  | ⌀ modelo   | Dist. al Sol (modelo) | Coordenadas GPS         |
|----------|------------|----------------------|-------------------------|
| Sol      | 35 cm      | —                    | -41.143448, -73.024236  |
| Mercurio | 1.227 mm   | 14.56 m              | -41.143448, -73.024062  |
| Venus    | 3.042 mm   | 27.21 m              | -41.143448, -73.023911  |
| Tierra   | 3.203 mm   | 37.61 m              | -41.143448, -73.023787  |
| Marte    | 1.704 mm   | 57.30 m              | -41.143448, -73.023553  |
| Júpiter  | 3.515 cm   | 195.8 m              | -41.143448, -73.021901  |
| Saturno  | 2.929 cm   | 360.3 m              | -41.143448, -73.019940  |
| Urano    | 1.275 cm   | 723.4 m              | -41.143448, -73.015609  |
| Neptuno  | 1.238 cm   | 1132 m               | -41.143448, -73.010716  |

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
