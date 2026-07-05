import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiRequestError } from '../lib/api'

/**
 * Fazenda Pop — uma CENA viva: canteiros de terra onde a planta cresce
 * visualmente, animais passeando pelo cercado com bolhas de produto para
 * coletar, árvores e cercas. O servidor calcula o crescimento (offline).
 */

interface CropInfo {
  slug: string
  name: string
  icon: string
  cost: number
  sell: number
  growSecs: number
}

interface PlotView {
  id: number
  crop: { slug: string; name: string; icon: string; sell: number } | null
  plantedAt: string | null
  readyAt: string | null
  isReady: boolean
  progress: number
}

interface AnimalView {
  id: number
  kind: string
  name: string
  icon: string
  produce: { name: string; icon: string; sell: number; readyAt: string; isReady: boolean } | null
  meat: { name: string; sell: number; matureAt: string; isMature: boolean }
}

interface AnimalForSale {
  kind: string
  name: string
  icon: string
  cost: number
  produce: { name: string; icon: string; sell: number; everySecs: number } | null
  meat: { name: string; sell: number; matureSecs: number }
}

interface FarmView {
  coins: number
  upgrades: { fertilizer: number }
  plots: PlotView[]
  animals: AnimalView[]
  barn: { max: number; owned: number; forSale: AnimalForSale[] }
  catalog: CropInfo[]
  shop: {
    plot: { price: number; owned: number; max: number } | null
    fertilizer: { price: number; level: number; max: number } | null
  }
  serverTime: string
}

