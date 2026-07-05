import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="border-t border-ink-700/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
        <Logo className="text-xl" />
        <p className="text-sm text-text-muted">
          Sua mesa de jogos, do seu jeito. Feita para jogar com quem você gosta.
        </p>
        <p className="text-xs text-text-muted/70">
          O Mesa Pop exibe anúncios para se manter no ar. Seus dados de jogo ficam no
          nosso próprio servidor.
        </p>
      </div>
    </footer>
  )
}
