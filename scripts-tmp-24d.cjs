const fs = require('fs')
const edit = (p, fn) => { let s = fs.readFileSync(p, 'utf8'); const o = s; s = fn(s); if (s === o) throw new Error('sin cambios: ' + p); fs.writeFileSync(p, s) }
const rep = (s, a, b) => { if (!s.includes(a)) throw new Error('no match: ' + a.slice(0, 80)); return s.replace(a, b) }
fs.rmSync('harness.html', { force: true })
fs.rmSync('src/harness.tsx', { force: true })
edit('package.json', (s) => rep(s, '"version": "2.4.0"', '"version": "2.5.0"'))
edit('CHANGELOG.md', (s) => rep(s, '## 2.4 · 2026-10-14', `## 2.5 · 2026-10-18
- Cardio: pregunta "¿Tienes partido pronto?" (sin partido / mañana / pasado mañana). Con partido mañana el tope es nivel suave; pasado mañana, hasta media.
- Pausa por molestia corregida: tras una molestia no se ofrece el nivel dura y la duración no sube de fase hasta registrar 2 sesiones seguidas sin molestia (en cualquier nivel). Antes el bloqueo no se levantaba solo.

## 2.4 · 2026-10-14`))
edit('README.md', (s) => rep(s, 'La duración crece por fases del ciclo.', 'La duración crece por fases del ciclo. Pregunta si hay partido pronto (limita el nivel) y, tras una molestia, pausa el nivel dura y el avance de fase hasta 2 sesiones seguidas sin molestia.'))
edit('supabase/schema.sql', (s) => s + "\nalter table public.cardio_logs add column if not exists match_soon text check (match_soon in ('no','manana','pasado'));\n")
