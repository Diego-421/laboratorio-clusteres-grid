import { useState } from 'react'
import { ESC, HUELLA, REPO, f } from './datos.js'
import { Barras, Lineas, Eficiencia } from './Graficas.jsx'
import Simulacion from './Simulacion.jsx'
import Detalle from './Detalle.jsx'
import Calculadora from './Calculadora.jsx'
import Comparacion from './Comparacion.jsx'

const ARCHIVOS = [
  ['laboratorio_distribuido.py', 'Código del laboratorio', 'blob/main/laboratorio_distribuido.py'],
  ['registro.txt', 'Registro completo de la ejecución', 'blob/main/registro.txt'],
  ['resultados.csv', 'Métricas por escenario', 'blob/main/resultados.csv'],
  ['corridas.csv', 'Tiempo de cada corrida', 'blob/main/corridas.csv'],
  ['Capturas/', 'Capturas de pantalla', 'tree/main/Capturas'],
]

function bajarCSV() {
  const filas = ESC.map(e => [`"${e.nom}"`, e.nodos, e.t, e.sp, e.ef].join(','))
  const blob = new Blob(['escenario,nodos,tiempo_s,speedup,eficiencia_pct\n' + filas.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'resultados_laboratorio.csv'; a.click()
}

export default function App() {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => { navigator.clipboard.writeText(HUELLA); setCopiado(true); setTimeout(() => setCopiado(false), 1800) }
  return (
    <>
      <nav className="top">
        <div className="wrap">
          <b>Clústeres y Grid · Grupo 7</b>
          <div className="links">
            <a href="#simulacion">Simulación</a><a href="#resultados">Resultados</a><a href="#escenario">Escenarios</a>
            <a href="#amdahl">Amdahl</a><a href="#comparacion">Comparación</a><a href="#evidencias">Evidencias</a>
          </div>
        </div>
      </nav>
      <header>
        <div className="wrap">
          <h1>De 7,40 s a 2,24 s con cuatro nodos</h1>
          <p>Procesamos 1.000 archivos con un coordinador que reparte el trabajo entre cuatro nodos y lo comparamos con un solo equipo. También probamos qué pasa cuando un nodo se cae.</p>
          <span className="badge">Simulación en un solo computador: los nodos son procesos de Python, no una Grid real</span>
          <div className="kpis">
            <div><b>7,40 s</b><span>con un solo equipo</span></div>
            <div><b>2,24 s</b><span>con cuatro nodos</span></div>
            <div><b>3,31×</b><span>speedup (ideal: 4×)</span></div>
            <div><b>82,7 %</b><span>eficiencia con 4 nodos</span></div>
            <div><b>+0,27 s</b><span>costo de perder un nodo</span></div>
          </div>
        </div>
      </header>
      <main className="wrap">
        <section id="simulacion">
          <h2>Mira cómo se reparte el trabajo</h2>
          <p className="sub">Inicia la animación, cambia la velocidad y activa la caída del nodo 3 para ver cómo el coordinador reasigna sus tareas.</p>
          <Simulacion />
        </section>
        <section id="resultados">
          <h2>Resultados medidos</h2>
          <p className="sub">Promedio de tres corridas por escenario. Pasa el cursor sobre una barra para ver sus corridas.</p>
          <div className="charts">
            <div className="panel"><Barras /></div>
            <div className="panel"><Lineas /></div>
            <div className="panel"><Eficiencia /></div>
            <div className="panel tw">
              <h3 className="mini">Resumen en tabla</h3>
              <table>
                <thead><tr><th>Escenario</th><th>Tiempo</th><th>Speedup</th></tr></thead>
                <tbody>{ESC.map(e => <tr key={e.nom} className={e.fail ? 'fail' : ''}><td><strong>{e.nom}</strong></td><td>{f(e.t)} s</td><td>{f(e.sp)}×</td></tr>)}</tbody>
              </table>
            </div>
          </div>
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
