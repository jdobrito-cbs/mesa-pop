import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MILHAO_ESCADA, type MilhaoView } from '@mesapop/shared'
import { api, ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import AvatarSvg from '../components/AvatarSvg'

/**
 * Tio Mário Milionário — quiz solo de escada de prêmios (identidade
 * própria do Mesa Pop, clima de palco de auditório): 16 perguntas até
 * R$ 1.000.000, pode parar a qualquer momento e levar o garantido, errou
 * leva metade. A resposta certa vive só no servidor até responder.
 */

type Ajuda = 'cartas' | 'universitarios' | 'plateia' | 'pulo'

interface RankRow {
  rank: number
  displayName: string
  points: number
}

interface Reveal {
  pergunta: NonNullable<MilhaoView['pergunta']>
  ultima: NonNullable<MilhaoView['ultima']>
}

const LETRAS = ['A', 'B', 'C', 'D'] as const

const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR')}`

const AJUDAS: { tipo: Ajuda; icon: string; label: string }[] = [
  { tipo: 'cartas', icon: '🃏', label: 'Cartas' },
  { tipo: 'universitarios', icon: '🎓', label: 'Universitários' },
  { tipo: 'plateia', icon: '📊', label: 'Plateia' },
  { tipo: 'pulo', icon: '⏭️', label: 'Pulo' },
]

export default function TioMarioPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [view, setView] = useState<MilhaoView | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [selecionada, setSelecionada] = useState<number | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [busy, setBusy] = useState(false)
  const { data: ranking, reload: reloadRanking } = useFetch<{ rows: RankRow[] }>(
    '/api/leaderboards/tio-mario-milionario',
  )

  useEffect(() => {
    void api<MilhaoView>('/api/milhao/estado')
      .then(setView)
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const mostraErro = (err: unknown) => {
    setErro(err instanceof ApiRequestError ? err.message : 'Não deu — tente de novo')
    setTimeout(() => setErro(''), 3000)
  }

  const comecar = useCallback(async () => {
    setBusy(true)
    setErro('')
    try {
      const res = await api<MilhaoView>('/api/milhao/start', { method: 'POST' })
      setView(res)
      setSelecionada(null)
      setReveal(null)
    } catch (err) {
      mostraErro(err)
    } finally {
      setBusy(false)
    }
  }, [])

  const confirmar = useCallback(async () => {
    if (!view?.pergunta || selecionada === null || busy) return
    const perguntaAntes = view.pergunta
    setBusy(true)
    setErro('')
    try {
      const res = await api<MilhaoView>('/api/milhao/responder', { body: { escolha: selecionada } })
      if (res.ultima) {
        setReveal({ pergunta: perguntaAntes, ultima: res.ultima })
        setTimeout(() => {
          setReveal(null)
          setView(res)
          setSelecionada(null)
          setBusy(false)
          if (res.fase === 'fim') void reloadRanking()
        }, 1600)
      } else {
        setView(res)
        setSelecionada(null)
        setBusy(false)
      }
    } catch (err) {
      mostraErro(err)
      setBusy(false)
    }
  }, [view, selecionada, busy, reloadRanking])

  const parar = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setErro('')
    try {
      const res = await api<MilhaoView>('/api/milhao/parar', { method: 'POST' })
      setView(res)
      void reloadRanking()
    } catch (err) {
      mostraErro(err)
    } finally {
      setBusy(false)
    }
  }, [busy, reloadRanking])

  const usarAjuda = useCallback(
    async (tipo: Ajuda) => {
      if (busy || reveal) return
      setBusy(true)
      setErro('')
      try {
        const res = await api<MilhaoView>('/api/milhao/ajuda', { body: { tipo } })
        setView(res)
      } catch (err) {
        mostraErro(err)
      } finally {
        setBusy(false)
      }
    },
    [busy, reveal],
  )

  const pergunta = reveal?.pergunta ?? view?.pergunta ?? null
  const conquistadas = view
    ? view.fase === 'fim' && view.resultado === 'milhao'
      ? MILHAO_ESCADA.length
      : view.nivel
    : 0

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">💰</span> Tio Mário Milionário
        </h1>
        <button
          onClick={() => navigate('/mesa')}
          className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange"
        >
          Voltar à mesa
        </button>
      </div>

      {erro && (
        <p role="alert" className="mt-4 rounded-field bg-pop-magenta/15 px-4 py-3 text-sm font-semibold text-pop-magenta">
          {erro}
        </p>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_260px]">
        {/* PALCO */}
        <div>
          {carregando ? (
            <p className="text-sm text-text-muted">Carregando…</p>
          ) : !view ? (
            <div className="card p-8 text-center">
              <p className="text-4xl" aria-hidden="true">🎙️</p>
              <h2 className="mt-3 font-display text-2xl font-extrabold">Bem-vindo ao palco!</h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">
                16 perguntas separam você de R$ 1.000.000.
                <br />
                Pare a qualquer momento e leve o que já acumulou.
                <br />
                Errou? Leva metade do acumulado.
                <br />
                Na pergunta do milhão, é tudo ou nada!
              </p>
              <button
                onClick={() => void comecar()}
                disabled={busy}
                className="btn-pop mt-6 bg-gradient-to-br from-pop-yellow to-pop-orange px-8 py-4 text-lg font-extrabold text-ink-950 disabled:opacity-60"
              >
                🎬 Começar!
              </button>
              {user?.isGuest && (
                <p className="mt-4 text-xs text-text-muted">
                  🎟️ convidado joga, mas não entra no ranking
                </p>
              )}
            </div>
          ) : view.fase === 'fim' ? (
            <div className="card p-8 text-center">
              {view.resultado === 'milhao' ? (
                <>
                  <p className="text-5xl" aria-hidden="true">🏆🎉</p>
                  <h2 className="mt-3 font-display text-3xl font-extrabold text-pop-yellow">
                    R$ 1.000.000! VOCÊ É O NOVO MILIONÁRIO!
                  </h2>
                </>
              ) : view.resultado === 'parou' ? (
                <>
                  <p className="text-4xl" aria-hidden="true">🛑</p>
                  <h2 className="mt-3 font-display text-2xl font-extrabold text-pop-green">
                    Você parou e levou {fmt(view.premio)}!
                  </h2>
                </>
              ) : (
                <>
                  <p className="text-4xl" aria-hidden="true">❌</p>
                  <h2 className="mt-3 font-display text-2xl font-extrabold">
                    Errou! A certa era{' '}
                    <span className="text-pop-yellow">{view.ultima ? LETRAS[view.ultima.correta] : '?'}</span>.
                    <br />
                    Você leva {fmt(view.premio)}.
                  </h2>
                  <p className="mt-2 text-sm text-text-muted">Bora tentar de novo?</p>
                </>
              )}
              {/* o que a partida rendeu de verdade: PONTOS no ranking + FICHAS */}
              {(view.pontosGanhos > 0 || view.fichasGanhas > 0) && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full bg-pop-cyan/15 px-5 py-2 font-display font-extrabold text-pop-cyan">
                    🏁 +{view.pontosGanhos.toLocaleString('pt-BR')} pontos no ranking
                  </span>
                  {view.fichasGanhas > 0 && (
                    <span className="rounded-full bg-pop-yellow/15 px-5 py-2 font-display font-extrabold text-pop-yellow">
                      🪙 +{view.fichasGanhas} fichas para a máquina de avatares!
                    </span>
                  )}
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => void comecar()}
                  disabled={busy}
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-3 font-bold text-white disabled:opacity-60"
                >
                  🔁 Jogar de novo
                </button>
                <button
                  onClick={() => navigate('/mesa')}
                  className="btn-pop px-6 py-3 ring-1 ring-ink-700 hover:ring-pop-orange"
                >
                  Voltar à mesa
                </button>
              </div>
              {user?.isGuest && (
                <p className="mt-4 text-xs text-text-muted">
                  🎟️ convidado joga, mas não entra no ranking
                </p>
              )}
            </div>
          ) : pergunta ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-display font-bold">
                  Pergunta {view.nivel + 1} de {MILHAO_ESCADA.length} · valendo {fmt(view.valorPergunta)}
                </span>
                <span className="text-xs text-text-muted">
                  Garantido: <span className="font-bold text-pop-green">{fmt(view.acumulado)}</span>
                  {' · '}
                  Se errar: <span className="font-bold text-pop-magenta">{fmt(view.seErrar)}</span>
                </span>
              </div>

              <div className="card mt-3 p-6">
                <span className="inline-block rounded-full bg-pop-cyan/15 px-3 py-1 text-xs font-bold text-pop-cyan">
                  {pergunta.categoria}
                </span>
                <p className="mt-3 font-display text-xl font-extrabold sm:text-2xl">{pergunta.texto}</p>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {pergunta.alternativas.map((alt, i) => {
                  const eliminada = !reveal && view.eliminadas.includes(i)
                  const isSelected = !reveal && selecionada === i
                  let cls = 'ring-1 ring-ink-700 hover:ring-pop-cyan/60'
                  if (reveal) {
                    if (i === reveal.ultima.correta) cls = 'bg-pop-green/90 text-ink-950 ring-2 ring-pop-green'
                    else if (i === reveal.ultima.escolha && !reveal.ultima.certo)
                      cls = 'bg-red-500/90 text-white ring-2 ring-red-500'
                    else cls = 'opacity-40 ring-1 ring-ink-700'
                  } else if (eliminada) {
                    cls = 'opacity-30 line-through pointer-events-none ring-1 ring-ink-700'
                  } else if (isSelected) {
                    cls = 'bg-ink-800 ring-4 ring-pop-yellow'
                  }
                  const pct = view.plateia ? view.plateia[i] : undefined
                  return (
                    <button
                      key={i}
                      onClick={() => !reveal && !eliminada && !busy && setSelecionada(i)}
                      disabled={eliminada || !!reveal}
                      className={`card flex w-full items-center gap-3 p-4 text-left font-semibold transition ${cls}`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-900 font-display font-extrabold">
                        {LETRAS[i]}
                      </span>
                      <span className="flex-1">{alt}</span>
                      {pct !== undefined && (
                        <span className="shrink-0 text-xs font-bold text-pop-cyan tabular-nums">{pct}%</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {selecionada !== null && !reveal && (
                <button
                  onClick={() => void confirmar()}
                  disabled={busy}
                  className="btn-pop mt-4 w-full bg-gradient-to-br from-pop-green to-pop-cyan py-3 font-extrabold text-ink-950 disabled:opacity-60"
                >
                  ✅ É essa! (confirmar)
                </button>
              )}

              {view.universitarios && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {view.universitarios.map((u) => (
                    <span
                      key={u.nome}
                      className="rounded-field bg-ink-800 px-3 py-1.5 text-xs font-semibold ring-1 ring-ink-700"
                    >
                      {u.nome}: {LETRAS[u.palpite]} ({u.confianca}%)
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {AJUDAS.map(({ tipo, icon, label }) => {
                  const usada = tipo === 'pulo' ? view.pulosRestantes <= 0 : view.ajudasUsadas.includes(tipo)
                  return (
                    <button
                      key={tipo}
                      onClick={() => void usarAjuda(tipo)}
                      disabled={usada || busy || !!reveal}
                      className="btn-pop rounded-full bg-ink-800 px-4 py-2 text-xs font-bold ring-1 ring-ink-700 hover:ring-pop-yellow disabled:opacity-30"
                    >
                      {icon} {label}
                      {tipo === 'pulo' ? ` (x${view.pulosRestantes})` : ''}
                    </button>
                  )
                })}
              </div>

              <div className="mt-6">
                {view.nivel === 0 && view.acumulado === 0 ? (
                  <button
                    disabled
                    className="btn-pop w-full px-6 py-3 text-sm font-bold ring-1 ring-ink-700 opacity-50"
                  >
                    Ainda não há prêmio para levar
                  </button>
                ) : (
                  <button
                    onClick={() => void parar()}
                    disabled={busy || !!reveal}
                    className="btn-pop w-full bg-gradient-to-br from-pop-orange to-pop-magenta px-6 py-3 font-extrabold text-white disabled:opacity-60"
                  >
                    🛑 Parar e levar {fmt(view.acumulado)}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <p className="font-display text-sm font-bold">🪜 Escada de prêmios</p>
            <div className="mt-3 flex flex-col gap-1">
              {MILHAO_ESCADA.slice()
                .reverse()
                .map((valor, revIdx) => {
                  const i = MILHAO_ESCADA.length - 1 - revIdx
                  const atual = !!view && view.fase === 'pergunta' && i === view.nivel
                  const conquistada = i < conquistadas
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-field px-3 py-1.5 text-xs tabular-nums ${
                        atual
                          ? 'animate-pulse bg-pop-yellow/25 font-extrabold text-pop-yellow ring-1 ring-pop-yellow'
                          : conquistada
                            ? 'bg-pop-green/10 font-bold text-pop-green'
                            : 'text-text-muted'
                      }`}
                    >
                      <span>{i + 1}º</span>
                      <span>{fmt(valor)}</span>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="card p-4">
            <p className="font-display text-sm font-bold">🏆 Ranking</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {!ranking?.rows.length && (
                <p className="text-sm text-text-muted">Ninguém chegou ao topo ainda!</p>
              )}
              {ranking?.rows.map((r) => (
                <div key={r.rank} className="flex items-center gap-2 rounded-field bg-ink-900 px-3 py-1.5 text-sm ring-1 ring-ink-700">
                  <span className={`w-7 font-display font-extrabold ${r.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>
                    {r.rank}º
                  </span>
                  <AvatarSvg id={r.displayName} size={20} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.displayName}</span>
                  <span className="font-bold text-pop-cyan tabular-nums">{r.points.toLocaleString('pt-BR')} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
