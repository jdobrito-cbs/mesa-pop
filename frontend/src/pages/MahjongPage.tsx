import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  gerarMahjong,
  MAHJONG_BASE_PONTOS,
  movimentosPossiveis,
  reembaralhar,
  slotsLivres,
  tilesMatch,
  type MahjongDeal,
  type MahjongDificuldade,
  type MahjongTile,
} from '@mesapop/shared'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import AdSlot from '../components/AdSlot'
import FullscreenButton from '../components/FullscreenButton'

/**
 * Mahjong Solitaire — combine pares de peças LIVRES até esvaziar a mesa. Cada
 * partida traz um agrupamento novo e sempre resolvível. Peças em SVG (naipes
 * de pontos e bambus desenhados; caracteres/ventos/dragões em glifos). 3 níveis
 * e ranking validado no servidor.
 */

const DIFS: Array<{ id: MahjongDificuldade; nome: string; icone: string; desc: string }> = [
  { id: 'facil', nome: 'Fácil', icone: '🀄', desc: '2 camadas — bom para pegar o jeito.' },
  { id: 'medio', nome: 'Médio', icone: '🀄', desc: '3 camadas — o clássico da pirâmide.' },
  { id: 'dificil', nome: 'Difícil', icone: '🀄', desc: '4 camadas — bem empilhado, exige planejar.' },
]

// dimensões da peça (px) e da meia-célula
const TW = 42
const TH = 56
const HUX = TW / 2
const HUY = TH / 2
const LIFT = 5

const CJK = '"Segoe UI","Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Hiragino Sans",sans-serif'

interface LeaderRow {
  rank: number
  userId: string
  displayName: string
  points: number
}

/** posições num grid 3×3 (col,row) para pontos/bambus conforme a quantidade */
const GRID: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [[1, 0], [1, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  7: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 0], [2, 1], [2, 2]],
  8: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
  9: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
}
const AX = 9
const AY = 8
const AW = 24
const AH = 40
const gx = (c: number) => AX + (c * AW) / 2
const gy = (r: number) => AY + (r * AH) / 2

/** arte do naipe dentro da face da peça */
function ArteNaipe({ tile }: { tile: MahjongTile }) {
  const { suit, rank } = tile
  if (suit === 'dot') {
    const raio = rank <= 4 ? 5 : rank <= 6 ? 4.3 : 3.7
    return (
      <g>
        {GRID[rank]!.map(([c, r], i) => (
          <g key={i}>
            <circle cx={gx(c)} cy={gy(r)} r={raio} fill="#fff" stroke="#1f6f8b" strokeWidth={1.6} />
            <circle cx={gx(c)} cy={gy(r)} r={raio * 0.42} fill="#b3271f" />
          </g>
        ))}
      </g>
    )
  }
  if (suit === 'bam') {
    const h = rank <= 4 ? 12 : rank <= 6 ? 10 : 8.5
    return (
      <g>
        {GRID[rank]!.map(([c, r], i) => {
          const x = gx(c)
          const y = gy(r)
          return (
            <g key={i}>
              <rect x={x - 2} y={y - h / 2} width={4} height={h} rx={2} fill="#2f8f4e" />
              <rect x={x - 2} y={y - 1} width={4} height={2} fill="#f5f0e1" />
              <circle cx={x} cy={y - h / 2} r={1.4} fill="#1f7a3d" />
            </g>
          )
        })}
      </g>
    )
  }
  if (suit === 'char') {
    const num = ['一', '二', '三', '四', '五', '六', '七', '八', '九'][rank - 1]
    return (
      <g fontFamily={CJK} textAnchor="middle" fontWeight={700}>
        <text x={21} y={24} fontSize={18} fill="#16233a">{num}</text>
        <text x={21} y={47} fontSize={17} fill="#b3271f">萬</text>
      </g>
    )
  }
  if (suit === 'wind') {
    const g = ['東', '南', '西', '北'][rank - 1]
    return (
      <text x={21} y={38} fontSize={26} fontFamily={CJK} textAnchor="middle" fontWeight={700} fill="#16407a">
        {g}
      </text>
    )
  }
  if (suit === 'dragon') {
    if (rank === 3) {
      // dragão branco: moldura azul (peça "vazia")
      return (
        <g fill="none" stroke="#16407a" strokeWidth={2}>
          <rect x={8} y={9} width={26} height={38} rx={3} />
          <rect x={12} y={13} width={18} height={30} rx={2} strokeWidth={1.3} />
        </g>
      )
    }
    return (
      <text x={21} y={38} fontSize={26} fontFamily={CJK} textAnchor="middle" fontWeight={700} fill={rank === 1 ? '#b3271f' : '#1f7a3d'}>
        {rank === 1 ? '中' : '發'}
      </text>
    )
  }
  if (suit === 'flower') {
    const cor = ['#e75a7c', '#d94f2b', '#b072d1', '#d19a2b'][rank - 1]!
    return (
      <g>
        {[0, 72, 144, 216, 288].map((a) => {
          const rad = (a * Math.PI) / 180
          return (
            <ellipse
              key={a}
              cx={21 + Math.cos(rad) * 7}
              cy={27 + Math.sin(rad) * 7}
              rx={5}
              ry={7.5}
              fill={cor}
              opacity={0.9}
              transform={`rotate(${a} ${21 + Math.cos(rad) * 7} ${27 + Math.sin(rad) * 7})`}
            />
          )
        })}
        <circle cx={21} cy={27} r={4} fill="#f4d03f" />
      </g>
    )
  }
  // season
  const cor = ['#2f8f4e', '#e0a021', '#cf6a2b', '#3a86c9'][rank - 1]!
  const g = ['春', '夏', '秋', '冬'][rank - 1]
  return (
    <g>
      <circle cx={21} cy={27} r={13} fill={cor} opacity={0.18} />
      <text x={21} y={35} fontSize={20} fontFamily={CJK} textAnchor="middle" fontWeight={700} fill={cor}>
        {g}
      </text>
    </g>
  )
}

