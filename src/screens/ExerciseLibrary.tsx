import { useMemo, useState } from 'react'
import { useData } from '../store'
import { GUIDES, VIDEOS, videoSearchUrl } from '../data/guides'
import type { Exercise } from '../types'

export default function ExerciseLibrary() {
  const { exercises } = useData()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('Todos')
  const [equipment, setEquipment] = useState('Todos')
  const [availableOnly, setAvailableOnly] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const muscles = useMemo(() => ['Todos', ...new Set(exercises.map((e) => e.muscle_primary).filter(Boolean).sort())], [exercises])
  const equipmentTypes = useMemo(() => ['Todos', ...new Set(exercises.map((e) => e.equipment || 'Sin equipo especificado').sort())], [exercises])
  const filtered = useMemo(() => exercises.filter((e) => {
    const text = `${e.name} ${e.muscle_primary} ${e.muscles_secondary.join(' ')} ${e.equipment ?? ''}`.toLocaleLowerCase('es')
    return text.includes(query.toLocaleLowerCase('es')) && (muscle === 'Todos' || e.muscle_primary === muscle || e.muscles_secondary.includes(muscle)) && (equipment === 'Todos' || (e.equipment || 'Sin equipo especificado') === equipment) && (!availableOnly || e.available)
  }), [exercises, query, muscle, equipment, availableOnly])

  return <div className="screen">
    <h2>Biblioteca de ejercicios</h2>
    <p className="muted">Busca por ejercicio, músculo o equipo de tu gimnasio. Abre una ficha para ver la técnica.</p>
    <section className="card exercise-library-filters">
      <input aria-label="Buscar ejercicio" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ejercicio, músculo o equipo…" />
      <div className="exercise-library-filter-row">
        <label>Músculo<select value={muscle} onChange={(e) => setMuscle(e.target.value)}>{muscles.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>Equipo<select value={equipment} onChange={(e) => setEquipment(e.target.value)}>{equipmentTypes.map((e) => <option key={e}>{e}</option>)}</select></label>
      </div>
      <label className="exercise-library-toggle"><input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} /> Solo equipo disponible en DarkoGym</label>
    </section>
    <p className="muted">{filtered.length} ejercicios</p>
    {filtered.map((ex) => <LibraryCard key={ex.id} ex={ex} expanded={open === ex.id} onToggle={() => setOpen(open === ex.id ? null : ex.id)} />)}
    {filtered.length === 0 && <section className="card"><p>No hay ejercicios que coincidan con esos filtros.</p><button className="link" onClick={() => { setQuery(''); setMuscle('Todos'); setEquipment('Todos') }}>Limpiar filtros</button></section>}
  </div>
}

function LibraryCard({ ex, expanded, onToggle }: { ex: Exercise; expanded: boolean; onToggle: () => void }) {
  const guide = GUIDES[ex.name]
  const video = VIDEOS[ex.name]
  const hasDemo = ex.name === 'Jalón al pecho'
  return <section className="card exercise-library-card">
    <button className="exercise-library-heading" aria-expanded={expanded} onClick={onToggle}>
      <span><strong>{ex.name}</strong><small>{ex.muscle_primary}{ex.equipment ? ` · ${ex.equipment}` : ''}</small></span>
      <span className="count">{expanded ? '−' : '+'}</span>
    </button>
    {expanded && <div className="exercise-library-detail">
      {!ex.available && <p className="warn-text">Marcado como no disponible en tu gimnasio.</p>}
      {!!ex.muscles_secondary.length && <p><strong>También trabaja:</strong> {ex.muscles_secondary.join(', ')}</p>}
      {hasDemo && <div className="exercise-library-animation"><span className="eyebrow">GUÍA ANIMADA INTERACTIVA</span><iframe title={`Animación: ${ex.name}`} src={`${import.meta.env.BASE_URL}demos/jalon-al-pecho/?embedded=1`} loading="lazy" /></div>}
      {guide ? <>
        <h4>Preparación</h4><p>{guide.setup}</p>
        <h4>Cómo hacerlo</h4><ol>{guide.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
        <h4>Evita</h4><ul>{guide.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
      </> : <p className="muted">Aún no hay una guía técnica escrita para este ejercicio.</p>}
      {video ? <details><summary>Ver referencia en video</summary><div className="exercise-library-video"><iframe title={`Video: ${ex.name}`} src={`https://www.youtube-nocookie.com/embed/${video}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></details> : <a className="link" href={videoSearchUrl(ex.name, guide?.query)} target="_blank" rel="noreferrer">Buscar demostración en YouTube ↗</a>}
    </div>}
  </section>
}
