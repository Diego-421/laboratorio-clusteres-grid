import { useState } from 'react'
import { ESC, f } from './datos.js'

const S = (p, n) => 1 / (1 - p / 100 + p / 100 / n)

export default function Calculadora() {
  const [p, setP] = useState(93)
  const [n, setN] = useState(4)
  const W = 520, H = 300, L = 40, R = 20, T = 24, B = 48, pw = W - L - R, ph = H - T - B
  const X = k => L + (pw * (k - 1)) / 11, Y = v => T + ph - (ph * v) / 12
  const curva = Array.from({ length: 12 }, (_, k) => `${X(k + 1)},${Y(S(p, k + 1))}`).join(' ')
  const limite = p >= 100 ? 'sin límite' : f(1 / (1 - p / 100)) + '×'
  return (
    <div className="panel calc">
      <div>
        <label className="rng">Parte del trabajo que se puede paralelizar: <b>{p} %</b>
          <input type="range" min="50" max="100" value={p} onChange={e => setP(+e.target.value)} /></label>
        <label className="rng">Número de nodos: <b>{n}</b>
          <input type="range" min="1" max="12" value={n} onChange={e => setN(+e.target.value)} /></label>
        <div className="kv one"><div><b>{f(S(p, n))}×</b><span>Speedup teórico con {n} {n === 1 ? 'nodo' : 'nodos'}</span></div>
          <div><b>{limite}</b><span>Límite con infinitos nodos</span></div></div>
        <p className="note">Modelo teórico (ley de Amdahl), no una medición. Los 3,31× medidos con 4 nodos equivalen a una parte paralelizable de cerca del 93 %.</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curva teórica de speedup según el número de nodos">
        {[0, 3, 6, 9, 12].map(v => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#C9D3E3" /><text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="12" fill="#7A8699">{v}</text></g>)}
        {[1, 2, 4, 6, 8, 10, 12].map(k => <text key={k} x={X(k)} y={H - 28} textAnchor="middle" fontSize="12.5" fill="#44505F">{k}</text>)}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize="12.5" fill="#7A8699">Número de nodos</text>
        <line x1={X(1)} y1={Y(1)} x2={X(12)} y2={Y(12)} stroke="#7A8699" strokeWidth="2" strokeDasharray="6 5" />
        <polyline fill="none" stroke="#1F4E9C" strokeWidth="3.5" points={curva} />
        {ESC.slice(0, 3).map(e => <circle key={e.nodos} cx={X(e.nodos)} cy={Y(e.sp)} r="5.5" fill="#fff" stroke="#D9822B" strokeWidth="3"><title>{`Medido: ${f(e.sp)}× con ${e.nodos} nodos`}</title></circle>)}
        <circle cx={X(n)} cy={Y(S(p, n))} r="7" fill="#1F4E9C" />
        <text x={L} y="14" fontSize="13" fontWeight="600" fill="#0B2545">Teoría (línea azul) frente a lo medido (círculos naranja)</text>
      </svg>
    </div>
  )
}
