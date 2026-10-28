import { ESC as E, f } from './datos.js'

export function Barras() {
  const W = 520, H = 310, L = 40, T = 26, B = 58, max = 8, ch = H - T - B, bw = 84, gap = (W - L - 4 * bw) / 5
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={'Tiempo por escenario: ' + E.map(e => `${e.nom} ${f(e.t)} s`).join('; ')}>
      {[0, 2, 4, 6, 8].map(v => {
        const y = T + ch - (ch * v) / max
        return (
          <g key={v}>
            <line x1={L} x2={W} y1={y} y2={y} stroke="#C9D3E3" />
            <text x={L - 8} y={y + 4} textAnchor="end" fontSize="12" fill="#7A8699">{v}</text>
          </g>
        )
      })}
      {E.map((e, i) => {
        const x = L + gap * (i + 1) + bw * i, h = (ch * e.t) / max, y = T + ch - h, cx = x + bw / 2
        return (
          <g key={e.nom}>
            <title>{'Corridas: ' + e.r.map(v => f(v)).join(' · ') + ' s'}</title>
            <rect className="grow" style={{ animationDelay: `${i * 130}ms` }} x={x} y={y} width={bw} height={h} rx="6" fill={e.c} />
            <text x={cx} y={y - 8} textAnchor="middle" fontWeight="700" fontSize="15" fill="#0B2545">{f(e.t)} s</text>
            <text x={cx} y={y + h / 2 + 5} textAnchor="middle" fontWeight="700" fontSize="15" fill="#fff">{f(e.sp)}×</text>
            <text x={cx} y={H - 34} textAnchor="middle" fontSize="12.5" fill="#44505F">{e.l[0]}</text>
            <text x={cx} y={H - 18} textAnchor="middle" fontSize="12.5" fill="#7A8699">{e.l[1]}</text>
          </g>
        )
      })}
      <text x={L} y="14" fontSize="13" fontWeight="600" fill="#0B2545">Tiempo de procesamiento (s)</text>
    </svg>
  )
}

export function Lineas() {
  const W = 520, H = 310, L = 40, R = 26, T = 26, B = 58, pw = W - L - R, ph = H - T - B
  const X = n => L + (pw * (n - 1)) / 3, Y = v => T + ph - (ph * v) / 4.2
  const m = E.slice(0, 3), fl = E[3]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Speedup medido: ${m.map(e => `${e.nodos} nodos ${f(e.sp)}`).join('; ')}; con falla ${f(fl.sp)}; ideal 4`}>
      {[0, 1, 2, 3, 4].map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#C9D3E3" />
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="12" fill="#7A8699">{v}</text>
        </g>
      ))}
      {[1, 2, 3, 4].map(n => <text key={n} x={X(n)} y={H - 30} textAnchor="middle" fontSize="12.5" fill="#44505F">{n}</text>)}
      <text x={(L + W - R) / 2} y={H - 10} textAnchor="middle" fontSize="12.5" fill="#7A8699">Número de nodos</text>
      <line x1={X(1)} y1={Y(1)} x2={X(4)} y2={Y(4)} stroke="#7A8699" strokeWidth="2" strokeDasharray="6 5" />
      <text x={X(4) - 8} y={Y(4) - 9} textAnchor="end" fontSize="12.5" fill="#7A8699">Ideal (4×)</text>
      <polyline fill="none" stroke="#1F4E9C" strokeWidth="3.5" points={m.map(e => `${X(e.nodos)},${Y(e.sp)}`).join(' ')} />
      {m.map((e, i) => (
        <g key={e.nodos}>
          <circle cx={X(e.nodos)} cy={Y(e.sp)} r="6" fill="#1F4E9C" />
          {i > 0 && <text x={X(e.nodos) - 10} y={Y(e.sp) - 12} textAnchor="end" fontSize="13.5" fontWeight="700" fill="#1F4E9C">{f(e.sp)}×</text>}
        </g>
      ))}
      <circle cx={X(4)} cy={Y(fl.sp)} r="7" fill="#D9822B" />
      <text x={X(4) - 12} y={Y(fl.sp) + 18} textAnchor="end" fontSize="13.5" fontWeight="700" fill="#B5651A">{f(fl.sp)}× con falla</text>
      <text x={L} y="14" fontSize="13" fontWeight="600" fill="#0B2545">Aceleración (speedup) frente al ideal</text>
    </svg>
  )
}

export function Eficiencia() {
  return (
    <div>
      <h3 className="mini">Eficiencia por escenario</h3>
      {E.map(e => (
        <div className="hbar" key={e.nom}>
          <span>{e.l[0]} {e.l[1]}</span>
          <div><i style={{ width: e.ef + '%', background: e.c }} /></div>
          <b>{e.ef === 100 ? '100' : f(e.ef, 1)} %</b>
        </div>
      ))}
      <p className="note">Eficiencia = speedup / número de nodos. Cae al sumar nodos porque comparten un mismo computador.</p>
    </div>
  )
}
