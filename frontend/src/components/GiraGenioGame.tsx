import { useEffect, useRef, useState } from 'react'
import { catInfo, GG_CATEGORIAS, GG_META, type GGCategoria, type GGView } from '@mesapop/shared'

/**
 * Gira Gênio — roleta de 6 categorias. O jogador da vez gira, cai numa
 * categoria e responde; acerto ganha a coroa e joga de novo, erro passa a vez.
 * A resposta certa vive no servidor; aqui só chega o texto das opções.
 */

const TEMPO = 20 // segundos para responder (timer do cliente)

function polar(cx: number, cy: number, r: number, ang: number): [number, number] {
  const rad = (ang * Math.PI) / 180
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)]
}

function Roleta({ girando, rotation }: { girando: boolean; rotation: number }) {
  const R = 110
  const cx = 120
  const cy = 120
  return (
    <div className="relative" style={{ width: 240, height: 240 }}>
      {/* ponteiro */}
      <div
        className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
        style={{ width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '20px solid #fff' }}
        aria-hidden="true"
      />
      <svg
        width={240}
        height={240}
        viewBox="0 0 240 240"
        style={{ transform: `rotate(${rotation}deg)`, transition: girando ? 'transform 2.8s cubic-bezier(.12,.7,.2,1)' : 'none' }}
      >
        {GG_CATEGORIAS.map((cat, i) => {
          const [x1, y1] = polar(cx, cy, R, i * 60)
          const [x2, y2] = polar(cx, cy, R, (i + 1) * 60)
          const [ix, iy] = polar(cx, cy, R * 0.64, i * 60 + 30)
          return (
            <g key={cat.id}>
              <path d={`M${cx} ${cy} L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill={cat.cor} opacity={0.9} stroke="#0b1020" strokeWidth={1.5} />
              <text x={ix} y={iy + 8} fontSize={22} textAnchor="middle">{cat.icone}</text>
            </g>
          )
        })}
        <circle cx={cx} cy={cy} r={16} fill="#0b1020" stroke="#fff" strokeWidth={2} />
      </svg>
    </div>
  )
}

export default function GiraGenioGame({
  view,
  yourSeat,
  players,
  onGirar,
  onResponder,
}: {
  view: GGView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
  onGirar: () => void
  onResponder: (opcao: number) => void
}) {
  const suaVez = view.turn === yourSeat && view.winnerSeats.length === 0
  const [rotation, setRotation] = useState(0)
  const spins = useRef(0)
  const [tempo, setTempo] = useState(TEMPO)
  const respondidoRef = useRef(false)
  // etapa local da rodada: gira ~3s → SALTA a categoria → pergunta → resposta (3s)
  const [etapa, setEtapa] = useState<'ocioso' | 'girando' | 'revelando' | 'pergunta' | 'resposta'>('ocioso')
  const faseAnt = useRef(view.fase)
  const ultimoRef = useRef(view.ultimo)
  // pergunta capturada (o servidor zera view.pergunta ao responder — guardo p/ o reveal)
  const [perguntaCap, setPerguntaCap] = useState<{ texto: string; opcoes: string[]; catId: GGCategoria } | null>(null)
  const [minhaResp, setMinhaResp] = useState<number | null>(null)

  const nome = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`

  // sequência: girar (roleta 3s + salto da categoria) e resposta (mostra 3s a certa)
  useEffect(() => {
    const prevFase = faseAnt.current
    const prevUltimo = ultimoRef.current
    faseAnt.current = view.fase
    ultimoRef.current = view.ultimo

    // alguém acabou de responder → segura a pergunta 3s destacando a resposta certa
    if (view.ultimo && view.ultimo !== prevUltimo) {
      setEtapa('resposta')
      const t = setTimeout(() => setEtapa('ocioso'), 3000)
      return () => clearTimeout(t)
    }

    // alguém girou (fase → pergunta): roda a roleta, revela a categoria, mostra a pergunta
    if (view.fase === 'pergunta' && prevFase !== 'pergunta') {
      const k = GG_CATEGORIAS.findIndex((c) => c.id === view.categoria)
      spins.current += 5
      setRotation(spins.current * 360 + (360 - (k * 60 + 30)))
      setMinhaResp(null)
      if (view.pergunta && view.categoria) {
        setPerguntaCap({ texto: view.pergunta.texto, opcoes: view.pergunta.opcoes, catId: view.categoria })
      }
      setEtapa('girando')
      const t1 = setTimeout(() => setEtapa('revelando'), 3000)
      const t2 = setTimeout(() => setEtapa('pergunta'), 4300)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }

    if (view.fase === 'escolhendo' && !view.ultimo) setEtapa('ocioso')
  }, [view.fase, view.categoria, view.ultimo, view.pergunta])

  // timer da pergunta: só começa quando a pergunta REALMENTE aparece (após a roleta)
  useEffect(() => {
    respondidoRef.current = false
    if (etapa !== 'pergunta' || view.fase !== 'pergunta') return
    setTempo(TEMPO)
    if (!suaVez) return
    const inicio = Date.now()
    const t = setInterval(() => {
      const rest = TEMPO - Math.floor((Date.now() - inicio) / 1000)
      setTempo(Math.max(0, rest))
      if (rest <= 0 && !respondidoRef.current) {
        respondidoRef.current = true
        clearInterval(t)
        onResponder(-1) // tempo esgotado = erro
      }
    }, 250)
    return () => clearInterval(t)
  }, [etapa, view.fase, view.pergunta?.texto, suaVez, onResponder])

  function responde(i: number) {
    if (respondidoRef.current) return
    respondidoRef.current = true
    setMinhaResp(i)
    onResponder(i)
  }

  const cat = view.categoria ? catInfo(view.categoria) : null

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* coroas de cada jogador */}
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {players
          .slice()
          .sort((a, b) => a.seat - b.seat)
          .map((p) => (
            <div
              key={p.seat}
              className={`rounded-2xl px-3 py-2 ring-1 ${
                view.turn === p.seat && view.winnerSeats.length === 0 ? 'bg-ink-800 ring-pop-yellow' : 'bg-ink-900 ring-ink-700'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                {p.name}
                {view.turn === p.seat && view.winnerSeats.length === 0 && (
                  <span className="text-xs text-pop-yellow">é a vez</span>
                )}
              </div>
              <div className="mt-1 flex gap-1">
                {GG_CATEGORIAS.map((c) => {
                  const tem = view.coroas[p.seat]?.includes(c.id)
                  return (
                    <span
                      key={c.id}
                      title={c.nome}
                      className="grid size-6 place-items-center rounded-full text-xs"
                      style={{ backgroundColor: tem ? c.cor : 'rgba(255,255,255,.07)', opacity: tem ? 1 : 0.5 }}
                    >
                      {tem ? '👑' : c.icone}
                    </span>
                  )
                })}
                <span className="ml-1 text-xs text-text-muted tabular-nums">
                  {view.coroas[p.seat]?.length ?? 0}/{GG_META}
                </span>
              </div>
            </div>
          ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        {etapa === 'pergunta' && view.fase === 'pergunta' && view.pergunta && cat ? (
          <div className="w-full animate-pop">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold" style={{ backgroundColor: `${cat.cor}22`, color: cat.cor }}>
                {cat.icone} {cat.nome}
              </span>
              <span className="text-sm font-bold tabular-nums text-text-muted">⏱️ {tempo}s</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
              <div className="h-full bg-pop-cyan transition-all duration-300" style={{ width: `${(tempo / TEMPO) * 100}%` }} />
            </div>
            <p className="mt-4 text-center font-display text-xl font-bold">{view.pergunta.texto}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {view.pergunta.opcoes.map((op, i) => (
                <button
                  key={i}
                  onClick={() => responde(i)}
                  disabled={!suaVez}
                  aria-label={`opção ${'ABCD'[i]}`}
                  className="btn-pop rounded-2xl bg-ink-800 px-4 py-3 text-left font-semibold ring-1 ring-ink-700 hover:ring-pop-cyan disabled:opacity-50"
                >
                  <span className="mr-2 font-display text-pop-yellow">{'ABCD'[i]}</span>
                  {op}
                </button>
              ))}
            </div>
            {!suaVez && <p className="mt-3 text-center text-sm text-text-muted">{nome(view.turn)} está respondendo…</p>}
          </div>
        ) : etapa === 'resposta' && perguntaCap && view.ultimo ? (
          /* mostra a resposta CERTA por ~3s (verde) e a errada escolhida (vermelho) */
          <div className="w-full animate-pop">
            <p className="mt-1 text-center font-display text-xl font-bold">{perguntaCap.texto}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {perguntaCap.opcoes.map((op, i) => {
                const certa = op === view.ultimo!.respostaCerta
                const minhaErrada = minhaResp === i && !certa
                return (
                  <div
                    key={i}
                    className={`rounded-2xl px-4 py-3 text-left font-semibold ring-1 ${
                      certa
                        ? 'bg-pop-green/20 text-pop-green ring-pop-green'
                        : minhaErrada
                          ? 'bg-pop-magenta/20 text-pop-magenta ring-pop-magenta'
                          : 'bg-ink-800 text-text-muted ring-ink-700'
                    }`}
                  >
                    <span className="mr-2 font-display">{'ABCD'[i]}</span>
                    {op} {certa ? '✅' : minhaErrada ? '❌' : ''}
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-center text-sm font-bold text-cream">
              Resposta certa: «{view.ultimo.respostaCerta}»
            </p>
          </div>
        ) : (
          <>
            {/* slot de altura FIXA acima da roleta (para ela NÃO subir/descer) */}
            <div className="flex h-16 items-center justify-center">
              {etapa === 'revelando' && cat ? (
                <div key={cat.id} className="animate-pop text-center">
                  <p className="font-display text-2xl font-extrabold" style={{ color: cat.cor }}>
                    {cat.icone} {cat.nome}
                  </p>
                  <p className="text-xs font-semibold text-text-muted">prepare-se para responder!</p>
                </div>
              ) : etapa === 'girando' ? (
                <p className="animate-pulse text-sm font-bold text-pop-cyan">girando a roleta…</p>
              ) : view.ultimo ? (
                <p
                  className={`rounded-field px-4 py-2 text-center text-sm font-semibold ring-1 ${
                    view.ultimo.acertou ? 'bg-pop-green/15 text-pop-green ring-pop-green/40' : 'bg-pop-magenta/15 text-pop-magenta ring-pop-magenta/40'
                  }`}
                >
                  {view.ultimo.acertou
                    ? view.ultimo.ganhouCoroa
                      ? `✅ ${nome(view.ultimo.seat)} ganhou a coroa de ${catInfo(view.ultimo.categoria).nome}!`
                      : `✅ ${nome(view.ultimo.seat)} acertou!`
                    : `❌ ${nome(view.ultimo.seat)} errou.`}
                </p>
              ) : null}
            </div>
            <Roleta girando={etapa === 'girando' || etapa === 'revelando'} rotation={rotation} />
            {view.fase === 'escolhendo' &&
              view.winnerSeats.length === 0 &&
              (suaVez ? (
                <button
                  onClick={onGirar}
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-8 py-3.5 font-display text-lg font-extrabold text-white shadow-lg shadow-pop-purple/25"
                >
                  🎡 Girar a roleta!
                </button>
              ) : (
                <p className="text-sm text-text-muted">Vez de {nome(view.turn)}…</p>
              ))}
          </>
        )}

        <p className="text-center text-xs text-text-muted">
          Acerte para ganhar a coroa da categoria. Junte as {GG_META} coroas e vença!
        </p>
      </div>
    </div>
  )
}
