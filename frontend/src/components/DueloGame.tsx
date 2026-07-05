import { useCallback, useEffect, useState } from 'react'
import type { DueloView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Duelo de Palavras — a mesma palavra secreta para todos. Sua grade tem
 * letras; as dos rivais mostram SÓ as cores (mão escondida em palavras).
 */

const TECLADO = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

const cell = (f: string) =>
  f === 'g' ? 'bg-pop-green text-ink-950' : f === 'y' ? 'bg-pop-yellow text-ink-950' : 'bg-ink-700 text-cream/70'

export default function DueloGame({
  view,
  yourSeat,
  players,
}: {
  view: DueloView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [atual, setAtual] = useState('')
  const [aviso, setAviso] = useState('')
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Rival ${seat + 1}`
  const posso = yourSeat >= 0 && view.fase === 'jogando' && !view.acabei

  const enviar = useCallback(async () => {
    if (!posso || atual.length !== 5) return
    const res = await emitAck('game:action', { action: { type: 'palpite', palavra: atual } })
    if (!res.ok) {
      setAviso(res.error ?? 'Não deu')
      setTimeout(() => setAviso(''), 2000)
      return
    }
    setAtual('')
  }, [posso, atual])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!posso) return
      if (e.key === 'Enter') void enviar()
      else if (e.key === 'Backspace') setAtual((a) => a.slice(0, -1))
      else if (/^[a-zA-Z]$/.test(e.key)) setAtual((a) => (a.length < 5 ? a + e.key.toLowerCase() : a))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [posso, enviar])

  // teclas coloridas pelo melhor feedback
  const keyState = new Map<string, string>()
  for (const t of view.minha) {
    ;[...t.palpite].forEach((ch, i) => {
      const f = t.feedback[i]!
      const prev = keyState.get(ch)
      if (f === 'g' || (f === 'y' && prev !== 'g') || (!prev && f === 'b')) keyState.set(ch, f)
    })
  }

  const linhas = Array.from({ length: view.maxTentativas }, (_, i) => {
    const t = view.minha[i]
    if (t) return { letras: [...t.palpite], feedback: [...t.feedback], viva: false }
    if (i === view.minha.length && posso) return { letras: [...atual.padEnd(5, ' ')], feedback: null, viva: true }
    return { letras: Array.from({ length: 5 }, () => ' '), feedback: null, viva: false }
  })

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display font-bold">
            {view.fase === 'fim'
              ? view.palavra
                ? <>A palavra era <span className="text-pop-yellow uppercase">{view.palavra}</span></>
                : 'Fim!'
              : view.acertei
                ? '🏆 Você acertou!'
                : view.acabei
                  ? 'Tentativas esgotadas — torça!'
                  : 'Adivinhe a palavra:'}
          </p>
          <span className="rounded-full bg-ink-950/80 px-3 py-1 font-display font-extrabold text-pop-yellow tabular-nums">
            ⏱ {view.tempo}s
          </span>
        </div>
        {aviso && (
          <p className="mb-2 rounded-field bg-pop-magenta/15 px-3 py-1.5 text-center text-sm font-bold text-pop-magenta">
            {aviso}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {linhas.map((l, i) => (
            <div key={i} className="grid grid-cols-5 gap-1.5">
              {l.letras.map((ch, j) => (
                <div
                  key={j}
                  className={`flex aspect-square items-center justify-center rounded-xl font-display text-3xl font-extrabold uppercase ${
                    l.feedback ? cell(l.feedback[j]!) : ch !== ' ' ? 'bg-ink-800 ring-2 ring-pop-cyan/60' : 'bg-ink-800 ring-1 ring-ink-700'
                  }`}
                >
                  {ch.trim()}
                </div>
              ))}
            </div>
          ))}
        </div>

        {posso && (
          <div className="mt-4 flex flex-col items-center gap-1.5">
            {TECLADO.map((row, i) => (
              <div key={row} className="flex gap-1.5">
                {i === 2 && (
                  <button onClick={() => void enviar()} className="btn-pop rounded-lg bg-pop-purple px-3 text-xs font-extrabold text-white">
                    ENTER
                  </button>
                )}
                {[...row].map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setAtual((a) => (a.length < 5 ? a + ch : a))}
                    className={`flex h-10 w-7 items-center justify-center rounded-lg font-display text-sm font-extrabold uppercase active:scale-90 sm:w-9 ${
                      keyState.has(ch) ? cell(keyState.get(ch)!) : 'bg-ink-800 ring-1 ring-ink-700'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
                {i === 2 && (
                  <button onClick={() => setAtual((a) => a.slice(0, -1))} className="btn-pop rounded-lg bg-ink-800 px-3 text-sm ring-1 ring-ink-700" aria-label="Apagar">
                    ⌫
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* rivais: SÓ as cores */}
      <div className="flex flex-row gap-3 overflow-x-auto lg:flex-col">
        {view.rivais.map((r) => (
          <div key={r.seat} className={`card min-w-40 p-3 ${r.acertou ? 'ring-2 ring-pop-green' : ''}`}>
            <p className="mb-2 truncate text-sm font-bold">
              {r.acertou ? '🏆 ' : r.acabou ? '⛔ ' : '🔎 '}
              {nameOf(r.seat)}
            </p>
            <div className="flex flex-col gap-1">
              {Array.from({ length: view.maxTentativas }, (_, i) => (
                <div key={i} className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 5 }, (_, j) => (
                    <div
                      key={j}
                      className={`aspect-square rounded ${r.feedbacks[i] ? cell(r.feedbacks[i]![j]!) : 'bg-ink-800 ring-1 ring-ink-700'}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
