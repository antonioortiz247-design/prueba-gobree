const productos = Array.from({ length: 40 }, (_, i) => {
  const categorias = ['sanitaria', 'alta-temperatura', 'modular', 'dentada'];
  const categoria = categorias[i % categorias.length];
  const nombreCategoria = {
    'sanitaria': 'Banda Sanitaria PVC Blanca',
    'alta-temperatura': 'Banda Alta Temperatura PTFE',
    'modular': 'Banda Modular Plástica',
    'dentada': 'Banda Dentada de Transmisión'
  }[categoria];

  return {
    id: i + 1,
    nombre: `${nombreCategoria} ${i + 1}`,
    categoria,
    descripcion: `Solución ${categoria} para líneas industriales con alta confiabilidad.`,
    material: categoria === 'sanitaria' ? 'PVC grado alimenticio' : categoria === 'alta-temperatura' ? 'PTFE / silicón' : categoria === 'modular' ? 'Polímero técnico' : 'Caucho reforzado',
    temperatura: categoria === 'alta-temperatura' ? '220°C' : categoria === 'sanitaria' ? '80°C' : categoria === 'modular' ? '95°C' : '120°C',
    industria: categoria === 'sanitaria' ? 'Alimenticia' : categoria === 'alta-temperatura' ? 'Manufactura' : categoria === 'modular' ? 'Logística' : 'Farmacéutica',
    aplicaciones: 'Transporte continuo, acumulación controlada y transmisión de potencia.',
    imagen: `https://images.unsplash.com/photo-${1586528116311 + i}-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80`
  };
});
