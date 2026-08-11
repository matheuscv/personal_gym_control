import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createExercise, deleteExercise, fetchExercises } from './api';

export function ExercisesPage() {
  const queryClient = useQueryClient();
  const exercisesQuery = useQuery({ queryKey: ['admin-exercises'], queryFn: fetchExercises });

  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createExercise,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exercises'] });
      setName('');
      setMuscleGroup('');
      setNotes('');
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExercise,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-exercises'] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Informe o nome do exercício.');
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      muscle_group: muscleGroup.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="admin-section">
      <h2 className="section-title">Exercícios</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Grupo muscular (opcional)"
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
        />
        <input placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button type="submit" disabled={createMutation.isPending}>
          Adicionar
        </button>
      </form>
      {error && <p className="admin-error">{error}</p>}

      {exercisesQuery.isLoading && <p>Carregando...</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Grupo muscular</th>
            <th>Notas</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {exercisesQuery.data?.map((exercise) => (
            <tr key={exercise.id}>
              <td>{exercise.name}</td>
              <td>{exercise.muscle_group ?? '—'}</td>
              <td>{exercise.notes ?? '—'}</td>
              <td>
                <button type="button" onClick={() => deleteMutation.mutate(exercise.id)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
