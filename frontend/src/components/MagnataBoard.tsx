import { useEffect, useRef, useState } from 'react'
import {
  CORES_GRUPO,
  custoResgate,
  CUSTO_CASA,
  grupoDe,
  MAGNATA_CASAS,
  MAGNATA_FIANCA,
  valorHipoteca,
  type MagnataAction,
  type MagnataGrupo,
  type MagnataView,
} from '@mesapop/shared'

/**
 * Magnata — tabuleiro quadrado (perímetro de 11×11). Mostra as casas com cor
 * do grupo, preço, dono e casas/hotel; peões dos jogadores; e no centro os
 * dados, o CARTÃO DE CRÉDITO, as ações e o histórico.
 */

function cell(i: number): { r: number; c: number } {
  if (i <= 10) return { r: 11, c: 11 - i }
  if (i <= 20) return { r: 11 - (i - 10), c: 1 }
  if (i <= 30) return { r: 1, c: i - 20 + 1 }
  return { r: i - 30 + 1, c: 11 }
}

const reais = (n: number) => `R$ ${n}`
const PASSO_MS = 600 // tempo de cada "pulo" do peão de uma casa à seguinte
const ROLL_MS = 2000 // duração da rolagem animada dos dados
const POS_DADOS_MS = 600 // pausa após os dados pararem, antes de o peão andar

function DiceFace({ v }: { v: number }) {
  const P: Record<number, Array<[number, number]>> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  }
  return (
    <svg width={38} height={38} viewBox="0 0 34 34" className="drop-shadow">
      <rect x={1} y={1} width={32} height={32} rx={7} fill="#faf6ea" stroke="#d8cfb4" />
      {(P[v] ?? []).map(([c, r], i) => (
        <circle key={i} cx={7 + c * 10} cy={7 + r * 10} r={3.2} fill="#16233a" />
      ))}
    </svg>
  )
}

/** ficha-peão desenhada (chibi), na cor do jogador — bem mais visível que um ponto */
function Pawn({ color, mine }: { color: string; mine: boolean }) {
  return (
    <svg width={mine ? 22 : 19} height={mine ? 27 : 23} viewBox="0 0 16 20" className={`drop-shadow-md ${mine ? 'animate-bob' : ''}`}>
      <ellipse cx={8} cy={18.6} rx={5.2} ry={1.5} fill="rgba(0,0,0,.4)" />
      {/* base */}
      <path d="M2.8 18.5 C2.8 15.2 5 14 8 14 C11 14 13.2 15.2 13.2 18.5 Z" fill={color} stroke="#ffffffcc" strokeWidth={0.8} />
      {/* corpo (sino) */}
      <path d="M5.2 14.2 C4.4 11 5.2 9.2 8 8.4 C10.8 9.2 11.6 11 10.8 14.2 Z" fill={color} stroke="#ffffff99" strokeWidth={0.7} />
      {/* colarinho */}
      <ellipse cx={8} cy={8.5} rx={3} ry={1.1} fill={color} stroke="#ffffffcc" strokeWidth={0.7} />
      {/* cabeça */}
      <circle cx={8} cy={4.8} r={3.1} fill={color} stroke="#ffffffdd" strokeWidth={1} />
      {/* brilho */}
      <circle cx={6.7} cy={3.8} r={0.9} fill="#ffffff90" />
    </svg>
  )
}

