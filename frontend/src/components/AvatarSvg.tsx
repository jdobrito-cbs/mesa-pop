import { paramsFromId, type AvatarParams } from '@mesapop/shared'

/** traços de cabeça por espécie (orelhas/antenas/tufos) */
function Orelhas({ p }: { p: AvatarParams }) {
  switch (p.especie) {
    case 'gato':
    case 'raposa':
      return (
        <g fill={p.corBase} stroke={p.corSec} strokeWidth={2}>
          <path d="M28 34 L22 14 L42 28 Z" />
          <path d="M72 34 L78 14 L58 28 Z" />
        </g>
      )
    case 'coruja':
      return (
        <g fill={p.corSec}>
          <circle cx={34} cy={30} r={4} />
          <circle cx={66} cy={30} r={4} />
        </g>
      )
    case 'alien':
    case 'robo':
      return (
        <g stroke={p.corSec} strokeWidth={3}>
          <line x1={34} y1={26} x2={30} y2={12} />
          <circle cx={30} cy={10} r={4} fill={p.corSec} stroke="none" />
          <line x1={66} y1={26} x2={70} y2={12} />
          <circle cx={70} cy={10} r={4} fill={p.corSec} stroke="none" />
        </g>
      )
    case 'panda':
    case 'urso':
      return (
        <g fill={p.corSec}>
          <circle cx={30} cy={26} r={9} />
          <circle cx={70} cy={26} r={9} />
        </g>
      )
    default:
      return null
  }
}

function Olhos({ p }: { p: AvatarParams }) {
  const y = 52
  if (p.olhos === 0)
    return (
      <g fill="#101728">
        <circle cx={40} cy={y} r={6} />
        <circle cx={60} cy={y} r={6} />
      </g>
    )
  if (p.olhos === 1)
    return (
      <g fill="#101728">
        <circle cx={40} cy={y} r={7} />
        <circle cx={60} cy={y} r={7} />
        <circle cx={42} cy={y - 2} r={2} fill="#fff" />
        <circle cx={62} cy={y - 2} r={2} fill="#fff" />
      </g>
    )
  if (p.olhos === 2)
    return (
      <g stroke="#101728" strokeWidth={3} fill="none" strokeLinecap="round">
        <path d={`M34 ${y} q6 -8 12 0`} />
        <path d={`M54 ${y} q6 -8 12 0`} />
      </g>
    )
  return (
    <g fill="#101728">
      <rect x={35} y={y - 5} width={10} height={10} rx={2} />
      <rect x={55} y={y - 5} width={10} height={10} rx={2} />
    </g>
  )
}

function Boca({ p }: { p: AvatarParams }) {
  const y = 68
  if (p.boca === 0) return <path d={`M42 ${y} q8 8 16 0`} stroke="#101728" strokeWidth={3} fill="none" strokeLinecap="round" />
  if (p.boca === 1) return <circle cx={50} cy={y} r={4} fill="#101728" />
  if (p.boca === 2) return <path d={`M42 ${y + 2} q8 -8 16 0`} stroke="#101728" strokeWidth={3} fill="none" strokeLinecap="round" />
  return <rect x={44} y={y - 2} width={12} height={5} rx={2} fill="#101728" />
}

/** acessórios dos tiers especial/super (chapéu, óculos, coroa…) */
function Acessorio({ p }: { p: AvatarParams }) {
  if (p.acessorio <= 0) return null
  switch (p.acessorio) {
    case 1:
      return <path d="M28 30 h44 l-6 -12 h-32 Z" fill={p.corSec} stroke="#0008" strokeWidth={1.5} />
    case 2:
      return (
        <g stroke="#101728" strokeWidth={3} fill="#ffffff55">
          <circle cx={40} cy={52} r={9} />
          <circle cx={60} cy={52} r={9} />
          <line x1={49} y1={52} x2={51} y2={52} />
        </g>
      )
    case 3:
      return <path d="M32 24 l6 10 l12 -8 l12 8 l6 -10 v10 h-36 Z" fill="#facc15" stroke="#0006" strokeWidth={1.5} />
    case 4:
      return <text x={72} y={28} fontSize={18}>✨</text>
    case 5:
      return <text x={70} y={30} fontSize={18}>⭐</text>
    default:
      return <text x={70} y={30} fontSize={18}>🎩</text>
  }
}

/** avatar procedural do Mesa Pop — desenha a partir do id (determinístico) */
export default function AvatarSvg({ id, size = 40 }: { id: string | null | undefined; size?: number }) {
  const p = paramsFromId(id || 'n0')
  const anim = p.moldura > 0 // super: moldura girando
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="avatar" className="shrink-0">
      {p.moldura > 0 && (
        <circle
          cx={50}
          cy={50}
          r={49}
          fill="none"
          stroke={p.corSec}
          strokeWidth={3}
          strokeDasharray="10 6"
          className={anim ? 'animate-[spin_8s_linear_infinite]' : ''}
          style={{ transformOrigin: '50% 50%' }}
        />
      )}
      <circle cx={50} cy={50} r={44} fill={p.fundo} />
      <Orelhas p={p} />
      <circle cx={50} cy={54} r={30} fill={p.corBase} stroke={p.corSec} strokeWidth={2} />
      <Olhos p={p} />
      <Boca p={p} />
      <Acessorio p={p} />
    </svg>
  )
}
