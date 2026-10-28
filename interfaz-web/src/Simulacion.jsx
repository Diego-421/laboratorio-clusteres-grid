import { useEffect, useRef, useState } from 'react'

const inicial = () => [0, 1, 2, 3].map(() => ({ done: 0, total: 250, alive: true }))

export default function Simulacion() {
  const [falla, setFalla] = useState(false)
  const [nodos, setNodos] = useState(inicial)
  const [log, setLog] = useState([])
  const [estado, setEstado] = useState('Listo para repartir 1.000 tareas entre 4 nodos.')
  const timer = useRef(null)
  const vel = useRef(1)
  useEffect(() => () => clearInterval(timer.current), [])

  function iniciar() {
    clearInterval(timer.current)
    const N = inicial(), L = []
    let tick = 0, caidaEn = null, detectada = false
    const add = (m, c = '') => { L.push({ m, c }); setLog([...L]) }
    setLog([]); setNodos(N.map(n => ({ ...n })))
    setEstado('Repartiendo 1.000 tareas en forma circular: 250 por nodo.')
    add('El coordinador reparte las tareas: 250 para cada nodo.')
    timer.current = setInterval(() => {
      tick++
      N.forEach(n => { if (n.alive && n.done < n.total) n.done = Math.min(n.total, n.done + 1.4 * vel.current) })
      if (falla && N[3].alive && N[3].done >= 100) {
        N[3].alive = false; N[3].done = 100; caidaEn = tick
        add('El nodo 3 se cae tras completar 100 tareas.', 'bad')
        setEstado('Nodo 3 caído: el coordinador lo está detectando…')
      }
      if (caidaEn && !detectada && tick - caidaEn >= 14) {
        detectada = true; [0, 1, 2].forEach(i => { N[i].total += 50 })
        add('El coordinador reasigna las 150 tareas pendientes: 50 para cada uno de los nodos 0, 1 y 2.')
        setEstado('Reasignando 150 tareas a los nodos que siguen activos.')
      }
      setNodos(N.map(n => ({ ...n })))
      if (N.every(n => !n.alive || n.done >= n.total) && (!falla || detectada)) {
        clearInterval(timer.current)
        const r = N.map(n => Math.round(n.done))
        setEstado('Terminado: 1.000 de 1.000 tareas completadas.')
        add(`Resultado: ${r.join(' / ')} tareas por nodo. Se recuperaron los 1.000 resultados.`, 'ok')
      }
    }, 40)
  }

  return (
    <div className="panel">
      <div className="coord"><strong>Coordinador</strong><span>{estado}</span></div>
      <div className="nodes">
        {nodos.map((n, i) => {
          const plan = n.alive ? n.total : 250
          const completo = n.alive && n.done >= n.total
          return (
            <div key={i} className={'node' + (!n.alive ? ' down' : completo ? ' done' : '')}>
              <h3>Nodo {i}<span className="chip">{!n.alive ? 'Caído' : completo ? 'Completo' : n.done > 0 ? 'Procesando' : 'En espera'}</span></h3>
              <div className="track"><div className="fill" style={{ width: Math.min(100, (n.done / plan) * 100) + '%' }} /></div>
              <div className="cnt">{Math.floor(n.done)} / {plan} tareas</div>
            </div>
          )
        })}
      </div>
      <div className="controls">
        <button onClick={iniciar}>Iniciar simulación</button>
        <label><input type="checkbox" checked={falla} onChange={e => setFalla(e.target.checked)} /> Simular la caída del nodo 3</label>
        <label>Velocidad <select defaultValue="1" onChange={e => { vel.current = +e.target.value }}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
      </div>
      <div id="log" aria-live="polite">{log.map((x, i) => <div key={i} className={x.c}>{x.m}</div>)}</div>
      <p className="note">Animación ilustrativa del comportamiento. Los tiempos reales medidos están en las gráficas y en la tabla.</p>
    </div>
  )
}
