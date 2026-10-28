import { useState } from 'react'

const COLS = ['Simulación del laboratorio', 'Clúster real', 'Infraestructura Grid']
const FILAS = [
  ['Nodos', 'Procesos en un solo equipo', 'Varios servidores dedicados', 'Recursos de múltiples instituciones'],
  ['Ubicación', 'Una máquina', 'Un mismo sitio, red local rápida', 'Geográficamente dispersos, internet o redes de investigación'],
  ['Hardware', 'Idéntico, compartido', 'Homogéneo, similar', 'Heterogéneo'],
  ['Administración', 'Una persona', 'Un único dominio administrativo', 'Varios dominios independientes'],
  ['Coordinación', 'Coordinador propio del script', 'Planificador (p. ej. Slurm) o MPI', 'Middleware, planificador de recursos, catálogo de recursos'],
  ['Seguridad', 'No aplica', 'Control interno', 'Autenticación y autorización entre organizaciones'],
  ['Datos', 'Disco local compartido', 'Almacenamiento compartido o replicado', 'Transferencia y replicación entre sitios'],
  ['Tolerancia a fallos', 'Falla provocada; reasignación automática por el coordinador', 'Alta disponibilidad, balanceo de carga', 'Fallos más frecuentes e impredecibles; requiere reintentos y replanificación'],
]

export default function Comparacion() {
  const [sel, setSel] = useState(0)
  return (
    <div className="panel tw">
      <div className="tabs" role="tablist">
        {COLS.map((c, k) => <button key={c} role="tab" aria-selected={k === sel} className={k === sel ? 'on' : ''} onClick={() => setSel(k)}>{c}</button>)}
      </div>
      <table className="cmp">
        <thead><tr><th>Aspecto</th>{COLS.map((c, k) => <th key={c} className={k === sel ? 'sel' : 'dim'}>{c}</th>)}</tr></thead>
        <tbody>
          {FILAS.map(r => (
            <tr key={r[0]}><td><strong>{r[0]}</strong></td>{r.slice(1).map((v, k) => <td key={k} className={k === sel ? 'sel' : 'dim'}>{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
