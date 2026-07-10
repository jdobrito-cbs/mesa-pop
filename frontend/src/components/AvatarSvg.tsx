import { paramsFromId, type AvatarExpressao, type AvatarParams } from '@mesapop/shared'

/**
 * Avatar procedural do Mesa Pop — 100% SVG nosso (estilos de referência
 * recriados, nunca clonados). Círculo CHAPADO colorido com:
 * - pessoas: rosto cartoon (penteados/tons variados, sorriso/sério/bravo);
 * - bichos: cara flat geométrica;
 * - ícones gamer: objeto chapado (especiais);
 * - mascotes: cara estilo e-sports com contorno forte (especiais/super).
 */

const TINTA = '#26150f' // traço dos rostos
const escurece = (hex: string, f = 0.72) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (x: number) => Math.round(x * f)
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`
}

// ————————————————————— PESSOAS —————————————————————

function BocaPessoa({ e }: { e: AvatarExpressao }) {
  if (e === 'sorriso')
    return (
      <g>
        {/* sorrisão aberto com dentes, como nas referências */}
        <path d="M40 59 Q50 73 60 59 Q50 63 40 59 Z" fill="#8c2f36" />
        <path d="M41.5 59.8 Q50 62.6 58.5 59.8 L57.5 63 Q50 65 42.5 63 Z" fill="#ffffff" />
      </g>
    )
  if (e === 'serio') return <path d="M44 63.5 h12" stroke={TINTA} strokeWidth={2.4} strokeLinecap="round" />
  return <path d="M43 66 Q50 59.5 57 66" stroke={TINTA} strokeWidth={2.6} fill="none" strokeLinecap="round" />
}

function OlhosPessoa({ e }: { e: AvatarExpressao }) {
  return (
    <g>
      <circle cx={42} cy={50} r={2.4} fill={TINTA} />
      <circle cx={58} cy={50} r={2.4} fill={TINTA} />
      <circle cx={42.9} cy={49.2} r={0.8} fill="#fff" />
      <circle cx={58.9} cy={49.2} r={0.8} fill="#fff" />
      {e === 'bravo' ? (
        <g stroke={TINTA} strokeWidth={2.2} strokeLinecap="round">
          <path d="M37.5 43.5 L46 46.5" />
          <path d="M62.5 43.5 L54 46.5" />
        </g>
      ) : (
        <g stroke={TINTA} strokeWidth={1.9} strokeLinecap="round" fill="none">
          <path d="M38 44.5 q4 -2.4 8 -0.6" />
          <path d="M54 43.9 q4 -1.8 8 0.6" />
        </g>
      )}
    </g>
  )
}

/** penteados (0..11) — desenhados por cima da cabeça */
function Cabelo({ v, cor }: { v: number; cor: string }) {
  switch (v) {
    case 0: // curto clássico
      return <path d="M31.5 47 Q29 25 50 24.5 Q71 25 68.5 47 Q67 34 50 33.5 Q33 34 31.5 47 Z" fill={cor} />
    case 1: // franja lateral
      return <path d="M31.5 48 Q29 24 50 24 Q71 24 68.5 46 L66 36 Q57 40 52 33 Q44 41 34 38 Q32 42 31.5 48 Z" fill={cor} />
    case 2: // cacheado volumoso
      return (
        <g fill={cor}>
          <circle cx={35} cy={33} r={9} /><circle cx={46} cy={27} r={10} /><circle cx={58} cy={28} r={9.5} />
          <circle cx={67} cy={36} r={8} /><circle cx={30} cy={43} r={7} /><circle cx={70} cy={46} r={6.5} />
          <path d="M31 48 Q31 30 50 29 Q69 30 69 48 Q69 38 50 37 Q31 38 31 48 Z" />
        </g>
      )
    case 3: // coque
      return (
        <g fill={cor}>
          <circle cx={50} cy={22} r={8} />
          <path d="M31.5 49 Q29 26 50 25 Q71 26 68.5 49 Q66 35 50 34 Q34 35 31.5 49 Z" />
        </g>
      )
    case 4: // maria-chiquinha
      return (
        <g fill={cor}>
          <circle cx={27} cy={44} r={7.5} /><circle cx={73} cy={44} r={7.5} />
          <path d="M31.5 49 Q29 25 50 24.5 Q71 25 68.5 49 Q66 34 50 33.5 Q34 34 31.5 49 Z" />
        </g>
      )
    case 5: // rabo de cavalo alto
      return (
        <g fill={cor}>
          <path d="M56 21 Q72 18 74 34 Q70 26 58 27 Z" />
          <path d="M31.5 48 Q29 24 50 24 Q71 24 68.5 46 Q66 34 50 33 Q34 34 31.5 48 Z" />
        </g>
      )
    case 6: // grisalho penteado (vô/vó)
      return <path d="M31.5 50 Q28 26 50 24.5 Q72 26 68.5 50 Q68 36 61 33 Q56 38 50 34 Q42 39 38 34 Q32 38 31.5 50 Z" fill={cor} />
    case 7: // careca + barba (a barba entra no corpo do rosto)
      return <path d="M35 34 Q42 27.5 50 27.5 Q58 27.5 65 34 Q58 31 50 31 Q42 31 35 34 Z" fill={cor} opacity={0.45} />
    case 8: // longo liso
      return (
        <g fill={cor}>
          <path d="M29 74 Q26 34 50 25 Q74 34 71 74 L62 74 Q66 46 50 36 Q34 46 38 74 Z" />
          <path d="M31.5 48 Q30 27 50 25.5 Q70 27 68.5 48 Q66 34 50 33 Q34 34 31.5 48 Z" />
        </g>
      )
    case 9: // lenço/bandana com laço
      return (
        <g fill={cor}>
          <path d="M31 47 Q29 26 50 25 Q71 26 69 47 Q66 33 50 32 Q34 33 31 47 Z" />
          <circle cx={66} cy={30} r={4.4} />
          <path d="M66 30 L76 24 L73 33 Z" />
        </g>
      )
    case 10: // topete
      return <path d="M32 47 Q30 30 40 27 Q36 22 46 21 Q60 19 66 26 Q72 32 68.5 47 Q66 33 50 32.5 Q34 33 32 47 Z" fill={cor} />
    default: // 11: cacho curtinho rente
      return (
        <g fill={cor}>
          <path d="M31.5 46 Q30 26 50 25 Q70 26 68.5 46 Q66 33 50 32 Q34 33 31.5 46 Z" />
          <circle cx={36} cy={31} r={4} /><circle cx={46} cy={27.5} r={4.4} /><circle cx={56} cy={27.5} r={4.4} /><circle cx={64} cy={31} r={4} />
        </g>
      )
  }
}

function Pessoa({ p }: { p: AvatarParams }) {
  return (
    <g>
      {/* camisa/ombros */}
      <path d="M22 100 Q23 76 50 76 Q77 76 78 100 Z" fill={p.corBase} />
      <path d="M43 78 L50 86 L57 78 Q50 81 43 78 Z" fill="#ffffff" opacity={0.9} />
      {/* pescoço + cabeça + orelhas */}
      <rect x={44.5} y={66} width={11} height={12} rx={4} fill={escurece(p.pele, 0.88)} />
      <circle cx={31.5} cy={53} r={4} fill={p.pele} />
      <circle cx={68.5} cy={53} r={4} fill={p.pele} />
      <ellipse cx={50} cy={50} rx={18.5} ry={21} fill={p.pele} />
      <Cabelo v={p.variante} cor={p.cabelo} />
      {/* barba do careca (variante 7) */}
      {p.variante === 7 && (
        <path d="M33 52 Q34 70 50 71 Q66 70 67 52 Q66 62 50 63.5 Q34 62 33 52 Z" fill={p.cabelo} />
      )}
      <OlhosPessoa e={p.expressao} />
      {/* bochechas coradas (só nos sorridentes) */}
      {p.expressao === 'sorriso' && (
        <g fill="#ff8d8d" opacity={0.4}>
          <circle cx={36} cy={57} r={3.4} />
          <circle cx={64} cy={57} r={3.4} />
        </g>
      )}
      <BocaPessoa e={p.expressao} />
      {/* nariz */}
      <path d="M49 54.5 q1.6 2.4 0 3.6" stroke={escurece(p.pele, 0.7)} strokeWidth={1.7} fill="none" strokeLinecap="round" />
      {p.oculos && (
        <g stroke={TINTA} strokeWidth={2} fill="#ffffff22">
          <circle cx={42} cy={50} r={6.4} />
          <circle cx={58} cy={50} r={6.4} />
          <path d="M48.4 50 h3.2" />
          <path d="M35.6 49 l-4 -1.6" /><path d="M64.4 49 l4 -1.6" />
        </g>
      )}
    </g>
  )
}

// ————————————————————— BICHOS FLAT —————————————————————

function BocaBicho({ e, y = 63 }: { e: AvatarExpressao; y?: number }) {
  if (e === 'sorriso') return <path d={`M44 ${y} Q50 ${y + 6} 56 ${y}`} stroke={TINTA} strokeWidth={2.2} fill="none" strokeLinecap="round" />
  if (e === 'bravo') return <path d={`M45 ${y + 4} Q50 ${y - 1} 55 ${y + 4}`} stroke={TINTA} strokeWidth={2.2} fill="none" strokeLinecap="round" />
  return <path d={`M46 ${y + 2} h8`} stroke={TINTA} strokeWidth={2.2} strokeLinecap="round" />
}

function Bicho({ p }: { p: AvatarParams }) {
  const e = p.expressao
  const olhos = (
    <g>
      <circle cx={42} cy={50} r={2.6} fill={TINTA} />
      <circle cx={58} cy={50} r={2.6} fill={TINTA} />
      <circle cx={43} cy={49} r={0.9} fill="#fff" />
      <circle cx={59} cy={49} r={0.9} fill="#fff" />
    </g>
  )
  switch (p.variante) {
    case 0: { // leão
      const juba = '#c96a24'
      return (
        <g>
          <g fill={juba}>{Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <circle key={i} cx={50 + Math.cos(a) * 24} cy={52 + Math.sin(a) * 24} r={6} /> })}</g>
          <circle cx={50} cy={52} r={25} fill={juba} />
          <circle cx={50} cy={52} r={19} fill="#f0a04a" />
          <ellipse cx={50} cy={60} rx={9} ry={7} fill="#ffd9a8" />
          <path d="M47 57 L53 57 L50 60.5 Z" fill={TINTA} />
          {olhos}
          <BocaBicho e={e} y={62} />
        </g>
      )
    }
    case 1: // panda
      return (
        <g>
          <circle cx={33} cy={33} r={7.5} fill={TINTA} />
          <circle cx={67} cy={33} r={7.5} fill={TINTA} />
          <circle cx={50} cy={52} r={22} fill="#ffffff" />
          <ellipse cx={41.5} cy={49} rx={5.6} ry={7} fill={TINTA} transform="rotate(-18 41.5 49)" />
          <ellipse cx={58.5} cy={49} rx={5.6} ry={7} fill={TINTA} transform="rotate(18 58.5 49)" />
          <circle cx={42} cy={50} r={2.2} fill="#fff" /><circle cx={58} cy={50} r={2.2} fill="#fff" />
          <circle cx={42} cy={50} r={1.1} fill={TINTA} /><circle cx={58} cy={50} r={1.1} fill={TINTA} />
          <path d="M47.5 58 L52.5 58 L50 61 Z" fill={TINTA} />
          <BocaBicho e={e} y={62} />
        </g>
      )
    case 2: // raposa
      return (
        <g>
          <path d="M28 32 L40 36 L33 46 Z" fill="#e8702a" />
          <path d="M72 32 L60 36 L67 46 Z" fill="#e8702a" />
          <path d="M50 74 Q28 66 29 46 Q34 36 50 35 Q66 36 71 46 Q72 66 50 74 Z" fill="#e8702a" />
          <path d="M50 74 Q40 68 38 58 Q44 52 50 52 Q56 52 62 58 Q60 68 50 74 Z" fill="#ffe8d2" />
          <circle cx={50} cy={62} r={2.6} fill={TINTA} />
          {olhos}
          <BocaBicho e={e} y={65} />
        </g>
      )
    case 3: // urso
      return (
        <g>
          <circle cx={34} cy={34} r={8} fill="#8a5a38" />
          <circle cx={66} cy={34} r={8} fill="#8a5a38" />
          <circle cx={34} cy={34} r={3.6} fill="#c98a5b" />
          <circle cx={66} cy={34} r={3.6} fill="#c98a5b" />
          <circle cx={50} cy={52} r={22} fill="#8a5a38" />
          <ellipse cx={50} cy={60} rx={9.5} ry={7.5} fill="#e8c49a" />
          <ellipse cx={50} cy={57} rx={3.4} ry={2.6} fill={TINTA} />
          {olhos}
          <BocaBicho e={e} y={62} />
        </g>
      )
    case 4: // coruja
      return (
        <g>
          <path d="M32 34 L38 26 L42 35 Z" fill="#7c5cc4" />
          <path d="M68 34 L62 26 L58 35 Z" fill="#7c5cc4" />
          <circle cx={50} cy={53} r={23} fill="#7c5cc4" />
          <circle cx={41} cy={49} r={9.5} fill="#ffffff" />
          <circle cx={59} cy={49} r={9.5} fill="#ffffff" />
          <circle cx={41} cy={49} r={4} fill={TINTA} />
          <circle cx={59} cy={49} r={4} fill={TINTA} />
          <circle cx={42.2} cy={47.8} r={1.2} fill="#fff" /><circle cx={60.2} cy={47.8} r={1.2} fill="#fff" />
          <path d="M46 58 L54 58 L50 65 Z" fill="#f7a325" />
          <path d="M38 68 q12 6 24 0" stroke="#5d43a0" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </g>
      )
    case 5: // gato
      return (
        <g>
          <path d="M30 34 L34 22 L44 32 Z" fill="#8f8f9c" />
          <path d="M70 34 L66 22 L56 32 Z" fill="#8f8f9c" />
          <circle cx={50} cy={52} r={22} fill="#8f8f9c" />
          <path d="M47 57 L53 57 L50 60 Z" fill="#e0558f" />
          {olhos}
          <g stroke="#5c5c68" strokeWidth={1.6} strokeLinecap="round">
            <path d="M28 55 L38 57" /><path d="M28 61 L38 60" />
            <path d="M72 55 L62 57" /><path d="M72 61 L62 60" />
          </g>
          <BocaBicho e={e} y={62} />
        </g>
      )
    case 6: // cachorro
      return (
        <g>
          <ellipse cx={31} cy={45} rx={7} ry={13} fill="#a06a3a" transform="rotate(14 31 45)" />
          <ellipse cx={69} cy={45} rx={7} ry={13} fill="#a06a3a" transform="rotate(-14 69 45)" />
          <circle cx={50} cy={52} r={21} fill="#c98a5b" />
          <ellipse cx={50} cy={60} rx={9} ry={7} fill="#ffe8d2" />
          <ellipse cx={50} cy={56.5} rx={3.4} ry={2.6} fill={TINTA} />
          {e === 'sorriso' && <path d="M52 64 q4 5 7 1 l-1 -4 Z" fill="#e0558f" />}
          {olhos}
          <BocaBicho e={e} y={62} />
        </g>
      )
    default: // 7: coelho
      return (
        <g>
          <ellipse cx={41} cy={24} rx={6} ry={15} fill="#e8e4da" transform="rotate(-8 41 24)" />
          <ellipse cx={59} cy={24} rx={6} ry={15} fill="#e8e4da" transform="rotate(8 59 24)" />
          <ellipse cx={41} cy={26} rx={2.8} ry={10} fill="#f5b8c4" transform="rotate(-8 41 26)" />
          <ellipse cx={59} cy={26} rx={2.8} ry={10} fill="#f5b8c4" transform="rotate(8 59 26)" />
          <circle cx={50} cy={54} r={20} fill="#e8e4da" />
          <path d="M47.5 58 L52.5 58 L50 61 Z" fill="#f28aa2" />
          <rect x={46.8} y={61} width={3} height={4.6} rx={1} fill="#fff" stroke={TINTA} strokeWidth={0.8} />
          <rect x={50.2} y={61} width={3} height={4.6} rx={1} fill="#fff" stroke={TINTA} strokeWidth={0.8} />
          {olhos}
          <BocaBicho e={e} y={61} />
        </g>
      )
  }
}

// ————————————————————— ÍCONES GAMER (especiais) —————————————————————

function Icone({ p }: { p: AvatarParams }) {
  const A = p.corBase
  const B = p.corSec === p.corBase ? escurece(p.corBase) : p.corSec
  switch (p.variante) {
    case 0: // controle
      return (
        <g>
          <path d="M30 42 Q50 36 70 42 Q80 44 80 56 Q80 68 71 67 Q64 66 60 60 L40 60 Q36 66 29 67 Q20 68 20 56 Q20 44 30 42 Z" fill="#f3f0f7" stroke="#c9c2d8" strokeWidth={1.5} />
          <rect x={31} y={47} width={4.6} height={12} rx={2} fill={B} />
          <rect x={27.3} y={50.7} width={12} height={4.6} rx={2} fill={B} />
          <circle cx={63} cy={48} r={2.8} fill="#ef4444" /><circle cx={70} cy={52} r={2.8} fill="#34d399" />
          <circle cx={63} cy={56} r={2.8} fill="#facc15" /><circle cx={56} cy={52} r={2.8} fill={A} />
        </g>
      )
    case 1: // joystick arcade
      return (
        <g>
          <circle cx={50} cy={36} r={9} fill={A} />
          <circle cx={47} cy={33} r={2.6} fill="#ffffff88" />
          <rect x={47} y={42} width={6} height={16} fill="#5c5c68" />
          <path d="M28 58 h44 l4 12 a4 4 0 0 1 -4 4 h-44 a4 4 0 0 1 -4 -4 Z" fill={B} />
          <circle cx={64} cy={64} r={3.4} fill="#facc15" />
          <circle cx={36} cy={64} r={3.4} fill="#ef4444" />
        </g>
      )
    case 2: // dado
      return (
        <g transform="rotate(-10 50 52)">
          <rect x={32} y={34} width={36} height={36} rx={8} fill="#faf6ea" stroke="#d8cfb4" strokeWidth={1.6} />
          <circle cx={42} cy={44} r={3.4} fill={TINTA} /><circle cx={58} cy={44} r={3.4} fill={TINTA} />
          <circle cx={50} cy={52} r={3.4} fill={TINTA} />
          <circle cx={42} cy={60} r={3.4} fill={TINTA} /><circle cx={58} cy={60} r={3.4} fill={TINTA} />
        </g>
      )
    case 3: // troféu
      return (
        <g>
          <path d="M36 30 h28 v10 q0 14 -14 16 q-14 -2 -14 -16 Z" fill="#facc15" stroke="#c99a1a" strokeWidth={1.5} />
          <path d="M36 33 h-8 q-1 12 10 14" fill="none" stroke="#c99a1a" strokeWidth={3} />
          <path d="M64 33 h8 q1 12 -10 14" fill="none" stroke="#c99a1a" strokeWidth={3} />
          <rect x={46.5} y={56} width={7} height={7} fill="#c99a1a" />
          <rect x={38} y={63} width={24} height={7} rx={2} fill={B} />
          <text x={50} y={45} textAnchor="middle" fontSize={11} fontWeight={900} fill="#8a6a10">1</text>
        </g>
      )
    case 4: // foguete
      return (
        <g transform="rotate(38 50 50)">
          <path d="M50 20 Q60 32 60 50 L40 50 Q40 32 50 20 Z" fill="#f3f0f7" stroke="#c9c2d8" strokeWidth={1.4} />
          <circle cx={50} cy={40} r={5} fill={A} />
          <path d="M40 48 L32 60 L42 56 Z" fill={B} />
          <path d="M60 48 L68 60 L58 56 Z" fill={B} />
          <rect x={45} y={50} width={10} height={6} fill={B} />
          <path d="M46 58 Q50 70 54 58 Z" fill="#f7a325" />
        </g>
      )
    case 5: // bomba
      return (
        <g>
          <circle cx={48} cy={58} r={17} fill="#3a3a46" />
          <circle cx={42} cy={52} r={5} fill="#ffffff22" />
          <rect x={52} y={38} width={9} height={7} rx={2} fill="#5c5c68" transform="rotate(30 56 41)" />
          <path d="M60 38 Q66 30 72 33" stroke="#8a5a38" strokeWidth={2.6} fill="none" />
          <path d="M72 33 l4 -6 l1 5 l5 1 l-6 3 Z" fill="#f7a325" />
        </g>
      )
    case 6: // baú do tesouro
      return (
        <g>
          <path d="M28 44 q0 -12 22 -12 q22 0 22 12 v6 h-44 Z" fill="#a06a3a" stroke="#6b4429" strokeWidth={1.6} />
          <rect x={28} y={50} width={44} height={20} rx={3} fill="#8a5a38" stroke="#6b4429" strokeWidth={1.6} />
          <rect x={45} y={46} width={10} height={12} rx={2} fill="#facc15" stroke="#c99a1a" strokeWidth={1.4} />
          <circle cx={50} cy={53} r={1.8} fill="#8a6a10" />
          <circle cx={36} cy={40} r={2.6} fill="#facc15" /><circle cx={58} cy={38} r={2.2} fill="#facc15" />
        </g>
      )
    case 7: // poção
      return (
        <g>
          <rect x={45.5} y={28} width={9} height={9} fill="#c9c2d8" />
          <rect x={43.5} y={26} width={13} height={4} rx={2} fill="#8a5a38" />
          <path d="M45.5 36 Q30 48 34 60 Q37 71 50 71 Q63 71 66 60 Q70 48 54.5 36 Z" fill="#dff4ff55" stroke="#9bd7f7" strokeWidth={1.6} />
          <path d="M38 54 Q40 48 46 45 L54 45 Q60 48 62 54 Q64 64 50 66 Q36 64 38 54 Z" fill={A} />
          <circle cx={44} cy={52} r={2} fill="#ffffff88" /><circle cx={56} cy={57} r={1.6} fill="#ffffff66" />
        </g>
      )
    case 8: // coroa
      return (
        <g>
          <path d="M28 62 L26 36 L38 46 L50 30 L62 46 L74 36 L72 62 Z" fill="#facc15" stroke="#c99a1a" strokeWidth={1.8} />
          <rect x={28} y={62} width={44} height={7} rx={2} fill="#c99a1a" />
          <circle cx={26} cy={34} r={3} fill={A} /><circle cx={50} cy={28} r={3} fill={A} /><circle cx={74} cy={34} r={3} fill={A} />
          <circle cx={50} cy={54} r={3.4} fill={B} />
        </g>
      )
    case 9: // ficha de pôquer
      return (
        <g>
          <circle cx={50} cy={51} r={22} fill={A} />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={46} y={27} width={8} height={9} rx={2} fill="#f3f0f7" transform={`rotate(${i * 60} 50 51)`} />
          ))}
          <circle cx={50} cy={51} r={13} fill="#f3f0f7" />
          <circle cx={50} cy={51} r={13} fill="none" stroke={B} strokeWidth={2} strokeDasharray="4 3" />
          <text x={50} y={56} textAnchor="middle" fontSize={13} fontWeight={900} fill={escurece(A)}>P</text>
        </g>
      )
    case 10: // coração pixel
      return (
        <g fill={A}>
          {[
            [38, 36], [44, 36], [56, 36], [62, 36],
            [32, 42], [38, 42], [44, 42], [50, 42], [56, 42], [62, 42], [68, 42],
            [32, 48], [38, 48], [44, 48], [50, 48], [56, 48], [62, 48], [68, 48],
            [38, 54], [44, 54], [50, 54], [56, 54], [62, 54],
            [44, 60], [50, 60], [56, 60],
            [50, 66],
          ].map(([x, y], i) => <rect key={i} x={x! - 3} y={y! - 3} width={6.2} height={6.2} />)}
          <rect x={35} y={39} width={6.2} height={6.2} fill="#ffffff77" />
        </g>
      )
    default: // 11: estrela
      return (
        <g>
          <path d="M50 26 L57 42 L75 44 L62 56 L66 74 L50 64 L34 74 L38 56 L25 44 L43 42 Z" fill="#facc15" stroke="#c99a1a" strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M50 33 L54.5 43.5 L50 41 Z" fill="#ffffff66" />
        </g>
      )
  }
}

// ————————————————————— MASCOTES E-SPORTS (especiais/super) —————————————————————

const TRACO = '#181820'

function OlhosMascote({ cor = '#ffffff', bravo = true }: { cor?: string; bravo?: boolean }) {
  return (
    <g>
      <path d={bravo ? 'M35 46 L47 50 L46 54 L36 51 Z' : 'M36 47 L47 48 L46 53 L36 52 Z'} fill={cor} stroke={TRACO} strokeWidth={1.6} />
      <path d={bravo ? 'M65 46 L53 50 L54 54 L64 51 Z' : 'M64 47 L53 48 L54 53 L64 52 Z'} fill={cor} stroke={TRACO} strokeWidth={1.6} />
    </g>
  )
}

function Mascote({ p }: { p: AvatarParams }) {
  const A = p.corBase
  const bravo = p.expressao === 'bravo'
  switch (p.variante) {
    case 0: // leão feroz
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M50 18 L62 26 L76 24 L72 38 L80 50 L70 58 L72 74 L58 70 L50 80 L42 70 L28 74 L30 58 L20 50 L28 38 L24 24 L38 26 Z" fill="#c9541e" />
          <path d="M50 28 Q66 30 66 46 Q66 60 50 66 Q34 60 34 46 Q34 30 50 28 Z" fill="#f0a04a" />
          <OlhosMascote bravo={bravo} />
          <path d="M44 56 h12 l-2 5 h-8 Z" fill="#ffd9a8" />
          <path d="M46.5 56 v4 M50 56 v5 M53.5 56 v4" stroke={TRACO} strokeWidth={1.2} />
          <path d="M47 51 L53 51 L50 54.5 Z" fill={TRACO} stroke="none" />
        </g>
      )
    case 1: // coruja mística
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M30 26 L42 34 L50 30 L58 34 L70 26 L68 44 Q72 58 50 72 Q28 58 32 44 Z" fill="#4a3a7c" />
          <path d="M38 44 Q42 38 48 42 L48 50 Q42 52 38 48 Z" fill="#8a6cf0" />
          <path d="M62 44 Q58 38 52 42 L52 50 Q58 52 62 48 Z" fill="#8a6cf0" />
          <circle cx={44} cy={46} r={3} fill="#ffe14d" stroke="none" />
          <circle cx={56} cy={46} r={3} fill="#ffe14d" stroke="none" />
          <path d="M46 56 L54 56 L50 63 Z" fill="#f7a325" />
        </g>
      )
    case 2: // ninja
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <circle cx={50} cy={50} r={26} fill="#2c2c3a" />
          <path d="M26 44 Q50 36 74 44 L72 56 Q50 50 28 56 Z" fill={A} />
          <OlhosMascote cor="#ffffff" bravo={bravo} />
          <path d="M70 40 L84 30 L80 42 Z" fill={A} />
          <path d="M50 22 Q60 24 64 30 Q52 28 36 30 Q42 24 50 22 Z" fill="#1d1d28" />
        </g>
      )
    case 3: // caveira
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M50 24 Q72 24 72 46 Q72 56 66 60 L66 68 Q66 74 60 74 L40 74 Q34 74 34 68 L34 60 Q28 56 28 46 Q28 24 50 24 Z" fill="#f3f0e6" />
          <ellipse cx={41} cy={47} rx={6} ry={7} fill={TRACO} stroke="none" />
          <ellipse cx={59} cy={47} rx={6} ry={7} fill={TRACO} stroke="none" />
          <circle cx={42.5} cy={45.5} r={1.6} fill={A} stroke="none" />
          <circle cx={60.5} cy={45.5} r={1.6} fill={A} stroke="none" />
          <path d="M47 56 L53 56 L50 61 Z" fill={TRACO} stroke="none" />
          <path d="M42 66 v6 M48 67 v7 M54 67 v7 M60 66 v6" stroke={TRACO} strokeWidth={1.6} />
        </g>
      )
    case 4: // fênix
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M50 16 Q56 24 52 30 Q62 26 66 18 Q68 30 60 36 Q72 34 78 28 Q76 42 64 46 Z" fill="#f2695c" />
          <path d="M50 16 Q44 24 48 30 Q38 26 34 18 Q32 30 40 36 Q28 34 22 28 Q24 42 36 46 Z" fill="#f7a325" />
          <circle cx={50} cy={52} r={20} fill="#f2695c" />
          <path d="M50 30 Q58 36 56 44 L44 44 Q42 36 50 30 Z" fill="#ffd166" />
          <OlhosMascote cor="#ffe14d" bravo={bravo} />
          <path d="M46 58 L54 58 L50 66 Z" fill="#f7a325" />
        </g>
      )
    case 5: // robô
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <rect x={30} y={34} width={40} height={34} rx={8} fill="#8fa2b8" />
          <rect x={36} y={42} width={28} height={12} rx={5} fill="#1d2836" />
          <circle cx={44} cy={48} r={3} fill={A} stroke="none" />
          <circle cx={56} cy={48} r={3} fill={A} stroke="none" />
          <path d="M42 60 h16 M45 60 v4 M50 60 v4 M55 60 v4" stroke={TRACO} strokeWidth={1.6} />
          <rect x={46} y={22} width={8} height={8} rx={2} fill="#8fa2b8" />
          <circle cx={50} cy={20} r={3.4} fill={A} />
          <rect x={22} y={44} width={8} height={12} rx={3} fill="#6c7f94" />
          <rect x={70} y={44} width={8} height={12} rx={3} fill="#6c7f94" />
        </g>
      )
    case 6: // touro
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M28 30 Q16 32 16 44 Q22 40 30 42 Z" fill="#e8e4da" />
          <path d="M72 30 Q84 32 84 44 Q78 40 70 42 Z" fill="#e8e4da" />
          <path d="M50 26 Q70 28 70 48 Q70 64 58 70 L42 70 Q30 64 30 48 Q30 28 50 26 Z" fill="#6b4030" />
          <path d="M40 58 Q50 52 60 58 L60 70 Q50 76 40 70 Z" fill="#c9a08a" />
          <circle cx={45} cy={64} r={2.6} fill={TRACO} stroke="none" />
          <circle cx={55} cy={64} r={2.6} fill={TRACO} stroke="none" />
          <OlhosMascote cor="#ffb84d" bravo={bravo} />
          <circle cx={50} cy={72} r={3} fill="#f0c33c" />
        </g>
      )
    case 7: // dragão
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M28 22 L40 32 L34 40 Z" fill="#3fa66b" />
          <path d="M72 22 L60 32 L66 40 Z" fill="#3fa66b" />
          <path d="M50 26 Q72 30 72 50 Q72 66 58 72 L42 72 Q28 66 28 50 Q28 30 50 26 Z" fill="#3fa66b" />
          <path d="M40 60 Q50 54 60 60 L58 72 L42 72 Z" fill="#bfe8a8" />
          <circle cx={45} cy={65} r={2} fill={TRACO} stroke="none" />
          <circle cx={55} cy={65} r={2} fill={TRACO} stroke="none" />
          <OlhosMascote cor="#ffe14d" bravo={bravo} />
          <path d="M50 30 L54 38 L46 38 Z" fill="#2c7a4a" />
        </g>
      )
    case 8: // lobo
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M30 24 L42 34 L34 44 Z" fill="#5c6a7c" />
          <path d="M70 24 L58 34 L66 44 Z" fill="#5c6a7c" />
          <path d="M50 30 Q70 32 70 50 Q70 62 58 68 L50 78 L42 68 Q30 62 30 50 Q30 32 50 30 Z" fill="#5c6a7c" />
          <path d="M50 50 Q60 52 58 64 L50 74 L42 64 Q40 52 50 50 Z" fill="#e8ecf2" />
          <path d="M47 60 L53 60 L50 64 Z" fill={TRACO} stroke="none" />
          <OlhosMascote cor="#8ad0ff" bravo={bravo} />
        </g>
      )
    case 9: // tubarão
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M50 20 L58 34 L42 34 Z" fill="#4a7ca6" />
          <path d="M50 32 Q74 36 74 54 Q74 68 50 72 Q26 68 26 54 Q26 36 50 32 Z" fill="#4a7ca6" />
          <path d="M34 56 Q50 50 66 56 Q62 68 50 70 Q38 68 34 56 Z" fill="#e8ecf2" />
          <path d="M38 58 l4 5 l4 -5 l4 5 l4 -5 l4 5 l4 -5" fill="#ffffff" stroke={TRACO} strokeWidth={1.4} />
          <OlhosMascote cor="#ffffff" bravo={bravo} />
        </g>
      )
    case 10: // águia
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M24 34 Q34 24 50 24 Q66 24 76 34 L66 40 Q58 34 50 34 Q42 34 34 40 Z" fill="#6b4030" />
          <path d="M50 30 Q68 34 68 52 Q68 66 50 70 Q32 66 32 52 Q32 34 50 30 Z" fill="#f3f0e6" />
          <OlhosMascote cor="#ffb84d" bravo={bravo} />
          <path d="M44 54 Q50 52 56 54 L52 64 L48 64 Z" fill="#f0c33c" />
          <path d="M48 64 L50 67 L52 64" fill="#c99a1a" />
        </g>
      )
    default: // 11: samurai
      return (
        <g stroke={TRACO} strokeWidth={2} strokeLinejoin="round">
          <path d="M28 40 Q28 24 50 24 Q72 24 72 40 L72 48 L28 48 Z" fill="#8c1f2f" />
          <path d="M46 16 L50 26 L54 16 Q50 20 46 16 Z" fill="#f0c33c" />
          <circle cx={50} cy={32} r={4} fill="#f0c33c" />
          <path d="M30 48 h40 l-4 18 q-16 10 -32 0 Z" fill="#e8c49a" />
          <path d="M40 60 Q50 56 60 60 L58 68 Q50 72 42 68 Z" fill="#2c2c3a" />
          <path d="M44 62 v5 M50 63 v5 M56 62 v5" stroke="#e8ecf2" strokeWidth={1.6} />
          <OlhosMascote cor="#ffffff" bravo={bravo} />
        </g>
      )
  }
}

// ————————————————————— COMPONENTE —————————————————————

let clipSeq = 0
const clipDe = new Map<string, string>()
function clipIdDe(id: string): string {
  let c = clipDe.get(id)
  if (!c) {
    c = `avclip${clipSeq++}`
    clipDe.set(id, c)
  }
  return c
}

export default function AvatarSvg({ id, size = 40 }: { id: string | null | undefined; size?: number }) {
  const p = paramsFromId(id || 'n0')
  const clipId = clipIdDe(id || 'n0')
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="avatar" className="shrink-0">
      <defs>
        <clipPath id={clipId}>
          <circle cx={50} cy={50} r={46} />
        </clipPath>
      </defs>
      {p.moldura > 0 && (
        <circle
          cx={50}
          cy={50}
          r={48.5}
          fill="none"
          stroke="#facc15"
          strokeWidth={3}
          strokeDasharray="10 6"
          className="animate-[spin_8s_linear_infinite]"
          style={{ transformOrigin: '50% 50%' }}
        />
      )}
      <circle cx={50} cy={50} r={46} fill={p.fundo} />
      <g clipPath={`url(#${clipId})`}>
        {/* sombra diagonal sutil (assinatura do estilo flat das referências) */}
        <path d="M76 30 L108 62 L108 108 L44 108 Z" fill="#00000014" />
        {p.tipo === 'pessoa' && <Pessoa p={p} />}
        {p.tipo === 'bicho' && <Bicho p={p} />}
        {p.tipo === 'icone' && <Icone p={p} />}
        {p.tipo === 'mascote' && <Mascote p={p} />}
      </g>
    </svg>
  )
}
