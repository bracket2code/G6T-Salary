// AI-powered skill suggestion system
export const analyzeDescriptionForSkills = (description: string, title: string = ''): string[] => {
  const text = `${title} ${description}`.toLowerCase();
  const suggestedSkills: string[] = [];
  
  // Define keywords for each skill type
  const skillKeywords = {
    electricidad: [
      'electricidad', 'eléctrico', 'cable', 'voltaje', 'corriente', 'interruptor', 
      'enchufe', 'toma', 'luz', 'lámpara', 'bombilla', 'fusible', 'breaker',
      'instalación eléctrica', 'cortocircuito', 'voltios', 'amperios', 'watts',
      'tablero eléctrico', 'cableado', 'conexión eléctrica'
    ],
    electronica: [
      'electrónico', 'circuito', 'sensor', 'microcontrolador', 'placa', 'chip',
      'resistencia', 'capacitor', 'transistor', 'diodo', 'led', 'pantalla',
      'display', 'control remoto', 'alarma', 'cámara', 'micrófono', 'altavoz'
    ],
    fontaneria: [
      'fontanería', 'tubería', 'cañería', 'agua', 'grifo', 'llave', 'ducha',
      'inodoro', 'lavabo', 'fregadero', 'desagüe', 'filtro', 'bomba de agua',
      'calentador', 'termo', 'válvula', 'sifón', 'goteo', 'fuga', 'presión'
    ],
    construccion: [
      'construcción', 'pared', 'techo', 'suelo', 'pintura', 'yeso', 'cemento',
      'ladrillo', 'azulejo', 'baldosa', 'ventana', 'puerta', 'marco', 'bisagra',
      'cerradura', 'manija', 'estructura', 'viga', 'columna', 'escalera'
    ],
    tecnologia: [
      'tecnología', 'ordenador', 'computadora', 'software', 'hardware', 'red',
      'wifi', 'internet', 'router', 'switch', 'servidor', 'impresora', 'scanner',
      'monitor', 'teclado', 'ratón', 'cable de red', 'ethernet', 'usb'
    ],
    cerrajeria: [
      'cerradura', 'llave', 'candado', 'cerrojo', 'bombín', 'cilindro',
      'manija', 'pomo', 'pestillo', 'bisagra', 'marco', 'puerta', 'ventana',
      'seguridad', 'acceso', 'apertura', 'cierre'
    ],
    cristaleria: [
      'cristal', 'vidrio', 'ventana', 'espejo', 'vitrina', 'escaparate',
      'mampara', 'cristalera', 'luna', 'templado', 'laminado', 'rotura',
      'grieta', 'sellado', 'silicona', 'marco'
    ],
    limpieza: [
      'limpieza', 'limpiar', 'suciedad', 'mancha', 'desinfección', 'higiene',
      'aspiradora', 'fregona', 'detergente', 'jabón', 'desinfectante',
      'basura', 'residuos', 'papelera', 'contenedor'
    ],
    sonido: [
      'sonido', 'audio', 'altavoz', 'micrófono', 'amplificador', 'ecualizador',
      'música', 'ruido', 'volumen', 'acústica', 'megafonía', 'sistema de sonido',
      'auriculares', 'cascos', 'reproductor'
    ],
    luces: [
      'luz', 'iluminación', 'lámpara', 'bombilla', 'led', 'fluorescente',
      'halógeno', 'foco', 'reflector', 'proyector', 'dimmer', 'regulador',
      'luminaria', 'aplique', 'plafón', 'downlight', 'strip led'
    ]
  };
  
  // Analyze text for each skill type
  Object.entries(skillKeywords).forEach(([skill, keywords]) => {
    const matchCount = keywords.filter(keyword => text.includes(keyword)).length;
    
    // If we find 1 or more matching keywords, suggest the skill
    if (matchCount > 0) {
      suggestedSkills.push(skill);
    }
  });
  
  // Remove duplicates and return
  return [...new Set(suggestedSkills)];
};