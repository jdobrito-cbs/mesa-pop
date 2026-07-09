import { useEffect, useMemo, useRef, useState } from 'react'
import { casaInfo, GANSO_FIM, type GansoState } from '@mesapop/shared'

/**
 * Corrida do Ganso — trilha em espiral que coila de fora para dentro (estilo
 * clássico do Jogo do Ganso), com o MIOLO ABERTO no centro (medalhão). Estado
 * vem do servidor; os dados são sorteados lá. Peões pulam de casa em casa.
 */

const COLS = 9
const ROWS = 8
const CELL = 58

const CORES = ['bg-pop-magenta', 'bg-pop-cyan', 'bg-pop-yellow', 'bg-pop-green']
const CORES_HEX = ['#ff3ea5', '#22d3ee', '#facc15', '#34d399']

/** espiral retangular: perímetro → anéis internos. Devolve TODOS os slots; o
 * jogo usa os 64 primeiros e o resto (miolo) vira o medalhão central. */
function espiralRect(cols: number, rows: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let top = 0
  let bottom = rows - 1
  let left = 0
  let right = cols - 1
  while (out.length < cols * rows) {
    for (let c = left; c <= right; c++) out.push([c, top])
    top++
    for (let r = top; r <= bottom; r++) out.push([right, r])
    right--
    if (top <= bottom) {
      for (let c = right; c >= left; c--) out.push([c, bottom])
      bottom--
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) out.push([left, r])
      left++
    }
  }
  return out
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
  const raw = useMemo(() => espiralRect(COLS, ROWS), [])
  const coords = raw.slice(0, GANSO_FIM + 1) // casas 0..63
  const suaVez = state.turn === yourSeat && state.winner === null
  const boardW = COLS * CELL
  const boardH = ROWS * CELL
  // miolo (slots não usados) → onde fica o medalhão central
  const miolo = raw.slice(GANSO_FIM + 1)
  const cCols = miolo.map((c) => c[0])
  const cRows = miolo.map((c) => c[1])
  // a numeração começa pela BASE (casa 1 embaixo), como no tabuleiro clássico
  const ty = (row: number) => (ROWS - 1 - row) * CELL
  const medalhao = miolo.length
    ? {
        left: Math.min(...cCols) * CELL + 6,
        top: ty(Math.max(...cRows)) + 6,
        width: (Math.max(...cCols) - Math.min(...cCols) + 1) * CELL - 12,
        height: (Math.max(...cRows) - Math.min(...cRows) + 1) * CELL - 12,
      }
    : null

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
        {/* tabuleiro — trilha de madeira coilando na grama, cercada por pedras */}
        <div
          className="overflow-auto rounded-[26px] p-4"
          style={{
            // calçada de pedrinhas (borda) — desenhada em CSS
            backgroundColor: '#6f6a60',
            backgroundImage:
              'radial-gradient(circle at 30% 32%, #d2cabb 0 26%, #a59c8c 42%, transparent 56%), radial-gradient(circle at 72% 70%, #c3baa9 0 24%, #948b7b 40%, transparent 54%)',
            backgroundSize: '20px 20px, 24px 24px',
            backgroundPosition: '0 0, 11px 9px',
            boxShadow: 'inset 0 0 0 2px #4f4a42, 0 8px 22px rgba(0,0,0,.5)',
          }}
        >
          <div
            className="rounded-[14px] p-2"
            style={{
              background: 'radial-gradient(circle at 50% 42%, #5aa85e, #3c7a44 72%, #2c5e37)',
              boxShadow: 'inset 0 0 16px rgba(0,0,0,.35)',
            }}
          >
            <div className="relative" style={{ width: boardW, height: boardH }}>
            {coords.map(([col, row], pos) => {
              const info = casaInfo(pos)
              const icone = ICONE[info.tipo]
              const inicio = pos === 0
              const cor =
                info.tipo === 'fim'
                  ? '#f4d03f'
                  : info.tipo === 'ganso'
                    ? '#34d399'
                    : info.tipo === 'caveira'
                      ? '#ff3ea5'
                      : info.tipo === 'labirinto'
                        ? '#a855f7'
                        : info.tipo === 'poco'
                          ? '#64748b'
                          : info.tipo === 'estalagem'
                            ? '#fb923c'
                            : info.tipo === 'ponte'
                              ? '#22d3ee'
                              : null
              return (
                <div
                  key={pos}
                  className="absolute flex flex-col items-center justify-center"
                  style={{
                    left: col * CELL + 3,
                    top: ty(row) + 3,
                    width: CELL - 6,
                    height: CELL - 6,
                    borderRadius: 10,
                    background: inicio
                      ? 'linear-gradient(155deg,#8fd694,#4f9e57)'
                      : 'linear-gradient(155deg,#e2b878,#b17f47)',
                    border: `2px solid ${cor ?? '#6f4d29'}`,
                    boxShadow: cor
                      ? `inset 0 1px 0 rgba(255,255,255,.4), 0 0 8px ${cor}88`
                      : 'inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 3px rgba(0,0,0,.22)',
                  }}
                  title={`casa ${pos}`}
                >
                  {/* número no cantinho */}
                  <span
                    className="absolute left-1 top-0.5 text-[10px] font-extrabold leading-none"
                    style={{ color: cor ?? '#4a3218' }}
                  >
                    {inicio ? '▶' : pos}
                  </span>
                  {icone ? (
                    <span className="mt-1.5 text-xl leading-none drop-shadow">{icone}</span>
                  ) : (
                    <span className="text-base font-extrabold" style={{ color: '#4a3218' }}>
                      {pos}
                    </span>
                  )}
                </div>
              )
            })}

            {/* medalhão central */}
            {medalhao && (
              <div
                className="pointer-events-none absolute grid place-items-center rounded-full text-center"
                style={{
                  left: medalhao.left,
                  top: medalhao.top,
                  width: medalhao.width,
                  height: medalhao.height,
                  background: 'radial-gradient(circle at 40% 32%, #f6d98d, #cda15a 62%, #a97d3f)',
                  border: '3px solid #7a5a34',
                  boxShadow: 'inset 0 2px 5px rgba(255,255,255,.5), 0 4px 12px rgba(0,0,0,.45)',
                }}
              >
                <div>
                  <div className="text-3xl leading-none">🪿</div>
                  <div className="font-display text-[11px] font-extrabold tracking-wide text-[#5a3d1e]">
                    CORRIDA DO GANSO
                  </div>
                  <div className="text-[10px] font-bold text-[#7a5320]">chegue na casa 63</div>
                </div>
              </div>
            )}

            {/* peões */}
            {state.positions.map((pos, seat) => {
              const [col, row] = coords[pos]!
              const grupo = porCasa.get(pos) ?? [seat]
              const idx = grupo.indexOf(seat)
              const ox = (idx % 2) * 16 + 6
              const oy = Math.floor(idx / 2) * 16 + 8
              return (
                <div
                  key={seat}
                  className="pointer-events-none absolute grid place-items-center rounded-full text-[12px] shadow-lg ring-2 ring-white/80 transition-all duration-300"
                  style={{
                    left: col * CELL + ox,
                    top: ty(row) + oy,
                    width: 22,
                    height: 22,
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
