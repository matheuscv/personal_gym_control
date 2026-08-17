export interface LibraryExercise {
  name: string;
  target_sets: number;
  target_reps: string;
}

export interface LibraryGroup {
  muscle_group: string;
  exercises: LibraryExercise[];
}

const s3 = (reps: string): [number, string] => [3, reps];

function group(muscle_group: string, entries: [string, number, string][]): LibraryGroup {
  return {
    muscle_group,
    exercises: entries.map(([name, target_sets, target_reps]) => ({ name, target_sets, target_reps })),
  };
}

export const EXERCISE_LIBRARY: LibraryGroup[] = [
  group('Peito', [
    ['Supino reto com barra', ...s3('8-12')],
    ['Supino reto com halteres', ...s3('12-15')],
    ['Supino inclinado com barra', ...s3('8-12')],
    ['Supino inclinado com halteres', ...s3('12-15')],
    ['Supino declinado com barra', ...s3('8-12')],
    ['Crucifixo reto com halteres', ...s3('10-15')],
    ['Crucifixo inclinado com halteres', ...s3('10-15')],
    ['Crossover na polia', ...s3('12-15')],
    ['Peck deck (voador)', ...s3('12-15')],
    ['Supino máquina', ...s3('12-15')],
    ['Flexão de braço', ...s3('12-20')],
    ['Flexão de braço com pés elevados', ...s3('10-15')],
    ['Pullover com halteres', ...s3('12-15')],
  ]),
  group('Costas', [
    ['Puxada na polia alta (pulldown)', ...s3('12-15')],
    ['Puxada na polia alta pegada supinada', ...s3('12-15')],
    ['Barra fixa (pull-up)', ...s3('6-10')],
    ['Remada curvada com barra', ...s3('8-12')],
    ['Remada curvada com halteres', ...s3('12-15')],
    ['Remada unilateral com halter (serrote)', ...s3('12-15')],
    ['Remada baixa na polia (cabo)', ...s3('12-15')],
    ['Remada cavalinho (T-bar)', ...s3('8-12')],
    ['Remada máquina articulada', ...s3('12-15')],
    ['Pulldown com corda (pull-down straight arm)', ...s3('12-15')],
    ['Levantamento terra', ...s3('6-10')],
    ['Hiperextensão lombar (banco romano)', ...s3('12-15')],
    ['Encolhimento de ombros com halteres', ...s3('12-15')],
  ]),
  group('Ombros', [
    ['Desenvolvimento militar com barra', ...s3('8-12')],
    ['Desenvolvimento de ombro com halteres', ...s3('12-15')],
    ['Desenvolvimento máquina (press)', ...s3('12-15')],
    ['Elevação lateral com halteres', ...s3('12-15')],
    ['Elevação lateral na polia', ...s3('12-15')],
    ['Elevação frontal com halteres', ...s3('12-15')],
    ['Crucifixo inverso (posterior de ombro)', ...s3('12-15')],
    ['Crucifixo inverso na máquina (peck deck invertido)', ...s3('12-15')],
    ['Remada alta com barra', ...s3('12-15')],
    ['Face pull na polia', ...s3('12-15')],
    ['Arnold press com halteres', ...s3('12-15')],
  ]),
  group('Bíceps', [
    ['Rosca direta com barra', ...s3('8-12')],
    ['Rosca direta com barra W', ...s3('8-12')],
    ['Rosca alternada com halteres', ...s3('12-15')],
    ['Rosca martelo com halteres', ...s3('12-15')],
    ['Rosca concentrada com halter', ...s3('12-15')],
    ['Rosca scott (banco Scott)', ...s3('12-15')],
    ['Rosca na polia baixa', ...s3('12-15')],
    ['Rosca 21 com barra', ...s3('7-7-7')],
  ]),
  group('Tríceps', [
    ['Tríceps na polia (pushdown)', ...s3('12-15')],
    ['Tríceps na polia com corda', ...s3('12-15')],
    ['Tríceps testa com barra', ...s3('12-15')],
    ['Tríceps testa com halteres', ...s3('12-15')],
    ['Tríceps francês com halter (unilateral)', ...s3('12-15')],
    ['Mergulho no banco (bench dips)', ...s3('12-15')],
    ['Mergulho em paralelas', ...s3('8-12')],
    ['Supino fechado (pegada fechada)', ...s3('8-12')],
    ['Coice de tríceps com halter', ...s3('12-15')],
  ]),
  group('Quadríceps', [
    ['Agachamento livre com barra', ...s3('8-12')],
    ['Agachamento com halteres (goblet squat)', ...s3('12-15')],
    ['Leg press 45°', ...s3('10-15')],
    ['Cadeira extensora', ...s3('12-15')],
    ['Agachamento hack (hack squat)', ...s3('12-15')],
    ['Agachamento smith (máquina Smith)', ...s3('12-15')],
    ['Afundo/passada com halteres', 3, '10 (cada perna)'],
    ['Agachamento búlgaro (unilateral)', 3, '10 (cada perna)'],
    ['Passada com barra', 3, '10 (cada perna)'],
    ['Agachamento sumô com halter', ...s3('12-15')],
  ]),
  group('Posterior de coxa', [
    ['Stiff / levantamento romeno com barra', ...s3('12-15')],
    ['Stiff / levantamento romeno com halteres', ...s3('12-15')],
    ['Mesa flexora (cadeira flexora deitada)', ...s3('12-15')],
    ['Cadeira flexora sentada', ...s3('12-15')],
    ['Flexora em pé (unilateral)', 3, '12-15 (cada perna)'],
    ['Levantamento terra romeno unilateral', 3, '10 (cada perna)'],
    ['Good morning com barra', ...s3('12-15')],
  ]),
  group('Glúteos', [
    ['Elevação de quadril (hip thrust)', ...s3('12-15')],
    ['Hip thrust com barra', ...s3('12-15')],
    ['Elevação pélvica no solo (glute bridge)', ...s3('15-20')],
    ['Coice de glúteo na polia', 3, '12-15 (cada perna)'],
    ['Coice de glúteo na máquina', 3, '12-15 (cada perna)'],
    ['Abdução de quadril na máquina', ...s3('15-20')],
    ['Abdução de quadril na polia', 3, '15-20 (cada perna)'],
  ]),
  group('Panturrilha', [
    ['Panturrilha em pé na máquina', ...s3('15-20')],
    ['Panturrilha sentado na máquina', ...s3('15-20')],
    ['Panturrilha no leg press', ...s3('15-20')],
    ['Panturrilha unilateral com halter', 3, '15-20 (cada perna)'],
  ]),
  group('Abdômen', [
    ['Prancha abdominal', 3, '30-40s'],
    ['Prancha lateral', 3, '20-30s (cada lado)'],
    ['Abdominal supra (crunch)', ...s3('15-20')],
    ['Abdominal infra (elevação de pernas)', ...s3('12-15')],
    ['Abdominal na polia alta (crunch cabo)', ...s3('15-20')],
    ['Abdominal oblíquo (bicicleta)', ...s3('15-20')],
    ['Elevação de pernas na barra fixa', ...s3('10-15')],
    ['Rotação de tronco na polia (russian twist cabo)', ...s3('12-15')],
    ['Ab wheel (roda abdominal)', ...s3('8-12')],
  ]),
  group('Cardio', [
    ['Esteira (caminhada/corrida)', 1, '20 min'],
    ['Bicicleta ergométrica', 1, '20 min'],
    ['Elíptico', 1, '20 min'],
    ['Escada (stairmaster)', 1, '15 min'],
    ['Remo ergométrico', 1, '15 min'],
    ['Pular corda', 3, '2 min'],
    ['HIIT em bike (intervalado)', 1, '15 min'],
  ]),
];