/** a peça inteira (bloco 3D + face + arte) */
function Peca({ tile }: { tile: MahjongTile }) {
  return (
    <svg width={TW} height={TH + 4} viewBox={`0 0 ${TW} ${TH + 4}`} className="block">
      {/* espessura (lábia inferior/direita) */}
      <rect x={1.5} y={4} width={TW - 3} height={TH - 2} rx={6} fill="#c4b896" />
      {/* face */}
      <rect x={1} y={0.5} width={TW - 2} height={TH - 2} rx={6} fill="#faf6ea" stroke="#e2d8bd" strokeWidth={1} />
      <rect x={2.5} y={2} width={TW - 5} height={10} rx={4} fill="#ffffff" opacity={0.5} />
      <ArteNaipe tile={tile} />
    </svg>
  )
}

export default function MahjongPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuest = !!user?.isGuest
  const [deal, setDeal] = useState<MahjongDeal | null>(null)
  const [tiles, setTiles] = useState<MahjongTile[]>([])
  const [removidas, setRemovidas] = useState<Set<number>>(new Set())
  const [sel, setSel] = useState<number | null>(null)
  const [tremendo, setTremendo] = useState<number | null>(null)
  const [dica, setDica] = useState<[number, number] | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [dicasUsadas, setDicasUsadas] = useState(0)
  const [reembs, setReembs] = useState(0)
  const [fim, setFim] = useState<{ points: number; rank?: number; best?: number } | null>(null)
  const startRef = useRef(Date.now())
  const matchRef = useRef<string | null>(null)
  const fsRef = useRef<HTMLElement>(null)
  const { data: board, reload } = useFetch<{ rows: LeaderRow[] }>('/api/leaderboards/mahjong')

  const comeca = useCallback(
    (dif: MahjongDificuldade) => {
      const d = gerarMahjong(`${Date.now()}-${Math.random()}`, dif)
      setDeal(d)
      setTiles(d.tiles)
      setRemovidas(new Set())
      setSel(null)
      setDica(null)
      setSegundos(0)
      setDicasUsadas(0)
      setReembs(0)
      setFim(null)
      startRef.current = Date.now()
      matchRef.current = null
      if (!isGuest) {
        void api<{ matchId: string }>('/api/solo/start', { body: { gameSlug: 'mahjong' } })
          .then((r) => (matchRef.current = r.matchId))
          .catch(() => {})
      }
    },
    [isGuest],
  )

  const livres = useMemo(
    () => (deal ? new Set(slotsLivres(deal.slots, removidas)) : new Set<number>()),
    [deal, removidas],
  )

  const fecha = useCallback(() => {
    if (!deal) return
    const secs = Math.floor((Date.now() - startRef.current) / 1000)
    const total = Math.max(MAHJONG_BASE_PONTOS[deal.dificuldade] - secs * 2 - dicasUsadas * 40 - reembs * 120, 100)
    setFim({ points: total })
    const matchId = matchRef.current
    if (matchId) {
      void api<{ points: number; best: number; rank: number }>('/api/solo/finish', { body: { matchId, points: total } })
        .then((r) => {
          setFim({ points: r.points, rank: r.rank, best: r.best })
          void reload()
        })
        .catch(() => {})
    }
  }, [deal, dicasUsadas, reembs, reload])

  const removerPar = useCallback(
    (a: number, b: number) => {
      if (!deal) return
      setRemovidas((old) => {
        const nova = new Set(old)
        nova.add(a)
        nova.add(b)
        if (nova.size === deal.slots.length) setTimeout(fecha, 50)
        return nova
      })
      setSel(null)
      setDica(null)
    },
    [deal, fecha],
  )

  function clique(id: number) {
    if (!deal || fim || removidas.has(id) || !livres.has(id)) return
    if (sel === id) return setSel(null)
    if (sel === null) return setSel(id)
    if (tilesMatch(tiles[sel]!, tiles[id]!)) {
      removerPar(sel, id)
    } else {
      setTremendo(id)
      setTimeout(() => setTremendo(null), 400)
      setSel(id)
    }
  }

  function pedeDica() {
    if (!deal) return
    const pares = movimentosPossiveis({ ...deal, tiles }, removidas)
    if (!pares.length) return
    setDica(pares[Math.floor(Math.random() * pares.length)]!)
    setDicasUsadas((n) => n + 1)
    setTimeout(() => setDica(null), 1600)
  }

  function embaralha() {
    if (!deal) return
    const novo = reembaralhar({ ...deal, tiles }, removidas, `${Date.now()}-${Math.random()}`)
    setTiles(novo)
    setSel(null)
    setDica(null)
    setReembs((n) => n + 1)
  }

  const semJogadas = useMemo(
    () => deal && !fim && removidas.size < deal.slots.length && movimentosPossiveis({ ...deal, tiles }, removidas).length === 0,
    [deal, tiles, removidas, fim],
  )

  // hook de dev para a demo automatizada
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__mahjong = deal
        ? { deal: { ...deal, tiles }, removidas: [...removidas], livres: [...livres], jogar: removerPar }
        : null
    }
  }, [deal, tiles, removidas, livres, removerPar])

  useEffect(() => {
    if (!deal || fim) return
    const t = setInterval(() => setSegundos(Math.floor((Date.now() - startRef.current) / 1000)), 500)
    return () => clearInterval(t)
  }, [deal, fim])

  if (!deal) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-extrabold"><span aria-hidden="true">🀄</span> Mahjong</h1>
        <p className="mt-1 text-text-muted">
          Combine pares de peças livres até esvaziar a mesa. Cada partida é um agrupamento novo — escolha o nível:
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {DIFS.map((d) => (
            <button
              key={d.id}
              onClick={() => comeca(d.id)}
              className="card p-5 text-left transition hover:-translate-y-1 hover:ring-pop-green/60"
            >
              <p className="text-3xl" aria-hidden="true">{d.icone}</p>
              <p className="mt-2 font-display text-lg font-bold">{d.nome}</p>
              <p className="mt-1 text-sm text-text-muted">{d.desc}</p>
            </button>
          ))}
        </div>
        <AdSlot className="mt-8" />
      </main>
    )
  }

  const maxLayer = Math.max(...deal.slots.map((s) => s.layer))
  const boardW = deal.largura * HUX + maxLayer * LIFT + 8
  const boardH = deal.altura * HUY + maxLayer * LIFT + 10
  const ordenadas = [...deal.slots].sort((a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x)
  const restam = deal.slots.length - removidas.size

  return (
    <main ref={fsRef} className="game-fs mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">🀄</span> Mahjong · {DIFS.find((d) => d.id === deal.dificuldade)?.nome}
        </h1>
        <div className="flex flex-wrap gap-2">
          <FullscreenButton targetRef={fsRef} />
          <button onClick={pedeDica} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-yellow">
            💡 Dica
          </button>
          <button onClick={embaralha} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
            🔀 Reembaralhar
          </button>
          <button onClick={() => setDeal(null)} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-purple">
            Trocar nível
          </button>
          <button onClick={() => navigate('/mesa')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Voltar à mesa
          </button>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="mb-3 flex items-center justify-center gap-5 text-sm font-bold">
            <span>⏱️ <span className="tabular-nums">{segundos}s</span></span>
            <span>🀫 restam <span className="tabular-nums">{restam}</span></span>
            <span>💡 {dicasUsadas}</span>
          </div>

          <div className="relative overflow-auto rounded-card bg-gradient-to-br from-[#1f7a52] to-[#155f3f] p-3 ring-2 ring-ink-700">
            <div className="relative mx-auto" style={{ width: boardW, height: boardH }}>
              {ordenadas.map((s) => {
                if (removidas.has(s.id)) return null
                const livre = livres.has(s.id)
                const isSel = sel === s.id
                const isDica = dica?.[0] === s.id || dica?.[1] === s.id
                const left = maxLayer * LIFT + s.x * HUX - s.layer * LIFT
                const top = maxLayer * LIFT + s.y * HUY - s.layer * LIFT
                return (
                  <button
                    key={s.id}
                    onClick={() => clique(s.id)}
                    aria-label={`peça ${s.id}`}
                    className={`absolute rounded-[7px] transition ${tremendo === s.id ? 'animate-pulse' : ''} ${
                      livre ? 'cursor-pointer hover:brightness-105' : 'brightness-[0.72] saturate-[0.85]'
                    }`}
                    style={{
                      left,
                      top,
                      zIndex: s.layer * 10000 + s.y * 100 + s.x,
                      pointerEvents: livre ? 'auto' : 'none',
                      boxShadow: isSel
                        ? '0 0 0 3px #f4d03f, 0 3px 6px rgba(0,0,0,.4)'
                        : isDica
                          ? '0 0 0 3px #2fd0c8, 0 3px 6px rgba(0,0,0,.4)'
                          : '0 2px 4px rgba(0,0,0,.35)',
                    }}
                  >
                    <Peca tile={tiles[s.id]!} />
                  </button>
                )
              })}
            </div>

            {semJogadas && (
              <div className="absolute inset-0 z-[99999] flex flex-col items-center justify-center gap-3 rounded-card bg-ink-950/80">
                <p className="text-4xl" aria-hidden="true">🤔</p>
                <p className="font-display text-xl font-extrabold text-pop-yellow">Sem jogadas livres!</p>
                <button onClick={embaralha} className="btn-pop bg-gradient-to-br from-pop-cyan to-pop-green px-6 py-3 text-white">
                  🔀 Reembaralhar as peças
                </button>
              </div>
            )}

            {fim && (
              <div className="absolute inset-0 z-[99999] flex flex-col items-center justify-center gap-3 rounded-card bg-ink-950/85">
                <p className="text-5xl" aria-hidden="true">🀄</p>
                <p className="font-display text-3xl font-extrabold text-pop-green">Mesa limpa!</p>
                <p className="font-display text-2xl font-extrabold text-pop-yellow">{fim.points} pts</p>
                {fim.rank && <p className="text-sm text-text-muted">posição {fim.rank}º no ranking</p>}
                {isGuest && <p className="text-sm text-text-muted">Convidados não pontuam no ranking.</p>}
                <button onClick={() => setDeal(null)} className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3 text-white">
                  Jogar outro
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-text-muted">
            Só peças LIVRES (sem peça em cima e com um lado aberto) podem ser escolhidas. Flores casam com flores; estações com estações.
          </p>
        </div>

        <div className="card p-4">
          <p className="font-display text-sm font-bold">🏆 Ranking (30 dias)</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {!board?.rows.length && <p className="text-sm text-text-muted">Limpe uma mesa e abra o placar!</p>}
            {board?.rows.map((row) => (
              <div key={row.userId} className="flex items-center gap-2 rounded-field bg-ink-900 px-3 py-1.5 text-sm ring-1 ring-ink-700">
                <span className={`w-7 font-display font-extrabold ${row.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>{row.rank}º</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{row.displayName}</span>
                <span className="font-bold text-pop-cyan tabular-nums">{row.points}</span>
              </div>
            ))}
          </div>
          <AdSlot className="mt-4" />
        </div>
      </div>
    </main>
  )
}
