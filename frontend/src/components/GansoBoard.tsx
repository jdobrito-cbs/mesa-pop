import { useEffect, useMemo, useRef, useState } from 'react'
import { casaInfo, GANSO_FIM, type GansoState } from '@mesapop/shared'

/**
 * Corrida do Ganso — trilha em espiral 8×8. Estado vem do servidor; os dados
 * são sorteados lá. Peões deslizam de casa em casa; casas especiais destacadas.
 */

const CELL = 52
const N = 8

const CORES = ['bg-pop-magenta', 'bg-pop-cyan', 'bg-pop-yellow', 'bg-pop-green']
const CORES_HEX = ['#ff3ea5', '#22d3ee', '#facc15', '#34d399']

/** coordenadas [col,row] das casas 0..63 numa espiral que entra para o centro */
function espiral(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let top = 0
  let bottom = n - 1
  let left = 0
  let right = n - 1
  while (out.length < n * n) {
    for (let c = left; c <= right; c++) out.push([c, top])
    top++
    for (let r = top; r <= bottom; r++) out.push([right, r])
    right--
    for (let c = right; c >= left; c--) out.push([c, bottom])
    bottom--
    for (let r = bottom; r >= top; r--) out.push([left, r])
    left++
  }
  return out.slice(0, n * n)
}

const ICONE: Record<string, string> = {
  ganso: '🪿',
  ponte: '🌉',
  estalagem: '🏨',
  poco: '🕳️',
  labirinto: '🌀',
  caveira: '💀',
  fim: '🏁',
}

function DiceFace({ v }: { v: number }) {
  // posições dos pontos por valor (grade 3×3)
  const P: Record<number, Array<[number, number]>> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  }
  return (
    <svg width={38} height={38} viewBox="0 0 38 38" className="drop-shadow">
      <rect x={1} y={1} width={36} height={36} rx={8} fill="#faf6ea" stroke="#d8cfb4" />
      {(P[v] ?? []).map(([c, r], i) => (
        <circle key={i} cx={8 + c * 11} cy={8 + r * 11} r={3.6} fill="#16233a" />
      ))}
    </svg>
  )
}

