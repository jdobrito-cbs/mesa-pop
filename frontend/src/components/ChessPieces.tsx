import type { ChessColor, PieceType } from '@mesapop/shared'

/**
 * Peças de xadrez como PERSONAGENS (SVG procedural, estilo Mesa Pop):
 * peão = soldadinho com lança, cavalo = cavaleiro montado, bispo com
 * cajado, torre de pedra com carinha, rainha e rei coroados.
 * Desenhadas em viewBox 64×64, ancoradas no chão (y=58).
 */

interface Palette {
  body: string
  shade: string
  line: string
  face: string
  accent: string
}

const TEAMS: Record<ChessColor, Palette> = {
  0: { body: '#FFF6E6', shade: '#E7D9BC', line: '#2A2140', face: '#2A2140', accent: '#33E0D6' },
  1: { body: '#3A2E5E', shade: '#2A2144', line: '#171029', face: '#FFF6E6', accent: '#F252C1' },
}

const GOLD = '#FFC53D'
const GOLD_DARK = '#D89A16'

function Face({ x, y, p, s = 1 }: { x: number; y: number; p: Palette; s?: number }) {
  return (
    <g>
      <circle cx={x - 3.2 * s} cy={y} r={1.5 * s} fill={p.face} />
      <circle cx={x + 3.2 * s} cy={y} r={1.5 * s} fill={p.face} />
      <path
        d={`M ${x - 2.2 * s} ${y + 3.4 * s} Q ${x} ${y + 5 * s} ${x + 2.2 * s} ${y + 3.4 * s}`}
        stroke={p.face}
        strokeWidth={1.2 * s}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}

function Pawn({ p }: { p: Palette }) {
  return (
    <g>
      {/* lança do soldadinho */}
      <rect x={12.6} y={14} width={2.8} height={40} rx={1.4} fill={GOLD_DARK} />
      <path d="M14 4 L18.5 14 L9.5 14 Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth={1} />
      {/* corpo */}
      <path d="M22 58 Q22 36 32 36 Q42 36 42 58 Z" fill={p.body} stroke={p.line} strokeWidth={2} />
      <rect x={22.6} y={49} width={18.8} height={4} fill={p.accent} opacity={0.9} />
      {/* cabeça + capacete com pluma */}
      <circle cx={32} cy={27} r={9.5} fill={p.body} stroke={p.line} strokeWidth={2} />
      <path d="M22.5 26 A9.5 9.5 0 0 1 41.5 26 L41.5 23 A9.5 8 0 0 0 22.5 23 Z" fill={p.shade} stroke={p.line} strokeWidth={1.6} />
      <path d="M22.5 25.5 L41.5 25.5" stroke={p.line} strokeWidth={1.4} />
      <circle cx={32} cy={15.5} r={2.6} fill={p.accent} stroke={p.line} strokeWidth={1.2} />
      <Face x={32} y={29} p={p} />
    </g>
  )
}

function Knight({ p }: { p: Palette }) {
  return (
    <g>
      {/* lança do cavaleiro */}
      <rect x={10.6} y={10} width={2.6} height={34} rx={1.3} fill={GOLD_DARK} />
      <path d="M11.9 2 L15.8 10 L8 10 Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth={1} />
      {/* corpo do cavalo */}
      <ellipse cx={31} cy={48} rx={17} ry={9.5} fill={p.body} stroke={p.line} strokeWidth={2} />
      {/* patas */}
      <rect x={18} y={52} width={5} height={7} rx={2} fill={p.shade} stroke={p.line} strokeWidth={1.4} />
      <rect x={39} y={52} width={5} height={7} rx={2} fill={p.shade} stroke={p.line} strokeWidth={1.4} />
      {/* pescoço + cabeça do cavalo */}
      <path d="M38 46 Q46 38 47 26 L54 30 Q55 36 50 40 Q44 46 42 50 Z" fill={p.body} stroke={p.line} strokeWidth={2} />
      <path d="M46 25 Q52 20 55.5 22 Q58 26 56 30 L47 28 Z" fill={p.body} stroke={p.line} strokeWidth={2} />
      <path d="M48.5 21.5 L51 15.5 L53.5 21.8 Z" fill={p.shade} stroke={p.line} strokeWidth={1.4} />
      <circle cx={51.5} cy={25.5} r={1.6} fill={p.face} />
      {/* crina */}
      <path d="M45 27 Q42 32 43 38 Q40 40 39 45" stroke={p.shade} strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* cavaleiro montado */}
      <rect x={20} y={26} width={13} height={15} rx={5.5} fill={p.accent} stroke={p.line} strokeWidth={2} />
      <circle cx={26.5} cy={19} r={7} fill={p.body} stroke={p.line} strokeWidth={2} />
      <path d="M19.5 18 A7 7 0 0 1 33.5 18 L33.5 15.5 A7 6 0 0 0 19.5 15.5 Z" fill={p.shade} stroke={p.line} strokeWidth={1.4} />
      <circle cx={26.5} cy={9.5} r={2.2} fill={GOLD} stroke={p.line} strokeWidth={1.1} />
      <Face x={26.5} y={20.5} p={p} s={0.85} />
    </g>
  )
}

