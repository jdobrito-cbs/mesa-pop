import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'
import AvatarSvg from './AvatarSvg'

const CUSTO = 1000
const CORES_BOLAS = ['#ff3ea5', '#22d3ee', '#facc15', '#34d399', '#a855f7', '#fb923c', '#ef4444', '#3b82f6']

/** posições fixas das bolinhas dentro do globo (procedural, sem aleatório no render) */
const BOLAS: Array<{ x: number; y: number; r: number; c: string }> = Array.from({ length: 16 }, (_, i) => {
  const ang = (i * 137.5 * Math.PI) / 180 // espiral de girassol: espalha bonito
  const rad = 8 + (i % 5) * 11
  return {
    x: 100 + Math.cos(ang) * rad,
    y: 92 + Math.sin(ang) * rad * 0.8,
    r: 9 + (i % 3) * 2,
    c: CORES_BOLAS[i % CORES_BOLAS.length]!,
  }
})

type Fase = 'inserir' | 'pronto' | 'girando' | 'caindo' | 'revelado'

/** Máquina gumball: insere 1.000 fichas (de 10 em 10), gira e a bolinha
 *  cai revelando um avatar ESPECIAL sorteado (posse permanente). */
export default function GumballModal({
  fichas: fichasIniciais,
  onFichas,
  onClose,
}: {
  fichas: number
  /** avisa o pai quando o saldo muda (após a troca) */
  onFichas: (n: number) => void
  onClose: () => void
}) {
  const { setAvatar } = useAuth()
  const [fichas, setFichas] = useState(fichasIniciais)
  const [inserido, setInserido] = useState(0)
  const [fase, setFase] = useState<Fase>('inserir')
  const [premio, setPremio] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [equipado, setEquipado] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const podeInserir = fase === 'inserir' && fichas >= CUSTO

  /** despeja as fichas de 10 em 10 (animação automática até 1.000) */
  function inserir() {
    if (!podeInserir || timerRef.current) return
    timerRef.current = setInterval(() => {
      setInserido((atual) => {
        const prox = Math.min(CUSTO, atual + 10)
        if (prox >= CUSTO) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          setFase('pronto')
        }
        return prox
      })
    }, 35)
  }

  async function retirar() {
    if (fase !== 'pronto') return
    setErro('')
    setFase('girando')
    try {
      const res = await api<{ avatar: string; fichas: number }>('/api/fichas/trocar', { method: 'POST' })
      setPremio(res.avatar)
      setFichas(res.fichas)
      onFichas(res.fichas)
      setTimeout(() => setFase('caindo'), 1100) // a manivela gira…
      setTimeout(() => setFase('revelado'), 2100) // …a bolinha cai e abre
    } catch (err) {
      setErro(err instanceof ApiRequestError ? err.message : 'A máquina engasgou — tente de novo')
      setFase('inserir')
      setInserido(0)
    }
  }

  function equipar() {
    if (!premio) return
    void api('/api/me/avatar', { method: 'PUT', body: { id: premio } })
      .then(() => { setAvatar(premio); setEquipado(true) })
      .catch(() => setErro('Não deu para equipar agora'))
  }

  function deNovo() {
    setPremio(null)
    setEquipado(false)
    setInserido(0)
    setFase('inserir')
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink-950/85 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">🎰 Máquina de avatares</h2>
          <button onClick={onClose} className="btn-pop px-3 py-1.5 text-sm ring-1 ring-ink-700">Fechar</button>
        </div>
        <p className="text-sm text-text-muted">1.000 fichas = 1 avatar ESPECIAL sorteado (fica seu para sempre)</p>
        {erro && <p className="mt-2 text-sm font-semibold text-pop-magenta">{erro}</p>}

        {/* a máquina */}
        <svg viewBox="0 0 200 270" className="mx-auto mt-3 w-64">
          {/* globo de vidro */}
          <circle cx={100} cy={92} r={72} fill="#dff4ff22" stroke="#9bd7f7" strokeWidth={3} />
          {BOLAS.map((b, i) => (
            <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={b.c} stroke="#ffffff55" strokeWidth={1.5} />
          ))}
          {/* reflexo do vidro */}
          <path d="M52 60 q18 -28 48 -32" stroke="#ffffff88" strokeWidth={5} fill="none" strokeLinecap="round" />
          {/* corpo */}
          <rect x={40} y={160} width={120} height={84} rx={12} fill="#e23b57" stroke="#a31f38" strokeWidth={3} />
          <rect x={52} y={150} width={96} height={16} rx={6} fill="#c92c47" />
          {/* fenda de fichas + contador */}
          <rect x={130} y={176} width={18} height={5} rx={2} fill="#5b0f20" />
          <rect x={56} y={172} width={58} height={22} rx={5} fill="#2a1020" />
          <text x={85} y={188} textAnchor="middle" fontSize={13} fontWeight={800} fill="#facc15">
            {inserido}
          </text>
          {/* manivela (gira na fase 'girando') */}
          <g style={{ transformOrigin: '100px 214px' }} className={fase === 'girando' ? 'animate-[spin_1.1s_ease-in-out]' : ''}>
            <circle cx={100} cy={214} r={13} fill="#f1d18d" stroke="#a3762c" strokeWidth={2.5} />
            <rect x={96.5} y={203} width={7} height={22} rx={3} fill="#a3762c" />
          </g>
          {/* saída da bolinha */}
          <rect x={86} y={244} width={28} height={16} rx={5} fill="#5b0f20" />
          {/* a bolinha do prêmio caindo */}
          {(fase === 'caindo' || fase === 'revelado') && (
            <circle cx={100} cy={fase === 'caindo' ? 100 : 252} r={11} fill="#facc15" stroke="#fff8" strokeWidth={2}
              style={{ transition: 'cy .8s cubic-bezier(.5,0,.8,1.4)' }} />
          )}
        </svg>

        {/* controles por fase */}
        {fase === 'inserir' && (
          <div className="mt-3">
            <p className="text-sm">Suas fichas: <b className="text-pop-yellow">🪙 {fichas.toLocaleString('pt-BR')}</b></p>
            <button
              onClick={inserir}
              disabled={!podeInserir}
              className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-2.5 text-sm text-white disabled:opacity-50"
            >
              🪙 Inserir fichas (10 em 10)
            </button>
            {fichas < CUSTO && <p className="mt-2 text-xs text-text-muted">Faltam {(CUSTO - fichas).toLocaleString('pt-BR')} fichas — você ganha 1 a cada 5 min jogando.</p>}
            {inserido > 0 && <p className="mt-1 text-xs text-text-muted">Inserindo… {inserido}/{CUSTO}</p>}
          </div>
        )}
        {fase === 'pronto' && (
          <button onClick={retirar} className="btn-pop mt-3 animate-bounce bg-gradient-to-br from-pop-yellow to-pop-orange px-6 py-3 font-display text-base font-extrabold text-ink-950">
            🎁 Retirar!
          </button>
        )}
        {fase === 'girando' && <p className="mt-3 text-sm font-semibold text-text-muted">girando a manivela…</p>}
        {fase === 'caindo' && <p className="mt-3 text-sm font-semibold text-text-muted">lá vem a bolinha…</p>}
        {fase === 'revelado' && premio && (
          <div className="mt-3">
            <div className="mx-auto w-fit animate-pop"><AvatarSvg id={premio} size={96} /></div>
            <p className="mt-1 font-display font-extrabold text-pop-yellow">✨ Avatar ESPECIAL conquistado!</p>
            <div className="mt-2 flex justify-center gap-2">
              <button onClick={equipar} disabled={equipado} className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-2 text-sm text-white disabled:opacity-60">
                {equipado ? '✓ Equipado!' : 'Equipar agora'}
              </button>
              <button onClick={deNovo} disabled={fichas < CUSTO} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 disabled:opacity-50">
                Girar de novo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
