# Mesa Pop — Memória do Projeto

Plataforma web de jogos casuais (multiplayer e single-player) com sistema de
salas, contas de usuário e painel administrativo completo. **Self-hosted**
(servidor próprio Linux), foco em privacidade e controle total dos dados.

**Princípio arquitetural central: REAPROVEITAMENTO.** Um esqueleto de salas,
uma engine 2D e um sistema de rede em tempo real servem múltiplos jogos.
Base sólida primeiro; os jogos plugam nela.

---

## ⚠️ ESTADO ATUAL DO PROJETO (atualizar sempre ao concluir trabalho)

- **Fase atual**: FASE 2 — ✅ CONCLUÍDA (2026-07-04). FASES 0 e 1 ✅.
- **Última atualização**: 2026-07-04
- **FASE 2 entregue** (esqueleto de salas + Damas end-to-end):
  - `/shared/checkers.ts`: regras brasileiras completas e puras (peão captura
    p/ trás, dama voadora, captura obrigatória + lei da maioria via DFS, peça
    não saltada 2x, promoção só ao parar na última fileira, empate aos 40
    lances quietos). 14 testes de regra.
  - `/shared/rooms.ts`: protocolo socket tipado (RoomView, Ack, chat).
  - Backend `realtime/roomManager.ts`: GENÉRICO para todos os jogos —
    criar sala pública/privada, código de convite (6 chars sem ambíguos),
    entrar, sair, host, sorteio de assentos, reconexão (rejoin restaura
    estado + chat), W.O. após 60s desconectado em partida (15s na espera),
    Match/MatchPlayer no banco (rankings ganham dados reais).
  - `games/module.ts`: interface GameModule {init, play, getStateFor, result}
    + registry — jogos novos só implementam isso. `games/checkers.ts` pluga
    as regras de /shared.
  - Socket.IO autenticado por JWT no handshake (verifica user ativo).
    Vite proxy e nginx com upgrade websocket configurados.
  - **Chat da sala** (adendo do usuário): 'chat:send' com trim, máx 300,
    anti-flood 500ms; histórico (100) reenviado no join/reconexão.
    UI `RoomChat` ao lado do tabuleiro/sala de espera.
  - Frontend: `/jogos/:slug` (criar sala, entrar por código, listar salas),
    `/sala/:code` (espera com código copiável + partida + overlay de fim),
    `CheckersBoard` (tabuleiro girado para o seat 1, lances legais calculados
    localmente com a MESMA lógica compartilhada, servidor revalida).
    Ficha do fliperama agora navega para o jogo habilitado.
  - Hook de dev `window.__game` no RoomPage (só import.meta.env.DEV) para
    testes automatizados de UI.
  - 55 testes passando. Demo real: 2 usuárias jogaram 41 lances até vitória
    natural, com chat, e o ranking do admin refletiu a partida.
- **FASE 1 entregue**:
  - API admin completa em `backend/src/routes/admin/` (todas exigem role
    ADMIN via hook de escopo): stats (DAU/MAU/partidas/salas), CRUD de
    usuários com busca+paginação, ban temporário/permanente com motivo
    (ban/desativação revoga TODAS as sessões), export CSV, auditoria com
    filtros (email/ação/período) + lista de ações distintas, toggle de jogos
    (desabilitar fecha salas WAITING; partidas em andamento podem terminar —
    decisão registrada), salas ao vivo + encerrar, rankings (jogos mais
    jogados por período; jogadores por vitórias/partidas/recorde, global ou
    por jogo), avisos (Announcement CRUD → banner no lobby).
  - Guardas: admin não se rebaixa/desativa/exclui (SELF_LOCKOUT/SELF_DELETE);
    delete de usuário com salas criadas → 409 sugerindo desativação.
  - Model novo: Announcement (migração `announcements`).
  - Frontend: /admin com sidebar (Visão geral, Usuários, Auditoria, Jogos,
    Salas ao vivo, Rankings, Avisos), modais de criar/editar/banir, gráfico
    de barras série única (cor única pop-purple, rótulos diretos + tabela).
  - Lobby real na "Minha mesa": /api/games (habilitados), /api/rooms
    (salas públicas WAITING), /api/announcements (banner 📣), seção
    "Chegando na mesa" com o restante do catálogo.
  - Client: api() renova sessão automaticamente num 401 (refresh + retry 1x).
  - 37 testes passando (12 novos de admin). Fluxo verificado no browser:
    habilitar Damas no admin → aparece no lobby; aviso criado → banner.
