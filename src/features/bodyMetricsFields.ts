export interface BodyMetricField {
  key: string;
  label: string;
  unit: string;
}

export const BODY_METRIC_FIELDS: BodyMetricField[] = [
  { key: 'peso_kg', label: 'Peso', unit: 'kg' },
  { key: 'imc', label: 'IMC', unit: '' },
  { key: 'gordura_corporal_pct', label: 'Gordura corporal', unit: '%' },
  { key: 'massa_muscular_kg', label: 'Massa muscular', unit: 'kg' },
  { key: 'massa_ossea_kg', label: 'Massa óssea', unit: 'kg' },
  { key: 'agua_corporal_pct', label: 'Água corporal', unit: '%' },
  { key: 'proteina_pct', label: 'Proteína', unit: '%' },
  { key: 'gordura_visceral', label: 'Gordura visceral', unit: '' },
  { key: 'tmb_kcal', label: 'TMB', unit: 'kcal' },
  { key: 'peso_livre_gordura_kg', label: 'Peso livre de gordura', unit: 'kg' },
  { key: 'gordura_subcutanea_pct', label: 'Gordura subcutânea', unit: '%' },
  { key: 'smi_kg_m2', label: 'SMI', unit: 'kg/m²' },
  { key: 'idade_corporal', label: 'Idade corporal', unit: 'anos' },
  { key: 'whr', label: 'WHR (cintura-quadril)', unit: '' },
  { key: 'peso_alvo_kg', label: 'Peso-alvo', unit: 'kg' },
  { key: 'peso_ideal_kg', label: 'Peso ideal', unit: 'kg' },
  { key: 'controle_peso_kg', label: 'Controle de peso', unit: 'kg' },
  { key: 'grau_obesidade_pct', label: 'Grau de obesidade', unit: '%' },
];
