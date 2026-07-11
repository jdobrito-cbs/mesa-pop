import { useEffect, useRef, useState } from 'react'
import {
  PAREO_APOSTAS_FICHAS,
  PAREO_CAVALOS,
  PAREO_CORRIDA_MS,
  PAREO_FINISH,
  PAREO_ODDS,
  PAREO_TRACK_LEN,
  pareoBuildRace,
  pareoHorseAt,
  pareoRandom,
  type PareoCorrida,
  type PareoView,
} from '@mesapop/shared'
import { api, ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'

/**
 * Páreo (O "Corre" do Yvens) — porte fiel do protótipo do usuário.
 * FASE 2: apostas em fichas ligadas na UI. O servidor segue dono do ciclo
 * (apostas → pré-largada → corrida → cerimônia) e da seed; este componente
 * REPRODUZ a timeline localmente (relógio sincronizado pelo offset
 * `view.agora - Date.now()`) e fala com o backend só por REST
 * (POST /api/pareo/apostar, GET /api/pareo/minha) — o socket segue
 * carregando apenas o estado da corrida.
 */

/** aposta enxuta como devolvida por GET /api/pareo/minha */
interface PareoApostaResumo {
  numero: number
  lane: number
  valor: number
  odds: number
  resultado: 'pendente' | 'ganhou' | 'perdeu'
  payout: number
}
interface PareoMinhaResp {
  fichas: number
  atual: PareoApostaResumo | null
  ultima: PareoApostaResumo | null
}

const W = 960
const H = 260
const LANE_TOP = 54
const LANE_H = (H - LANE_TOP - 20) / PAREO_CAVALOS.length
/** quanto tempo o overlay do vencedor fica na tela (o resto da cerimônia
 * segue só com o pódio + confete, como no protótipo) */
const WINNER_SHOW_MS = 5700

interface DrawableHorse {
  cor: string
  lane: number
  x: number
  legT: number
}

interface ConfettiParticle {
  x0: number
  vy: number
  vx: number
  c: string
  s: number
  rot0: number
  startY: number
}

export default function PareoGame({ view }: { view: PareoView }) {
  const { user } = useAuth()
  const isGuest = !!user?.isGuest
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // relógio sincronizado: offset suavizado a cada view recebida
  const offsetRef = useRef(0)
  const syncedRef = useRef(false)
  useEffect(() => {
    const raw = view.agora - Date.now()
    offsetRef.current = syncedRef.current ? (offsetRef.current + raw) / 2 : raw
    syncedRef.current = true
  }, [view.agora])

  // sempre a view mais recente disponível dentro do loop de canvas
  const viewRef = useRef(view)
  viewRef.current = view

  // corrida local determinística — construída UMA vez por seed
  const raceRef = useRef<{ seed: number; race: PareoCorrida } | null>(null)
  if (view.seed !== null && raceRef.current?.seed !== view.seed) {
    raceRef.current = { seed: view.seed, race: pareoBuildRace(view.seed) }
  }

  // confete semeado uma vez por páreo, ao entrar na cerimônia
  const confettiRef = useRef<{ numero: number; particles: ConfettiParticle[] } | null>(null)
  if (view.fase === 'cerimonia' && confettiRef.current?.numero !== view.numero) {
    confettiRef.current = { numero: view.numero, particles: seedConfetti(view.numero) }
  }

  // favorito selecionado (local, sem aposta ainda) — zera a cada páreo novo
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null)
  const prevNumeroRef = useRef(view.numero)
  if (prevNumeroRef.current !== view.numero) {
    prevNumeroRef.current = view.numero
    setSelectedHorse(null)
  }

  // ===== carteira de fichas (FASE 2) =====
  const [fichas, setFichas] = useState<number | null>(null)
  const [apostaAtual, setApostaAtual] = useState<PareoApostaResumo | null>(null)
  const [ultimaAposta, setUltimaAposta] = useState<PareoApostaResumo | null>(null)
  const [valorEscolhido, setValorEscolhido] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [avisoErro, setAvisoErro] = useState<string | null>(null)

  // páreo novo (numero mudou): limpa a aposta local otimisticamente — o
  // efeito de troca de fase abaixo (que dispara junto) re-hidrata do servidor
  const prevNumeroApostaRef = useRef(view.numero)
  if (prevNumeroApostaRef.current !== view.numero) {
    prevNumeroApostaRef.current = view.numero
    setApostaAtual(null)
  }

  // busca GET /minha no mount e a cada MUDANÇA de fase (as próprias deps do
  // efeito garantem isso — nada de guard por ref, que quebrava no StrictMode:
  // a dupla montagem do dev cancelava o 1º fetch e pulava o 2º, deixando o
  // saldo sem hidratar). Ao ENTRAR na cerimônia, repete uma vez ~2,5s depois
  // se o resultado ainda não tiver sido liquidado a tempo.
  useEffect(() => {
    if (isGuest) return
    let cancelado = false
    ;(async () => {
      const r = await api<PareoMinhaResp>('/api/pareo/minha').catch(() => null)
      if (cancelado || !r) return
      setFichas(r.fichas)
      setApostaAtual(r.atual)
      setUltimaAposta(r.ultima)
      if (view.fase === 'cerimonia' && r.ultima?.numero !== view.numero) {
        await new Promise((resolve) => setTimeout(resolve, 2500))
        if (cancelado) return
        const r2 = await api<PareoMinhaResp>('/api/pareo/minha').catch(() => null)
        if (cancelado || !r2) return
        setFichas(r2.fichas)
        setApostaAtual(r2.atual)
        setUltimaAposta(r2.ultima)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [view.fase, view.numero, isGuest])

  async function confirmarAposta() {
    if (isGuest || enviando || apostaAtual || selectedHorse === null || valorEscolhido === null) return
    setEnviando(true)
    setAvisoErro(null)
    try {
      const r = await api<{ aposta: { lane: number; valor: number; odds: number }; fichas: number }>(
        '/api/pareo/apostar',
        { body: { numero: view.numero, lane: selectedHorse, valor: valorEscolhido } },
      )
      setFichas(r.fichas)
      setApostaAtual({
        numero: view.numero,
        lane: r.aposta.lane,
        valor: r.aposta.valor,
        odds: r.aposta.odds,
        resultado: 'pendente',
        payout: 0,
      })
    } catch (e) {
      setAvisoErro(e instanceof ApiRequestError ? e.message : 'Algo deu errado. Tente de novo.')
      setTimeout(() => setAvisoErro(null), 3000)
    } finally {
      setEnviando(false)
    }
  }

  // overlay "«nome» venceu" — aparece ao entrar na cerimônia e some sozinho
  const [winnerVisible, setWinnerVisible] = useState(false)
  const winnerNumeroRef = useRef<number | null>(null)
  useEffect(() => {
    if (view.fase !== 'cerimonia') {
      winnerNumeroRef.current = null
      return
    }
    if (winnerNumeroRef.current === view.numero) return
    winnerNumeroRef.current = view.numero
    setWinnerVisible(true)
    const cerimoniaComecoEm = view.largadaEm + PAREO_CORRIDA_MS
    const delay = Math.max(200, cerimoniaComecoEm + WINNER_SHOW_MS - (Date.now() + offsetRef.current))
    const id = setTimeout(() => setWinnerVisible(false), delay)
    return () => clearTimeout(id)
  }, [view.fase, view.numero, view.largadaEm])

  // tick de meio-em-meio segundo só para os relógios em texto (o canvas
  // anima por requestAnimationFrame, independente disso)
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  // loop de desenho — lê tudo por ref para nunca prender uma view velha
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const render = () => {
      raf = requestAnimationFrame(render)
      const v = viewRef.current
      const now = Date.now() + offsetRef.current
      const built = raceRef.current

      if (v.fase === 'corrida' && v.seed !== null && built && built.seed === v.seed) {
        const t = clamp((now - v.largadaEm) / PAREO_CORRIDA_MS, 0, 1)
        let front = 0
        const positioned: DrawableHorse[] = built.race.cavalos.map((c) => {
          const s = pareoHorseAt(c, t)
          if (s.x > front) front = s.x
          return { cor: c.cor, lane: c.lane, x: s.x, legT: s.legT }
        })
        const cameraX = Math.max(0, front - W * 0.58)
        drawTrack(ctx, cameraX)
        positioned.forEach((h) => drawHorse(ctx, h, cameraX))
      } else if (v.fase === 'cerimonia' && v.seed !== null && built && built.seed === v.seed) {
        drawTrack(ctx, 0)
        const cerimoniaComecoEm = v.largadaEm + PAREO_CORRIDA_MS
        const ceremonyT = Math.max(0, (now - cerimoniaComecoEm) / 1000)
        drawCeremony(ctx, built.race, ceremonyT, confettiRef.current?.particles ?? [])
      } else {
        // apostas/prelargada, ou 'corrida' que chegou antes da seed (atrasada)
        drawTrack(ctx, 0)
        drawIdleHorses(ctx)
      }
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  const now = Date.now() + offsetRef.current
  const faseTexto =
    view.fase === 'apostas'
      ? 'Apostas abertas'
      : view.fase === 'prelargada'
        ? 'Apostas encerradas'
        : view.fase === 'corrida'
          ? 'E LARGARAM!'
          : 'Chegada!'
  const apostaConfirmadaAgora =
    view.fase === 'apostas' && apostaAtual && apostaAtual.numero === view.numero ? apostaAtual : null
  const painelTitulo = apostaConfirmadaAgora
    ? `Apostou ${apostaConfirmadaAgora.valor} em ${PAREO_CAVALOS[apostaConfirmadaAgora.lane]!.nome} (${apostaConfirmadaAgora.odds.toFixed(1)}×) · boa sorte!`
    : view.fase === 'apostas'
      ? 'Escolha seu favorito'
      : view.fase === 'prelargada'
        ? 'Preparando a largada…'
        : view.fase === 'corrida'
          ? 'Corrida em andamento'
          : 'Pódio'
  const topClock = view.fase === 'apostas' ? `Fecha em ${fmt(view.faseFimEm - now)}` : ''
  const startClock =
    view.fase === 'apostas' || view.fase === 'prelargada' ? fmt(Math.max(0, view.largadaEm - now)) : '0:00'
  const vencedorCavalo = view.vencedor !== null ? PAREO_CAVALOS[view.vencedor] : null
  const vencedorOdds = view.vencedor !== null ? PAREO_ODDS[view.vencedor]! : null
  const resultadoPessoal =
    ultimaAposta && ultimaAposta.numero === view.numero && ultimaAposta.resultado !== 'pendente'
      ? ultimaAposta
      : null
  const podeApostar = view.fase === 'apostas' && !isGuest && !apostaAtual
  const podeConfirmar =
    podeApostar && selectedHorse !== null && valorEscolhido !== null && fichas !== null && valorEscolhido <= fichas

  return (
    <div className="mp-corrida mx-auto w-full max-w-3xl">
      <div className="card overflow-hidden p-3 sm:p-4">
        {/* pista */}
        <div className="relative overflow-hidden rounded-field ring-1 ring-[#3a2e23]" style={{ background: '#1e1813' }}>
          <div
            className={`absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full px-5 py-1.5 font-display text-lg font-extrabold tracking-widest whitespace-nowrap ring-1 ${
              view.fase === 'corrida' ? 'text-[#ff5747] ring-[#d63a2f]' : 'text-[#ffc04d] ring-[#3a2e23]'
            }`}
            style={{ background: 'rgba(20,16,12,0.78)' }}
          >
            <span>{faseTexto}</span>
            {topClock && <span className="font-mono text-sm font-normal tracking-normal text-[#f3e9d8]">{topClock}</span>}
          </div>

          <canvas ref={canvasRef} width={W} height={H} className="block w-full" style={{ aspectRatio: `${W} / ${H}` }} />

          {winnerVisible && vencedorCavalo && vencedorOdds !== null && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              style={{ background: 'radial-gradient(ellipse at center, rgba(20,16,12,0.35), rgba(20,16,12,0.82))' }}
            >
              <p className="text-[11px] font-bold tracking-[0.3em] text-[#ffc04d] uppercase">Vencedor do páreo</p>
              <p
                className="mt-1 font-display text-4xl font-extrabold text-[#f3e9d8]"
                style={{ textShadow: '0 4px 24px rgba(245,166,35,0.5)' }}
              >
                {vencedorCavalo.nome} venceu
              </p>
              {resultadoPessoal ? (
                resultadoPessoal.resultado === 'ganhou' ? (
                  <p className="mt-3 font-mono text-sm font-bold text-pop-green">
                    Você acertou e ganhou <b>+{resultadoPessoal.payout}</b> fichas 🎉
                  </p>
                ) : (
                  <p className="mt-3 font-mono text-sm font-bold text-[#ff5747]">
                    Você perdeu suas <b>{resultadoPessoal.valor}</b> fichas — próximo páreo em instantes!
                  </p>
                )
              ) : (
                <p className="mt-2 font-mono text-sm text-[#a08a6f]">
                  Cavalo #{view.vencedor! + 1} · pagou {vencedorOdds.toFixed(1)}×
                </p>
              )}
            </div>
          )}
        </div>

        {/* painel */}
        <div className="mt-4 rounded-field p-4 ring-1 ring-[#3a2e23]" style={{ background: '#1e1813' }}>
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <p className="font-display text-lg font-extrabold text-cream">{painelTitulo}</p>
            <p className="ml-auto font-mono text-xs text-[#a08a6f]">
              Início da corrida em <b className="text-[#ffc04d]">{startClock}</b>
            </p>
          </div>

          {isGuest ? (
            <p className="mb-3 rounded-field border border-dashed border-[#3a2e23] px-3 py-2 text-center text-xs text-[#a08a6f]">
              🎟️ Convidado assiste e torce — crie sua conta para apostar
            </p>
          ) : (
            <p className="mb-3 font-mono text-sm text-[#ffc04d] tabular-nums">
              Saldo: 🪙 {fichas ?? '—'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAREO_CAVALOS.map((h, i) => {
              const podeEscolher = podeApostar
              const selecionado = selectedHorse === i && podeEscolher
              const venceu = view.fase === 'cerimonia' && view.vencedor === i
              const apostouAqui = apostaAtual && apostaAtual.numero === view.numero && apostaAtual.lane === i
              return (
                <button
                  key={h.nome}
                  type="button"
                  disabled={!podeEscolher}
                  onClick={() => setSelectedHorse(i)}
                  className={`flex items-center gap-2 rounded-field p-2.5 text-left transition ${
                    podeEscolher ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-not-allowed opacity-45'
                  } ${venceu ? 'ring-2 ring-pop-green' : selecionado ? 'ring-2 ring-pop-yellow' : 'ring-1 ring-[#3a2e23]'}`}
                  style={{ background: '#271f18' }}
                >
                  <span className="size-3.5 shrink-0 rounded-md" style={{ background: h.cor }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-cream">{h.nome}</span>
                    <span className="font-mono text-[10px] text-[#a08a6f]">
                      #{i + 1}
                      {apostouAqui && <span className="ml-1.5 text-pop-yellow">● {apostaAtual!.valor}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-display text-xl leading-none font-extrabold text-[#ffc04d]">
                    {PAREO_ODDS[i]!.toFixed(1)}
                    <small className="text-[10px] text-[#a08a6f]">×</small>
                  </span>
                </button>
              )
            })}
          </div>

          {/* fila de fichas — habilitada em 'apostas' para quem tem conta e ainda não apostou */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] tracking-wide text-[#a08a6f] uppercase">Aposta</span>
            <div className="flex flex-wrap gap-1.5">
              {PAREO_APOSTAS_FICHAS.map((v) => {
                const ativo = podeApostar && valorEscolhido === v
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={!podeApostar}
                    onClick={() => setValorEscolhido(v)}
                    className={`rounded-full px-3 py-1.5 font-mono text-xs ring-1 transition ${
                      !podeApostar
                        ? 'cursor-not-allowed text-cream opacity-40 ring-[#3a2e23]'
                        : ativo
                          ? 'cursor-pointer bg-pop-yellow text-[#1e1813] ring-pop-yellow'
                          : 'cursor-pointer text-cream ring-[#3a2e23] hover:ring-pop-yellow/60'
                    }`}
                  >
                    {v}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              disabled={!podeConfirmar || enviando}
              onClick={confirmarAposta}
              className={`btn-pop ml-auto px-6 py-2 text-sm text-cream ${
                !podeConfirmar || enviando ? 'cursor-not-allowed bg-[#3a2e23] opacity-50' : ''
              }`}
            >
              {apostaAtual && apostaAtual.numero === view.numero
                ? 'Aposta confirmada'
                : enviando
                  ? 'Enviando…'
                  : 'Confirmar aposta'}
            </button>
          </div>

          {avisoErro ? (
            <p className="mt-3 rounded-field border border-pop-yellow/50 bg-pop-yellow/10 px-3 py-2 text-center text-xs font-semibold text-pop-yellow">
              {avisoErro}
            </p>
          ) : view.fase !== 'apostas' ? (
            <p className="mt-3 rounded-field border border-dashed border-[#3a2e23] px-3 py-2 text-center text-xs text-[#a08a6f]">
              Apostas encerradas — reabrem no próximo páreo
            </p>
          ) : null}

          {view.historico.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 font-mono text-[10px]">
              <span className="text-[#a08a6f]">Últimos vencedores:</span>
              {view.historico.map((n, i) => (
                <span key={i} className="rounded-full px-2 py-0.5 text-cream ring-1 ring-[#3a2e23]">
                  <b>{n}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== helpers de tempo =====
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

// ===== confete (semeado pelo mesmo PRNG determinístico da corrida) =====
const CONFETTI_CORES = ['#ffd24a', '#ff5747', '#4aa3df', '#7ee0ab', '#f3e9d8']
function seedConfetti(numero: number): ConfettiParticle[] {
  const rng = pareoRandom((numero * 7919 + 13) >>> 0)
  const out: ConfettiParticle[] = []
  for (let i = 0; i < 90; i++) {
    out.push({
      x0: rng() * W,
      vy: 40 + rng() * 90,
      vx: (rng() - 0.5) * 30,
      c: CONFETTI_CORES[i % 5]!,
      s: 3 + rng() * 3,
      rot0: rng() * 6,
      startY: rng() * -H,
    })
  }
  return out
}
function drawConfetti(ctx: CanvasRenderingContext2D, particles: ConfettiParticle[], t: number) {
  for (const p of particles) {
    let y = p.startY + p.vy * t
    y = (((y % (H + 20)) + (H + 20)) % (H + 20)) - 10
    const x = p.x0 + p.vx * t
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(p.rot0 + t * 4)
    ctx.fillStyle = p.c
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.6)
    ctx.restore()
  }
}

// ===== render (porte fiel do protótipo do usuário) =====
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  r = Math.max(0, Math.min(255, r + pct))
  g = Math.max(0, Math.min(255, g + pct))
  b = Math.max(0, Math.min(255, b + pct))
  return `rgb(${r},${g},${b})`
}

function drawTrack(ctx: CanvasRenderingContext2D, cameraX: number) {
  ctx.clearRect(0, 0, W, H)
  const grd = ctx.createLinearGradient(0, 0, 0, H)
  grd.addColorStop(0, '#1c2a1a')
  grd.addColorStop(1, '#16210f')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < PAREO_CAVALOS.length; i++) {
    const y = LANE_TOP + i * LANE_H
    ctx.fillStyle = i % 2 === 0 ? 'rgba(58,46,35,0.35)' : 'rgba(42,32,24,0.35)'
    ctx.fillRect(0, y, W, LANE_H)
    ctx.strokeStyle = 'rgba(243,233,216,0.06)'
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  for (let d = 0; d <= PAREO_TRACK_LEN; d += 200) {
    const sx = d - cameraX
    if (sx < -20 || sx > W + 20) continue
    ctx.strokeStyle = 'rgba(243,233,216,0.07)'
    ctx.beginPath()
    ctx.moveTo(sx, LANE_TOP - 6)
    ctx.lineTo(sx, H - 24)
    ctx.stroke()
  }
  const startX = 0 - cameraX
  if (startX > -10 && startX < W + 10) {
    ctx.fillStyle = 'rgba(243,233,216,0.5)'
    ctx.fillRect(startX - 1, LANE_TOP - 6, 2, H - LANE_TOP - 18)
  }
  const fx = PAREO_FINISH - cameraX
  if (fx > -20 && fx < W + 40) {
    const sq = 9
    for (let yy = LANE_TOP - 6; yy < H - 24; yy += sq) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (Math.floor(yy / sq) + c) % 2 === 0 ? '#f3e9d8' : '#14100c'
        ctx.fillRect(fx + c * sq, yy, sq, sq)
      }
    }
  }
}

function drawHorse(ctx: CanvasRenderingContext2D, h: DrawableHorse, cameraX: number) {
  const y = LANE_TOP + h.lane * LANE_H + LANE_H / 2
  const x = h.x - cameraX
  const gallop = Math.sin(h.legT)
  const gallop2 = Math.sin(h.legT + Math.PI)
  const bob = Math.sin(h.legT * 2) * 1.5
  const S = 1.6
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.ellipse(x, y + 16, 30, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(x, y + bob)
  ctx.scale(S, S)
  const dark = shade(h.cor, -45)
  const darker = shade(h.cor, -70)
  const light = shade(h.cor, 40)
  ctx.strokeStyle = dark
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-11, 4)
  ctx.lineTo(-13 + gallop * 5, 12)
  ctx.lineTo(-12 + gallop * 7, 17)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(9, 4)
  ctx.lineTo(11 + gallop2 * 5, 12)
  ctx.lineTo(12 + gallop2 * 7, 17)
  ctx.stroke()
  ctx.strokeStyle = darker
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-15, -3)
  ctx.quadraticCurveTo(-24, 0, -22 + gallop * 2, 10)
  ctx.stroke()
  ctx.fillStyle = h.cor
  ctx.beginPath()
  ctx.ellipse(-2, 0, 16, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-11, -2, 7, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(8, -4)
  ctx.quadraticCurveTo(16, -6, 19, -15)
  ctx.lineTo(24, -14)
  ctx.quadraticCurveTo(22, -4, 14, 1)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(19, -15)
  ctx.lineTo(28, -20)
  ctx.lineTo(30, -17)
  ctx.lineTo(25, -13)
  ctx.lineTo(21, -12)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.moveTo(20, -16)
  ctx.lineTo(21, -21)
  ctx.lineTo(23, -16)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#14100c'
  ctx.beginPath()
  ctx.arc(24, -16, 1.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(28.5, -17.5, 0.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = darker
  ctx.beginPath()
  ctx.moveTo(8, -5)
  ctx.quadraticCurveTo(14, -10, 20, -16)
  ctx.lineTo(18, -13)
  ctx.quadraticCurveTo(13, -7, 8, -2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = h.cor
  ctx.lineWidth = 2.8
  ctx.beginPath()
  ctx.moveTo(7, 4)
  ctx.lineTo(9 - gallop2 * 5, 12)
  ctx.lineTo(9 - gallop2 * 7, 17)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-9, 4)
  ctx.lineTo(-11 - gallop * 5, 12)
  ctx.lineTo(-10 - gallop * 7, 17)
  ctx.stroke()
  const jx = -3
  const jy = -9
  ctx.strokeStyle = '#2b2b33'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(jx - 1, jy + 2)
  ctx.lineTo(jx + 4, jy + 5)
  ctx.lineTo(jx + 7, jy + 3)
  ctx.stroke()
  ctx.strokeStyle = light
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(jx - 3, jy + 1)
  ctx.lineTo(jx + 3, jy - 4)
  ctx.stroke()
  ctx.fillStyle = light
  ctx.beginPath()
  ctx.ellipse(jx, jy - 1, 4, 3.4, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = light
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(jx + 2, jy - 2)
  ctx.lineTo(jx + 9, jy + 1)
  ctx.stroke()
  ctx.fillStyle = '#f0ead8'
  ctx.beginPath()
  ctx.arc(jx + 4, jy - 6, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = darker
  ctx.beginPath()
  ctx.arc(jx + 4, jy - 7, 2.9, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(jx + 5.5, jy - 7.4, 2.4, 1.1)
  ctx.restore()
  ctx.fillStyle = 'rgba(243,233,216,0.9)'
  ctx.font = "bold 12px ui-monospace, SFMono-Regular, Menlo, monospace"
  ctx.textAlign = 'center'
  ctx.fillText('#' + (h.lane + 1), x, y - LANE_H * 0.34)
  ctx.textAlign = 'start'
}

function drawCeremony(ctx: CanvasRenderingContext2D, race: PareoCorrida, ceremonyT: number, confetti: ConfettiParticle[]) {
  const cx = W / 2
  const cy = H / 2 + 34
  const w = race.cavalos[race.vencedor]!
  const S = 3.6
  ctx.fillStyle = 'rgba(243,233,216,0.08)'
  ctx.fillRect(cx - 70, cy + 34, 140, 44)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(S, S)
  const dark = shade(w.cor, -45)
  const darker = shade(w.cor, -70)
  const light = shade(w.cor, 40)
  ctx.strokeStyle = dark
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  for (const lx of [-11, 9, 7, -9]) {
    ctx.beginPath()
    ctx.moveTo(lx, 4)
    ctx.lineTo(lx, 17)
    ctx.stroke()
  }
  ctx.fillStyle = w.cor
  ctx.beginPath()
  ctx.ellipse(-2, 0, 16, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-11, -2, 7, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(8, -4)
  ctx.quadraticCurveTo(18, -10, 20, -20)
  ctx.lineTo(25, -19)
  ctx.quadraticCurveTo(23, -6, 14, 1)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(20, -20)
  ctx.lineTo(29, -24)
  ctx.lineTo(31, -21)
  ctx.lineTo(26, -17)
  ctx.lineTo(22, -17)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.moveTo(21, -21)
  ctx.lineTo(22, -26)
  ctx.lineTo(24, -21)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#14100c'
  ctx.beginPath()
  ctx.arc(25, -21, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = darker
  ctx.beginPath()
  ctx.moveTo(8, -5)
  ctx.quadraticCurveTo(15, -12, 21, -20)
  ctx.lineTo(19, -16)
  ctx.quadraticCurveTo(13, -8, 8, -2)
  ctx.closePath()
  ctx.fill()
  const jx = -3
  const jy = -10
  const raise = Math.sin(ceremonyT * 3) * 0.7
  ctx.strokeStyle = light
  ctx.lineWidth = 4.5
  ctx.beginPath()
  ctx.moveTo(jx - 2, jy + 2)
  ctx.lineTo(jx + 2, jy - 5)
  ctx.stroke()
  ctx.fillStyle = light
  ctx.beginPath()
  ctx.ellipse(jx, jy - 2, 3.6, 3, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f0ead8'
  ctx.beginPath()
  ctx.arc(jx + 2, jy - 7, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = darker
  ctx.beginPath()
  ctx.arc(jx + 2, jy - 8, 2.6, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = light
  ctx.lineWidth = 1.8
  const tx = jx + 1 + raise
  const ty = jy - 16
  ctx.beginPath()
  ctx.moveTo(jx + 1, jy - 4)
  ctx.lineTo(tx, ty + 3)
  ctx.stroke()
  ctx.fillStyle = '#ffd24a'
  ctx.beginPath()
  ctx.moveTo(tx - 2.5, ty)
  ctx.lineTo(tx + 2.5, ty)
  ctx.lineTo(tx + 1.5, ty + 3.5)
  ctx.lineTo(tx - 1.5, ty + 3.5)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(tx - 0.6, ty + 3.5, 1.2, 2)
  ctx.fillRect(tx - 2, ty + 5.5, 4, 1.2)
  ctx.strokeStyle = '#ffd24a'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.arc(tx - 2.5, ty + 1.4, 1.6, Math.PI * 0.5, Math.PI * 1.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(tx + 2.5, ty + 1.4, 1.6, Math.PI * 1.5, Math.PI * 0.5)
  ctx.stroke()
  ctx.restore()
  drawConfetti(ctx, confetti, ceremonyT)
}

function drawIdleHorses(ctx: CanvasRenderingContext2D) {
  const t = performance.now() / 400
  PAREO_CAVALOS.forEach((def, i) => {
    drawHorse(ctx, { cor: def.cor, lane: i, x: 60, legT: t + i }, 0)
  })
}
