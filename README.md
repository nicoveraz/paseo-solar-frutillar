# Paseo Solar Frutillar

Modelo a escala del sistema solar emplazado en la costanera de Frutillar, Chile.

**Escala:** 1:3.093.333.333
**El Sol:** 45 cm de diámetro — ubicado en la costanera (-41.129935, -73.027327)
**Neptuno:** a 1.456 metros al sur del Sol

## Estructura

```
paseo-solar-frutillar/
├── index.html          Inicio: mapa, progreso de la misión, planetas y datos de escala
├── planet.html         Ficha de cada planeta (?planet=mercurio)
├── ar.html             Realidad aumentada + Misión Solar (?planet=mercurio opcional)
├── configurar.html     Herramienta admin (PIN): ubicar pedestales y generar QR
├── css/styles.css      Estilos (dark space theme, mobile-first)
└── js/
    ├── planets-data.js Datos del modelo, coordenadas GPS y helpers de formato
    ├── map.js          Mapa Leaflet de la costanera
    ├── home.js         Lógica de index.html
    └── ar.js           Cámara + brújula + GPS + captura de planetas
```

## Experiencia

1. **Inicio** — mapa interactivo, lista de planetas y progreso de la misión.
2. **Ficha** — datos reales y del modelo, lunas, distancias y mini mapa.
3. **AR / Misión Solar** — una sola vista de cámara: los pines muestran la dirección
   real de cada pedestal. Al estar a menos de 10 m aparece el botón *Capturar*.
   El progreso se guarda en `localStorage` y se muestra en el inicio.
4. **Configurar** — página protegida por PIN para mover el Sol y los pedestales sobre
   el mapa, exportar el JSON de coordenadas y descargar los códigos QR.

## Tecnologías

- HTML5 / CSS3 / Vanilla JS — sin build tools
- [Leaflet.js](https://leafletjs.com/) — mapa interactivo
- WebRTC (`getUserMedia`), `DeviceOrientation` / `AbsoluteOrientationSensor` y Geolocation — AR sin frameworks
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) — generación de QR (solo en configurar)
- [Google Material Symbols](https://fonts.google.com/icons) — iconografía

## Datos de escala

| Planeta  | ⌀ modelo   | Dist. al Sol (modelo) | Coordenadas GPS           |
|----------|------------|----------------------|---------------------------|
| Sol      | 45 cm      | —                    | -41.129935, -73.027327    |
| Mercurio | 1,58 mm    | 18,7 m               | -41.130102, -73.027348    |
| Venus    | 3,91 mm    | 35,0 m               | -41.130246, -73.027383    |
| Tierra   | 4,12 mm    | 48,4 m               | -41.130366, -73.027400    |
| Marte    | 2,19 mm    | 73,7 m               | -41.130592, -73.027437    |
| Júpiter  | 4,52 cm    | 251,7 m              | -41.132195, -73.027489    |
| Saturno  | 3,76 cm    | 462,9 m              | -41.134098, -73.027341    |
| Urano    | 1,64 cm    | 930,1 m              | -41.138278, -73.026551    |
| Neptuno  | 1,59 cm    | 1,456 km             | -41.142839, -73.024401    |

## Uso local

```bash
python3 -m http.server 8080
```

Luego abrir `http://localhost:8080`

> La vista AR requiere HTTPS en producción (excepto en localhost) y permisos de cámara, GPS y orientación.