- **Concluído até agora**:
  - Monorepo npm workspaces (`/shared`, `/backend`, `/frontend`) + git.
  - Backend Fastify + Prisma (schema completo: User, RefreshToken, AuditLog,
    Game, Room, RoomPlayer, Match, MatchPlayer, Score) + migração `init`.
  - Auth completo: register/login/refresh/logout/me. JWT access (15min) +
    refresh token OPACO rotativo (hash SHA-256 no banco, cookie httpOnly em
    `/api/auth`). Senhas argon2id. Rate limit nas rotas de auth. Auditoria
    automática (register, login, login_failed).
  - Seed idempotente: admin (via ADMIN_EMAIL/ADMIN_PASSWORD do .env) +
    14 jogos do catálogo (fonte: `shared/src/games.ts`; seed NÃO sobrescreve
    `isEnabled` de jogos existentes).
  - Identidade visual completa: tokens em `frontend/src/styles/global.css`
    (@theme Tailwind v4), logos em `/branding`, favicon.svg, PWA manifest +
    ícones 192/512 (gerados por `npm run icons -w frontend`), STYLE_GUIDE.md.
  - Frontend: landing, cadastro, login, "Minha mesa" (rota protegida),
    header/footer, GameCard, animação CoinInsert (ficha no fliperama).
  - Docker: compose com db (sempre) + backend/frontend (profile `full`,
    nginx proxy /api → mesmo origin em produção).
  - 25 testes passando (validação compartilhada + integração completa do auth
    com rotação/replay/revogação). Typecheck limpo nos 3 workspaces.
  - Fluxo verificado de ponta a ponta no browser (cadastro real pela UI →
    área logada) — desktop e mobile.
- **Decisões técnicas tomadas**:
  - Backend roda via tsx (build = typecheck apenas) — evita fricção ESM.
  - Prisma lê `backend/.env` (copiar o `.env` da raiz para lá em dev).
  - Refresh token opaco (não JWT) com rotação e revogação por hash.
  - Dev: Vite proxy `/api` → :3001 (mesmo origin). Produção: nginx proxy.
  - Fontes self-hosted via @fontsource (privacidade, sem CDN).
- **Próximo passo**: apresentar plano curto da FASE 3 (jogos de mão
  escondida: Dominó e One — getStateFor filtrando por jogador) e aguardar
  OK do usuário.

> Ao final de cada sessão de trabalho, atualize esta seção: fase atual, o que
> foi concluído, decisões tomadas e o próximo passo.

---

## Regras de trabalho (OBRIGATÓRIAS — como o usuário quer que eu trabalhe)

1. **Trabalhar POR FASES, nunca tudo de uma vez.** Começar pela FASE 0 e só
   avançar quando ela estiver rodando e testada.
2. **Antes de cada fase, apresentar um plano curto** do que será criado e
   **esperar o OK do usuário**. Nunca iniciar uma fase sem aprovação.
3. Priorizar **código limpo, tipado e testável** sobre velocidade.
4. Lógica de jogo em `/shared` para reuso cliente/servidor onde aplicável —
   **a validação no servidor é a fonte de verdade**.
5. Se um requisito for ambíguo ou uma decisão tiver trade-offs relevantes,
   **perguntar em vez de assumir**.
6. **Nunca usar nomes/arte com marca registrada** (Uno, Mario, etc.) — usar
   equivalentes genéricos (ex.: Uno → "One" ou nome próprio).
7. **Commits pequenos e descritivos** por funcionalidade.
8. Se algo na stack definida for má escolha para um requisito específico,
   **sinalizar e propor alternativa ANTES de implementar**.
