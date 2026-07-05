import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import type { DesenhaStroke, DesenhaView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Desenha & Adivinha — tela estilo gartic: lista de jogadores com pontos
 * (lápis no desenhista), DICA com tracinhos, canvas de desenho e o chat
 * de RESPOSTAS — o ÚNICO chat deste jogo. Palpite certo vira
 * "✓ Fulana acertou!" (a palavra nunca aparece); o campo de quem acertou
 * trava em "Você acertou!".
 */

const CORES = ['#140E26', '#E8455A', '#FF8244', '#FFC53D', '#55E07F', '#33E0D6', '#9D5CFF', '#F252C1']
const TAMANHOS = [4, 9, 16]
const CANVAS_W = 1000
const CANVAS_H = 640

export default function DesenhaGame({
  view,
  yourSeat,
  players,
}: {
  view: DesenhaView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cor, setCor] = useState(CORES[0]!)
  const [tamanho, setTamanho] = useState(TAMANHOS[1]!)
  const [palavra, setPalavra] = useState('')
  const [palpite, setPalpite] = useState('')
  const [aviso, setAviso] = useState('')
  const respostasRef = useRef<HTMLDivElement>(null)

  // traços locais do desenhista (zero lag) — zera quando a rodada muda
  const localRef = useRef<DesenhaStroke[]>([])
  const currentRef = useRef<DesenhaStroke | null>(null)
  const flushRef = useRef<number[]>([])
  const roundKey = `${view.rodada}-${view.desenhistaSeat}`
  const lastRound = useRef(roundKey)

  const souDesenhista = yourSeat === view.desenhistaSeat
  const acertei = view.acertaram.includes(yourSeat)
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`

  if (lastRound.current !== roundKey) {
    lastRound.current = roundKey
    localRef.current = []
    currentRef.current = null
    setPalavra('')
    setPalpite('')
  }

  // envia os pontos acumulados do traço em lotes (~10Hz)
  useEffect(() => {
    if (!souDesenhista) return
    const timer = setInterval(() => {
      const pts = flushRef.current
      if (pts.length >= 4) {
        flushRef.current = pts.slice(-2) // continuidade do traço
        void emitAck('game:action', {
          action: { type: 'traco', color: currentRef.current?.color ?? cor, size: currentRef.current?.size ?? tamanho, pts },
        })
      }
    }, 100)
    return () => clearInterval(timer)
  }, [souDesenhista, cor, tamanho])

  // desenha tudo (servidor + locais) a cada mudança
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    const render = () => {
      ctx.fillStyle = '#FFF9F0'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      const all = souDesenhista
        ? [...localRef.current, ...(currentRef.current ? [currentRef.current] : [])]
        : view.strokes
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const s of all) {
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.size
        ctx.beginPath()
        for (let i = 0; i + 1 < s.pts.length; i += 2) {
          const x = (s.pts[i]! / 1000) * CANVAS_W
          const y = (s.pts[i + 1]! / 1000) * CANVAS_H
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      raf = requestAnimationFrame(render)
    }
    render()
    return () => cancelAnimationFrame(raf)
  }, [view.strokes, souDesenhista])

  // rola o chat de respostas para o fim
  useEffect(() => {
    respostasRef.current?.scrollTo({ top: respostasRef.current.scrollHeight })
  }, [view.respostas.length])

  function coords(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return [
      Math.round(((e.clientX - rect.left) / rect.width) * 1000),
      Math.round(((e.clientY - rect.top) / rect.height) * 1000),
    ] as const
  }

  function down(e: PointerEvent<HTMLCanvasElement>) {
    if (!souDesenhista || view.fase !== 'desenhando') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const [x, y] = coords(e)
    currentRef.current = { color: cor, size: tamanho, pts: [x, y] }
    flushRef.current = [x, y]
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!currentRef.current) return
    const [x, y] = coords(e)
    currentRef.current.pts.push(x, y)
    flushRef.current.push(x, y)
  }

  function up() {
    if (!currentRef.current) return
    const pts = flushRef.current
    if (pts.length >= 2) {
      void emitAck('game:action', {
        action: { type: 'traco', color: currentRef.current.color, size: currentRef.current.size, pts },
      })
    }
    localRef.current.push(currentRef.current)
    currentRef.current = null
    flushRef.current = []
  }

  async function enviarPalavra(e: FormEvent) {
    e.preventDefault()
    const res = await emitAck('game:action', { action: { type: 'palavra', palavra } })
    if (!res.ok) mostraAviso(res.error)
  }

  async function enviarPalpite(e: FormEvent) {
    e.preventDefault()
    if (!palpite.trim()) return
    const res = await emitAck('game:action', { action: { type: 'palpite', texto: palpite } })
    if (!res.ok) mostraAviso(res.error)
    setPalpite('')
  }

  function mostraAviso(msg?: string) {
    setAviso(msg ?? 'Não deu — tente de novo')
    setTimeout(() => setAviso(''), 2500)
  }

  async function limpar() {
    localRef.current = []
    await emitAck('game:action', { action: { type: 'limpar' } })
  }

  const tempoPct = view.fase === 'desenhando' ? (view.tempo / 180) * 100 : 100

  return (
    <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
      {/* jogadores — lápis no desenhista, ✓ em quem acertou */}
      <div className="card flex flex-row gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
        {players
          .slice()
          .sort((a, b) => (view.scores[b.seat] ?? 0) - (view.scores[a.seat] ?? 0))
          .map((p) => (
            <div
              key={p.seat}
              className={`flex min-w-36 items-center gap-2 rounded-field px-3 py-2 ring-1 ${
                p.seat === view.desenhistaSeat ? 'bg-pop-purple/20 ring-pop-purple/50' : 'bg-ink-900 ring-ink-700'
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                {p.seat === view.desenhistaSeat ? '✏️' : view.acertaram.includes(p.seat) ? '✅' : '🙂'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {p.name}
                  {p.seat === yourSeat ? ' (você)' : ''}
                </p>
                <p className="text-xs font-bold text-pop-cyan tabular-nums">{view.scores[p.seat] ?? 0} pts</p>
              </div>
            </div>
          ))}
        <p className="hidden text-center text-xs text-text-muted lg:block">
          rodada {view.rodada}/{view.totalRodadas}
        </p>
      </div>

      <div>
        {/* DICA + tempo */}
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="rounded-2xl bg-ink-800 px-4 py-2 ring-1 ring-ink-700">
            <p className="text-[10px] font-extrabold tracking-widest text-pop-yellow uppercase">dica</p>
            <p className="font-mono text-lg font-bold tracking-widest">
              {view.fase === 'escolhendo'
                ? souDesenhista
                  ? 'escolha a palavra!'
                  : `${nameOf(view.desenhistaSeat)} está escolhendo…`
                : (view.palavra ?? view.dica ?? '')}
            </p>
          </div>
          {view.fase === 'desenhando' && (
            <span className="rounded-full bg-ink-950/80 px-4 py-2 font-display text-xl font-extrabold text-pop-yellow tabular-nums">
              ⏱ {view.tempo}s
            </span>
          )}
        </div>

        {/* tela de desenho */}
        <div className="relative overflow-hidden rounded-card ring-2 ring-ink-700">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className={`block w-full bg-cream touch-none ${souDesenhista && view.fase === 'desenhando' ? 'cursor-crosshair' : ''}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            aria-label="Tela de desenho"
          />
          {/* barra de tempo */}
          <div className="absolute right-0 bottom-0 left-0 h-1.5 bg-ink-950/20">
            <div
              className="h-full bg-gradient-to-r from-pop-orange to-pop-yellow transition-[width] duration-1000 ease-linear"
              style={{ width: `${tempoPct}%` }}
            />
          </div>

          {/* desenhista escolhe a palavra */}
          {view.fase === 'escolhendo' && souDesenhista && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
              <form onSubmit={enviarPalavra} className="card flex w-80 flex-col gap-3 p-5">
                <p className="text-center font-display text-lg font-bold">✏️ Sua vez de desenhar!</p>
                <input
                  className="field text-center"
                  placeholder="Digite a palavra secreta"
                  value={palavra}
                  maxLength={30}
                  onChange={(e) => setPalavra(e.target.value)}
                  aria-label="Palavra secreta"
                />
                <button
                  disabled={palavra.trim().length < 2}
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-2.5 text-white disabled:opacity-50"
                >
                  Desenhar!
                </button>
                <p className="text-center text-xs text-text-muted">Ninguém vê a palavra — só o seu desenho. ⏱ {view.tempo}s</p>
              </form>
            </div>
          )}
          {view.fase === 'escolhendo' && !souDesenhista && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60">
              <p className="animate-pulse font-display text-2xl font-extrabold text-cream">
                ✏️ {nameOf(view.desenhistaSeat)} está escolhendo a palavra…
              </p>
            </div>
          )}
          {/* revelação */}
          {view.fase === 'revelacao' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-950/75">
              <p className="text-sm font-bold tracking-widest text-text-muted uppercase">a palavra era</p>
              <p className="font-display text-4xl font-extrabold text-pop-yellow">{view.palavra}</p>
              <p className="text-sm text-text-muted">
                {view.acertaram.length
                  ? `${view.acertaram.length} ${view.acertaram.length === 1 ? 'pessoa acertou' : 'pessoas acertaram'}!`
                  : 'Ninguém acertou dessa vez 😅'}
              </p>
            </div>
          )}
        </div>

        {/* ferramentas do desenhista */}
        {souDesenhista && view.fase === 'desenhando' && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                aria-label={`cor ${c}`}
                className={`size-8 rounded-full ring-2 transition ${cor === c ? 'scale-110 ring-cream' : 'ring-ink-700'}`}
                style={{ background: c }}
              />
            ))}
            <button
              onClick={() => setCor('#FFF9F0')}
              aria-label="borracha"
              className={`flex size-8 items-center justify-center rounded-full bg-cream text-sm ring-2 ${cor === '#FFF9F0' ? 'scale-110 ring-pop-magenta' : 'ring-ink-700'}`}
            >
              🧽
            </button>
            <span className="mx-1 h-6 w-px bg-ink-700" />
            {TAMANHOS.map((t) => (
              <button
                key={t}
                onClick={() => setTamanho(t)}
                aria-label={`pincel ${t}`}
                className={`flex size-8 items-center justify-center rounded-full ring-2 ${tamanho === t ? 'ring-pop-cyan' : 'ring-ink-700'}`}
              >
                <span className="rounded-full bg-cream" style={{ width: t, height: t }} />
              </button>
            ))}
            <button onClick={() => void limpar()} className="btn-pop ml-auto px-4 py-1.5 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
              Limpar tudo
            </button>
          </div>
        )}

        {/* RESPOSTAS — o único chat deste jogo */}
        <div className="card mt-3">
          <p className="border-b border-ink-700 px-4 py-2 font-display text-sm font-bold text-pop-cyan">
            RESPOSTAS
          </p>
          <div ref={respostasRef} className="h-40 space-y-1 overflow-y-auto px-4 py-2" aria-live="polite">
            {view.respostas.length === 0 && (
              <p className="text-sm text-text-muted">Os palpites aparecem aqui — chute sem medo!</p>
            )}
            {view.respostas.map((r, i) =>
              r.acertou ? (
                <p key={i} className="text-sm font-extrabold text-pop-green">
                  ✔ {nameOf(r.seat)} acertou!
                </p>
              ) : (
                <p key={i} className="text-sm">
                  <span className="font-bold text-text-muted">{nameOf(r.seat)}</span>{' '}
                  <span className="break-words">{r.text}</span>
                </p>
              ),
            )}
          </div>
          {aviso && <p className="px-4 pb-1 text-xs font-semibold text-pop-orange">{aviso}</p>}
          <div className="border-t border-ink-700 p-3">
            {yourSeat < 0 ? (
              <p className="text-center text-xs text-text-muted">Assistindo ao vivo 👀</p>
            ) : souDesenhista ? (
              <p className="text-center text-xs text-text-muted">Você é quem desenha — capriche no traço! ✏️</p>
            ) : acertei ? (
              <p className="rounded-field bg-pop-green/15 px-4 py-2 text-center text-sm font-extrabold text-pop-green">
                🖊 Você acertou!
              </p>
            ) : (
              <form onSubmit={enviarPalpite} className="flex gap-2">
                <input
                  className="field flex-1 py-2 text-sm"
                  placeholder="Responda aqui…"
                  maxLength={60}
                  value={palpite}
                  onChange={(e) => setPalpite(e.target.value)}
                  aria-label="Seu palpite"
                  disabled={view.fase !== 'desenhando'}
                />
                <button
                  disabled={!palpite.trim() || view.fase !== 'desenhando'}
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Enviar
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
