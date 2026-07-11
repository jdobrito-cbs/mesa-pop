import { useEffect, useRef, useState } from 'react'
import {
  CISCO_APOSTAS_FICHAS,
  CISCO_CORRIDA_MS,
  CISCO_FINISH,
  CISCO_GALINHAS,
  CISCO_ODDS,
  CISCO_SIM_STEPS,
  CISCO_TRACK_LEN,
  ciscoBuildRace,
  ciscoGalinhaAt,
  ciscoRandom,
  type CiscoCorrida,
  type CiscoView,
} from '@mesapop/shared'
import { api, ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'

/**
 * Cisco (Fazenda do Bruno) — porte fiel do protótipo do usuário
 * (corrida de galinhas + ovos "plim" + cerimônia com ovo de ouro). Espelha
 * a estrutura do PareoGame.tsx: o servidor é dono do ciclo (apostas →
 * pré-largada → corrida → cerimônia) e da seed; este componente REPRODUZ a
 * timeline localmente (relógio sincronizado pelo offset
 * `view.agora - Date.now()`) e fala com o backend só por REST
 * (POST /api/cisco/apostar, GET /api/cisco/minha) — o socket segue
 * carregando apenas o estado da corrida.
 */

/** aposta enxuta como devolvida por GET /api/cisco/minha */
interface CiscoApostaResumo {
  numero: number
  lane: number
  valor: number
  odds: number
  resultado: 'pendente' | 'ganhou' | 'perdeu'
  payout: number
}
interface CiscoMinhaResp {
  fichas: number
  atual: CiscoApostaResumo | null
  ultima: CiscoApostaResumo | null
}

const W = 960
const H = 260
const LANE_TOP = 54
const LANE_H = (H - LANE_TOP - 20) / CISCO_GALINHAS.length
/** quanto tempo o overlay da campeã fica na tela (o resto da cerimônia
 * segue só com o pódio + confete, como no protótipo) */
const WINNER_SHOW_MS = 5700

interface DrawableGalinha {
  cor: string
  lane: number
  x: number
  legT: number
  ciscando: boolean
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

export default function CiscoGame({ view }: { view: CiscoView }) {
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
  const raceRef = useRef<{ seed: number; race: CiscoCorrida } | null>(null)
  if (view.seed !== null && raceRef.current?.seed !== view.seed) {
    raceRef.current = { seed: view.seed, race: ciscoBuildRace(view.seed) }
  }

  // confete semeado uma vez por corrida, ao entrar na cerimônia
  const confettiRef = useRef<{ numero: number; particles: ConfettiParticle[] } | null>(null)
  if (view.fase === 'cerimonia' && confettiRef.current?.numero !== view.numero) {
    confettiRef.current = { numero: view.numero, particles: seedConfetti(view.numero) }
  }

  // favorita selecionada (local, sem aposta ainda) — zera a cada corrida nova
  const [selectedGalinha, setSelectedGalinha] = useState<number | null>(null)
  const prevNumeroRef = useRef(view.numero)
  if (prevNumeroRef.current !== view.numero) {
    prevNumeroRef.current = view.numero
    setSelectedGalinha(null)
  }

  // ===== carteira de fichas =====
  const [fichas, setFichas] = useState<number | null>(null)
  const [apostaAtual, setApostaAtual] = useState<CiscoApostaResumo | null>(null)
  const [ultimaAposta, setUltimaAposta] = useState<CiscoApostaResumo | null>(null)
  const [valorEscolhido, setValorEscolhido] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [avisoErro, setAvisoErro] = useState<string | null>(null)

  // corrida nova (numero mudou): limpa a aposta local otimisticamente — o
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
      const r = await api<CiscoMinhaResp>('/api/cisco/minha').catch(() => null)
      if (cancelado || !r) return
      setFichas(r.fichas)
      setApostaAtual(r.atual)
      setUltimaAposta(r.ultima)
      if (view.fase === 'cerimonia' && r.ultima?.numero !== view.numero) {
        await new Promise((resolve) => setTimeout(resolve, 2500))
        if (cancelado) return
        const r2 = await api<CiscoMinhaResp>('/api/cisco/minha').catch(() => null)
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
    if (isGuest || enviando || apostaAtual || selectedGalinha === null || valorEscolhido === null) return
    setEnviando(true)
    setAvisoErro(null)
    try {
      const r = await api<{ aposta: { lane: number; valor: number; odds: number }; fichas: number }>(
        '/api/cisco/apostar',
        { body: { numero: view.numero, lane: selectedGalinha, valor: valorEscolhido } },
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
    const cerimoniaComecoEm = view.largadaEm + CISCO_CORRIDA_MS
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
        const t = clamp((now - v.largadaEm) / CISCO_CORRIDA_MS, 0, 1)
        let front = 0
        const positioned: DrawableGalinha[] = built.race.galinhas.map((g) => {
          const s = ciscoGalinhaAt(g, t)
          if (s.x > front) front = s.x
          return { cor: g.cor, lane: g.lane, x: s.x, legT: s.legT, ciscando: s.ciscando }
        })
        const cameraX = Math.max(0, front - W * 0.58)
        const renderStep = Math.round(t * CISCO_SIM_STEPS)
        drawTrack(ctx, cameraX)
        drawOvos(ctx, built.race, renderStep, cameraX)
        positioned.forEach((g) => drawGalinha(ctx, g, cameraX))
      } else if (v.fase === 'cerimonia' && v.seed !== null && built && built.seed === v.seed) {
        drawTrack(ctx, 0)
        const cerimoniaComecoEm = v.largadaEm + CISCO_CORRIDA_MS
        const ceremonyT = Math.max(0, (now - cerimoniaComecoEm) / 1000)
        drawCerimonia(ctx, built.race, ceremonyT, confettiRef.current?.particles ?? [])
      } else {
        // apostas/prelargada, ou 'corrida' que chegou antes da seed (atrasada)
        drawTrack(ctx, 0)
        drawIdleGalinhas(ctx)
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
          ? 'E LÁ VÃO ELAS!'
          : 'Chegada!'
  const apostaConfirmadaAgora =
    view.fase === 'apostas' && apostaAtual && apostaAtual.numero === view.numero ? apostaAtual : null
  const painelTitulo = apostaConfirmadaAgora
    ? `Apostou ${apostaConfirmadaAgora.valor} em ${CISCO_GALINHAS[apostaConfirmadaAgora.lane]!.nome} (${apostaConfirmadaAgora.odds.toFixed(1)}×) · boa sorte!`
    : view.fase === 'apostas'
      ? 'Escolha sua galinha'
      : view.fase === 'prelargada'
        ? 'Preparando a largada…'
        : view.fase === 'corrida'
          ? 'Corrida em andamento'
          : 'Pódio'
  const topClock = view.fase === 'apostas' ? `Fecha em ${fmt(view.faseFimEm - now)}` : ''
  const startClock =
    view.fase === 'apostas' || view.fase === 'prelargada' ? fmt(Math.max(0, view.largadaEm - now)) : '0:00'
  const vencedorGalinha = view.vencedor !== null ? CISCO_GALINHAS[view.vencedor] : null
  const vencedorOdds = view.vencedor !== null ? CISCO_ODDS[view.vencedor]! : null
  const resultadoPessoal =
    ultimaAposta && ultimaAposta.numero === view.numero && ultimaAposta.resultado !== 'pendente'
      ? ultimaAposta
      : null
  const podeApostar = view.fase === 'apostas' && !isGuest && !apostaAtual
  const podeConfirmar =
    podeApostar && selectedGalinha !== null && valorEscolhido !== null && fichas !== null && valorEscolhido <= fichas

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

          {winnerVisible && vencedorGalinha && vencedorOdds !== null && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              style={{ background: 'radial-gradient(ellipse at center, rgba(20,16,12,0.35), rgba(20,16,12,0.82))' }}
            >
              <p className="text-[11px] font-bold tracking-[0.3em] text-[#ffc04d] uppercase">Galinha campeã</p>
              <p
                className="mt-1 font-display text-4xl font-extrabold text-[#f3e9d8]"
                style={{ textShadow: '0 4px 24px rgba(245,166,35,0.5)' }}
              >
                {vencedorGalinha.nome} venceu
              </p>
              {resultadoPessoal ? (
                resultadoPessoal.resultado === 'ganhou' ? (
                  <p className="mt-3 font-mono text-sm font-bold text-pop-green">
                    Você acertou e ganhou <b>+{resultadoPessoal.payout}</b> fichas 🎉
                  </p>
                ) : (
                  <p className="mt-3 font-mono text-sm font-bold text-[#ff5747]">
                    Você perdeu suas <b>{resultadoPessoal.valor}</b> fichas — próxima corrida em instantes!
                  </p>
                )
              ) : (
                <p className="mt-2 font-mono text-sm text-[#a08a6f]">
                  Galinha #{view.vencedor! + 1} · pagou {vencedorOdds.toFixed(1)}×
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
            {CISCO_GALINHAS.map((g, i) => {
              const podeEscolher = podeApostar
              const selecionado = selectedGalinha === i && podeEscolher
              const venceu = view.fase === 'cerimonia' && view.vencedor === i
              const apostouAqui = apostaAtual && apostaAtual.numero === view.numero && apostaAtual.lane === i
              return (
                <button
                  key={g.nome}
                  type="button"
                  disabled={!podeEscolher}
                  onClick={() => setSelectedGalinha(i)}
                  className={`flex items-center gap-2 rounded-field p-2.5 text-left transition ${
                    podeEscolher ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-not-allowed opacity-45'
                  } ${venceu ? 'ring-2 ring-pop-green' : selecionado ? 'ring-2 ring-pop-yellow' : 'ring-1 ring-[#3a2e23]'}`}
                  style={{ background: '#271f18' }}
                >
                  <span className="size-3.5 shrink-0 rounded-md" style={{ background: g.cor }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-cream">{g.nome}</span>
                    <span className="font-mono text-[10px] text-[#a08a6f]">
                      #{i + 1}
                      {apostouAqui && <span className="ml-1.5 text-pop-yellow">● {apostaAtual!.valor}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-display text-xl leading-none font-extrabold text-[#ffc04d]">
                    {CISCO_ODDS[i]!.toFixed(1)}
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
              {CISCO_APOSTAS_FICHAS.map((v) => {
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
              Apostas encerradas — reabrem na próxima corrida
            </p>
          ) : null}

          {view.historico.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 font-mono text-[10px]">
              <span className="text-[#a08a6f]">Últimas campeãs:</span>
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
  const rng = ciscoRandom((numero * 7919 + 13) >>> 0)
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
  for (let i = 0; i < CISCO_GALINHAS.length; i++) {
    const y = LANE_TOP + i * LANE_H
    ctx.fillStyle = i % 2 === 0 ? 'rgba(58,46,35,0.35)' : 'rgba(42,32,24,0.35)'
    ctx.fillRect(0, y, W, LANE_H)
    ctx.strokeStyle = 'rgba(243,233,216,0.06)'
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  for (let d = 0; d <= CISCO_TRACK_LEN; d += 200) {
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
  const fx = CISCO_FINISH - cameraX
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

/** ovos já botados na pista — desenhados ANTES das galinhas (ficam atrás) */
function drawOvos(ctx: CanvasRenderingContext2D, race: CiscoCorrida, renderStep: number, cameraX: number) {
  race.galinhas.forEach((g) => {
    const y = LANE_TOP + g.lane * LANE_H + LANE_H / 2
    g.ovos.forEach((ovo) => {
      const age = renderStep - ovo.step
      if (age < 0 || age > 28) return // só aparece por ~28 passos (surge e some)
      const ex = ovo.x - cameraX
      if (ex < -20 || ex > W + 20) return
      // plim: cresce rápido e some no fim
      let sc = age < 6 ? age / 6 : age > 20 ? 1 - (age - 20) / 8 : 1
      sc = Math.max(0, Math.min(1, sc))
      ctx.save()
      ctx.translate(ex, y + 13)
      ctx.scale(sc, sc)
      ctx.fillStyle = '#f5efe0'
      ctx.beginPath()
      ctx.ellipse(0, 0, 4, 5.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.beginPath()
      ctx.ellipse(1, 1, 2.5, 3.4, 0, 0, Math.PI * 2)
      ctx.fill()
      // brilho "plim"
      if (age < 8) {
        ctx.strokeStyle = `rgba(255,240,180,${1 - age / 8})`
        ctx.lineWidth = 1
        for (let a = 0; a < 4; a++) {
          const ang = a * (Math.PI / 2) + 0.4
          ctx.beginPath()
          ctx.moveTo(Math.cos(ang) * 7, Math.sin(ang) * 7)
          ctx.lineTo(Math.cos(ang) * 10, Math.sin(ang) * 10)
          ctx.stroke()
        }
      }
      ctx.restore()
    })
  })
}

function drawGalinha(ctx: CanvasRenderingContext2D, g: DrawableGalinha, cameraX: number) {
  const y = LANE_TOP + g.lane * LANE_H + LANE_H / 2
  const x = g.x - cameraX
  const ciscando = g.ciscando
  const run = Math.sin(g.legT)
  const run2 = Math.sin(g.legT + Math.PI)
  const bob = ciscando ? 0 : Math.abs(Math.sin(g.legT * 2)) * 2
  const S = 1.5
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.26)'
  ctx.beginPath()
  ctx.ellipse(x, y + 15, 22, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(x, y + bob)
  ctx.scale(S, S)
  const body = g.cor
  const dark = shade(g.cor, -40)
  const light = shade(g.cor, 35)
  const comb = '#e0392b'
  const beak = '#f5a623'
  const leg = '#e0a83a'

  // cauda (penas atrás)
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.moveTo(-10, -2)
  ctx.quadraticCurveTo(-22, -6, -24, -16)
  ctx.quadraticCurveTo(-16, -10, -12, -8)
  ctx.quadraticCurveTo(-20, -4, -18, 4)
  ctx.closePath()
  ctx.fill()

  // pernas (ciscando: paradas; correndo: alternando)
  ctx.strokeStyle = leg
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  if (ciscando) {
    ctx.beginPath()
    ctx.moveTo(-2, 7)
    ctx.lineTo(-3, 16)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(3, 7)
    ctx.lineTo(4, 16)
    ctx.stroke()
    // dedos
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(-3, 16)
    ctx.lineTo(-6, 17)
    ctx.moveTo(-3, 16)
    ctx.lineTo(0, 17)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(4, 16)
    ctx.lineTo(1, 17)
    ctx.moveTo(4, 16)
    ctx.lineTo(7, 17)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(-2, 7)
    ctx.lineTo(-3 + run * 5, 15)
    ctx.lineTo(-3 + run * 7, 17)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(3, 7)
    ctx.lineTo(4 + run2 * 5, 15)
    ctx.lineTo(4 + run2 * 7, 17)
    ctx.stroke()
  }

  // corpo (oval gordinho)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(-2, 0, 13, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // asa
  ctx.fillStyle = light
  ctx.beginPath()
  ctx.ellipse(-3, 1, 7, 5, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = dark
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(-8, 0)
  ctx.quadraticCurveTo(-3, 3, 2, 1)
  ctx.stroke()

  // cabeça + pescoço (posição muda ao ciscar)
  const hx = ciscando ? 8 : 9
  const hy = ciscando ? 10 : -11 // ciscando: cabeça no chão
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(4, -6)
  ctx.quadraticCurveTo(hx - 1, hy / 2, hx, hy + 2)
  ctx.lineTo(hx + 3, hy + 2)
  ctx.quadraticCurveTo(hx + 2, hy / 2, 8, -4)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(hx + 2, hy, 4, 0, Math.PI * 2)
  ctx.fill()
  // crista
  ctx.fillStyle = comb
  ctx.beginPath()
  ctx.arc(hx + 1, hy - 4, 1.6, 0, Math.PI * 2)
  ctx.arc(hx + 3, hy - 5, 1.8, 0, Math.PI * 2)
  ctx.arc(hx + 5, hy - 4, 1.6, 0, Math.PI * 2)
  ctx.fill()
  // barbela (queixo vermelho)
  ctx.beginPath()
  ctx.ellipse(hx + 1, hy + 3.5, 1.2, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // bico (aponta pro chão se ciscando)
  ctx.fillStyle = beak
  if (ciscando) {
    ctx.beginPath()
    ctx.moveTo(hx + 3, hy + 3)
    ctx.lineTo(hx + 5, hy + 6)
    ctx.lineTo(hx + 6, hy + 3)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(hx + 5, hy - 1)
    ctx.lineTo(hx + 9, hy)
    ctx.lineTo(hx + 5, hy + 2)
    ctx.closePath()
    ctx.fill()
  }
  // olho
  ctx.fillStyle = '#14100c'
  ctx.beginPath()
  ctx.arc(hx + 3, hy - 0.5, 0.9, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()

  // partículas de cisca (quando ciscando)
  if (ciscando) {
    ctx.fillStyle = 'rgba(160,130,90,0.7)'
    for (let k = 0; k < 3; k++) {
      const px = x + (8 + k * 3) * S
      const py = y + 16
      ctx.beginPath()
      ctx.arc(px + Math.sin(g.legT * 3 + k) * 2, py, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // rótulo #raia
  ctx.fillStyle = 'rgba(243,233,216,0.9)'
  ctx.font = "bold 11px ui-monospace, SFMono-Regular, Menlo, monospace"
  ctx.textAlign = 'center'
  ctx.fillText('#' + (g.lane + 1), x, y - LANE_H * 0.36)
  ctx.textAlign = 'start'
}

function drawCerimonia(ctx: CanvasRenderingContext2D, race: CiscoCorrida, ceremonyT: number, confetti: ConfettiParticle[]) {
  const cx = W / 2
  const cy = H / 2 + 20
  const w = race.galinhas[race.vencedor]!
  const hop = Math.abs(Math.sin(ceremonyT * 4)) * 10 // galinha pulando de alegria
  // pedestal
  ctx.fillStyle = 'rgba(243,233,216,0.10)'
  ctx.fillRect(cx - 60, cy + 40, 120, 42)
  ctx.fillStyle = 'rgba(245,166,35,0.15)'
  ctx.fillRect(cx - 60, cy + 40, 120, 6)
  // galinha grande, pulando, na cor da vencedora
  const S = 3.4
  ctx.save()
  ctx.translate(cx, cy - hop)
  ctx.scale(S, S)
  const body = w.cor
  const dark = shade(w.cor, -40)
  const light = shade(w.cor, 35)
  const comb = '#e0392b'
  const beak = '#f5a623'
  const leg = '#e0a83a'
  // cauda
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.moveTo(-10, -2)
  ctx.quadraticCurveTo(-22, -8, -25, -18)
  ctx.quadraticCurveTo(-16, -11, -12, -8)
  ctx.quadraticCurveTo(-20, -4, -18, 4)
  ctx.closePath()
  ctx.fill()
  // pernas (levantadas no pulo)
  ctx.strokeStyle = leg
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-2, 8)
  ctx.lineTo(-4, 15)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(3, 8)
  ctx.lineTo(5, 15)
  ctx.stroke()
  // corpo
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(-2, 0, 13, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  // asas abertas (comemorando)
  ctx.fillStyle = light
  const wing = Math.sin(ceremonyT * 8) * 0.3
  ctx.save()
  ctx.translate(-4, -1)
  ctx.rotate(-0.4 - wing)
  ctx.beginPath()
  ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // pescoço + cabeça erguida
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(4, -6)
  ctx.quadraticCurveTo(11, -14, 11, -20)
  ctx.lineTo(15, -20)
  ctx.quadraticCurveTo(14, -10, 8, -4)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(13, -21, 4.5, 0, Math.PI * 2)
  ctx.fill()
  // crista
  ctx.fillStyle = comb
  ctx.beginPath()
  ctx.arc(12, -26, 1.8, 0, Math.PI * 2)
  ctx.arc(14, -27, 2, 0, Math.PI * 2)
  ctx.arc(16, -26, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(12, -17, 1.3, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()
  // bico aberto (cacarejando feliz)
  ctx.fillStyle = beak
  ctx.beginPath()
  ctx.moveTo(16, -22)
  ctx.lineTo(21, -23)
  ctx.lineTo(16, -20)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(16, -20)
  ctx.lineTo(20, -18)
  ctx.lineTo(16, -19)
  ctx.closePath()
  ctx.fill()
  // olho
  ctx.fillStyle = '#14100c'
  ctx.beginPath()
  ctx.arc(14, -22, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // ovo dourado no pedestal ao lado
  const ex = cx + 95
  const ey = cy + 30
  ctx.fillStyle = '#ffd24a'
  ctx.beginPath()
  ctx.ellipse(ex, ey, 11, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.ellipse(ex - 3, ey - 4, 3, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c99a2e'
  ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace"
  ctx.textAlign = 'center'
  ctx.fillText('OVO DE OURO', ex, ey + 26)
  ctx.textAlign = 'start'
  drawConfetti(ctx, confetti, ceremonyT)
}

function drawIdleGalinhas(ctx: CanvasRenderingContext2D) {
  const t = performance.now() / 300
  CISCO_GALINHAS.forEach((def, i) => {
    drawGalinha(ctx, { cor: def.cor, lane: i, x: 60, legT: t + i, ciscando: false }, 0)
  })
}
