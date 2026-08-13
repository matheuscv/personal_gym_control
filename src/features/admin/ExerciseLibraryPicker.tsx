import { useMemo, useState } from 'react';
import {
  Search,
  Dumbbell,
  Flame,
  ArrowUp,
  ChevronsUp,
  Footprints,
  Target,
  Activity,
  Timer,
  Folder,
} from 'lucide-react';
import { EXERCISE_LIBRARY, type LibraryGroup } from './exerciseLibrary';
import './ExercisePicker.css';

const GROUP_ICONS: Record<string, typeof Dumbbell> = {
  Peito: Flame,
  Costas: ArrowUp,
  Ombros: ChevronsUp,
  Bíceps: Dumbbell,
  Tríceps: Dumbbell,
  Quadríceps: Footprints,
  'Posterior de coxa': Footprints,
  Glúteos: Target,
  Panturrilha: Footprints,
  Abdômen: Activity,
  Cardio: Timer,
};

interface ExerciseLibraryPickerProps {
  selectedNames: Set<string>;
  onSelect: (muscleGroup: string, name: string, targetSets: number, targetReps: string) => void;
  extraGroups?: LibraryGroup[];
}

export function ExerciseLibraryPicker({ selectedNames, onSelect, extraGroups }: ExerciseLibraryPickerProps) {
  const [search, setSearch] = useState('');

  const allGroups = useMemo(
    () => (extraGroups && extraGroups.length > 0 ? [...EXERCISE_LIBRARY, ...extraGroups] : EXERCISE_LIBRARY),
    [extraGroups]
  );

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allGroups;
    return allGroups
      .map((group) => ({
        ...group,
        exercises: group.exercises.filter((ex) => ex.name.toLowerCase().includes(term)),
      }))
      .filter((group) => group.exercises.length > 0);
  }, [allGroups, search]);

  return (
    <section className="library-panel">
      <div className="library-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Buscar exercício..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="library-groups">
        {filteredGroups.map((group) => {
          const Icon = GROUP_ICONS[group.muscle_group] ?? Folder;
          const selectedInGroup = group.exercises.filter((ex) => selectedNames.has(ex.name)).length;
          return (
            <details key={group.muscle_group} className="library-group" open={search.trim().length > 0}>
              <summary>
                <span className="library-group-icon">
                  <Icon size={16} />
                </span>
                <span className="library-group-name">{group.muscle_group}</span>
                {selectedInGroup > 0 && <span className="library-group-count">{selectedInGroup}</span>}
                <span className="library-group-total">{group.exercises.length}</span>
              </summary>
              <div className="exercise-chip-grid">
                {group.exercises.map((ex) => {
                  const isSelected = selectedNames.has(ex.name);
                  return (
                    <button
                      key={ex.name}
                      type="button"
                      className={`exercise-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelect(group.muscle_group, ex.name, ex.target_sets, ex.target_reps)}
                    >
                      {ex.name}
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
        {filteredGroups.length === 0 && (
          <p className="library-empty">Nenhum exercício encontrado para &quot;{search}&quot;.</p>
        )}
      </div>
    </section>
  );
}