export default function MagnataBoard({
  view,
  yourSeat,
  onAction,
}: {
  view: MagnataView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
  onAction: (a: MagnataAction) => void
}) {
  const eu = view.jogadores.find((j) => j.seat === yourSeat)
  const suaVez = view.turno === yourSeat && !view.vencedor
  const nomeSeat = (s: number) => view.jogadores.find((j) => j.seat === s)?.nome ?? `J${s + 1}`

  // propriedades onde EU posso construir (grupo completo, < hotel)
  const construir: number[] = []
  if (eu && suaVez && (view.fase === 'agir' || view.fase === 'comprar')) {
    for (const c of MAGNATA_CASAS) {
      if (c.tipo === 'propriedade' && view.donoDe[c.i] === yourSeat && grupoDe(c.grupo!).every((i) => view.donoDe[i] === yourSeat)) {
        if ((eu.casas[c.i] ?? 0) < 5) construir.push(c.i)
      }
    }
  }

  // estado da UI: lance do leilão + construtor de proposta + painel de imóveis
  const [lance, setLance] = useState('')
  const [negociar, setNegociar] = useState(false)
  const [gerir, setGerir] = useState(false)
  const [alvo, setAlvo] = useState<number | null>(null)
  const [ofP, setOfP] = useState<number[]>([])
  const [peP, setPeP] = useState<number[]>([])
  const [ofD, setOfD] = useState('')
  const [peD, setPeD] = useState('')

  // ——— animação em FILA: cada movimento (de QUALQUER jogador — robô ou humano)
  // entra numa fila e é tocado por INTEIRO (dados → pausa → passo a passo), UM de
  // cada vez. Assim o robô segue o MESMO princípio do usuário e nada "pula", mesmo
  // quando o servidor resolve o turno do robô muito rápido. ———
  const [mostra, setMostra] = useState<Record<number, number>>(() =>
    Object.fromEntries(view.jogadores.map((j) => [j.seat, j.pos])),
  )
  const [rolando, setRolando] = useState(false)
  const [faces, setFaces] = useState<[number, number]>([1, 1])
  const [animando, setAnimando] = useState(false)
  // última posição CONHECIDA do servidor por assento (para detectar movimentos)
  const posServidorRef = useRef<Record<number, number>>(
    Object.fromEntries(view.jogadores.map((j) => [j.seat, j.pos])),
  )
  const filaRef = useRef<Array<{ seat: number; de: number; ate: number }>>([])
  const tocandoRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout)
      if (spinRef.current) clearInterval(spinRef.current)
    },
    [],
  ) // limpa timers/intervalo ao desmontar

  useEffect(() => {
    const push = (fn: () => void, ms: number) => timersRef.current.push(setTimeout(fn, ms))

    function processa() {
      if (tocandoRef.current) return
      const mov = filaRef.current.shift()
      if (!mov) {
        setAnimando(false)
        setRolando(false)
        timersRef.current = []
        return
      }
      tocandoRef.current = true
      setAnimando(true)
      setRolando(true)
      const spin = setInterval(
        () => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]),
        90,
      )
      spinRef.current = spin
      push(() => {
        clearInterval(spin)
        setRolando(false)
      }, ROLL_MS)
      const dist = (mov.ate - mov.de + 40) % 40
      const inicio = ROLL_MS + POS_DADOS_MS // só anda após os dados pararem + a pausa
      const fim = () => {
        tocandoRef.current = false
        processa()
      }
      if (dist === 0) {
        push(fim, ROLL_MS)
      } else if (dist > 13) {
        // teleporte (prisão / carta) → salta direto na hora de andar
        push(() => setMostra((p) => ({ ...p, [mov.seat]: mov.ate })), inicio)
        push(fim, inicio + 60)
      } else {
        for (let k = 1; k <= dist; k++) push(() => setMostra((p) => ({ ...p, [mov.seat]: (mov.de + k) % 40 })), inicio + k * PASSO_MS)
        push(fim, inicio + dist * PASSO_MS + 60)
      }
    }

    // detecta cada peão que mudou de posição no servidor e enfileira o movimento
    let enfileirou = false
    for (const j of view.jogadores) {
      const prev = posServidorRef.current[j.seat]
      if (prev === undefined) {
        posServidorRef.current[j.seat] = j.pos
        continue
      }
      if (j.pos !== prev) {
        filaRef.current.push({ seat: j.seat, de: prev, ate: j.pos })
        posServidorRef.current[j.seat] = j.pos
        enfileirou = true
      }
    }
    if (enfileirou) processa()
  }, [view.jogadores])

  const posDe = (seat: number) => mostra[seat] ?? view.jogadores[seat]?.pos ?? 0

  // SINCRONIA: enquanto anima (dados + peão andando), o "resultado" (comprar/cobrar/
  // aviso/cartão) fica segurado — só aparece quando o peão CHEGA na casa.
  const cartaoRef = useRef(eu)
  if (!animando) cartaoRef.current = eu
  const cartao = animando ? cartaoRef.current : eu

  // último imóvel que EU adquiri (para sugerir construir logo após comprar)
  const propsRef = useRef<number[]>(eu?.props ?? [])
  const [ultimaCompra, setUltimaCompra] = useState<number | null>(null)
  useEffect(() => {
    const atual = eu?.props ?? []
    const novos = atual.filter((p) => !propsRef.current.includes(p))
    if (novos.length) setUltimaCompra(novos[novos.length - 1]!)
    propsRef.current = atual
  }, [eu?.props])

  const podeGerir = suaVez && (view.fase === 'rolar' || view.fase === 'agir' || view.fase === 'comprar')
  const meusImoveis = eu ? eu.props.slice().sort((a, b) => a - b) : []
  const nomeProps = (ids: number[]) => (ids.length ? ids.map((i) => MAGNATA_CASAS[i]!.nome).join(', ') : '—')
  const toggle = (arr: number[], set: (v: number[]) => void, i: number) =>
    set(arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i])
  const outros = view.jogadores.filter((j) => j.seat !== yourSeat && !j.falido)
  const alvoJog = alvo !== null ? view.jogadores.find((j) => j.seat === alvo) : undefined
  // imóveis negociáveis (sem casas) meus e do alvo
  const negMeus = meusImoveis.filter((i) => (eu?.casas[i] ?? 0) === 0)
  const negAlvo = (alvoJog?.props ?? []).filter((i) => (alvoJog?.casas[i] ?? 0) === 0)

  function enviaProposta() {
    if (alvo === null) return
    onAction({
      type: 'propor',
      para: alvo,
      ofereceProps: ofP,
      ofereceDinheiro: parseInt(ofD || '0', 10) || 0,
      pedeProps: peP,
      pedeDinheiro: parseInt(peD || '0', 10) || 0,
    })
    setNegociar(false)
    setAlvo(null)
    setOfP([])
    setPeP([])
    setOfD('')
    setPeD('')
  }

  return (
    <div className="mp-magnata mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* TABULEIRO */}
      <div
        className="mp-magnata-board relative mx-auto grid aspect-square w-full max-w-[860px] gap-0.5 rounded-card bg-[#0d5c3a] p-1.5 text-[8px] ring-2 ring-ink-700"
        style={{ gridTemplateColumns: 'repeat(11,1fr)', gridTemplateRows: 'repeat(11,1fr)' }}
      >
        {MAGNATA_CASAS.map((c) => {
          const p = cell(c.i)
          const dono = view.donoDe[c.i]
          const donoCor = dono !== null && dono !== undefined ? view.jogadores[dono]?.cor : undefined
          const grupoCor = c.grupo ? CORES_GRUPO[c.grupo] : undefined
          const nCasas = dono !== null && dono !== undefined ? (view.jogadores[dono]?.casas[c.i] ?? 0) : 0
          const hipotecada = dono !== null && dono !== undefined && !!view.jogadores[dono]?.hipotecadas.includes(c.i)
          return (
            <div
              key={c.i}
              style={{
                gridRow: p.r,
                gridColumn: p.c,
                // moldura na cor do DONO (quem é o terreno de quem)
                ...(donoCor ? { boxShadow: `inset 0 0 0 3px ${donoCor}` } : {}),
              }}
              className={`relative flex flex-col overflow-hidden rounded-[3px] bg-ink-900 leading-tight ${donoCor ? '' : 'ring-1 ring-ink-700'}`}
            >
              {grupoCor && <div style={{ background: grupoCor }} className="h-2 w-full shrink-0" />}
              <div className="flex-1 px-1 pt-0.5 font-bold text-cream/90">{c.nome}</div>
              {c.preco !== undefined && <div className="px-1 pb-0.5 text-[9px] font-bold text-pop-yellow">{reais(c.preco)}</div>}
              {c.tipo === 'sorte' && <div className="grid flex-1 place-items-center text-xl">🎲</div>}
              {c.tipo === 'cofre' && <div className="grid flex-1 place-items-center text-xl">📦</div>}
              {c.tipo === 'imposto' && <div className="grid flex-1 place-items-center text-xl">🏛️</div>}
              {c.tipo === 'prisao' && <div className="grid flex-1 place-items-center text-xl">🚓</div>}
              {c.tipo === 'vaprisao' && <div className="grid flex-1 place-items-center text-xl">👮</div>}
              {c.tipo === 'parada' && <div className="grid flex-1 place-items-center text-xl">🅿️</div>}
              {c.tipo === 'inicio' && <div className="grid flex-1 place-items-center text-xl">🏁</div>}
              {nCasas > 0 && (
                <div className="absolute right-0.5 top-2 text-[9px] leading-none">{nCasas >= 5 ? '🏨' : '🏠'.repeat(nCasas)}</div>
              )}
              {hipotecada && (
                <div className="absolute inset-0 grid place-items-center bg-ink-950/55 text-[8px] font-bold text-pop-yellow">🏦 HIP</div>
              )}
              {/* peões (na posição ANIMADA, pulando casa a casa) */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0.5 flex flex-wrap items-end justify-center gap-0">
                {view.jogadores.map(
                  (j) =>
                    !j.falido &&
                    posDe(j.seat) === c.i && <Pawn key={j.seat} color={j.cor} mine={j.seat === yourSeat} />,
                )}
              </div>
            </div>
          )
        })}

        {/* CENTRO: dados + ações */}
        <div
          style={{ gridRow: '3 / 10', gridColumn: '3 / 10' }}
          className="flex flex-col items-center justify-center gap-2 rounded-lg bg-ink-950/40 p-2 text-center"
        >
          <p className="font-display text-xl font-extrabold text-cream">MAGNATA</p>
          {(view.dados || rolando) && (
            <div className={`flex gap-2 ${rolando ? 'animate-bounce' : ''}`}>
              <DiceFace v={rolando ? faces[0] : (view.dados?.[0] ?? 1)} />
              <DiceFace v={rolando ? faces[1] : (view.dados?.[1] ?? 1)} />
            </div>
          )}
          {rolando && <p className="text-[11px] font-bold text-pop-cyan">rolando os dados…</p>}
          {!animando && view.aviso && <p className="max-w-[90%] text-[11px] leading-tight text-pop-yellow">{view.aviso}</p>}
          {view.vencedor !== null ? (
            <p className="font-display text-sm font-extrabold text-pop-green">🏆 {nomeSeat(view.vencedor)} venceu!</p>
          ) : (
            <p className="text-[10px] text-text-muted">
              Vez de <span className="font-bold text-cream">{nomeSeat(view.turno)}</span>
            </p>
          )}
        </div>
      </div>

      {/* PAINEL LATERAL */}
      <div className="flex flex-col gap-3">
        {/* seu cartão de crédito — valores segurados até o peão chegar */}
        {eu && cartao && (
          <div className="rounded-card bg-gradient-to-br from-pop-purple to-pop-magenta p-3 text-white shadow-lg">
            <div className="flex items-center justify-between text-xs opacity-90">
              <span>💳 Cartão Magnata</span>
              <span>{eu.nome}</span>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-[10px] opacity-80">Caixa</p>
                <p className="font-display text-xl font-extrabold tabular-nums">{reais(cartao.dinheiro)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] opacity-80">Crédito livre</p>
                <p className="font-display text-lg font-extrabold tabular-nums">{reais(cartao.cartaoLimite - cartao.cartaoUsado)}</p>
              </div>
            </div>
            <div className="mt-1 text-[10px] opacity-80">
              limite {reais(cartao.cartaoLimite)} · usado {reais(cartao.cartaoUsado)}
            </div>
          </div>
        )}

        {/* ações */}
        <div className="card flex flex-col gap-2 p-3">
          {view.vencedor !== null ? (
            <p className="text-center text-sm font-bold text-pop-green">Fim de jogo!</p>
          ) : view.leilao ? (
            /* LEILÃO em andamento */
            <>
              <p className="text-center text-sm font-extrabold text-pop-orange">🔨 Leilão: {MAGNATA_CASAS[view.leilao.casa]!.nome}</p>
              <p className="text-center text-xs text-text-muted">
                Lance atual:{' '}
                {view.leilao.lance > 0 ? (
                  <span className="font-bold text-pop-yellow">{reais(view.leilao.lance)} · {nomeSeat(view.leilao.lider!)}</span>
                ) : (
                  'nenhum ainda'
                )}
              </p>
              {view.leilao.vez === yourSeat ? (
                <>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={lance}
                    onChange={(e) => setLance(e.target.value)}
                    placeholder={`maior que ${view.leilao.lance}`}
                    className="field text-sm"
                    aria-label="Seu lance"
                  />
                  <button
                    onClick={() => {
                      const v = parseInt(lance || '0', 10)
                      if (v > view.leilao!.lance) {
                        onAction({ type: 'lance', valor: v })
                        setLance('')
                      }
                    }}
                    className="btn-pop bg-gradient-to-br from-pop-green to-pop-cyan px-4 py-2 text-sm font-bold text-white"
                  >
                    Dar lance
                  </button>
                  <button onClick={() => onAction({ type: 'desistir' })} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
                    Desistir
                  </button>
                </>
              ) : (
                <p className="text-center text-xs text-text-muted">Vez de {nomeSeat(view.leilao.vez)} dar o lance…</p>
              )}
            </>
          ) : view.proposta ? (
            /* PROPOSTA de troca pendente */
            <>
              <p className="text-center text-sm font-extrabold text-pop-cyan">🤝 Proposta de troca</p>
              <p className="text-xs text-text-muted">
                <b className="text-cream">{nomeSeat(view.proposta.de)}</b> dá: {nomeProps(view.proposta.ofereceProps)}
                {view.proposta.ofereceDinheiro > 0 ? ` + ${reais(view.proposta.ofereceDinheiro)}` : ''}
              </p>
              <p className="text-xs text-text-muted">
                e quer: {nomeProps(view.proposta.pedeProps)}
                {view.proposta.pedeDinheiro > 0 ? ` + ${reais(view.proposta.pedeDinheiro)}` : ''}
              </p>
              {view.proposta.para === yourSeat ? (
                <>
                  <button onClick={() => onAction({ type: 'aceitarTroca' })} className="btn-pop bg-gradient-to-br from-pop-green to-pop-cyan px-4 py-2 text-sm font-bold text-white">
                    ✅ Aceitar
                  </button>
                  <button onClick={() => onAction({ type: 'recusarTroca' })} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
                    Recusar
                  </button>
                </>
              ) : view.proposta.de === yourSeat ? (
                <>
                  <p className="text-center text-xs text-text-muted">Aguardando {nomeSeat(view.proposta.para)}…</p>
                  <button onClick={() => onAction({ type: 'recusarTroca' })} className="btn-pop px-4 py-1.5 text-xs ring-1 ring-ink-700">
                    Cancelar proposta
                  </button>
                </>
              ) : (
                <p className="text-center text-xs text-text-muted">{nomeSeat(view.proposta.de)} e {nomeSeat(view.proposta.para)} negociam…</p>
              )}
            </>
          ) : !suaVez ? (
            <p className="text-center text-sm text-text-muted">Aguarde: vez de {nomeSeat(view.turno)}…</p>
          ) : animando ? (
            <p className="text-center text-sm text-text-muted">
              {rolando ? '🎲 rolando os dados…' : '🚶 o peão está andando…'}
            </p>
          ) : (
            <>
              {view.fase === 'rolar' && (
                <>
                  <button onClick={() => onAction({ type: 'rolar' })} className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-3 font-display font-extrabold text-white">
                    🎲 {eu?.preso ? 'Tentar dupla' : 'Rolar dados'}
                  </button>
                  {eu?.preso && (
                    <button onClick={() => onAction({ type: 'fianca' })} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
                      Pagar fiança ({reais(MAGNATA_FIANCA)})
                    </button>
                  )}
                </>
              )}
              {view.fase === 'comprar' && view.compravel !== null && (
                <>
                  <button onClick={() => onAction({ type: 'comprar' })} className="btn-pop bg-gradient-to-br from-pop-green to-pop-cyan px-4 py-3 font-bold text-white">
                    🏠 Comprar {MAGNATA_CASAS[view.compravel]!.nome} ({reais(MAGNATA_CASAS[view.compravel]!.preco!)})
                  </button>
                  <button onClick={() => onAction({ type: 'passar' })} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
                    Passar (vai a leilão)
                  </button>
                </>
              )}
              {/* construir vem em destaque ANTES de encerrar — logo após comprar */}
              {construir.length > 0 && (view.fase === 'agir' || view.fase === 'comprar') && (
                <>
                  <p className="text-center text-xs font-bold text-pop-green">🏗️ Você tem o grupo — construa!</p>
                  {construir.map((i) => (
                    <button
                      key={i}
                      onClick={() => onAction({ type: 'construir', casa: i })}
                      className="btn-pop bg-gradient-to-br from-pop-green to-pop-cyan px-3 py-2 text-xs font-bold text-white"
                    >
                      Construir em {MAGNATA_CASAS[i]!.nome} ({reais(CUSTO_CASA[MAGNATA_CASAS[i]!.grupo as MagnataGrupo] ?? 100)})
                    </button>
                  ))}
                </>
              )}
              {/* acabou de comprar mas ainda não tem o grupo → dica */}
              {view.fase === 'agir' && construir.length === 0 && eu && ultimaCompra !== null && (
                <p className="text-center text-[11px] text-text-muted">
                  Complete o grupo de {MAGNATA_CASAS[ultimaCompra]!.nome} para poder construir.
                </p>
              )}
              {(view.fase === 'agir' || view.fase === 'fim') && (
                <button onClick={() => onAction({ type: 'encerrar' })} className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-3 font-bold text-white">
                  Encerrar turno
                </button>
              )}

              {/* negociar + gerir imóveis (hipoteca/venda) */}
              {podeGerir && (view.fase === 'agir' || view.fase === 'comprar') && outros.length > 0 && (
                <button onClick={() => setNegociar((v) => !v)} className="btn-pop px-3 py-1.5 text-xs ring-1 ring-pop-cyan/50 hover:ring-pop-cyan">
                  🤝 {negociar ? 'Fechar negociação' : 'Negociar com alguém'}
                </button>
              )}
              {podeGerir && meusImoveis.length > 0 && (
                <button onClick={() => setGerir((v) => !v)} className="btn-pop px-3 py-1.5 text-xs ring-1 ring-pop-orange/50 hover:ring-pop-orange">
                  🏦 {gerir ? 'Fechar imóveis' : 'Gerir imóveis (hipoteca)'}
                </button>
              )}

              {/* construtor de proposta */}
              {negociar && (
                <div className="mt-1 flex flex-col gap-2 rounded-field bg-ink-950/50 p-2 ring-1 ring-ink-700">
                  <p className="text-[11px] font-bold text-text-muted">Trocar com:</p>
                  <div className="flex flex-wrap gap-1">
                    {outros.map((o) => (
                      <button
                        key={o.seat}
                        onClick={() => { setAlvo(o.seat); setPeP([]) }}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${alvo === o.seat ? 'bg-pop-cyan/25 ring-pop-cyan' : 'ring-ink-700'}`}
                      >
                        {o.nome}
                      </button>
                    ))}
                  </div>
                  {alvo !== null && (
                    <>
                      <p className="text-[11px] font-bold text-text-muted">Você oferece:</p>
                      <div className="flex flex-wrap gap-1">
                        {negMeus.length === 0 && <span className="text-[11px] text-text-muted">nenhum imóvel livre</span>}
                        {negMeus.map((i) => (
                          <button key={i} onClick={() => toggle(ofP, setOfP, i)} className={`rounded px-1.5 py-0.5 text-[10px] ring-1 ${ofP.includes(i) ? 'bg-pop-green/25 ring-pop-green' : 'ring-ink-700'}`}>
                            {MAGNATA_CASAS[i]!.nome}
                          </button>
                        ))}
                      </div>
                      <input type="number" inputMode="numeric" value={ofD} onChange={(e) => setOfD(e.target.value)} placeholder="+ dinheiro (opcional)" className="field text-xs" aria-label="Dinheiro que você oferece" />
                      <p className="text-[11px] font-bold text-text-muted">Você pede de {nomeSeat(alvo)}:</p>
                      <div className="flex flex-wrap gap-1">
                        {negAlvo.length === 0 && <span className="text-[11px] text-text-muted">nenhum imóvel livre</span>}
                        {negAlvo.map((i) => (
                          <button key={i} onClick={() => toggle(peP, setPeP, i)} className={`rounded px-1.5 py-0.5 text-[10px] ring-1 ${peP.includes(i) ? 'bg-pop-magenta/25 ring-pop-magenta' : 'ring-ink-700'}`}>
                            {MAGNATA_CASAS[i]!.nome}
                          </button>
                        ))}
                      </div>
                      <input type="number" inputMode="numeric" value={peD} onChange={(e) => setPeD(e.target.value)} placeholder="+ dinheiro pedido (opcional)" className="field text-xs" aria-label="Dinheiro que você pede" />
                      <button onClick={enviaProposta} className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-3 py-1.5 text-xs font-bold text-white">
                        Enviar proposta
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* gestão de imóveis: hipotecar / resgatar / vender casa */}
              {gerir && (
                <div className="mt-1 flex flex-col gap-1.5 rounded-field bg-ink-950/50 p-2 ring-1 ring-ink-700">
                  {meusImoveis.map((i) => {
                    const c = MAGNATA_CASAS[i]!
                    const hipotecada = eu!.hipotecadas.includes(i)
                    const casas = eu!.casas[i] ?? 0
                    return (
                      <div key={i} className="flex items-center gap-1 text-[11px]">
                        <span className={`min-w-0 flex-1 truncate ${hipotecada ? 'text-text-muted line-through' : ''}`}>{c.nome}</span>
                        {casas > 0 && (
                          <button onClick={() => onAction({ type: 'venderCasa', casa: i })} className="rounded px-1.5 py-0.5 ring-1 ring-ink-600 hover:ring-pop-orange">
                            vender casa +{Math.round((CUSTO_CASA[c.grupo as MagnataGrupo] ?? 100) / 2)}
                          </button>
                        )}
                        {!hipotecada && casas === 0 && c.preco !== undefined && (
                          <button onClick={() => onAction({ type: 'hipotecar', casa: i })} className="rounded px-1.5 py-0.5 text-pop-yellow ring-1 ring-ink-600 hover:ring-pop-yellow">
                            hipotecar +{valorHipoteca(c.preco)}
                          </button>
                        )}
                        {hipotecada && c.preco !== undefined && (
                          <button onClick={() => onAction({ type: 'resgatar', casa: i })} className="rounded px-1.5 py-0.5 text-pop-green ring-1 ring-ink-600 hover:ring-pop-green">
                            resgatar −{custoResgate(c.preco)}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* jogadores */}
        <div className="card p-3">
          <p className="mb-2 font-display text-sm font-bold">Jogadores</p>
          <div className="flex flex-col gap-1.5">
            {view.jogadores.map((j) => (
              <div key={j.seat} className={`flex items-center gap-2 rounded-field px-2 py-1 text-xs ring-1 ${j.seat === view.turno && !view.vencedor ? 'bg-ink-800 ring-pop-yellow' : 'bg-ink-900 ring-ink-700'} ${j.falido ? 'opacity-40' : ''}`}>
                <span style={{ backgroundColor: j.cor }} className="size-3 rounded-full" />
                <span className="min-w-0 flex-1 truncate font-semibold">{j.nome}{j.preso ? ' 🚓' : ''}{j.falido ? ' 💥' : ''}</span>
                <span className="tabular-nums text-pop-yellow">{reais(j.dinheiro)}</span>
                <span className="tabular-nums text-text-muted">🏠{j.props.length}</span>
              </div>
            ))}
          </div>
        </div>

        {/* log */}
        <div className="card max-h-40 overflow-y-auto p-3 text-xs text-text-muted">
          {view.log.map((l, i) => (
            <p key={i} className={i === 0 ? 'font-semibold text-cream' : ''}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