export default function GansoBoard({
  state,
  yourSeat,
  players,
  onRoll,
}: {
  state: GansoState
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
  onRoll: () => void
}) {
  const coords = useMemo(() => espiral(N), [])
  const suaVez = state.turn === yourSeat && state.winner === null
  const boardPx = N * CELL

  // dados rolando ~2s a cada novo lance (o backend só age no 'roll', então
  // cada snapshot é uma rolagem — lastMove muda de referência a cada uma)
  const [rolando, setRolando] = useState(false)
  const [faces, setFaces] = useState<[number, number]>([1, 1])
  const primeiro = useRef(true)
  useEffect(() => {
    if (!state.lastMove) return
    if (primeiro.current) {
      primeiro.current = false
      return
    }
    setRolando(true)
    const spin = setInterval(() => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 90)
    const stop = setTimeout(() => {
      clearInterval(spin)
      setRolando(false)
    }, 2000)
    return () => {
      clearInterval(spin)
      clearTimeout(stop)
    }
  }, [state.lastMove])

  // agrupa peões por casa para posicionar sem sobrepor
  const porCasa = new Map<number, number[]>()
  state.positions.forEach((pos, seat) => {
    const arr = porCasa.get(pos) ?? []
    arr.push(seat)
    porCasa.set(pos, arr)
  })

  const nome = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`

  const narração = (() => {
    const m = state.lastMove
    if (!m) return null
    const quem = nome(m.seat)
    const ev = m.eventos
    if (ev.includes('chegou')) return `🏁 ${quem} chegou na casa 63 e venceu!`
    if (ev.includes('caveira')) return `💀 ${quem} caiu na caveira e voltou à largada!`
    if (ev.includes('poco')) return `🕳️ ${quem} caiu no poço — perde 2 vezes.`
    if (ev.includes('estalagem')) return `🏨 ${quem} parou na estalagem — perde a vez.`
    if (ev.includes('labirinto')) return `🌀 ${quem} entrou no labirinto e recuou.`
    if (ev.includes('ponte')) return `🌉 ${quem} atravessou a ponte!`
    if (ev.includes('ganso')) return `🪿 ${quem} caiu no ganso — avançou de novo!`
    return `🎲 ${quem} tirou ${m.roll} e foi para a casa ${m.to}.`
  })()

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* objetivo em destaque */}
      <div className="mb-3 rounded-field bg-pop-yellow/10 px-4 py-2 text-center text-sm font-bold text-cream ring-1 ring-pop-yellow/30">
        🏁 Corra pela espiral e seja o <span className="text-pop-yellow">primeiro a chegar na casa 63</span> (no centro).
        Precisa cair EXATO — se passar, ricocheteia de volta.
      </div>

      {/* placar dos jogadores */}
      <div className="mb-3 flex flex-wrap justify-center gap-2">
        {players
          .slice()
          .sort((a, b) => a.seat - b.seat)
          .map((p) => (
            <span
              key={p.seat}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ring-1 ${
                state.turn === p.seat && state.winner === null
                  ? 'bg-ink-800 ring-pop-yellow'
                  : 'bg-ink-900 ring-ink-700'
              }`}
            >
              <span className={`size-3 rounded-full ${CORES[p.seat]}`} aria-hidden="true" />
              {p.name}
              <span className="text-text-muted tabular-nums">casa {state.positions[p.seat]}</span>
              {state.turn === p.seat && state.winner === null && (
                <span className="text-xs text-pop-yellow">é a vez</span>
              )}
            </span>
          ))}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
        {/* tabuleiro */}
        <div className="overflow-auto rounded-card bg-gradient-to-br from-[#3f8f4f] to-[#2c6b3c] p-3 ring-2 ring-ink-700">
          <div className="relative" style={{ width: boardPx, height: boardPx }}>
            {coords.map(([col, row], pos) => {
              const info = casaInfo(pos)
              const icone = ICONE[info.tipo]
              const especial = info.tipo !== 'normal'
              const cor =
                info.tipo === 'fim'
                  ? 'bg-pop-yellow/30 ring-pop-yellow'
                  : info.tipo === 'ganso'
                    ? 'bg-pop-green/25 ring-pop-green/50'
                    : info.tipo === 'caveira'
                      ? 'bg-pop-magenta/20 ring-pop-magenta/50'
                      : especial
                        ? 'bg-pop-cyan/15 ring-pop-cyan/40'
                        : 'bg-[#c9a06b]/90 ring-black/10'
              return (
                <div
                  key={pos}
                  className={`absolute flex flex-col items-center justify-center rounded-lg ring-1 ${cor}`}
                  style={{ left: col * CELL + 2, top: row * CELL + 2, width: CELL - 4, height: CELL - 4 }}
                >
                  <span className="text-[10px] leading-none font-bold text-ink-950/70">
                    {pos === 0 ? '▶' : pos}
                  </span>
                  {icone && <span className="text-base leading-none">{icone}</span>}
                </div>
              )
            })}

            {/* peões */}
            {state.positions.map((pos, seat) => {
              const [col, row] = coords[pos]!
              const grupo = porCasa.get(pos) ?? [seat]
              const idx = grupo.indexOf(seat)
              const ox = (idx % 2) * 15 + 5
              const oy = Math.floor(idx / 2) * 15 + 4
              return (
                <div
                  key={seat}
                  className="pointer-events-none absolute grid place-items-center rounded-full text-[11px] font-extrabold text-white shadow-lg ring-2 ring-white/70 transition-all duration-300"
                  style={{
                    left: col * CELL + ox,
                    top: row * CELL + oy,
                    width: 20,
                    height: 20,
                    backgroundColor: CORES_HEX[seat],
                    zIndex: 100 + seat,
                  }}
                  aria-label={`peão ${nome(seat)}`}
                >
                  🦢
                </div>
              )
            })}
          </div>
        </div>

        {/* controles */}
        <div className="flex w-full max-w-[220px] flex-col items-center gap-3">
          <div className={`flex gap-2 ${rolando ? 'animate-bounce' : ''}`}>
            <DiceFace v={rolando ? faces[0] : (state.lastRoll?.[0] ?? 1)} />
            <DiceFace v={rolando ? faces[1] : (state.lastRoll?.[1] ?? 1)} />
          </div>
          {rolando && <p className="text-xs font-bold text-pop-cyan">rolando o dado…</p>}

          {state.winner !== null ? (
            <p className="text-center font-display text-lg font-extrabold text-pop-green">
              🏁 {nome(state.winner)} venceu!
            </p>
          ) : (
            <button
              onClick={onRoll}
              disabled={!suaVez}
              className="btn-pop w-full bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-3.5 font-display text-lg font-extrabold text-white shadow-lg shadow-pop-purple/25 disabled:opacity-40"
            >
              {suaVez ? '🎲 Rolar dado' : 'Aguarde a sua vez…'}
            </button>
          )}

          {!rolando && narração && (
            <p className="rounded-field bg-ink-900 px-3 py-2 text-center text-sm font-semibold text-cream ring-1 ring-ink-700">
              {narração}
            </p>
          )}

          {/* legenda das casas especiais — o que cada desafio faz */}
          <div className="w-full rounded-field bg-ink-900 p-2.5 text-[11px] ring-1 ring-ink-700">
            <p className="mb-1 font-display font-bold text-cream">O que cada casa faz</p>
            <ul className="flex flex-col gap-0.5 text-text-muted">
              <li>🪿 <b className="text-pop-green">Ganso</b>: avança de novo o mesmo valor</li>
              <li>🌉 <b className="text-pop-cyan">Ponte</b>: atalho pra frente</li>
              <li>🏨 <b className="text-pop-cyan">Estalagem</b>: perde 1 rodada</li>
              <li>🕳️ <b className="text-pop-cyan">Poço</b>: perde 2 rodadas</li>
              <li>🌀 <b className="text-pop-cyan">Labirinto</b>: recua um trecho</li>
              <li>💀 <b className="text-pop-magenta">Caveira</b>: volta à largada</li>
              <li>🏁 <b className="text-pop-yellow">Chegada</b>: casa 63, no centro</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
