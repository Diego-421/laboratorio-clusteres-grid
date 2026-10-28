import { useState } from 'react'
import { ESC, f } from './datos.js'

const PAL = ['#2E75D6', '#1F4E9C', '#1A9DB5', '#D9822B']
const sd = a => { const m = a.reduce((x, y) => x + y) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) }
const MAX = Math.max(...ESC.flatMap(x => x.r))

export default function Detalle() {
  const [i, setI] = useState(2)
  const e = ESC[i]
  return (
    <div className="panel">
      <div className="tabs" role="tablist">
        {ESC.map((x, k) => (
          <button key={x.nom} role="tab" aria-selected={k === i} className={k === i ? 'on' : ''} onClick={() => setI(k)}>{x.l[0]} {x.l[1]}</button>
        ))}
      </div>
      <div className="kv">
        <div><b>{f(e.t)} s</b><span>Tiempo promedio</span></div>
        <div><b>±{f(sd(e.r))} s</b><span>Variación entre corridas</span></div>
        <div><b>{f(e.sp)}×</b><span>Speedup</span></div>
        <div><b>{e.ef === 100 ? '100' : f(e.ef, 1)} %</b><span>Eficiencia</span></div>
      </div>
      <h3 className="mini">Las tres corridas</h3>
      {e.r.map((v, k) => (
        <div className="hbar" key={k}><span>Corrida {k + 1}</span><div><i style={{ width: (v / MAX) * 100 + '%', background: e.c }} /></div><b>{f(v)} s</b></div>
      ))}
      <h3 className="mini">Tareas completadas por nodo</h3>
      <div className="stack">
        {e.dist.map((n, k) => (
          <div key={k} style={{ flex: n, background: e.fail && k === 3 ? '#B3261E' : PAL[k] }} title={`${n} tareas`}>
            {e.nodos === 1 ? 'Equipo único' : 'Nodo ' + k} · {n.toLocaleString('es-CO')}
          </div>
        ))}
      </div>
      {e.fail && <p className="note">El nodo 3 se cayó tras 100 tareas; sus 150 pendientes se repartieron entre los nodos 0, 1 y 2.</p>}
    </div>
  )
}
