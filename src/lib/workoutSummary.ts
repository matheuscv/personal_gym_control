import type { WorkoutMood } from '../features/workout/types';

export const MOOD_META: Record<WorkoutMood, { label: string; emoji: string }> = {
  exhausted: { label: 'Exausto', emoji: '😵' },
  tired: { label: 'Cansado', emoji: '😓' },
  good: { label: 'Bem', emoji: '🙂' },
  excellent: { label: 'Excelente', emoji: '🤩' },
};

export function formatWorkoutDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}