function Bishop({ p }: { p: Palette }) {
  return (
    <g>
      {/* cajado com voluta */}
      <rect x={47.4} y={16} width={2.8} height={40} rx={1.4} fill={GOLD_DARK} />
      <path d="M48.8 16 Q48.8 8 42.5 9 Q38.5 9.8 40 14" stroke={GOLD} strokeWidth={2.8} strokeLinecap="round" fill="none" />
      {/* túnica */}
      <path d="M19 58 Q21 30 32 27 Q43 30 45 58 Z" fill={p.body} stroke={p.line} strokeWidth={2} />
      <path d="M30 33 L34 33 L34 56 L30 56 Z" fill={p.accent} opacity={0.85} />
      {/* cabeça + mitra */}
      <circle cx={32} cy={20} r={8} fill={p.body} stroke={p.line} strokeWidth={2} />
      <path d="M25 13 Q32 -2 39 13 Q35.5 16 32 16 Q28.5 16 25 13 Z" fill={p.shade} stroke={p.line} strokeWidth={1.8} />
      <circle cx={32} cy={8} r={1.8} fill={GOLD} />
      <Face x={32} y={21.5} p={p} s={0.9} />
    </g>
  )
}

function Rook({ p }: { p: Palette }) {
  return (
    <g>
      {/* base de pedra */}
      <rect x={14} y={52} width={36} height={7} rx={3} fill={p.shade} stroke={p.line} strokeWidth={2} />
      {/* torre */}
      <path d="M20 52 L20 26 L44 26 L44 52 Z" fill={p.body} stroke={p.line} strokeWidth={2} />
      {/* ameias */}
      <path
        d="M17 26 L17 14 L24 14 L24 19 L28.5 19 L28.5 14 L35.5 14 L35.5 19 L40 19 L40 14 L47 14 L47 26 Z"
        fill={p.shade}
        stroke={p.line}
        strokeWidth={2}
      />
      {/* tijolinhos */}
      <path d="M24 33 L30 33 M34 33 L40 33 M27 40 L33 40 M37 40 L42 40" stroke={p.line} strokeWidth={1.2} opacity={0.5} />
      {/* portinha */}
      <path d="M27.5 52 L27.5 45 A4.5 4.5 0 0 1 36.5 45 L36.5 52 Z" fill={p.line} opacity={0.55} />
      <Face x={32} y={29.5} p={p} s={0.95} />
    </g>
  )
}

function Queen({ p }: { p: Palette }) {
  return (
    <g>
      {/* vestido */}
      <path d="M17 58 Q22 34 32 30 Q42 34 47 58 Z" fill={p.body} stroke={p.line} strokeWidth={2} />
      <path d="M20 53 Q26 49 32 53 Q38 49 44 53" stroke={p.accent} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {/* colar */}
      <circle cx={32} cy={32.5} r={1.8} fill={GOLD} />
      {/* cabeça */}
      <circle cx={32} cy={20} r={8.5} fill={p.body} stroke={p.line} strokeWidth={2} />
      {/* cabelo */}
      <path d="M23.5 20 Q22 12 32 11.5 Q42 12 40.5 20 Q40 14.5 32 14.5 Q24 14.5 23.5 20 Z" fill={p.shade} stroke={p.line} strokeWidth={1.4} />
      {/* coroa de pontas */}
      <path d="M23 12 L26 4.5 L29.5 10 L32 3 L34.5 10 L38 4.5 L41 12 Q36.5 14.5 32 14.5 Q27.5 14.5 23 12 Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth={1.6} />
      <circle cx={26} cy={5.5} r={1.5} fill={p.accent} />
      <circle cx={32} cy={4} r={1.5} fill={p.accent} />
      <circle cx={38} cy={5.5} r={1.5} fill={p.accent} />
      {/* cílios */}
      <path d="M26.8 18.5 L25 17.4 M37.2 18.5 L39 17.4" stroke={p.face} strokeWidth={1.1} strokeLinecap="round" />
      <Face x={32} y={21} p={p} s={0.95} />
    </g>
  )
}

function King({ p }: { p: Palette }) {
  return (
    <g>
      {/* capa */}
      <path d="M18 58 Q14 34 24 30 L40 30 Q50 34 46 58 Z" fill={p.shade} stroke={p.line} strokeWidth={2} />
      {/* corpo */}
      <path d="M22 58 Q22 32 32 32 Q42 32 42 58 Z" fill={p.body} stroke={p.line} strokeWidth={2} />
      <rect x={22.8} y={47} width={18.4} height={4.4} fill={GOLD} stroke={GOLD_DARK} strokeWidth={1.2} />
      {/* cetro */}
      <rect x={49.4} y={26} width={2.8} height={30} rx={1.4} fill={GOLD_DARK} />
      <path d="M50.8 17 L53.6 22.6 L50.8 25.4 L48 22.6 Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth={1.2} />
      {/* cabeça + barba */}
      <circle cx={32} cy={20} r={8.5} fill={p.body} stroke={p.line} strokeWidth={2} />
      <path d="M25 22 Q25 30 32 30 Q39 30 39 22 Q36 26 32 26 Q28 26 25 22 Z" fill={p.shade} stroke={p.line} strokeWidth={1.4} />
      {/* coroa fechada com orbe */}
      <path d="M24 13 L24 7 L28 10 L32 5.5 L36 10 L40 7 L40 13 Q36 15.5 32 15.5 Q28 15.5 24 13 Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth={1.6} />
      <circle cx={32} cy={3.4} r={2} fill={GOLD} stroke={GOLD_DARK} strokeWidth={1.1} />
      <circle cx={32} cy={12.5} r={1.6} fill={p.accent} />
      <Face x={32} y={20.5} p={p} s={0.95} />
    </g>
  )
}

const DRAW: Record<PieceType, (props: { p: Palette }) => ReturnType<typeof Pawn>> = {
  p: Pawn,
  n: Knight,
  b: Bishop,
  r: Rook,
  q: Queen,
  k: King,
}

export default function PieceSvg({ t, c, className }: { t: PieceType; c: ChessColor; className?: string }) {
  const p = TEAMS[c]
  const Draw = DRAW[t]
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* sombra no chão */}
      <ellipse cx={32} cy={59} rx={16} ry={3.2} fill="rgba(20,14,38,0.35)" />
      <Draw p={p} />
    </svg>
  )
}
