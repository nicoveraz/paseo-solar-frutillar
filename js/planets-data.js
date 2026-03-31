'use strict';

// Escala: 1:3,977,140,000
// El Sol (diámetro 35 cm) está en el centro de la costanera de Frutillar
const ESCALA = 1 / 3977140000;
const SOL_COORDS = { lat: -41.143448, lng: -73.024236 };
const RUMBO_COSTANERA = 129.20; // grados — bearing real del Paseo Costanera Frutillar (sureste)

// Calcula coordenadas GPS a partir de una distancia en metros y un rumbo
function calcularCoordenadas(distanciaMetros, rumbo) {
  const R = 6371000;
  const r = rumbo !== undefined ? rumbo : RUMBO_COSTANERA;
  const lat1 = SOL_COORDS.lat * Math.PI / 180;
  const lon1 = SOL_COORDS.lng * Math.PI / 180;
  const d = distanciaMetros / R;
  const theta = r * Math.PI / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(theta)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(theta) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  return {
    lat: parseFloat((lat2 * 180 / Math.PI).toFixed(6)),
    lng: parseFloat(((lon2 * 180 / Math.PI + 540) % 360 - 180).toFixed(6))
  };
}

const SISTEMA_SOLAR = {
  sol: {
    id: 'sol',
    nombre: 'El Sol',
    nombreIngles: 'The Sun',
    simbolo: '☉',
    tipo: 'estrella',
    color: '#fdb813',
    colorSecundario: '#ff6b00',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2023/09/sun.jpg',
    imagenFallback: 'https://science.nasa.gov/wp-content/uploads/2024/03/pia15162-mercury-basins-messenger-16x9-1.jpg',
    imagenCredito: 'NASA/SDO',
    diametroReal: 1391000,
    diametroModelo: 35,
    distanciaRealSol: 0,
    distanciaModeloSol: 0,
    lunas: [],
    descripcion: 'El Sol es la estrella en el centro de nuestro sistema solar. Esta gigantesca esfera de plasma caliente contiene el 99,86% de toda la masa del sistema solar. En su núcleo, la temperatura alcanza los 15 millones de grados Celsius, donde la fusión nuclear convierte hidrógeno en helio liberando cantidades colosales de energía. La luz solar tarda aproximadamente 8 minutos en recorrer los 150 millones de kilómetros hasta la Tierra. El Sol tiene unos 4.600 millones de años de edad y se encuentra a mitad de su vida, por lo que continuará brillando durante otros 5.000 millones de años aproximadamente.',
    datosClave: [
      { label: 'Temperatura superficial', valor: '5.500 °C' },
      { label: 'Temperatura del núcleo', valor: '15.000.000 °C' },
      { label: 'Edad', valor: '4.600 millones de años' },
      { label: 'Composición', valor: '73% hidrógeno, 25% helio' },
      { label: 'Masa (Tierra = 1)', valor: '333.000' },
      { label: 'Rotación en el ecuador', valor: '25,4 días' }
    ],
    coords: SOL_COORDS
  },

  mercurio: {
    id: 'mercurio',
    nombre: 'Mercurio',
    nombreIngles: 'Mercury',
    simbolo: '☿',
    tipo: 'planeta terrestre',
    color: '#b5b5b5',
    colorSecundario: '#8a8a8a',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2024/03/pia15162-mercury-basins-messenger-16x9-1.jpg',
    imagenFallback: 'https://photojournal.jpl.nasa.gov/jpeg/PIA15162.jpg',
    imagenCredito: 'NASA/MESSENGER',
    diametroReal: 4879,
    diametroModelo: 0.1227,
    distanciaRealSol: 57.9,
    distanciaModeloSol: 14.56,
    lunas: [],
    descripcion: 'Mercurio es el planeta más pequeño del sistema solar y el más cercano al Sol. Con un diámetro de apenas 4.879 km, es incluso más pequeño que algunas lunas planetarias. Su superficie, densamente cubierta de cráteres, se asemeja a la de nuestra Luna. Sin atmósfera significativa que retenga el calor, las temperaturas oscilan entre -180 °C en la sombra y 430 °C en el lado iluminado. Un año mercuriano dura solo 88 días terrestres, pero un día solar en Mercurio dura 176 días. En este modelo a escala, Mercurio sería una bolita de apenas 1,2 mm de diámetro, colocada a 14,56 metros del Sol.',
    datosClave: [
      { label: 'Período orbital', valor: '88 días terrestres' },
      { label: 'Temperatura máxima', valor: '430 °C' },
      { label: 'Temperatura mínima', valor: '-180 °C' },
      { label: 'Gravedad (Tierra = 1)', valor: '0,38' },
      { label: 'Lunas', valor: '0' },
      { label: 'Distancia al Sol', valor: '57,9 millones de km' }
    ],
    coords: { lat: -41.143531, lng: -73.024101 }
  },

  venus: {
    id: 'venus',
    nombre: 'Venus',
    nombreIngles: 'Venus',
    simbolo: '♀',
    tipo: 'planeta terrestre',
    color: '#e8cda0',
    colorSecundario: '#c9a84c',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2024/03/venus-mariner-10-pia23791-fig2-16x9-1.jpg',
    imagenFallback: 'https://photojournal.jpl.nasa.gov/jpeg/PIA00271.jpg',
    imagenCredito: 'NASA/Mariner 10',
    diametroReal: 12104,
    diametroModelo: 0.3042,
    distanciaRealSol: 108.2,
    distanciaModeloSol: 27.21,
    lunas: [],
    descripcion: 'Venus es a menudo llamado el "planeta gemelo" de la Tierra por su tamaño similar, pero en realidad es un mundo radicalmente diferente. Su densa atmósfera de dióxido de carbono crea un efecto invernadero tan extremo que la temperatura superficial supera los 465 °C, más caliente que Mercurio a pesar de estar más lejos del Sol. Venus gira en dirección opuesta a la mayoría de los planetas (rotación retrógrada), y un día venusiano dura más que su propio año. La presión atmosférica en su superficie es 90 veces mayor que en la Tierra, equivalente a estar a 900 metros de profundidad en el océano.',
    datosClave: [
      { label: 'Período orbital', valor: '225 días terrestres' },
      { label: 'Temperatura superficial', valor: '465 °C' },
      { label: 'Presión atmosférica', valor: '90 atm' },
      { label: 'Rotación', valor: 'Retrógrada (243 días)' },
      { label: 'Lunas', valor: '0' },
      { label: 'Distancia al Sol', valor: '108,2 millones de km' }
    ],
    coords: { lat: -41.143603, lng: -73.023984 }
  },

  tierra: {
    id: 'tierra',
    nombre: 'La Tierra',
    nombreIngles: 'Earth',
    simbolo: '🌍',
    tipo: 'planeta terrestre',
    color: '#4fa3e0',
    colorSecundario: '#2e7d32',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2024/03/blue-marble-apollo-17-16x9-1.jpg',
    imagenFallback: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57723/globe_east_2048.jpg',
    imagenCredito: 'NASA/Apollo 17',
    diametroReal: 12742,
    diametroModelo: 0.3203,
    distanciaRealSol: 149.6,
    distanciaModeloSol: 37.61,
    lunas: [
      {
        nombre: 'Luna',
        diametroReal: 3474,
        diametroModelo: 0.0874,
        distanciaReal: 384400,
        distanciaModelo: 9.66,
        descripcion: 'La Luna es el único satélite natural de la Tierra y el quinto mayor del sistema solar. Su influencia gravitacional genera las mareas de los océanos y estabiliza la inclinación del eje terrestre, lo que tiene un efecto estabilizador en el clima de la Tierra a lo largo del tiempo geológico.'
      }
    ],
    descripcion: 'La Tierra es nuestro hogar y el único planeta conocido que alberga vida. Con el 71% de su superficie cubierta de agua líquida, la Tierra posee condiciones únicas que han permitido la evolución de la vida durante 3.800 millones de años. Nuestra atmósfera de nitrógeno y oxígeno, junto con el campo magnético generado por el núcleo de hierro líquido, nos protege de la radiación solar. La inclinación del eje terrestre de 23,5° produce las estaciones del año. En este modelo, estarías parado a 37,61 metros del Sol, en un planeta del tamaño de un grano de pimienta de 3,2 mm.',
    datosClave: [
      { label: 'Período orbital', valor: '365,25 días' },
      { label: 'Temperatura media', valor: '15 °C' },
      { label: 'Inclinación axial', valor: '23,5°' },
      { label: 'Campo magnético', valor: 'Sí' },
      { label: 'Lunas', valor: '1 (Luna)' },
      { label: 'Distancia al Sol', valor: '149,6 millones de km (1 UA)' }
    ],
    coords: { lat: -41.143662, lng: -73.023888 }
  },

  marte: {
    id: 'marte',
    nombre: 'Marte',
    nombreIngles: 'Mars',
    simbolo: '♂',
    tipo: 'planeta terrestre',
    color: '#c1440e',
    colorSecundario: '#8b3a0e',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2024/03/mars-full-globe-16x9-1.jpg',
    imagenFallback: 'https://photojournal.jpl.nasa.gov/jpeg/PIA00407.jpg',
    imagenCredito: 'NASA/Viking',
    diametroReal: 6779,
    diametroModelo: 0.1704,
    distanciaRealSol: 227.9,
    distanciaModeloSol: 57.30,
    lunas: [
      {
        nombre: 'Fobos',
        diametroReal: 22.2,
        diametroModelo: 0.00056,
        distanciaReal: 9376,
        distanciaModelo: 0.00236,
        descripcion: 'Luna irregular, probablemente un asteroide capturado. Orbita tan cerca de Marte que se dirige a chocar con él en unos 50 millones de años.'
      },
      {
        nombre: 'Deimos',
        diametroReal: 12.6,
        diametroModelo: 0.00032,
        distanciaReal: 23463,
        distanciaModelo: 0.0059,
        descripcion: 'La luna más pequeña y exterior de Marte. También es un asteroide capturado.'
      }
    ],
    descripcion: 'Marte, el planeta rojo, debe su color característico al óxido de hierro que cubre su superficie. Es el planeta más explorado del sistema solar después de la Tierra, con decenas de misiones que han revelado un mundo fascinante. Alberga el Olympus Mons, el volcán más alto del sistema solar con 21 km de altura, y el Valles Marineris, un sistema de cañones que se extendería de un extremo al otro de los Estados Unidos. Existe evidencia sólida de que Marte tuvo agua líquida en su pasado y su atmósfera delgada de CO₂ podría haber sido mucho más densa. Actualmente, seis robots exploran activamente su superficie y órbita.',
    datosClave: [
      { label: 'Período orbital', valor: '687 días terrestres' },
      { label: 'Temperatura media', valor: '-63 °C' },
      { label: 'Volcán más alto', valor: 'Olympus Mons (21 km)' },
      { label: 'Atmósfera', valor: '95% CO₂' },
      { label: 'Lunas', valor: '2 (Fobos y Deimos)' },
      { label: 'Distancia al Sol', valor: '227,9 millones de km' }
    ],
    coords: { lat: -41.143774, lng: -73.023706 }
  },

  jupiter: {
    id: 'jupiter',
    nombre: 'Júpiter',
    nombreIngles: 'Jupiter',
    simbolo: '♃',
    tipo: 'gigante gaseoso',
    color: '#c88b3a',
    colorSecundario: '#8b5e1a',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2024/03/jupiter-marble-pia22946-16x9-1.jpg',
    imagenFallback: 'https://photojournal.jpl.nasa.gov/jpeg/PIA02873.jpg',
    imagenCredito: 'NASA/Juno',
    diametroReal: 139820,
    diametroModelo: 3.515,
    distanciaRealSol: 778.5,
    distanciaModeloSol: 195.8,
    lunas: [
      {
        nombre: 'Ío',
        diametroReal: 3643,
        diametroModelo: 0.0916,
        distanciaReal: 421800,
        distanciaModelo: 10.6,
        descripcion: 'La luna más volcanicamente activa del sistema solar. Cientos de volcanes en erupción continua moldean su superficie color azufre. Las fuerzas de marea de Júpiter generan suficiente calor interno para mantener este inferno geológico.'
      },
      {
        nombre: 'Europa',
        diametroReal: 3122,
        diametroModelo: 0.0785,
        distanciaReal: 671100,
        distanciaModelo: 16.9,
        descripcion: 'Una de las lunas más prometedoras para la búsqueda de vida extraterrestre. Bajo su corteza de hielo se esconde un océano de agua líquida más grande que todos los océanos de la Tierra combinados.'
      },
      {
        nombre: 'Ganímedes',
        diametroReal: 5268,
        diametroModelo: 0.1324,
        distanciaReal: 1070400,
        distanciaModelo: 26.9,
        descripcion: 'La luna más grande del sistema solar, incluso más grande que el planeta Mercurio. Tiene su propio campo magnético, algo único entre las lunas conocidas.'
      },
      {
        nombre: 'Calisto',
        diametroReal: 4821,
        diametroModelo: 0.1212,
        distanciaReal: 1882700,
        distanciaModelo: 47.3,
        descripcion: 'La superficie más craterizada del sistema solar. Tiene posiblemente un océano subsuperficial y es candidata a exploración futura por ser más accesible que Europa.'
      }
    ],
    descripcion: 'Júpiter es el gigante del sistema solar: su masa supera la de todos los demás planetas combinados multiplicada por dos. Su característica más icónica es la Gran Mancha Roja, una tormenta anticiclónica que lleva activa al menos 350 años y que en su apogeo era tres veces el tamaño de la Tierra. Júpiter irradia más energía de la que recibe del Sol gracias a la contracción gravitacional. Sus cuatro lunas principales —Ío, Europa, Ganímedes y Calisto— fueron descubiertas por Galileo en 1610 y son mundos fascinantes por sí solos. Europa, con su océano subsuperficial, es uno de los mejores candidatos para buscar vida en el sistema solar.',
    datosClave: [
      { label: 'Período orbital', valor: '11,9 años terrestres' },
      { label: 'Temperatura en la capa de nubes', valor: '-108 °C' },
      { label: 'Velocidad del viento', valor: 'hasta 620 km/h' },
      { label: 'Gran Mancha Roja', valor: '>350 años activa' },
      { label: 'Lunas conocidas', valor: '95' },
      { label: 'Distancia al Sol', valor: '778,5 millones de km' }
    ],
    coords: { lat: -41.144561, lng: -73.022424 }
  },

  saturno: {
    id: 'saturno',
    nombre: 'Saturno',
    nombreIngles: 'Saturn',
    simbolo: '♄',
    tipo: 'gigante gaseoso',
    color: '#e4d191',
    colorSecundario: '#b8a040',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2023/05/saturn-farewell-pia21345-sse-banner-1920x640-1.jpg',
    imagenFallback: 'https://photojournal.jpl.nasa.gov/jpeg/PIA04913.jpg',
    imagenCredito: 'NASA/Cassini',
    diametroReal: 116460,
    diametroModelo: 2.929,
    distanciaRealSol: 1432,
    distanciaModeloSol: 360.3,
    lunas: [
      {
        nombre: 'Titán',
        diametroReal: 5151,
        diametroModelo: 0.1295,
        distanciaReal: 1221870,
        distanciaModelo: 30.7,
        descripcion: 'La única luna del sistema solar con una atmósfera densa (más densa que la de la Tierra). Tiene lagos y ríos de metano líquido en su superficie y un ciclo del metano análogo al ciclo del agua en la Tierra. La misión Cassini-Huygens exploró Titán en detalle entre 2004 y 2017.'
      }
    ],
    descripcion: 'Saturno es el planeta más reconocible del sistema solar gracias a sus magníficos anillos. Estos anillos están compuestos principalmente de fragmentos de hielo y roca, con tamaños que van desde micrómetros hasta varios metros. Saturno es el planeta menos denso del sistema solar —si existiera un océano suficientemente grande, ¡flotaría!— con una densidad promedio menor que el agua. El planeta emite aproximadamente el doble de energía de la que recibe del Sol. Titán, su luna más grande, es uno de los mundos más intrigantes del sistema solar con su atmósfera densa y sus lagos de metano.',
    datosClave: [
      { label: 'Período orbital', valor: '29,5 años terrestres' },
      { label: 'Densidad', valor: '0,69 g/cm³ (menor que el agua)' },
      { label: 'Extensión de los anillos', valor: '282.000 km de diámetro' },
      { label: 'Grosor de los anillos', valor: '10 a 100 metros' },
      { label: 'Lunas conocidas', valor: '146' },
      { label: 'Distancia al Sol', valor: '1.432 millones de km' }
    ],
    coords: { lat: -41.145496, lng: -73.020901 }
  },

  urano: {
    id: 'urano',
    nombre: 'Urano',
    nombreIngles: 'Uranus',
    simbolo: '⛢',
    tipo: 'gigante de hielo',
    color: '#7de8e8',
    colorSecundario: '#4bb8b8',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2024/03/uranus-pia18182-16x9-1.jpg',
    imagenFallback: 'https://photojournal.jpl.nasa.gov/jpeg/PIA18182.jpg',
    imagenCredito: 'NASA/Voyager 2',
    diametroReal: 50724,
    diametroModelo: 1.275,
    distanciaRealSol: 2867,
    distanciaModeloSol: 723.4,
    lunas: [
      { nombre: 'Ariel', diametroReal: 1158, diametroModelo: 0.0291, distanciaReal: 190900, distanciaModelo: 4.80, descripcion: 'Luna con mezcla de cráteres y cañones.' },
      { nombre: 'Umbriel', diametroReal: 1169, diametroModelo: 0.0294, distanciaReal: 266000, distanciaModelo: 6.69, descripcion: 'Luna de superficie oscura y antigua.' },
      { nombre: 'Titania', diametroReal: 1578, diametroModelo: 0.0397, distanciaReal: 436300, distanciaModelo: 10.97, descripcion: 'La luna más grande de Urano.' },
      { nombre: 'Oberón', diametroReal: 1523, diametroModelo: 0.0383, distanciaReal: 583500, distanciaModelo: 14.67, descripcion: 'Luna con cráteres profundos y antiguas montañas.' }
    ],
    descripcion: 'Urano es un gigante de hielo que gira sobre su lado, con su eje de rotación inclinado casi 98 grados respecto a su órbita. Este "planeta volcado" resulta en que sus polos reciben más luz solar que su ecuador en ciertas épocas del año. Se cree que este inusual eje fue causado por una colisión con un objeto del tamaño de la Tierra hace miles de millones de años. Urano fue el primer planeta descubierto con telescopio, observado por William Herschel en 1781. Tiene 13 anillos delgados y oscuros, y 27 lunas conocidas, todas nombradas en honor a personajes de las obras de Shakespeare y Alexander Pope.',
    datosClave: [
      { label: 'Período orbital', valor: '84 años terrestres' },
      { label: 'Inclinación axial', valor: '97,8°' },
      { label: 'Temperatura mínima', valor: '-224 °C (más frío que Neptuno)' },
      { label: 'Descubrimiento', valor: '1781 por William Herschel' },
      { label: 'Lunas conocidas', valor: '27' },
      { label: 'Distancia al Sol', valor: '2.867 millones de km' }
    ],
    coords: { lat: -41.147559, lng: -73.017541 }
  },

  neptuno: {
    id: 'neptuno',
    nombre: 'Neptuno',
    nombreIngles: 'Neptune',
    simbolo: '♆',
    tipo: 'gigante de hielo',
    color: '#4b70dd',
    colorSecundario: '#2a3fa0',
    imagen: 'https://science.nasa.gov/wp-content/uploads/2024/03/pia01492-neptune-full-disk-16x9-1.jpg',
    imagenFallback: 'https://photojournal.jpl.nasa.gov/jpeg/PIA01492.jpg',
    imagenCredito: 'NASA/Voyager 2',
    diametroReal: 49244,
    diametroModelo: 1.238,
    distanciaRealSol: 4495,
    distanciaModeloSol: 1132,
    lunas: [
      {
        nombre: 'Tritón',
        diametroReal: 2707,
        diametroModelo: 0.0681,
        distanciaReal: 354759,
        distanciaModelo: 8.92,
        descripcion: 'Una de las lunas más fascinantes del sistema solar. Orbita a Neptuno en dirección contraria a la rotación del planeta (órbita retrógrada), lo que sugiere que fue capturada del Cinturón de Kuiper. Tiene géiseres activos de nitrógeno y su órbita está decayendo gradualmente: en aproximadamente 3.600 millones de años, será destruida por las fuerzas de marea de Neptuno.'
      }
    ],
    descripcion: 'Neptuno es el planeta más lejano del sistema solar, situado a más de 4.500 millones de kilómetros del Sol. Con velocidades de viento que pueden superar los 2.100 km/h, alberga las tormentas más violentas del sistema solar. La sonda Voyager 2 es la única nave espacial que ha visitado Neptuno, en 1989, y ha tardado 12 años en llegar allí. Neptuno fue el primer planeta descubierto mediante predicciones matemáticas, antes de ser observado directamente en 1846. En este modelo a escala, Neptuno está a 1.132 metros del Sol, casi en el otro extremo de la costanera.',
    datosClave: [
      { label: 'Período orbital', valor: '165 años terrestres' },
      { label: 'Velocidad del viento', valor: 'hasta 2.100 km/h' },
      { label: 'Temperatura', valor: '-201 °C' },
      { label: 'Descubrimiento', valor: '1846 por Le Verrier y Adams' },
      { label: 'Lunas conocidas', valor: '16' },
      { label: 'Distancia al Sol', valor: '4.495 millones de km' }
    ],
    coords: { lat: -41.149881, lng: -73.013759 }
  }
};

const ORDEN_PLANETAS = ['sol', 'mercurio', 'venus', 'tierra', 'marte', 'jupiter', 'saturno', 'urano', 'neptuno'];

function getPlaneta(id) {
  return SISTEMA_SOLAR[id] || null;
}

function getPlanetaAnterior(id) {
  const idx = ORDEN_PLANETAS.indexOf(id);
  if (idx <= 0) return null;
  return SISTEMA_SOLAR[ORDEN_PLANETAS[idx - 1]];
}

function getPlanetaSiguiente(id) {
  const idx = ORDEN_PLANETAS.indexOf(id);
  if (idx < 0 || idx >= ORDEN_PLANETAS.length - 1) return null;
  return SISTEMA_SOLAR[ORDEN_PLANETAS[idx + 1]];
}

function formatearDistancia(metros) {
  if (metros >= 1000) return (metros / 1000).toFixed(3) + ' km';
  return metros.toFixed(2) + ' m';
}

function formatearDiametro(cm) {
  if (cm < 0.1) return (cm * 10).toFixed(3) + ' mm';
  return cm.toFixed(4) + ' cm';
}
