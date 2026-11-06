// A decorative European roulette wheel; never used to encode model results.
const numbers = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const point = (r, angle) => [240 + r * Math.sin(angle), 240 - r * Math.cos(angle)];
export default function RouletteWheel() {
  const step = 2 * Math.PI / numbers.length;
  return <svg className="roulette-wheel" viewBox="0 0 480 480" aria-hidden="true">
    <circle cx="240" cy="240" r="237" fill="none" stroke="currentColor" opacity=".3" />
    <circle cx="240" cy="240" r="226" fill="#183c30" stroke="#bca877" strokeWidth="2" />
    <g className="wheel-sectors">
      {numbers.map((n, i) => {
        const a = i * step, b = (i + 1) * step;
        const p = point(215,a), q = point(215,b), r = point(160,b), s = point(160,a);
        const t = point(189,a+step/2);
        return <g key={n}>
          <path d={`M${p} A215 215 0 0 1 ${q} L${r} A160 160 0 0 0 ${s} Z`} fill={i===0?'#4b7855':i%2?'#973b35':'#152a23'} stroke="#c3b78e" strokeWidth=".65" />
          <text x={t[0]} y={t[1]} fill="#f1e9d6" fontSize="12" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(a+step/2)*180/Math.PI},${t[0]},${t[1]})`}>{n}</text>
          <path d={`M${point(157,a)} L${point(108,a)}`} stroke="#bca877" opacity=".35" />
        </g>;
      })}
    </g>
    <circle cx="240" cy="240" r="157" fill="none" stroke="#bca877" />
    <circle cx="240" cy="240" r="106" fill="#e8e0ca" />
    <circle cx="240" cy="240" r="97" fill="none" stroke="#183c30" opacity=".5" />
    <text x="240" y="205" textAnchor="middle" fill="#183c30" fontSize="9" letterSpacing="3">MONTE CARLO</text>
    <text x="240" y="278" textAnchor="middle" fill="#183c30" fontSize="90" fontFamily="Georgia, serif" fontStyle="italic">0</text>
    <text x="240" y="303" textAnchor="middle" fill="#183c30" fontSize="8" letterSpacing="2">POSSIBILITY / ∞</text>
    <circle cx="280" cy="102" r="7" fill="#fff6df" stroke="#bca877" strokeWidth="2" />
  </svg>;
}
