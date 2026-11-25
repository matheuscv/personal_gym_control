import { useState } from 'react';
import { MOOD_META } from '../../lib/workoutSummary';
import type { WorkoutMood, WorkoutSummaryInput } from './types';
import './WorkoutSummaryModal.css';

const MOOD_OPTIONS = (Object.entries(MOOD_META) as [WorkoutMood, { label: string; emoji: string }][]).map(
  ([value, meta]) => ({ value, ...meta })
);

interface WorkoutSummaryModalProps {
  onCancel: () => void;
  onSave: (summary: WorkoutSummaryInput) => void;
}

// "HH:MM:SS" (ou "HH:MM", se o navegador não der os segundos do <input
// type="time" step="1">) -> minutos totais, arredondado. duration_minutes
// no banco continua só em minutos — granularidade de segundo na digitação
// não é relevante pra análise de tendência de duração do treino.
function parseDurationToMinutes(value: string): number | null {
  if (!value) return null;
  const [h, m, s] = value.split(':').map((part) => Number(part) || 0);
  return Math.round((h * 3600 + m * 60 + s) / 60);
}

export function WorkoutSummaryModal({ onCancel, onSave }: WorkoutSummaryModalProps) {
  const [skip, setSkip] = useState(false);
  const [durationTime, setDurationTime] = useState('');
  const [calories, setCalories] = useState('');
  const [heartRateAvg, setHeartRateAvg] = useState('');
  const [heartRateMax, setHeartRateMax] = useState('');
  const [mood, setMood] = useState<WorkoutMood | null>(null);

  const hasAnyValue =
    durationTime !== '' || calories !== '' || heartRateAvg !== '' || heartRateMax !== '' || mood != null;
  const canSave = skip || hasAnyValue;

  function handleSkipToggle(checked: boolean) {
    setSkip(checked);
    if (checked) {
      setDurationTime('');
      setCalories('');
      setHeartRateAvg('');
      setHeartRateMax('');
      setMood(null);
    }
  }

  function handleSave() {
    if (!canSave) return;
    onSave({
      duration_minutes: skip ? null : parseDurationToMinutes(durationTime),
      calories: skip || calories === '' ? null : Number(calories),
      heart_rate_avg: skip || heartRateAvg === '' ? null : Number(heartRateAvg),
      heart_rate_max: skip || heartRateMax === '' ? null : Number(heartRateMax),
      mood: skip ? null : mood,
    });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Resumo do treino de hoje">
      <div className="modal-box workout-summary-modal">
        <h2>Resumo do treino de hoje</h2>
        <p className="workout-summary-hint">Esses dados são opcionais e valem só pra hoje.</p>

        <label className="summary-field">
          <span>Duração total (hh:mm:ss)</span>
          <input
            type="time"
            step={1}
            value={durationTime}
            disabled={skip}
            onChange={(e) => setDurationTime(e.target.value)}
          />
        </label>

        <label className="summary-field">
          <span>Total de calorias (kcal)</span>
          <input type="number" min={0} value={calories} disabled={skip} onChange={(e) => setCalories(e.target.value)} />
        </label>

        <label className="summary-field">
          <span>Frequência cardíaca média (bpm)</span>
          <input
            type="number"
            min={0}
            value={heartRateAvg}
            disabled={skip}
            onChange={(e) => setHeartRateAvg(e.target.value)}
          />
        </label>

        <label className="summary-field">
          <span>Frequência cardíaca máxima (bpm)</span>
          <input
            type="number"
            min={0}
            value={heartRateMax}
            disabled={skip}
            onChange={(e) => setHeartRateMax(e.target.value)}
          />
        </label>

        <div className="summary-mood">
          <span>Como você se sente ao final do treino de hoje?</span>
          <div className="summary-mood-options">
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={skip}
                className={`summary-mood-btn ${mood === opt.value ? 'selected' : ''}`}
                onClick={() => setMood(opt.value)}
              >
                <span className="summary-mood-emoji">{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className="summary-skip">
          <input type="checkbox" checked={skip} onChange={(e) => handleSkipToggle(e.target.checked)} />
          Não informar
        </label>

        <div className="summary-actions">
          <button type="button" className="summary-btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="summary-btn-primary" disabled={!canSave} onClick={handleSave}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
