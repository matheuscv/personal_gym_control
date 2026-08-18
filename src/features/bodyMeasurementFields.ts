export type MeasurementGroup = 'Tronco' | 'Membros superiores' | 'Membros inferiores';

export interface BodyMeasurementField {
  key: string;
  label: string;
  group: MeasurementGroup;
  optional?: boolean;
}

export const MEASUREMENT_GROUPS: MeasurementGroup[] = ['Tronco', 'Membros superiores', 'Membros inferiores'];

export const BODY_MEASUREMENT_FIELDS: BodyMeasurementField[] = [
  { key: 'peito_torax_cm', label: 'Peito/Tórax', group: 'Tronco' },
  { key: 'cintura_cm', label: 'Cintura', group: 'Tronco' },
  { key: 'abdomen_quadril_cm', label: 'Abdômen/Quadril', group: 'Tronco' },
  { key: 'biceps_direito_cm', label: 'Bíceps direito', group: 'Membros superiores' },
  { key: 'biceps_esquerdo_cm', label: 'Bíceps esquerdo', group: 'Membros superiores' },
  { key: 'antebraco_direito_cm', label: 'Antebraço direito', group: 'Membros superiores' },
  { key: 'antebraco_esquerdo_cm', label: 'Antebraço esquerdo', group: 'Membros superiores' },
  { key: 'coxa_direita_cm', label: 'Coxa direita', group: 'Membros inferiores' },
  { key: 'coxa_esquerda_cm', label: 'Coxa esquerda', group: 'Membros inferiores' },
  { key: 'panturrilha_direita_cm', label: 'Panturrilha direita', group: 'Membros inferiores' },
  { key: 'panturrilha_esquerda_cm', label: 'Panturrilha esquerda', group: 'Membros inferiores' },
];
