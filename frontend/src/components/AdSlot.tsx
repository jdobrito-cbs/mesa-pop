import { useEffect, useRef } from 'react'

/**
 * Espaço de anúncio (Google AdSense) — a plataforma nasce PREPARADA:
 * sem `VITE_ADSENSE_CLIENT` configurado, não renderiza nada em produção
 * (e mostra um marcador discreto em dev, para enxergar os espaços).
 * Com o client ID no .env, o script carrega uma única vez e cada slot
 * vira um bloco responsivo do AdSense.
 */
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

let scriptInjected = false
function ensureScript() {
  if (scriptInjected || !CLIENT) return
  scriptInjected = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
}

export default function AdSlot({
  slot = (import.meta.env.VITE_ADSENSE_SLOT as string | undefined) ?? '',
  className = '',
}: {
  /** data-ad-slot do bloco (criado no painel do AdSense) */
  slot?: string
  className?: string
}) {
  const pushed = useRef(false)

  useEffect(() => {
    if (!CLIENT || pushed.current) return
    ensureScript()
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // bloqueador de anúncios — segue o jogo
    }
  }, [])

  if (!CLIENT) {
    // marcador visível só em desenvolvimento (para posicionar os espaços)
    return import.meta.env.DEV ? (
      <div
        className={`flex h-24 items-center justify-center rounded-card border-2 border-dashed border-ink-700 text-xs font-bold tracking-widest text-text-muted/50 uppercase ${className}`}
        aria-hidden="true"
      >
        espaço de anúncio
      </div>
    ) : null
  }

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: 'block' }}
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}