const fmtTime = (secs: number) => {
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}min`
  if (secs >= 60) return `${Math.floor(secs / 60)}min ${Math.floor(secs % 60)}s`
  return `${Math.max(Math.ceil(secs), 0)}s`
}

/** decoração fixa da cena (posições em %) */
const DECOR = [
  { icon: '🌳', left: 2, top: 4, size: 44 },
  { icon: '🌳', left: 90, top: 2, size: 40 },
  { icon: '🏡', left: 80, top: 0, size: 52 },
  { icon: '🌻', left: 30, top: 2, size: 24 },
  { icon: '🌼', left: 45, top: 5, size: 18 },
  { icon: '🌷', left: 62, top: 3, size: 20 },
  { icon: '🪨', left: 12, top: 8, size: 18 },
]

export default function FarmPage() {
  const navigate = useNavigate()
  const [farm, setFarm] = useState<FarmView | null>(null)
  const [picker, setPicker] = useState<number | null>(null)
  const [animalOpen, setAnimalOpen] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [, forceTick] = useState(0)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    try {
      setFarm(await api<FarmView>('/api/farm'))
    } catch {
      showToast('Não deu para carregar a fazenda')
    }
  }, [])

  useEffect(() => {
    void load()
    const poll = setInterval(() => void load(), 30000)
    const tick = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load])

  async function call(path: string, body: unknown, okMsg?: (r: Record<string, unknown>) => string) {
    try {
      const r = await api<FarmView & Record<string, unknown>>(path, { body })
      setFarm(r)
      if (okMsg) showToast(okMsg(r))
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Algo deu errado')
    }
  }

  const now = Date.now()
  const openAnimal = farm?.animals.find((a) => a.id === animalOpen) ?? null

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">🌾</span> Fazenda Pop
        </h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-pop-yellow/15 px-4 py-1.5 font-display text-lg font-extrabold text-pop-yellow tabular-nums">
            🪙 {farm?.coins ?? '…'}
          </span>
          <button onClick={() => navigate('/mesa')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Voltar à mesa
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Sua fazenda vive no servidor — plante, crie e volte depois: tudo continua crescendo.
      </p>

      {toast && (
        <p className="mt-3 rounded-field bg-ink-800 px-4 py-2 text-sm font-semibold text-pop-yellow ring-1 ring-ink-700">
          {toast}
        </p>
      )}

      {/* ============ A CENA ============ */}
      <div
        className="relative mt-5 overflow-hidden rounded-card ring-2 ring-[#3E7A2F]"
        style={{ background: 'linear-gradient(180deg, #8CCB5E 0%, #6FB548 45%, #5CA23C 100%)' }}
      >
        {/* decoração */}
        {DECOR.map((d, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute select-none"
            style={{ left: `${d.left}%`, top: `${d.top}%`, fontSize: d.size }}
          >
            {d.icon}
          </span>
        ))}

        {/* canteiros */}
        <div className="relative z-10 flex flex-wrap justify-center gap-3 px-4 pt-16 pb-4 sm:justify-start sm:pl-6">
          {farm?.plots.map((plot) => {
            const readyAt = plot.readyAt ? new Date(plot.readyAt).getTime() : null
            const plantedAt = plot.plantedAt ? new Date(plot.plantedAt).getTime() : null
            const remaining = readyAt !== null ? (readyAt - now) / 1000 : null
            const ready = readyAt !== null && remaining !== null && remaining <= 0
            const progress =
              readyAt !== null && plantedAt !== null
                ? Math.min((now - plantedAt) / Math.max(readyAt - plantedAt, 1), 1)
                : 0
            const stageIcon = !plot.crop
              ? null
              : ready
                ? plot.crop.icon
                : progress < 0.35
                  ? '🌱'
                  : progress < 0.75
                    ? '🌿'
                    : plot.crop.icon
            return (
              <button
                key={plot.id}
                onClick={() => {
                  if (!plot.crop) setPicker(plot.id)
                  else if (ready)
                    void call('/api/farm/harvest', { plotId: plot.id }, (r) => {
                      const h = r.harvested as { icon: string; name: string; sell: number } | undefined
                      return h ? `${h.icon} ${h.name} vendida por 🪙 ${h.sell}!` : 'Colhido!'
                    })
                }}
                className={`relative flex h-24 w-24 flex-col items-center justify-center rounded-2xl transition sm:h-28 sm:w-28 ${
                  ready ? 'cursor-pointer ring-2 ring-pop-yellow' : plot.crop ? 'cursor-default' : 'cursor-pointer hover:ring-2 hover:ring-pop-green'
                }`}
                style={{
                  background:
                    'repeating-linear-gradient(180deg, #6B4A28 0px, #6B4A28 8px, #5C3E20 8px, #5C3E20 16px)',
                  boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.35), 0 3px 0 #4A3218',
                }}
                aria-label={plot.crop ? `Canteiro com ${plot.crop.name}` : 'Canteiro vazio — plantar'}
              >
                {!plot.crop ? (
                  <span className="rounded-full bg-[#4A3218]/70 px-3 py-1 text-xs font-bold text-[#D9BE93]">
                    🌱 plantar
                  </span>
                ) : (
                  <>
                    <span
                      aria-hidden="true"
                      className={ready ? 'animate-ripe' : ''}
                      style={{ fontSize: 20 + progress * 22 }}
                    >
                      {stageIcon}
                    </span>
                    {ready ? (
                      <span className="absolute -bottom-2 rounded-full bg-pop-yellow px-2.5 py-0.5 text-[11px] font-extrabold text-ink-950 shadow">
                        Colher +🪙{plot.crop.sell}
                      </span>
                    ) : (
                      <>
                        <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-[#4A3218]">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-pop-green to-pop-yellow"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                        <span className="mt-0.5 text-[10px] font-bold text-[#EADFC8] tabular-nums drop-shadow">
                          {fmtTime(remaining ?? 0)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>

        {/* cercado dos animais */}
        <div className="relative z-10 mx-4 mb-4 sm:mx-6">
          <div
            className="relative h-40 overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(180deg, #7CBB53 0%, #69A844 100%)',
              border: '5px solid #8D6B4B',
              boxShadow: 'inset 0 0 0 3px #6E5138, inset 0 6px 14px rgba(0,0,0,0.18)',
            }}
          >
            <span className="absolute top-1 left-3 rounded-full bg-[#6E5138]/85 px-3 py-0.5 text-[11px] font-extrabold text-[#EADFC8]">
              🏚️ Curral {farm ? `${farm.barn.owned}/${farm.barn.max}` : ''}
            </span>
            {farm?.animals.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-[#3E5A2B]">
                Compre animais na lojinha abaixo 👇
              </p>
            )}
            {farm?.animals.map((a, i) => {
              const produceReady = a.produce ? new Date(a.produce.readyAt).getTime() - now <= 0 : false
              const mature = new Date(a.meat.matureAt).getTime() - now <= 0
              const lane = 18 + ((i * 37) % 70) // % vertical
              const wanderDist = 60 + ((i * 53) % 120)
              const duration = 5 + ((i * 2.3) % 6)
              return (
                <div
                  key={a.id}
                  className="animate-wander absolute"
                  style={{
                    top: `${lane}%`,
                    left: `${6 + ((i * 23) % 40)}%`,
                    ['--wander-distance' as string]: `${wanderDist}px`,
                    animationDuration: `${duration}s`,
                  }}
                >
                  <button
                    onClick={() => setAnimalOpen(a.id)}
                    className="relative block cursor-pointer select-none"
                    aria-label={`${a.name} — abrir`}
                  >
                    {/* bolha de produto pronta (clique = coletar) */}
                    {produceReady && a.produce && (
                      <span
                        role="button"
                        aria-label={`Coletar ${a.produce.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          void call('/api/farm/animal/collect', { animalId: a.id }, (r) => {
                            const c = r.collected as { icon: string; name: string; sell: number } | undefined
                            return c ? `${c.icon} ${c.name} vendido por 🪙 ${c.sell}!` : 'Coletado!'
                          })
                        }}
                        className="animate-float absolute -top-7 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base shadow-lg ring-2 ring-pop-yellow"
                      >
                        {a.produce.icon}
                      </span>
                    )}
                    {/* selo de abate disponível */}
                    {mature && (
                      <span className="absolute -right-2.5 -bottom-1 flex size-5 items-center justify-center rounded-full bg-pop-orange text-[10px] shadow ring-1 ring-white/60">
                        🍖
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className="animate-face block"
                      style={{ fontSize: 34, animationDuration: `${duration * 2}s` }}
                    >
                      {a.icon}
                    </span>
                    <span
                      aria-hidden="true"
                      className="mx-auto block h-1.5 w-7 rounded-full bg-[#3E5A2B]/40"
                    />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ============ painéis ============ */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {/* lojinha de animais */}
        <div className="card p-4">
          <p className="font-display text-sm font-bold">🐄 Comprar animais</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {farm && farm.barn.owned >= farm.barn.max && (
              <p className="text-xs text-text-muted">Curral cheio!</p>
            )}
            {farm &&
              farm.barn.owned < farm.barn.max &&
              farm.barn.forSale.map((d) => (
                <button
                  key={d.kind}
                  onClick={() => void call('/api/farm/animal/buy', { kind: d.kind }, () => `${d.icon} ${d.name} chegou ao curral!`)}
                  disabled={farm.coins < d.cost}
                  className="btn-pop justify-between rounded-field bg-ink-900 px-3 py-2 text-xs ring-1 ring-ink-700 hover:ring-pop-green disabled:opacity-50"
                >
                  <span className="text-left">
                    {d.icon} <strong>{d.name}</strong>
                    <span className="block text-[10px] text-text-muted">
                      {d.produce ? `${d.produce.icon} ${fmtTime(d.produce.everySecs)} (+${d.produce.sell}) · ` : ''}
                      🍖 {d.meat.sell} após {fmtTime(d.meat.matureSecs)}
                    </span>
                  </span>
                  <span className="font-bold text-pop-yellow">🪙 {d.cost}</span>
                </button>
              ))}
          </div>
        </div>

        {/* melhorias */}
        <div className="card p-4">
          <p className="font-display text-sm font-bold">🏪 Melhorias</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {farm?.shop.plot ? (
              <button
                onClick={() => void call('/api/farm/buy', { upgrade: 'plot' }, () => 'Canteiro novo! 🎉')}
                disabled={farm.coins < farm.shop.plot.price}
                className="btn-pop justify-between rounded-field bg-ink-900 px-3 py-2 text-xs ring-1 ring-ink-700 hover:ring-pop-green disabled:opacity-50"
              >
                <span>🟫 Novo canteiro ({farm.shop.plot.owned}/{farm.shop.plot.max})</span>
                <span className="font-bold text-pop-yellow">🪙 {farm.shop.plot.price}</span>
              </button>
            ) : (
              <p className="text-xs text-text-muted">🟫 Fazenda no tamanho máximo!</p>
            )}
            {farm?.shop.fertilizer ? (
              <button
                onClick={() => void call('/api/farm/buy', { upgrade: 'fertilizer' }, (r) => `Adubo nível ${(r.upgrades as { fertilizer: number }).fertilizer}! 🌱`)}
                disabled={farm.coins < farm.shop.fertilizer.price}
                className="btn-pop justify-between rounded-field bg-ink-900 px-3 py-2 text-xs ring-1 ring-ink-700 hover:ring-pop-green disabled:opacity-50"
              >
                <span>💩 Adubo nível {farm.shop.fertilizer.level + 1} (−8% tempo)</span>
                <span className="font-bold text-pop-yellow">🪙 {farm.shop.fertilizer.price}</span>
              </button>
            ) : (
              <p className="text-xs text-text-muted">💩 Adubo no nível máximo!</p>
            )}
          </div>
        </div>

        {/* guia de sementes */}
        <div className="card p-4">
          <p className="font-display text-sm font-bold">📖 Sementes</p>
          <div className="mt-2 flex flex-col gap-1 text-xs">
            {farm?.catalog.map((c) => (
              <div key={c.slug} className="flex items-center justify-between rounded-field bg-ink-900 px-3 py-1.5 ring-1 ring-ink-700">
                <span>
                  {c.icon} {c.name} <span className="text-text-muted">· {fmtTime(c.growSecs)}</span>
                </span>
                <span className="tabular-nums">
                  <span className="text-pop-orange">−{c.cost}</span> → <span className="text-pop-green">+{c.sell}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* seletor de sementes */}
      {picker !== null && farm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4"
          onClick={(e) => e.target === e.currentTarget && setPicker(null)}
        >
          <div className="card w-full max-w-sm p-5">
            <p className="font-display text-lg font-bold">O que vamos plantar?</p>
            <div className="mt-3 flex flex-col gap-2">
              {farm.catalog.map((c) => (
                <button
                  key={c.slug}
                  disabled={farm.coins < c.cost}
                  onClick={() => {
                    const plotId = picker
                    setPicker(null)
                    void call('/api/farm/plant', { plotId, crop: c.slug }, () => `${c.icon} ${c.name} plantada!`)
                  }}
                  className="btn-pop justify-between rounded-field bg-ink-900 px-4 py-3 text-sm ring-1 ring-ink-700 hover:ring-pop-green disabled:opacity-40"
                >
                  <span className="text-left">
                    <span className="text-xl" aria-hidden="true">{c.icon}</span> <strong>{c.name}</strong>
                    <span className="block text-xs text-text-muted">cresce em {fmtTime(c.growSecs)} · vende por 🪙{c.sell}</span>
                  </span>
                  <span className="font-bold text-pop-yellow">🪙 {c.cost}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPicker(null)} className="btn-pop mt-3 w-full px-4 py-2 text-sm text-text-muted ring-1 ring-ink-700">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ficha do animal */}
      {openAnimal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4"
          onClick={(e) => e.target === e.currentTarget && setAnimalOpen(null)}
        >
          <div className="card w-full max-w-xs p-5 text-center">
            <p className="text-5xl" aria-hidden="true">{openAnimal.icon}</p>
            <p className="mt-1 font-display text-xl font-extrabold">{openAnimal.name}</p>
            {openAnimal.produce && (
              <p className="mt-1 text-xs text-text-muted">
                {openAnimal.produce.icon} {openAnimal.produce.name}:{' '}
                {new Date(openAnimal.produce.readyAt).getTime() - now <= 0
                  ? 'pronto!'
                  : `em ${fmtTime((new Date(openAnimal.produce.readyAt).getTime() - now) / 1000)}`}
              </p>
            )}
            <p className="text-xs text-text-muted">
              🍖 {openAnimal.meat.name} (+🪙{openAnimal.meat.sell}):{' '}
              {new Date(openAnimal.meat.matureAt).getTime() - now <= 0
                ? 'no ponto de abate'
                : `em ${fmtTime((new Date(openAnimal.meat.matureAt).getTime() - now) / 1000)}`}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {openAnimal.produce && (
                <button
                  disabled={new Date(openAnimal.produce.readyAt).getTime() - now > 0}
                  onClick={() => {
                    const id = openAnimal.id
                    setAnimalOpen(null)
                    void call('/api/farm/animal/collect', { animalId: id }, (r) => {
                      const c = r.collected as { icon: string; name: string; sell: number } | undefined
                      return c ? `${c.icon} ${c.name} vendido por 🪙 ${c.sell}!` : 'Coletado!'
                    })
                  }}
                  className="btn-pop bg-pop-yellow px-4 py-2.5 text-sm font-extrabold text-ink-950 disabled:opacity-50"
                >
                  Coletar {openAnimal.produce.icon} +🪙{openAnimal.produce.sell}
                </button>
              )}
              <button
                disabled={new Date(openAnimal.meat.matureAt).getTime() - now > 0}
                onClick={() => {
                  if (!window.confirm(`Abater ${openAnimal.name} por 🪙 ${openAnimal.meat.sell}?`)) return
                  const id = openAnimal.id
                  setAnimalOpen(null)
                  void call('/api/farm/animal/slaughter', { animalId: id }, (r) => {
                    const s = r.slaughtered as { name: string; sell: number } | undefined
                    return s ? `🍖 ${s.name} vendida por 🪙 ${s.sell}!` : 'Abatido!'
                  })
                }}
                className="btn-pop bg-pop-orange/25 px-4 py-2.5 text-sm font-extrabold text-pop-orange ring-1 ring-pop-orange/50 disabled:opacity-50"
              >
                🍖 Abater +🪙{openAnimal.meat.sell}
              </button>
              <button onClick={() => setAnimalOpen(null)} className="btn-pop px-4 py-2 text-xs text-text-muted ring-1 ring-ink-700">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
