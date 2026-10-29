import { useState } from 'react'
import { ESC, HUELLA, REPO, f } from './datos.js'
import { Barras, Lineas, Eficiencia } from './Graficas.jsx'
import Laboratorio from './Laboratorio.jsx'
import Detalle from './Detalle.jsx'
import Calculadora from './Calculadora.jsx'
import Comparacion from './Comparacion.jsx'
import { useSimulacion } from './useSimulacion.jsx'

const ARCHIVOS = [
  ['laboratorio_distribuido.py', 'Código del laboratorio', 'blob/main/laboratorio_distribuido.py'],
  ['registro.txt', 'Registro completo de la ejecución', 'blob/main/registro.txt'],
  ['resultados.csv', 'Métricas por escenario', 'blob/main/resultados.csv'],
  ['corridas.csv', 'Tiempo de cada corrida', 'blob/main/corridas.csv'],
  ['Capturas/', 'Capturas de pantalla', 'tree/main/Capturas'],
]

const NUM = { 1: 'un', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 8: 'ocho' }
const nodosTxt = (n) => `${NUM[n] ?? n} nodos`
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function bajarCSV() {
  const filas = ESC.map(e => [`"${e.nom}"`, e.nodos, e.t, e.sp, e.ef].join(','))
  const blob = new Blob(['escenario,nodos,tiempo_s,speedup,eficiencia_pct\n' + filas.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'resultados_laboratorio.csv'; a.click()
}

export default function App() {
  const [copiado, setCopiado] = useState(false)
  const v = useSimulacion()   // números reales de la simulación en curso, en vivo
  const copiar = () => { navigator.clipboard.writeText(HUELLA); setCopiado(true); setTimeout(() => setCopiado(false), 1800) }
  return (
    <>
      <nav className="top">
        <div className="wrap">
          <b>Clústeres y Grid · Grupo 7</b>
          <div className="links">
            <a href="#simulacion">Simulación</a><a href="#resultados">Referencia</a><a href="#escenario">Escenarios</a>
            <a href="#amdahl">Amdahl</a><a href="#comparacion">Comparación</a><a href="#evidencias">Evidencias</a>
          </div>
        </div>
      </nav>
      <header>
        <div className="wrap">
          <h1>{v.b && v.m ? `De ${f(v.b.t)} s a ${f(v.m.t)} s con ${nodosTxt(v.m.nodos)}` : 'Resultados de la simulación en vivo'}</h1>
          <p>Procesamos {miles(v.archivos ?? 1000)} archivos con un coordinador que reparte el trabajo entre los nodos y lo comparamos con un solo equipo. También probamos qué pasa cuando un nodo se cae.</p>
          <span className="badge">Simulación en un solo computador: los nodos son procesos de Python, no una Grid real</span>
          {v.texto && <p style={{ margin: '14px 0 0', fontWeight: 600, opacity: 0.9 }}>{v.texto}</p>}
          <div className="kpis">
            <div><b>{v.b ? `${f(v.b.t)} s` : '—'}</b><span>con un solo equipo</span></div>
            <div><b>{v.m ? `${f(v.m.t)} s` : '—'}</b><span>{v.m ? `con ${nodosTxt(v.m.nodos)}` : 'con varios nodos'}</span></div>
            <div><b>{v.m ? `${f(v.m.sp)}×` : '—'}</b><span>speedup (ideal: {v.m ? `${v.m.nodos}×` : '—'})</span></div>
            <div><b>{v.m ? `${f(v.m.ef, 1)} %` : '—'}</b><span>eficiencia{v.m ? ` con ${v.m.nodos} nodos` : ''}</span></div>
            <div><b>{v.costo != null ? `${v.costo >= 0 ? '+' : '−'}${f(Math.abs(v.costo))} s` : '—'}</b><span>costo de perder un nodo</span></div>
          </div>
        </div>
      </header>
      <main className="wrap">
        <section id="simulacion">
          <h2>Ejecuta la simulación</h2>
          <p className="sub">Elige los parámetros, mira en vivo cómo el coordinador reparte el trabajo entre los nodos (incluida la caída del nodo 3) y revisa los resultados de tu ejecución.</p>
          <Laboratorio />
        </section>

<section id="resultados">
  <h2>Resultados de la ejecución en vivo</h2>
  <p className="sub">
    Los tiempos, el speedup y la eficiencia se actualizan con
    las corridas reales del laboratorio.
  </p>

  {v.resultados.length === 0 ? (
    <div className="panel">
      Todavía no hay resultados. Ejecuta el laboratorio para
      visualizar las métricas.
    </div>
  ) : (
    <div className="charts">
      <div className="panel">
        <Barras resultados={v.resultados} />
      </div>

      <div className="panel">
        <Lineas resultados={v.resultados} />
      </div>

      <div className="panel">
        <Eficiencia resultados={v.resultados} />
      </div>

      <div className="panel tw">
        <h3 className="mini">Resumen de la ejecución actual</h3>

        <table>
          <thead>
            <tr>
              <th>Escenario</th>
              <th>Tiempo</th>
              <th>Speedup</th>
              <th>Eficiencia</th>
              <th>Corridas</th>
            </tr>
          </thead>

          <tbody>
            {v.resultados.map(e => (
              <tr key={e.idx} className={e.fail ? 'fail' : ''}>
                <td><strong>{e.nom}</strong></td>
                <td>{f(e.t)} s</td>
                <td>{e.sp == null ? '—' : `${f(e.sp)}×`}</td>
                <td>{e.ef == null ? '—' : `${f(e.ef, 1)} %`}</td>
                <td>{e.r.map(t => `${f(t)} s`).join(' · ') || 'En espera'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )}
</section>

        <section id="escenario">
          <h2>Explora cada escenario</h2>
          <p className="sub">Elige un escenario para ver sus corridas y cómo se repartieron las tareas.</p>
          <Detalle />
        </section>
        <section id="amdahl">
          <h2>¿Por qué no llega a 4×?</h2>
          <p className="sub">Mueve los controles para ver cómo la parte que no se puede paralelizar limita la aceleración.</p>
          <Calculadora />
        </section>
        <section id="comparacion">
          <h2>Simulación, clúster y Grid</h2>
          <p className="sub">Elige una columna para resaltarla y compararla con las otras.</p>
          <Comparacion />
        </section>
        <section id="evidencias">
          <h2>Evidencias</h2>
          <p className="sub">Todo lo que respalda estos resultados está en el repositorio.</p>
          <div className="panel ev">
            <div className="acts">
              <button onClick={bajarCSV}>Descargar resultados (CSV)</button>
              <button className="ghost" onClick={copiar}>{copiado ? 'Huella copiada' : 'Copiar huella de verificación'}</button>
            </div>
            <p className="note">Huella <strong>{HUELLA}</strong> idéntica en los cuatro escenarios (1.000 de 1.000 archivos).</p>
            <ul className="files">
              {ARCHIVOS.map(([n, d, ruta]) => <li key={n}><a href={`${REPO}/${ruta}`} target="_blank" rel="noreferrer">{n}</a><span>{d}</span></li>)}
            </ul>
          </div>
        </section>
        <footer>Windows 11, 12 núcleos lógicos, Python 3.13.15. Universidad Tecnológica de Pereira · Sistemas Distribuidos.</footer>
      </main>
    </>
  )
}