9. Idioma do usuário: **português (pt-BR)**. Comunicar em pt-BR.

---

## Stack técnica (DEFINIDA — não improvisar)

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite; TailwindCSS para UI |
| Jogos de ação | HTML5 Canvas 2D API pura (sem engine de terceiros pesada) |
| Backend | Node.js + TypeScript; Fastify (ou Express) para REST |
| Tempo real | WebSocket via `ws` ou Socket.IO (Socket.IO tem reconexão e salas nativas — bom para começar) |
| Banco | PostgreSQL + Prisma (ORM) |
| Auth | JWT (access + refresh); senhas com argon2 (preferível) ou bcrypt |
| Deploy | Docker + docker-compose (app, banco, reverse proxy) |
| Estrutura | Monorepo: `/frontend`, `/backend`, `/shared` (tipos + lógica de jogo compartilhada) |

---

## Identidade visual — "Mesa Pop"

"Mesa" = lugar de reunião, social, encontro para jogar. "Pop" = cores
vibrantes, energia, leveza. Estética **colorida, amigável, arredondada e
enérgica** — NUNCA corporativa ou sóbria. Entre um fliperama moderno e um app
casual alegre.

- **Paleta**: viva e alto-contraste. Base: roxo/magenta + ciano/turquesa como
  primárias, acentos amarelo/laranja "pop", fundos escuros suaves (para as
  cores saltarem) OU claros bem limpos. Design token set coerente (cores,
  espaçamentos, raios de borda).
- **Cantos arredondados** generosos em cards, botões e modais.
- **Tipografia**: display font arredondado/geométrico e divertido para títulos
  e logo; sans-serif limpa para texto.
- **Microinterações**: hovers, "pops" de escala em botões, transições suaves —
  a plataforma deve parecer viva e lúdica.
- **Cards de jogo** no lobby: peças coloridas e convidativas, cada jogo com sua
  cor/ícone, grade tipo "tabuleiro".
- **Responsivo** desktop e mobile.
- **Animação de "ficha no fliperama"** (pedido do usuário em 2026-07-04): ao
  escolher um jogo, tocar uma animação de ficha/moeda sendo inserida num
  arcade — ar de jogos antigos. Componente reutilizável (`CoinInsert`) usado
  como transição padrão de entrada em TODOS os jogos.
- **Assentos e duplas no Dominó** (pedido do usuário em 2026-07-04): o
  usuário ESCOLHE o assento na sala de espera; a dupla é sempre quem senta
  em frente (assentos 0+2 vs 1+3). Se preferir, escolhe a DUPLA em vez do
  assento (senta no primeiro lugar livre dela); se a dupla estiver cheia,
  vai automaticamente para a outra. Quem não escolher nada recebe assento
  livre sorteado no início. Implementado como capacidade genérica
  (`seatPicking` no GameModule) — reutilizável por outros jogos.
- **Espectadores + fila rotativa** (pedidos do usuário em 2026-07-04):
  Dominó e Xadrez têm sala de espera/espectadores — quem entra com a mesa
  cheia (ou em partida) assiste ao vivo SEM VER as pedras/cartas dos
  jogadores (visão de assento -1, filtrada no servidor). Na sala de espera,
  o usuário PODE escolher a dupla desde já (senta se houver vaga); senão,
  fica aguardando ser chamado. **Rotação estilo bar**: quando uma dupla
  perde, ela sai para o fim da fila e a próxima dupla da fila entra em
  seguida para jogar — os vencedores FICAM na mesa. A sala não fecha entre
  partidas (chat contínuo). Flags no GameModule: `allowSpectators`,
  `seatPicking`, `rotation` (ligar também no Xadrez na Fase 8).
- **Chat da sala** (pedido do usuário em 2026-07-04): TODO jogo multijogador
  tem uma janela de chat geral para conversar com os parceiros da sala.
  Implementado no esqueleto de salas (Fase 2) — vale automaticamente para
  todos os jogos multiplayer futuros. Mensagens em memória por sala (últimas
  100, reenviadas na reconexão), sanitizadas e limitadas no servidor.
  Moderação de chat pelo admin: candidata a fase futura.
