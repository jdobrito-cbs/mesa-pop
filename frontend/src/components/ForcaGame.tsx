import { useState, type FormEvent } from 'react'
import type { ForcaView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Forca — o boneco cresce parte a parte no patíbulo, a palavra aparece
 * em tracinhos e o teclado pinta o que já foi tentado. Quem escolheu a
 * palavra vê tudo; quem adivinha, só o que já saiu.
 */

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function Boneco({ erros }: { erros: number }) {
  return (
    <svg viewBox="0 0 140 160" className="h-36 w-32" aria-label={`Forca com ${erros} erros`}>
      {/* patíbulo */}
      <g stroke="#B4A8D8" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M15 150 h80" />
        <path d="M35 150 V15 h55 v18" />
      </g>
      <g stroke="#F252C1" strokeWidth="4.5" strokeLinecap="round" fill="none">
        {erros >= 1 && <circle cx="90" cy="47" r="13" />} {/* cabeça */}
        {erros >= 2 && <path d="M90 60 v38" />} {/* tronco */}
        {erros >= 3 && <path d="M90 68 L72 86" />} {/* braço esq */}
        {erros >= 4 && <path d="M90 68 L108 86" />} {/* braço dir */}
        {erros >= 5 && <path d="M90 98 L75 122" />} {/* perna esq */}
        {erros >= 6 && <path d="M90 98 L105 122" />} {/* perna dir */}
      </g>
      {erros >= 6 && (
        <g fill="#F252C1" fontSize="7" fontWeight="bold">
          <text x="84" y="45">×</text>
          <text x="92" y="45">×</text>
        </g>
      )}
    </svg>
  )
}

export default function ForcaGame({
  view,
  yourSeat,
  players,
}: {
  view: ForcaView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [aviso, setAviso] = useState('')
  const [palavra, setPalavra] = useState('')
  const [chute, setChute] = useState('')
  const [chutando, setChutando] = useState(false)
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`
  const souEscolhedor = yourSeat === view.escolhedor
  const minhaVez = view.fase === 'jogando' && view.turno === yourSeat && !souEscolhedor

  async function agir(action: Record<string, unknown>) {
    const res = await emitAck('game:action', { action })
    if (!res.ok) {
      setAviso(res.error ?? 'Não deu')
      setTimeout(() => setAviso(''), 2200)
    }
    return res.ok
  }

  async function enviaPalavra(e: FormEvent) {
    e.preventDefault()
    if (await agir({ type: 'palavra', palavra })) setPalavra('')
  }

  async function enviaChute(e: FormEvent) {
    e.preventDefault()
    if (await agir({ type: 'chute', palavra: chute })) {
      setChute('')
      setChutando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* placar + rodada */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {view.pontos.map((p, seat) => (
            <div
              key={seat}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm ring-1 ${
                view.fase === 'jogando' && view.turno === seat ? 'bg-pop-purple/20 ring-pop-purple/60' : 'bg-ink-800 ring-ink-700'
              }`}
            >
              {seat === view.escolhedor && <span aria-hidden="true">🤫</span>}
              <span className="font-bold">{seat === yourSeat ? 'Você' : nameOf(seat)}</span>
              <span className="font-display font-extrabold text-pop-yellow tabular-nums">{p}</span>
            </div>
          ))}
        </div>
        <span className="rounded-2xl bg-ink-950/80 px-3 py-1.5 text-xs font-extrabold text-text-muted">
          rodada {Math.min(view.rodada + 1, view.totalRodadas)}/{view.totalRodadas}
        </span>
      </div>

      {aviso && (
        <p className="mb-2 rounded-field bg-pop-magenta/15 px-4 py-2 text-center text-sm font-bold text-pop-magenta">{aviso}</p>
      )}

      <div className="rounded-card bg-ink-900 p-5 ring-1 ring-ink-700">
        {view.fase === 'escolhendo' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Boneco erros={0} />
            {souEscolhedor ? (
              <form onSubmit={enviaPalavra} className="flex w-full max-w-sm gap-2">
                <input
                  className="field flex-1 uppercase"
                  placeholder="Sua palavra secreta (3–16 letras)"
                  value={palavra}
                  maxLength={16}
                  onChange={(e) => setPalavra(e.target.value)}
                  autoFocus
                />
                <button className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-2.5 text-sm font-bold text-white">
                  Pronto! 🤫
                </button>
              </form>
            ) : (
              <p className="text-sm font-bold text-text-muted">
                {nameOf(view.escolhedor)} está escolhendo a palavra… 🤫
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="text-center">
              <Boneco erros={view.erros} />
              <p className="text-xs font-bold text-text-muted">{view.erros}/{view.maxErros} erros</p>
              {view.letrasErradas.length > 0 && (
                <p className="mt-1 max-w-32 text-sm font-extrabold tracking-widest text-pop-magenta/80">
                  {view.letrasErradas.join(' ')}
                </p>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {/* palavra em tracinhos */}
              <div className="flex flex-wrap justify-center gap-1.5">
                {view.palavraVista.map((letra, i) => (
                  <span
                    key={i}
                    className={`flex h-11 w-8 items-center justify-center rounded-lg border-b-4 font-display text-xl font-extrabold sm:h-12 sm:w-9 ${
                      letra ? 'border-pop-cyan bg-ink-800 text-cream' : 'border-ink-600 bg-ink-950/50 text-transparent'
                    }`}
                  >
                    {letra ?? '·'}
                  </span>
                ))}
              </div>
              {view.ultimoEvento && (
                <p className="mt-2 text-center text-sm font-bold text-pop-yellow">{view.ultimoEvento}</p>
              )}
              <p className="mt-1 text-center text-xs text-text-muted">
                {souEscolhedor
                  ? 'Você escolheu — agora é só torcer pela forca! 😈'
                  : minhaVez
                    ? 'Sua vez: chute uma letra (acertou, joga de novo!)'
                    : `vez de ${nameOf(view.turno)}…`}
              </p>

              {/* teclado */}
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {LETRAS.map((l) => {
                  const certa = view.letrasCertas.includes(l)
                  const errada = view.letrasErradas.includes(l)
                  return (
                    <button
                      key={l}
                      onClick={minhaVez && !certa && !errada ? () => void agir({ type: 'letra', letra: l }) : undefined}
                      disabled={!minhaVez || certa || errada}
                      className={`size-9 rounded-lg font-display text-sm font-extrabold transition sm:size-10 ${
                        certa
                          ? 'bg-pop-green/25 text-pop-green'
                          : errada
                            ? 'bg-pop-magenta/20 text-pop-magenta/60 line-through'
                            : minhaVez
                              ? 'cursor-pointer bg-ink-800 ring-1 ring-ink-700 hover:-translate-y-0.5 hover:ring-pop-cyan'
                              : 'bg-ink-800/50 text-text-muted/50'
                      }`}
                    >
                      {l}
                    </button>
                  )
                })}
              </div>

              {/* chutar a palavra inteira */}
              {minhaVez && (
                <div className="mt-3 text-center">
                  {chutando ? (
                    <form onSubmit={enviaChute} className="mx-auto flex max-w-sm gap-2">
                      <input
                        className="field flex-1 uppercase"
                        placeholder="A palavra inteira…"
                        value={chute}
                        maxLength={16}
                        onChange={(e) => setChute(e.target.value)}
                        autoFocus
                      />
                      <button className="btn-pop bg-pop-orange px-4 py-2 text-sm font-extrabold text-ink-950">Chutar!</button>
                      <button type="button" onClick={() => setChutando(false)} className="btn-pop px-3 py-2 text-sm ring-1 ring-ink-700">
                        ✕
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setChutando(true)}
                      className="btn-pop px-4 py-2 text-xs font-bold ring-1 ring-ink-700 hover:ring-pop-orange"
                    >
                      💥 Arriscar a palavra inteira (+60, mas errar conta na forca!)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
