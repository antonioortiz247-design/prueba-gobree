const productos = [
  // 1. Transportadoras Planas
  {
    id: 1,
    nombre: "Banda PVC (Colores)",
    categoria: "Transportadoras Planas",
    descripcion: "Transporte versátil para múltiples industrias.",
    tags: ["PVC", "higiene", "transporte", "general"],
    material: "PVC",
    propiedad: "Higiene",
    img: "banda-pvc-industrial.png",
    alt: "Banda transportadora de PVC para transporte ligero en industria",
    title: "Banda PVC industrial"
  },
  {
    id: 2,
    nombre: "Banda Poliuretano",
    categoria: "Transportadoras Planas",
    descripcion: "Alta resistencia a aceites y grasas, grado alimenticio.",
    tags: ["Poliuretano", "PU", "higiene", "alimentos"],
    material: "Poliuretano",
    propiedad: "Higiene",
    img: "banda-poliuretano-industrial.png",
    alt: "Banda de poliuretano para procesos industriales de alta precisión",
    title: "Banda poliuretano"
  },
  {
    id: 3,
    nombre: "Banda Silicón",
    categoria: "Transportadoras Planas",
    descripcion: "Excelente desprendimiento y resistencia térmica moderada.",
    tags: ["Silicón", "higiene", "antiadherente"],
    material: "Silicón",
    propiedad: "Higiene",
    img: "banda-silicon-industrial.png",
    alt: "Banda de silicón resistente a altas temperaturas industriales",
    title: "Banda de silicón"
  },

  // 2. Bandas Modulares
  {
    id: 4,
    nombre: "Banda Modular Acetal",
    categoria: "Bandas Modulares",
    descripcion: "Alta resistencia mecánica y bajo coeficiente de fricción.",
    tags: ["Acetal", "carga pesada", "modular", "todas las industrias"],
    material: "Acetal",
    propiedad: "Carga pesada",
    img: "banda-modular-acetal-industrial.png",
    alt: "Banda modular de acetal para uso industrial de alta resistencia",
    title: "Banda modular acetal"
  },
  {
    id: 5,
    nombre: "Banda Modular Polipropileno",
    categoria: "Bandas Modulares",
    descripcion: "Excelente resistencia química y ligereza.",
    tags: ["Polipropileno", "PP", "modular", "química", "todas las industrias"],
    material: "Polipropileno",
    propiedad: "Higiene",
    img: "banda-modular-pp-industrial.png",
    alt: "Banda modular de polipropileno para transporte industrial general",
    title: "Banda modular PP"
  },
  {
    id: 6,
    nombre: "Banda Modular Polietileno",
    categoria: "Bandas Modulares",
    descripcion: "Ideal para aplicaciones de baja temperatura y alta flexibilidad.",
    tags: ["Polietileno", "PE", "modular", "baja temperatura", "todas las industrias"],
    material: "Polietileno",
    propiedad: "Higiene",
    img: "banda-modular-pe-industrial.png",
    alt: "Banda modular de polietileno flexible resistente a impactos",
    title: "Banda modular PE"
  },

  // 3. Bandas Planas
  {
    id: 7,
    nombre: "Banda Hule / Boticlano",
    categoria: "Bandas Planas",
    descripcion: "Máxima tracción y resistencia a la abrasión.",
    tags: ["Hule", "Boticlano", "carga pesada", "abrasión"],
    material: "Hule",
    propiedad: "Carga pesada"
  },
  {
    id: 8,
    nombre: "Banda Textil",
    categoria: "Bandas Planas",
    descripcion: "Flexibilidad y suavidad para transporte ligero.",
    tags: ["Textil", "flexibilidad", "ligero"],
    material: "Textil",
    propiedad: "Transmisión",
    img: "banda-textil-industrial.png",
    alt: "Banda transportadora textil con alta tracción para industria",
    title: "Banda textil"
  },
  {
    id: 9,
    nombre: "Banda Transmisión de Fuerza",
    categoria: "Bandas Planas",
    descripcion: "Eficiencia en transmisión de potencia industrial.",
    tags: ["Transmisión", "potencia", "fuerza"],
    material: "Nylon",
    propiedad: "Transmisión",
    img: "banda-nylon-industrial.png",
    alt: "Banda transportadora de nylon de alta resistencia industrial",
    title: "Banda nylon"
  },
  {
    id: 10,
    nombre: "Banda con Alma de Poliamida (Nylon)",
    categoria: "Bandas Planas",
    descripcion: "Alta estabilidad dimensional para transmisiones críticas.",
    tags: ["Nylon", "poliamida", "estabilidad", "transmisión"],
    material: "Nylon",
    propiedad: "Transmisión",
    img: "banda-nylon-industrial.png",
    alt: "Banda transportadora de nylon de alta resistencia industrial",
    title: "Banda nylon"
  },

  // 4. Bandas Dentadas (Sincrónicas)
  {
    id: 11,
    nombre: "Banda Dentada Simple",
    categoria: "Bandas Dentadas",
    descripcion: "Sincronización precisa para maquinaria industrial.",
    tags: ["Dentada", "sincrónica", "precisión"],
    material: "Poliuretano",
    propiedad: "Precisión",
    img: "banda-dentada-simple-industrial.png",
    alt: "Banda dentada para transmisión de movimiento en maquinaria",
    title: "Banda dentada simple"
  },
  {
    id: 12,
    nombre: "Banda Dentada con Linatex",
    categoria: "Bandas Dentadas",
    descripcion: "Alto agarre y resistencia al desgaste.",
    tags: ["Dentada", "Linatex", "recubrimiento", "agarre"],
    material: "Hule",
    propiedad: "Precisión"
  },
  {
    id: 13,
    nombre: "Banda Dentada Grip Top",
    categoria: "Bandas Dentadas",
    descripcion: "Tracción superior en superficies inclinadas.",
    tags: ["Dentada", "Grip Top", "recubrimiento", "tracción"],
    material: "PVC",
    propiedad: "Precisión",
    img: "banda-recubrimiento-griptop.png",
    alt: "Banda con recubrimiento griptop de alta adherencia industrial",
    title: "Recubrimiento griptop"
  },
  {
    id: 14,
    nombre: "Banda Dentada Diamante",
    categoria: "Bandas Dentadas",
    descripcion: "Grabado especial para manejo de materiales delicados.",
    tags: ["Dentada", "Diamante", "recubrimiento"],
    material: "PVC",
    propiedad: "Precisión",
    img: "banda-recubrimiento-diamante.png",
    alt: "Banda con recubrimiento diamante antideslizante",
    title: "Recubrimiento diamante"
  },
  {
    id: 15,
    nombre: "Banda Dentada Linatrile",
    categoria: "Bandas Dentadas",
    descripcion: "Resistencia a aceites con alto coeficiente de fricción.",
    tags: ["Dentada", "Linatrile", "recubrimiento", "aceites"],
    material: "Nitrilo",
    propiedad: "Precisión",
    img: "banda-recubrimiento-nitrilo.png",
    alt: "Banda con recubrimiento nitrilo resistente a químicos y aceites",
    title: "Recubrimiento nitrilo"
  },
  {
    id: 16,
    nombre: "Banda Dentada Ambur",
    categoria: "Bandas Dentadas",
    descripcion: "Recubrimiento especializado para la industria alimentaria.",
    tags: ["Dentada", "Ambur", "recubrimiento", "alimentos"],
    material: "Poliuretano",
    propiedad: "Higiene"
  },
  {
    id: 17,
    nombre: "Banda Dentada Nitrilo",
    categoria: "Bandas Dentadas",
    descripcion: "Excelente resistencia química y a hidrocarburos.",
    tags: ["Dentada", "Nitrilo", "recubrimiento", "química"],
    material: "Nitrilo",
    propiedad: "Precisión",
    img: "banda-recubrimiento-nitrilo.png",
    alt: "Banda con recubrimiento nitrilo resistente a químicos y aceites",
    title: "Recubrimiento nitrilo"
  },
  {
    id: 18,
    nombre: "Banda Dentada Corcho Hule",
    categoria: "Bandas Dentadas",
    descripcion: "Compresión y agarre para aplicaciones específicas.",
    tags: ["Dentada", "Corcho", "Hule", "recubrimiento"],
    material: "Hule",
    propiedad: "Precisión",
    img: "banda-recubrimiento-corcho.png",
    alt: "Banda con recubrimiento de corcho para agarre controlado",
    title: "Recubrimiento corcho"
  },
  {
    id: 19,
    nombre: "Banda Dentada con Empujadores",
    categoria: "Bandas Dentadas",
    descripcion: "Transporte inclinado con posicionamiento exacto.",
    tags: ["Dentada", "empujadores", "inclinación"],
    material: "Poliuretano",
    propiedad: "Precisión"
  },
  {
    id: 20,
    nombre: "Banda Dentada con Perforaciones",
    categoria: "Bandas Dentadas",
    descripcion: "Ideal para sistemas de vacío y succión.",
    tags: ["Dentada", "perforaciones", "vacío"],
    material: "Poliuretano",
    propiedad: "Precisión",
    img: "banda-dentada-perforada-industrial.png",
    alt: "Banda dentada perforada para ventilación y procesos especiales",
    title: "Banda dentada perforada"
  },
  {
    id: 21,
    nombre: "Banda Doble Dentado",
    categoria: "Bandas Dentadas",
    descripcion: "Transmisión de potencia por ambos lados de la banda.",
    tags: ["Doble dentado", "potencia", "sincrónica"],
    material: "Poliuretano",
    propiedad: "Precisión"
  },

  // 5. Bandas de Teflón
  {
    id: 22,
    nombre: "Banda Teflón Fibra de Vidrio",
    categoria: "Bandas de Teflón",
    descripcion: "Alta resistencia térmica y antiadherencia.",
    tags: ["Teflón", "PTFE", "fibra de vidrio", "alta temperatura"],
    material: "Teflón",
    propiedad: "Alta temperatura",
    img: "banda-teflon-fibra.png",
    alt: "Banda de teflón con fibra para alta temperatura industrial",
    title: "Banda teflón fibra"
  },
  {
    id: 23,
    nombre: "Banda Teflón (Diferentes Espesores)",
    categoria: "Bandas de Teflón",
    descripcion: "Ligeramente elásticas y resistentes a químicos.",
    tags: ["Teflón", "PTFE", "elástica", "química"],
    material: "Teflón",
    propiedad: "Alta temperatura",
    img: "banda-teflon-lisa.png",
    alt: "Banda de teflón lisa con superficie antiadherente",
    title: "Banda teflón lisa"
  },

  // 6. Otros Productos
  {
    id: 24,
    nombre: "Banda Abierta",
    categoria: "Otros Productos",
    descripcion: "Versatilidad para instalaciones personalizadas.",
    tags: ["Abierta", "instalación", "personalizado"],
    material: "Poliuretano",
    propiedad: "Transmisión",
    img: "banda-abierta-industrial.png",
    alt: "Banda transportadora abierta sin empalme para instalación",
    title: "Banda abierta"
  },
  {
    id: 25,
    nombre: "Banda Circular (Polycord) Naranja",
    categoria: "Otros Productos",
    descripcion: "Diámetro 4-5 mm, ideal para transmisión de potencia.",
    tags: ["Circular", "Polycord", "naranja", "potencia"],
    material: "Poliuretano",
    propiedad: "Transmisión",
    img: "banda-polycord.png",
    alt: "Banda tipo polycord redonda para transmisión ligera",
    title: "Polycord"
  },
  {
    id: 26,
    nombre: "Banda Circular (Polycord) Verde",
    categoria: "Otros Productos",
    descripcion: "Diámetro 4-5 mm, tracción confiable y flexible.",
    tags: ["Circular", "Polycord", "verde", "tracción"],
    material: "Poliuretano",
    propiedad: "Transmisión",
    img: "banda-polycord.png",
    alt: "Banda tipo polycord redonda para transmisión ligera",
    title: "Polycord"
  }
];

// Exportar si es necesario (dependiendo de cómo se use en otros scripts)
if (typeof module !== 'undefined') {
  module.exports = productos;
}