- **Logo**: "Mesa Pop" em SVG. Wordmark com display font divertido; explorar
  "mesa" e/ou "pop" (ex.: "O" de Pop como ficha de jogo, bolha estourando).
  Variações: horizontal, empilhada, monocromática.
- **Ícone**: quadrado em SVG, simples, reconhecível em tamanho pequeno
  (monograma "MP", ficha estilizada ou elemento "pop"). Gerar favicon e
  tamanhos PWA (192, 512).
- **PWA**: instalável com nome "Mesa Pop", ícone e theme color no manifest.
- **`STYLE_GUIDE.md`**: documentar paleta (hex), fontes, tokens e uso do logo
  para manter consistência entre todos os jogos e telas.

---

## Arquitetura em camadas

### 1. Núcleo de plataforma (construir primeiro)
- Contas: cadastro, login, sessão, refresh de token.
- Salas genéricas e reutilizáveis: sala pública/privada, código de convite,
  entrar/sair, lista de jogadores, host, **reconexão**.
- Lobby: listagem de jogos disponíveis e salas abertas por jogo.
- Rede em tempo real desacoplada da lógica de cada jogo: um **`GameRoom`
  abstrato** que jogos específicos estendem.

### 2. Servidor de jogo autoritativo
- O servidor guarda o estado real e valida todas as jogadas.
- Jogos de mão escondida (One, Dominó) **NUNCA enviam a mão dos outros ao
  cliente** — `getStateFor(player)` filtra por jogador.
- Ação em tempo real: servidor autoritativo com client-side prediction onde
  necessário (fase avançada; começar simples).

### 3. Jogos (plugáveis)
Cada jogo é um módulo implementando interface comum, ex.:
`GameModule { init, onPlayerJoin, onAction, getStateFor(player), tick }`.

### As quatro famílias de engine
1. **Turno** — cartas e tabuleiro (estado discreto, sem tempo real).
2. **2D top-down de ação** — corrida, moto, 1942, nave (ângulo/velocidade,
   colisão, scroll — mesma base; 1942 = cenário se move; corrida = câmera segue
   o jogador).
3. **Flocking** — cardume de peixes (boids). Autocontida.
4. **Simulação econômica** — fazenda (grade + temporizadores + persistência).

---

## Sistema de contas

- **Cadastro**: e-mail, nome, telefone, senha + confirmação. Validação de
  e-mail (formato + unicidade), telefone (formato), senha forte.
- **Hash**: argon2 (preferível). Nunca senha em texto plano.
- **Verificação de e-mail**: opcional na fase 1, mas estruturar para adicionar.
- **Login**: e-mail + senha → JWT. Refresh token em cookie httpOnly.
- **Perfil**: nome de exibição, avatar (opcional), estatísticas (jogos,
  vitórias, recordes).
- **Roles**: `user` e `admin`. Rotas admin protegidas por middleware de role.
  Primeiro usuário ou usuário semeado (seed) é admin.

---

## Painel do Admin (requisitos)

Área protegida, só `admin`:

1. **Dashboard**: total de usuários, ativos, partidas em andamento, jogos
   habilitados.
2. **CRUD de usuários**: listar (busca + paginação), detalhes, criar, editar,
   desativar/banir, excluir. Editar role (promover a admin).
3. **Auditoria**: log de ações (login, logout, cadastro, partidas, ações
   administrativas, alterações de conta). Filtrável por usuário, tipo e
   período. Registrar IP e timestamp.
4. **Ranking de jogos mais jogados**: partidas por jogo, período selecionável.
   Gráfico + tabela.
5. **Ranking de maiores jogadores**: leaderboard global e por jogo (vitórias,
   pontuação, tempo jogado, recordes). Ordenável.
6. **Habilitar/desabilitar jogos**: toggle. Jogo desabilitado some do lobby e
   não aceita novas salas (partidas em andamento: decidir tratamento limpo).
7. **Gestão de salas ao vivo**: ver salas ativas, nº de jogadores, encerrar
   sala.
8. **Extras sugeridos** (implementar os que fizerem sentido): banimento
   temporário/permanente com motivo; anúncios globais no lobby; configurações
   da plataforma (nome, limites, manutenção); métricas de retenção (DAU/MAU);
   moderação de chat; export CSV; feature flags para jogos em beta.

---

## Catálogo de jogos

### Turno
- **Cartas**: Dominó (4p, duplas), One/"Uno genérico" (4p), Truco (duplas,
  blefe), Buraco/Canastra (duplas), Poker Texas Hold'em, Pife.
- **Tabuleiro (2p)**: Damas, Xadrez, Gamão, Reversi/Othello, Trilha.
- **Palavra/quiz**: Stop/Adedanha (4-6p, desafio = validação de respostas),
  Quiz/trivia, Forca multiplayer.

### Party
- **Desenha & Adivinha** (regras detalhadas pelo usuário em 2026-07-04,
  até 6 jogadores): o desenhista da rodada digita uma PALAVRA (fica oculta
  até o fim da rodada) e desenha no canvas para exemplificá-la; os outros
  tentam adivinhar PELO CHAT da sala. Quem escrever a palavra exata ganha a
  partida/rodada. Tempo de rodada: 3 minutos. Ao acertar OU estourar o tempo
  sem acerto, a vez de desenhar RODA para outro participante (cada rodada um
  novo integrante escolhido, mesmos critérios). A sala fica ativa em rodadas
  contínuas até o anfitrião encerrar. Dedução social ("impostor") como
  possível extensão futura.

### Single-player (com leaderboard)
- **Puzzle**: Sudoku, Campo Minado, Nonograma, Sokoban, **Puzzle
  (quebra-cabeça)** e **Paciência** (adicionados pelo usuário em 2026-07-04)
  — geráveis proceduralmente → **modo "desafio diário" com seed do dia**.
- **Arcade**: Snake (confirmado pelo usuário), Tetris-like, Breakout, 2048.
- **Arcade retrô side-view** (pedidos do usuário em 2026-07-04, usar NOMES
  GENÉRICOS — sem marcas):
  - **"Missão Elevador"** — clone de *Elevator Action* (NES) como referência
    de design: espião desce pelo prédio de elevador, andares, portas e
    inimigos. Visão lateral (variante side-view da engine 2D).
  - **"Pega-Ladrão"** — clone de *Keystone Kapers* (Atari 2600) como
    referência: guarda persegue o ladrão pelos andares de uma loja,
    desviando de obstáculos, com escadas rolantes e elevador. Side-view.
  - **"Come-Come"** — clone de *Pac-Man* como referência (pedido do usuário
    em 2026-07-04): labirinto, pastilhas, 4 fantasmas com personalidades,
    power-pellet que inverte a caçada. Visão de cima (usa a engine 2D
    top-down da Fase 4 com grade de labirinto).
- **Palavra**: Termo diário, caça-palavras.

### Ação 2D top-down (engine compartilhada)
- **Corrida (carro/moto), até 4p**: visão de cima estilo Micro Machines.
  **Boost carregado por drift**, recarregável, com trade-off: durante o boost,
  controle reduzido (arriscar na curva = caótico; na reta = seguro). Loop de
  habilidade: driftar bem = mais velocidade. PvP em tempo real (fase avançada).
  Moto = carro com física mais escorregadia.
- **1942 (avião)**: shoot'em up com scroll vertical. **Armas pegas no caminho,
  usadas até acabar**: tiro reto, espalhado, laser, míssil teleguiado, bomba de
  tela. Posicionamento dos power-ups coreografa a curva emocional da fase.
  Single-player primeiro (zero rede); depois **co-op** (aviões vs. máquina —
  latência tolerante pois não há PvP direto) com dois modos:
  (a) **time que sobrevive junto** — vida/pontuação coletiva, revive aliado;
  (b) **lado a lado por pontos** — cada um seu placar.
- **Nave espacial**: endless de **desvio** (cometas, asteroides, naves).
  Densidade crescente. Highscore = tempo de sobrevivência. Identidade: desviar
  (não sobrepõe ao 1942, que cobre o atirar).

### Engines próprias
- **Fazenda**: simulação econômica persistente. Loop: produzir → esperar →
  colher → vender → reinvestir em melhorias → repetir (curva de crescimento).
  **Servidor calcula crescimento offline** (plantou 14h, colhe 18h). Estado
  persistido no banco por usuário. Desafio: balanceamento econômico.
- **Cardume de peixes**: flocking/boids (separação, alinhamento, coesão).
  Mouse move → cardume segue; **clicar** → espalha (fuga); **segurar** → orbita
  o ponteiro rápido (arma). Inimigos = peixes maiores por fase. Progressão
  intra-partida: comer aumenta o cardume (mais peixes = arma mais forte).

---

## FASEAMENTO (seguir esta ordem, uma fase por vez)

**FASE 0 — Fundação**
Monorepo, Docker Compose (Postgres + backend + frontend), Prisma schema
inicial (User, Role, AuditLog, Game, Match, Score/Leaderboard, Room), auth
completo (cadastro, login, JWT, refresh), seed de admin. Testes básicos.
Identidade visual completa: logo SVG (variações), ícone/favicon, manifest PWA,
design tokens, `STYLE_GUIDE.md`. Shell da UI (header com logo, tema, layout
base) já nessa identidade.

**FASE 1 — Painel Admin + Lobby**
CRUD de usuários, auditoria, habilitar/desabilitar jogos, rankings
(estrutura, mesmo sem dados reais), lobby listando jogos e salas.

**FASE 2 — Esqueleto de salas + primeiro jogo de turno**
GameRoom abstrato, WebSocket, reconexão. **Damas** (2p, estado visível — o
mais simples) end-to-end para validar todo o pipeline.

**FASE 3 — Jogos de mão escondida**
Dominó e One. Servidor autoritativo com estado escondido por jogador.

**FASE 4 — Engine 2D top-down + single-player**
Engine de canvas reutilizável. **1942 single-player** primeiro. Depois Nave
espacial. Integrar leaderboards.

**FASE 5 — Rede em tempo real tolerante**
**1942 co-op** (os dois modos). Valida tempo real no cenário mais fácil.

**FASE 6 — Jogos autorais**
Fazenda (persistência econômica) e Cardume (flocking). Ambos single-player.

**FASE 7 — Boss final**
Corrida PvP em tempo real (client-side prediction, reconciliação).

**FASE 8 — Restante do catálogo**
Xadrez, Gamão, Truco, Buraco, Poker, Stop, Quiz, Gartic, puzzles, arcades.

---

## Requisitos transversais (aplicar em TUDO)

- **Segurança**: validação de input em todo endpoint; rate limiting; proteção
  XSS/CSRF; senhas hasheadas; JWT com expiração; rotas admin protegidas.
  **Servidor sempre autoritativo** — nunca confiar no cliente para pontuação,
  jogadas ou estado.
- **Anti-trapaça**: leaderboards validados no servidor; mão escondida nunca
  vaza estado alheio.
- **Auditoria**: registrar ações sensíveis no AuditLog automaticamente.
- **Responsivo**: desktop e mobile (canvas com input de toque onde couber).
- **i18n**: preparado para pt-BR (primário) e en.
- **Testes**: unitários na lógica de jogo (crítico — validação de jogadas);
  integração no auth e admin.
- **Documentação**: README com setup, `.env.example`, um doc por jogo (regras
  + formato de estado).

---

## Diferenciais estratégicos (norte do produto)

- **Single-player + leaderboard**: hábito solitário + comparação social, sem
  exigir dois online simultâneos. Desafio diário = formato mais viciante e
  barato.
- **Público vs. privado**: party games brilham em sala privada com amigos;
  Xadrez/Damas/Poker funcionam em sala pública/ranqueada.
- **Self-hosted**: leaderboards e saves em backend próprio — controle total.
