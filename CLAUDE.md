# Mesa Pop — Memória do Projeto

Plataforma web de jogos casuais (multiplayer e single-player) com sistema de
salas, contas de usuário e painel administrativo completo. **Self-hosted**
(servidor próprio Linux), foco em privacidade e controle total dos dados.

**Princípio arquitetural central: REAPROVEITAMENTO.** Um esqueleto de salas,
uma engine 2D e um sistema de rede em tempo real servem múltiplos jogos.
Base sólida primeiro; os jogos plugam nela.

---

## ⚠️ ESTADO ATUAL DO PROJETO (atualizar sempre ao concluir trabalho)

- **Fase atual**: **FASE 9 — "A mesa da família" (9 jogos novos,
  aprovada pelo usuário em 2026-07-05) — EM ANDAMENTO.** Plano em 5
  lotes: **TODOS os 9 jogos combinados entregues (lotes 1–5 ✅,
  2026-07-05): Memória, Pife, Sudoku, Caça-palavras, Forca, Bingo,
  Quiz Pop, Quiz Nostalgia e Cruzadinha.** Falta só o lote 6 OPCIONAL
  (Modo Conforto 60+: fontes grandes, alto contraste, timers
  relaxados) — aguardando decisão do usuário. Roadmap original 0–8 ✅
  (23 jogos). **32 jogos jogáveis.**
- **Última atualização**: 2026-07-11
- **MILIONÁRIO · FICHAS ×100 (pedido do usuário 2026-07-11)**: o milhão
  agora vale **10.000 fichas** (era 100) — `milhaoFichas = premio/100`
  (`MILHAO_FICHAS_MAX` 10.000), proporcional DESDE a 1ª pergunta
  (POP$ 1.000 → 10 fichas; 100.000 → 1.000; 500.000 → 5.000). A nota
  "fichas a partir de 10.000" saiu da tela final (toda pergunta vencida
  rende). Pontos do ranking inalterados (premio/20). 336 testes.
- **PÁREO/CISCO · MODO DROP-IN (jogo público contínuo — pedidos do
  usuário 2026-07-11)**: os dois jogos de corrida viraram PÚBLICOS de
  entrada livre — nada de sala privada, código ou "Começar":
  - Nova flag `GameModule.dropIn` + `RoomManager.quickJoin` (evento
    `room:quickjoin` no protocolo): entra na 1ª sala pública com vaga —
    JOGANDO na hora, mesmo no meio da corrida (recebe o próximo assento
    livre + matchPlayer p/ contar nos rankings) — e quando TODAS estão
    cheias (16) abre outra sala automaticamente.
  - `create` de jogo drop-in FORÇA pública e já faz `beginMatch` (o
    ciclo começa com o 1º jogador; sem sala de espera).
  - **Sair NÃO derruba a corrida** dos outros (branch próprio no
    `leave` — sem W.O.; sala esvaziou → Match FINISHED + closeRoom
    limpos; apostas pendentes liquidam pela seed no sweep).
  - **Fechar o navegador libera a vaga rápido**: carência de
    desconexão de 15s p/ drop-in (era 60s de W.O.) — um refresh
    reconecta sem perder a vaga; quem fechou de verdade sai sozinho
    (env de teste `DROPIN_GRACE_MS`).
  - Lobby: Páreo/Cisco mostram só o botão "🐎/🐔 Entrar agora"
    (criar pública/privada, código e lista de salas somem).
  - 335 testes (6 novos de integração com sockets REAIS: quickjoin cria
    já PLAYING, 2º entra JOGANDO na mesma sala com assento 0/1, privada
    vira pública, sala cheia → sala nova, sair sem W.O., desconexão
    libera a vaga na carência). Demo real: lobby sem privada/código,
    A caiu direto na corrida, B caiu na MESMA sala no meio como
    jogador, B fechou o navegador e a vaga liberou.
- **NOVO JOGO — CISCO (Fazenda do Bruno) · COMPLETO (ciclo + apostas)
  (2026-07-11, OK do usuário: "faça tudo até o final"; protótipo dele em
  Downloads/cisco-galinhas.html)**: corrida de GALINHAS com apostas — a
  versão cômica do Páreo. **Mecânica** (`shared/cisco.ts`, portada
  fiel): cada galinha alterna CORRER e CISCAR (peckChance/peckMin/
  peckMax por galinha; favorita corre mais e cisca menos; janela 5%–92%
  da corrida) — o padrão de ciscadas decide; OVOS botados por distância
  (com o passo p/ o efeito "plim"); timeline com `stateTraj`
  (correndo/ciscando); Cocota/Penosa/Ryca/Turbina 34/28/22/16; pista
  10.800/chegada 9.520. **ABSTRAÇÃO COMUM adotada** (sugerida no plano e
  aprovada): `games/corridaCiclo.ts` (ciclo genérico de fases por sala,
  seed oculta até a largada, jogo contínuo) e `lib/corridaApostas.ts`
  (motor de apostas: débito atômico, uma por corrida, liquidação
  determinística pela seed, idempotente) — o PÁREO foi refatorado para
  usá-los SEM mudar comportamento (14 testes intactos) e o Cisco pluga
  `CiscoBet` (migração `20260711120000_cisco_bets`, MESMO formato do
  PareoBet — os delegates casam estruturalmente no `BetDelegate`).
  Rotas `/api/cisco/apostar|minha`; sweep único de 2,5s liquida os DOIS
  jogos; auditoria 'cisco.aposta'. UI `CiscoGame.tsx` espelha o
  PareoGame (galinha com pose de ciscar bicando o chão, ovos com plim,
  cerimônia da campeã pulando ao lado do OVO DE OURO, "E LÁ VÃO ELAS!",
  "Últimas campeãs"). Envs de demo `CISCO_APOSTAS_MS`/
  `CISCO_PRELARGADA_MS`. Catálogo: 39 jogos. 330 testes (8 novos).
  Demo real (2 janelas): apostas Cocota×Penosa (1000→900 cada), corrida
  1 = Cocota venceu → apostador recebeu 260 (saldo 1160) e o outro 900;
  corrida 2 = "Turbina venceu · pagou 5.5×" IDÊNTICA nas duas janelas
  com histórico sincronizado. Ledger conferido no banco (ganhou/perdeu/
  payout + vencedor recalculado da seed bateu 100%).
- **PÁREO · FASE 2 ENTREGUE — APOSTAS AUTORITATIVAS NA CARTEIRA
  (2026-07-11, OK do usuário: "pode continuar"; decisões: carteira =
  fichas da plataforma, sem bônus interno; stakes 10/25/50/100/250; UMA
  aposta por corrida)**: model `PareoBet` (migração
  `20260711100000_pareo_bets`) é o LEDGER do jogo — guarda
  roomId+numero+seed+lane+valor+odds+resultado+payout+liquidaEm, com
  UNIQUE (roomId,numero,userId). `lib/pareoApostas.ts`:
  `registrarAposta` valida fase/páreo/valor/unicidade e DEBITA a
  carteira atomicamente (updateMany fichas>=valor; corrida rara na PK →
  reembolsa); `liquidarApostas` roda num sweep de 2,5s no server.ts —
  o vencedor é recalculado DA SEED gravada na aposta (determinístico:
  liquida mesmo se a sala morreu; nenhuma ficha presa) e o pagamento é
  IDEMPOTENTE (linha só sai de 'pendente' uma vez; payout = valor×odds).
  Rotas REST `POST /api/pareo/apostar` (resolve a sala pelo
  RoomManager.roomOf; convidado 403) e `GET /api/pareo/minha` (saldo +
  aposta atual + última liquidada). AuditLog 'pareo.aposta'. UI:
  saldo no painel, chips habilitados, confirmar → card "● valor" +
  título "Apostou X em Y (odds)", resultado pessoal na cerimônia
  (ganhou +payout / perdeu). 322 testes (6 novos de apostas: débito,
  rejeições sem mexer no saldo, liquidação idempotente, pendente futuro
  não liquida, convidado 403). Demo real (2 apostadores): saldo
  1000→900 nas duas janelas, aposta travada, Trovão venceu → A recebeu
  260 (saldo 1160) e B ficou em 900. **LIÇÃO (bug real da demo)**:
  guard de "fase mudou" por ref DENTRO de useEffect quebra no
  StrictMode (dupla montagem cancela o 1º fetch e pula o 2º — saldo
  nunca hidratava); as deps do efeito já fazem esse papel — sem ref.
  Faltam FASES 3 (sincronia fina/reconexão/salas) e 4 (leaderboards/
  admin/polimento), cada uma com OK prévio.
- **AJUSTES DO DIA (pedidos do usuário 2026-07-11)**: (a) moeda do
  Milionário virou **POP$** (era R$ — cenográfica); (b) **Desafio
  Diário SORTEIA os jogos do dia** — `desafiosDoDia(date)` embaralha
  os 4 seedáveis com seed=data e pega `DESAFIOS_POR_DIA`=2 (iguais p/
  todos; servidor recusa jogo fora do sorteio; hub/despachante só
  mostram os sorteados); (c) FIX Milionário: partida ENCERRADA não
  gruda mais ao reabrir (o /estado só retoma partida em andamento) e a
  tela final explica as fichas proporcionais ("a partir de POP$
  10.000"); VERIFICADO de ponta a ponta que pontos/fichas SÃO gravados
  (parar com POP$ 10.000 → 500 pts no Score/MatchPlayer/leaderboard +
  1 ficha na carteira) — o reporte de "não insere" era a regra
  proporcional (prêmios < 10k = 0 fichas) + cache de 60s dos rankings
  gerais + servidor em build antiga.
- **NOVO JOGO — PÁREO (O "Corre" do Yvens) · FASE 1 ENTREGUE
  (2026-07-11; plano de 4 fases aprovado pelo usuário — B=apostas na
  carteira, C=sincronia/reconexão fina, D=leaderboards/admin — cada
  fase espera OK)**: corrida de cavalos com apostas, integrada como
  GameModule realtime a partir do PROTÓTIPO DO USUÁRIO
  (Downloads/corrida-cavalos_6.html; a versão mais recente é a _6).
  **Simulação determinística portada para `shared/pareo.ts`**:
  `pareoBuildRace(seed)` pré-computa a timeline (600 passos,
  traj/legTraj Float32Array), vencedor por cruzamento interpolado
  (visual == real), favoritismo 34/28/22/16, odds com margem 0.88,
  `pareoHorseAt` p/ animação. **Servidor dono do ciclo**
  (`backend/games/pareo.ts`): fases por SALA — apostas 123s →
  pré-largada 30s → corrida ~20s (encurta ao cruzamento + 1,1s) →
  cerimônia (absorve o resto; ciclo ~180s) — via `avancaCiclo` movido a
  timestamps oficiais (atravessa fases se o tick atrasar); a SEED só
  trafega na largada (resultado já fixado; view nunca vaza
  seed/vencedor antes — teste garante); jogo CONTÍNUO
  (result.finished sempre false; sala esvaziou → manager encerra);
  realtime {500ms, broadcastEvery 4}; minPlayers 1, até 16 +
  espectadores. Envs de demo/teste `PAREO_APOSTAS_MS`/
  `PAREO_PRELARGADA_MS`. **Cliente** (`PareoGame.tsx`): canvas do
  protótipo portado (pista, cavalos com jóquei, cerimônia com troféu +
  confete, overlay de vencedor, relógios "Fecha em"/"Início da
  corrida", cards com odds, fichas desabilitadas com nota "apostas na
  FASE 2", histórico) com RELÓGIO SINCRONIZADO (offset = view.agora −
  Date.now()) e corrida reproduzida localmente da seed. Catálogo: 38
  jogos. 313 testes (8 novos: determinismo, vencedor cruza,
  favoritismo em 600 seeds, odds, ciclo completo de fases, atravessa
  fases, não-vazamento da seed, jogo contínuo). Demo real (Playwright,
  2 janelas na MESMA sala): apostas abertas nas duas, "E LARGARAM!"
  nas duas, e a MESMA cerimônia ("Relâmpago venceu · pagou 3.1×") +
  próximo páreo abrindo sozinho. DECISÕES do usuário p/ FASE 2:
  carteira = fichas da plataforma (sem bônus interno; stakes
  10/25/50/100/250), UMA aposta por corrida por jogador, salas de 16.
- **BOB MAGNATA (rename) + NOVO JOGO — TIO MÁRIO MILIONÁRIO (pedidos do
  usuário 2026-07-10)**:
  - **Rename (AJUSTE FINAL, pedido 2026-07-10)**: nomes COMPOSTOS no
    catálogo — **"Magnata (Bob Magnata)"** e **"Milionário (Tio Mário
    Milionário)"** (base clássica + apelido entre parênteses; medalhão
    do tabuleiro mostra MAGNATA com "(BOB MAGNATA)" menor embaixo;
    título da página do quiz idem). SLUGs `magnata` e
    `tio-mario-milionario` inalterados; o seed atualiza o `name` de
    jogos existentes no update do upsert.
  - **Tio Mário Milionário** (slug `tio-mario-milionario`, solo, 💰):
    quiz de ESCADA DE PRÊMIOS — formato clássico de gincana de
    perguntas recriado com identidade própria (regra 6: nada de
    marca/arte/perguntas de programas reais; banco 100% autoral). 16
    níveis (R$ 1 mil → 1 milhão em `MILHAO_ESCADA`), acertou sobe;
    **PARAR** leva o acumulado; **errar leva METADE** (na pergunta do
    milhão: tudo ou nada). Ajudas de uso único — 🃏 cartas (elimina 1–3
    erradas), 🎓 universitários (3 palpites simulados), 📊 plateia
    (percentuais pendendo à correta; taxa cai com a dificuldade) — e
    ⏭️ 3 pulos. **Servidor AUTORITATIVO**: `routes/milhao.ts` guarda a
    pergunta+gabarito em sessão de memória por usuário (a view NUNCA
    contém a correta antes da resposta; teste de vazamento por
    serialização); retomada via `GET /api/milhao/estado` (refresh não
    perde a partida); Match/MatchPlayer/Score gravados PELO SERVIDOR
    (prêmio = pontos; ranking pelo `GET /api/leaderboards/:slug`
    existente; convidado joga sem pontuar). Banco autoral
    `lib/milhaoPerguntas.ts` com 96 perguntas (32 fáceis/médias/
    difíceis, alts[0] correta, embaralhadas por partida; tier por nível
    via `milhaoTier`). UI `TioMarioPage.tsx` estilo PALCO: escada
    lateral dourada, chips de ajuda, seleção+confirmação ("✅ É essa!"),
    reveal verde/vermelho de 1,6s, telas de fim (parou/errou/MILHÃO) —
    despachada por slug no GameLobby (padrão TermoPage). Catálogo: 37
    jogos. 304 testes (7 novos: sem vazamento, subir/parar grava Score,
    errar=metade, cartas nunca tiram a correta + pulo troca, plateia
    soma 100, estado retoma, escada completa dá o milhão com isWinner).
    Demo real (Playwright): pergunta com plateia 71% + carta eliminando
    alternativa, resposta certa subiu p/ "Pergunta 2 · R$ 2.000", parou
    → "Você parou e levou R$ 1.000!" e o ranking mostrou o 1º lugar.
    LIÇÃO: `nameSchema` recusa nome de 1 letra — usar nomes reais nos
    testes de register.
  - **PONTUAÇÃO E FICHAS PROPORCIONAIS (pedidos do usuário
    2026-07-10)**: o ranking é em PONTOS, não em R$ — o R$ é
    cenográfico. Regra única no `encerra`: **pontos = prêmio ÷ 20**
    (`milhaoPontos`; o milhão vale 50.000 = `MILHAO_PONTOS_MAX`) e
    **fichas = prêmio ÷ 10.000** (`milhaoFichas`; o milhão vale 100 =
    `MILHAO_FICHAS_MAX`) — quem PARA ou ERRA no meio leva a FRAÇÃO de
    ambos (ex.: parou com R$ 2.000 → 100 pts; abaixo de R$ 10.000
    ainda não rende ficha). MatchPlayer.score e Score.points gravam os
    PONTOS (metadata guarda o `premio` em R$); fichas creditadas pelo
    servidor; convidado não pontua nem ganha. A view devolve
    `pontosGanhos`+`fichasGanhas` e a tela final mostra os dois selos
    ("🏁 +X pontos no ranking" / "🪙 +Y fichas"); o ranking lateral
    exibe "pts". 305 testes (fração no parar/errar, milhão = 50.000
    pts + 100 fichas no banco).
- **AVATARES · REDESIGN VISUAL COMPLETO (pedido do usuário 2026-07-10,
  com 6 imagens de referência)**: o usuário rejeitou o estilo
  "bichinhos" da 1ª versão e definiu os estilos — NUNCA tristes (só
  sorriso/sério/bravo). Novo `AvatarSvg` + `shared/avatares.ts` v2:
  **NORMAIS (20, curados à mão)** = 12 rostos cartoon de PESSOAS
  (12 penteados: curto, franja, cacheado, coque, maria-chiquinha, rabo,
  grisalho, careca+barba, longo, bandana, topete, cacho rente; 6 tons de
  pele; óculos; sorrisão com dentes) + 8 BICHOS flat (leão/panda/raposa/
  urso/coruja/gato/cachorro/coelho) em círculo CHAPADO colorido
  (AVATAR_FUNDOS, 12 cores vivas) com sombra diagonal sutil.
  **ESPECIAIS (e0..e999)** = ícones GAMER flat (controle, joystick, dado,
  troféu, foguete, bomba, baú, poção, coroa, ficha, coração pixel,
  estrela) + MASCOTES de e-sports com contorno forte (leão, coruja,
  ninja, caveira, fênix, robô, touro, dragão, lobo, tubarão, águia,
  samurai). **SUPER (s0..s14)** = 15 mascotes premium curados com a
  moldura girante. `paramsFromId` segue determinístico e o CONTRATO do
  tier (acessorio>0 especial, moldura>0 super) foi preservado — testes
  antigos passam sem mudança. QA visual real (capturas da grade do
  cadastro e do Meus avatares com filtro de bloqueio removido).
  **Também a pedido**: removidos os 2 boxes antigos de standing da Mesa
  ("Ranking global"/"Seu jogo") — substituídos pelos banners dos
  rankings gerais (o GET /api/me/standing ficou sem consumidor; remoção
  futura opcional). 297 testes verdes; pacotes regenerados.
- **AVATARES · FASES B+C+D ENTREGUES — SISTEMA DE AVATARES COMPLETO
  (2026-07-10, execução contínua autorizada pelo usuário: "faça todos os
  planos sem parar"; plano em
  docs/superpowers/plans/2026-07-10-avatares-fases-bcd.md)**:
  - **B — COR DO PEÃO no Magnata**: `MAGNATA_CORES` (8 cores, + vermelho
    e azul) no shared; ação `{type:'cor'}` validada no servidor — só até
    a PRÓPRIA primeira rolagem (`MagnataJogador.jaRolou`), vale fora do
    turno (tratada antes do guard, como lance/troca), cor em uso →
    recusa; paleta de bolinhas no painel do MagnataBoard (ocupadas
    apagadas); bots mantêm a cor do assento.
  - **C — RANKINGS GERAIS + desbloqueio posicional**:
    `lib/rankingsGerais.ts` (cache 60s; PONTOS = SUM MatchPlayer.score —
    não somar Score, dupla contagem; TEMPO = SUM duração de Match
    FINISHED; convidados fora; `limparCacheRankings()` p/ testes) +
    `GET /api/rankings/gerais` (pública, auth OPCIONAL no padrão do
    /api/rooms, devolve `voce` logado). PUT /api/me/avatar: ESPECIAL
    liberado p/ top 10 (qualquer dos 2 rankings), SUPER p/ nº 1; quem
    cai mantém o equipado (grandfather). Página `/rankings` (2 top-10
    com medalhas 🥇🥈🥉 + avatar + "Você: nº X") e 2 BANNERS pop
    clicáveis na Mesa com nome+posição.
  - **D — FICHAS + MÁQUINA GUMBALL**: acúmulo = 1 ficha a cada 5 min
    ONLINE (`lib/fichas.ts`: sweep de 60s no server.ts credita presença
    não-convidado; fração em memória, teto de 5000 entradas);
    `UserPublic.fichas`; model `AvatarOwned` (posse permanente, migração
    `20260710140000_avatar_owned`); `POST /api/fichas/trocar` — débito
    de 1000 + posse na MESMA transação (LIÇÃO da revisão: duas
    requisições sorteando o MESMO especial violavam a PK e perdiam as
    fichas; `$transaction` desfaz o débito em qualquer falha; coleção
    completa → 409 sem debitar); sorteia especial NÃO possuído;
    `GET /api/me/avatares` {fichas, owned, melhorPosicao}. PUT aceita
    avatar POSSUÍDO sempre. UI: banner "🪙 Suas fichas" na Mesa +
    `GumballModal` (máquina SVG procedural com globo de bolinhas;
    Inserir despeja 10 em 10 animado até 1000 → Retirar gira a manivela
    → bolinha CAI → revela o avatar com Equipar agora/Girar de novo);
    "Meus avatares" ganhou "⭐ Conquistados na máquina" e, no top 10,
    os especiais da amostra ficam clicáveis.
  - Qualidade: 297 testes verdes (41 arquivos; novos: magnata-cor,
    rankings-gerais, fichas), typecheck limpo, revisão final adversarial
    APROVADA (1 média corrigida = transação da troca; 2 baixas =
    timeouts do gumball limpos + teto do mapa). Demo real (Playwright,
    9 capturas): banners na Mesa, /rankings, paleta do Magnata com peão
    VERMELHO escolhido, admin deu +1000 fichas, máquina inseriu 1000,
    bolinha caiu, "✨ Avatar ESPECIAL conquistado!" equipado e listado
    em Conquistados. **Visão das 4 fases (A–D) 100% entregue.**
- **AVATARES · FASE A ENTREGUE + FICHAS DO ADMIN + FIXES MOBILE
  (2026-07-10, execução por subagentes — plano em
  docs/superpowers/plans/2026-07-10-avatares-fase-a.md)**: início do
  sistema de avatares (visão completa em 4 fases A–D; B=cor do peão no
  Magnata, C=rankings gerais+banners, D=fichas 1/5min+máquina gumball).
  **Gerador procedural** em `shared/avatares.ts` (ids n0..n19 livres,
  e0..e999 especiais e s0..s14 super — BLOQUEADOS até C/D;
  `paramsFromId` determinístico via hashSeed/mulberry32; 10 espécies de
  bichinhos) + componente `AvatarSvg.tsx` (SVG 100% procedural).
  **Modelo**: `User.avatar`/`avatarPromptedAt` (migração
  `20260710120000_avatar`) + `UserPublic.avatar`. **Fluxos**: cadastro
  com grade de 20 (sem/inválido → aleatório; registrar grava
  `mp_avatar_prompt` p/ não rever o convite), convidado ganha normal
  aleatório, `PUT /api/me/avatar` (especial/super → 403 AVATAR_LOCKED)
  + `POST /api/me/avatar/prompt-visto`, header com avatar + menu
  **"Meus avatares"** (à ESQUERDA de "Minha mesa"; modal via PORTAL —
  LIÇÃO: `backdrop-blur` no header vira containing block e prende o
  `position:fixed` do overlay), modal pulável 1× na Mesa p/ contas
  antigas. **Avatar em todo lugar**: `RoomUser→LivePlayer→views` levam
  `avatar`+`isAdmin` (decididos NO SERVIDOR); avatar pequeno ao lado do
  nome no chat da mesa, no chat RESPOSTAS do Desenha, nos chips de
  sala/SeatPicker e nos rankings (fallback: nome como seed) — e **nome
  de ADMIN em VERMELHO (`text-red-500`) em qualquer chat** (pedido).
  **FICHAS (pedido)**: `User.fichas` (migração `20260710130000_fichas`
  com backfill) — admin ATUAL, promovido via PATCH (guard: promover 2×
  não duplica), criado com role ADMIN, setup e seed ganham **100.000**;
  `POST /api/admin/users/:id/fichas` dá **+1.000** (convidado → 400
  GUEST_NO_FICHAS) com botão "+1000 🪙" e coluna no painel de usuários.
  **FIXES mobile (pedidos)**: (1) botão SAIR da tela cheia agora é um
  flutuante renderizado por portal DENTRO do elemento fullscreen
  (fora dele a API esconde tudo; celular não tem ESC) — RoomPage e
  SoloGamePage passaram a usar o `FullscreenButton`; (2) Magnata com
  fonte responsiva 6/7/8px (nomes legíveis no celular); (3) **refresh
  acidental NÃO perde mais a partida**: `overscroll-behavior-y: none`
  (mata o puxar-para-atualizar), `beforeunload` pede confirmação em
  partida ativa, e o `guest/leave` do pagehide (que TAMBÉM dispara num
  reload) ganhou CARÊNCIA de 90s SEM revogar a sessão — o refresh
  restaura e cancela (`scheduleGuestLeave`/`cancelGuestLeave` +
  checagem de presença p/ multi-abas); logout explícito segue apagando
  na hora. 281 testes verdes (38 arquivos; novos: avatares, avatar-auth,
  avatar-me, fichas-admin, carência do convidado); typecheck limpo;
  revisão final de branch APROVADA (2 minors corrigidos). Demo real
  (Playwright): cadastro com grade, "Meus avatares" com 🔒, convite 1×,
  chat com avatar + "Administrador" em vermelho, painel com
  "+1.000 fichas (agora 1.000 🪙)" e admin com 100.000 no banco.
- **FIX CRÍTICO — atualização WSRTA deixava ÓRFÃOS e quebrava o build
  (2026-07-10)**: ao remover o Corrida do Ganso, o deploy WSRTA no
  servidor falhava no `tsc` porque o `GansoBoard.tsx` (apagado do
  código) CONTINUAVA no `/var/www/.../frontend/src` — a atualização
  SOBREPÕE os arquivos do pacote mas NÃO apaga os que sumiram. Correção:
  o empacotador (`build-wsrta.mjs`) agora grava um `wsrta-manifest.txt`
  com TODOS os arquivos do pacote, e o `wsrta-update.sh`, antes de
  compilar, apaga de `frontend/src`/`backend/src`/`shared/src` qualquer
  arquivo que NÃO esteja no manifesto (órfãos). Comprovado por simulação
  (injetei um GansoBoard órfão → o update o removeu). **LIÇÃO**: sempre
  que um arquivo é REMOVIDO do código, o update WSRTA precisa do
  manifesto para limpá-lo no servidor; senão o build quebra em código
  velho. Também adicionado o botão "Voltar à mesa" no topo do lobby de
  cada jogo.
- **CORRIDA DO GANSO REMOVIDO + FIX de sincronia do Magnata (pedidos do
  usuário 2026-07-09)**:
  - **Ganso removido** ("não ficou legal"): tirado do catálogo
    (`shared/games.ts`), do registro do socket, do `RoomPage`/`GameLobby`
    (hasBot) e do `index.ts`; arquivos deletados (`shared/ganso.ts`,
    `backend/games/ganso.ts`, `GansoBoard.tsx`, `test/ganso.test.ts`) e
    a linha do banco de dev apagada (com dependências). **36 jogos** no
    catálogo. NOTA sobre a referência de imagem do "Goose Game": recriei
    o ESTILO clássico (domínio público) na nossa arte — nunca se clona a
    ilustração/logo/peças do produto específico (regra 6).
  - **Magnata — BUG da prisão**: ao sair da prisão pagando a fiança
    obrigatória (3ª tentativa) o servidor NÃO zerava `preso` → o jogador
    andava mas continuava "preso" e o painel pedia "Tentar dupla" fora
    da prisão. Corrigido (`j.preso = false` no ramo `turnosPreso >= 3`).
  - **Magnata — SINCRONIA total (pedido do usuário)**: a UI agora segue
    a sequência EXATA: 1) rola os dados (animação 3s); 2) dados param,
    espera 1s (`POS_DADOS_MS`); 3) o peão anda 1 casa por **1s**
    (`PASSO_MS` 1,5s→1s); 4) SÓ ao chegar aparecem comprar/cobrar/aviso
    e o cartão atualiza. Reescrita a animação para ser CONVERGENTE (o
    `podeAndarRef` compartilhado travava peões e desincronizava): agora
    um efeito único, guiado pelo contador `rolagens`, agenda a sequência
    por `setTimeout` só para o peão da VEZ (os outros vão direto à
    posição), com estado `animando` que esconde as ações e segura o
    cartão (`cartaoRef`) até a chegada; teleporte (prisão/carta) dá snap
    no momento de andar. Demo real: dados 6+6 pararam → "🚶 o peão está
    andando…" (ações escondidas, cartão em R$1500) → opções na chegada.
  - **Gira Gênio — roleta não pula mais**: o texto acima da roleta
    mudava de altura (chip de resultado × "girando" × salto da
    categoria) e empurrava a roleta p/ cima/baixo (parecia bug). Agora há
    UM slot de altura FIXA (`h-16`) acima da roleta que hospeda os três
    estados; a roleta fica imóvel.
- **REALISMO/UX — rodada de polimento (pedidos do usuário 2026-07-09)**,
  vários jogos:
  - **Magnata** (6 pedidos): tabuleiro maior e legível no PC
    (`max-w-[760px]`, texto 6px→8px + preços visíveis); **peões viraram
    FICHAS** desenhadas (SVG chibi na cor do jogador, com bob no meu)
    no lugar dos pontinhos; **movimento passo-a-passo** — o peão pula de
    casa em casa a cada 1,5s (`PASSO_MS`; teleporte de prisão/carta com
    salto>13 casas dá snap); **moldura do terreno na cor do DONO**
    (`boxShadow` interno) em vez de branco; **dados ROLANDO ~3s** antes
    de assentar (contador `rolagens` novo na view dispara a animação de
    faces girando); e **construir logo após comprar** (botões de
    construir em destaque acima de "Encerrar" + dica "Complete o grupo
    de X" quando ainda não é monopólio).
  - **Tela cheia AMPLIA o jogo** (não só o navegador): regras
    `.game-fs:fullscreen` no `global.css` fazem o `canvas` e os
    tabuleiros (`.mp-magnata-board`/`.mp-fs-fit`) crescerem até
    `min(96vw, 88vh)` — enche a largura no celular e a altura no PC.
  - **Gira Gênio**: a **roleta GIRA ~3s e para na categoria** (sequência
    local girando→revelando→pergunta), com o **nome da categoria
    SALTANDO** (`animate-pop`) acima da roleta antes das perguntas
    (estilo Perguntados); ao responder, **mostra a resposta certa por
    3s** (a correta em verde ✅, a errada escolhida em vermelho ❌,
    "Resposta certa: «…»") — a pergunta é capturada no cliente porque o
    servidor zera `view.pergunta` ao responder. **Banco expandido**
    96→156 (26/categoria). Novo `GameModule.botDelayMs` (o robô do Gira
    "pensa" 4,5s para a roleta girar antes de ele responder;
    `RoomManager` usa `module.botDelayMs ?? BOT_THINK_MS`).
  - **Mahjong**: removido o botão "Reembaralhar" da barra (fica só no
    overlay "Sem jogadas livres!", igual ao de vitória); peças mantêm o
    contraste claro/escuro (livre×presa — o usuário preferiu assim); e
    **clicar numa peça presa a faz PISCAR EM VERMELHO** (estado
    `travada`, todas clicáveis agora).
  - **Corrida do Ganso**: **objetivo em destaque** no topo (chegar
    primeiro à casa 63 no centro, exato ou ricocheteia), **legenda "O
    que cada casa faz"** (ganso/ponte/estalagem/poço/labirinto/caveira/
    chegada) e **dados ROLANDO ~2s** (disparado pela mudança de
    `state.lastMove`, já que cada snapshot é uma rolagem). **Tabuleiro
    REFEITO no estilo clássico (referência do usuário 2026-07-09)**:
    trilha de tiles de MADEIRA em espiral RETANGULAR sobre a grama,
    moldura de madeira e **MEDALHÃO central "Corrida do Ganso" com o
    miolo ABERTO** — `espiralRect(9×8)` gera 72 slots, o jogo usa os 64
    primeiros (casas 0–63) e o restante vira o medalhão do centro;
    casas especiais com borda/ícone coloridos por tipo. Substitui a
    grade 8×8 cheia anterior. **2ª rodada**: para ficar fiel ao visual
    clássico da referência do usuário — **borda de CALÇADA DE PEDRAS**
    (desenhada em CSS) cercando a trilha de madeira sobre a grama, e a
    numeração começando pela BASE (casa 1 embaixo, `ty(row)` inverte o
    eixo) coilando até o medalhão central. **IMPORTANTE (regra 6)**: a
    arte é NOSSA (Mesa Pop) inspirada no Jogo do Ganso de domínio
    público — NÃO se copia o logo/ilustração/peões daquele produto
    específico protegido; o usuário pediu "idêntico à imagem" e a
    resposta foi recriar o ESTILO clássico, não clonar a arte.
  - 275 testes seguem verdes; typecheck limpo nos 3 workspaces. Demos
    reais (Playwright): Magnata (tabuleiro grande, fichas, dados
    "rolando os dados…", molduras coloridas, dica de grupo), Gira Gênio
    (roleta parou em História com salto do texto; reveal mostrou Ottawa
    em verde e Vancouver em vermelho), Mahjong (barra sem reembaralhar,
    peças claras/escuras) e Ganso (banner + legenda + espiral).
- **MAGNATA · NEGOCIAÇÃO + LEILÃO + HIPOTECA (pedido do usuário
  2026-07-09, fecha a leva "vamos fazer tudo isso")**: as três mecânicas
  clássicas que faltavam ao Magnata, servidor autoritativo.
  **Hipoteca** (`hipotecar`/`resgatar` + `venderCasa`): hipotecar rende
  metade do preço (`valorHipoteca`) e a propriedade para de render
  aluguel (resolveCasa e a contagem de aeroporto/serviço passam a
  ignorar hipotecadas); resgatar custa metade + 10% (`custoResgate`);
  não dá para construir num grupo hipotecado nem hipotecar com casas
  (vender antes, reembolso pela metade). **Leilão** (`lance`/`desistir`,
  nova fase `'leilao'` + estado `MagnataLeilao`): recusar a compra
  (`passar`) leva a propriedade a leilão entre TODOS os solventes; sobe
  por lances (round-robin pulando o líder), arremata quem sobra e paga o
  lance; ninguém dá lance → fica com o banco. **Negociação**
  (`propor`/`aceitarTroca`/`recusarTroca` + estado `MagnataProposta`):
  o jogador da vez oferece imóveis+dinheiro por imóveis+dinheiro de
  outro; o alvo aceita/recusa (hipoteca acompanha o imóvel; sem casas).
  **Infra reutilizada**: `currentSeat` passou a apontar o
  `leilao.vez`/`proposta.para` (não só o turno) e o `aplica` libera
  essas ações FORA do turno (o `RoomManager` já dirige o ator real e
  encadeia os bots) — o `play(state, seat, ...)` recebe o assento de
  quem agiu. **Bot** estendido: dá lances até ~60% do preço (só com
  caixa) e responde trocas aceitando só quando ganha valor. UI
  (`MagnataBoard`): painel de leilão (lance + Dar lance/Desistir),
  resposta de troca (Aceitar/Recusar/Cancelar), construtor de proposta
  (alvo + chips de imóveis dos dois lados + dinheiro) e "Gerir imóveis"
  (hipotecar/resgatar/vender casa) + selo "🏦 HIP" nas casas
  hipotecadas. 275 testes (8 novos de Magnata: hipoteca rende/resgata,
  bloqueia construir no grupo hipotecado, exige vender casas, leilão
  arremata/sem-lance, troca transfere+trava o turno, recusar limpa).
  Typecheck limpo nos 3 workspaces. **LIÇÃO**: ações fora do turno
  (lance/aceitar) precisam ser tratadas ANTES do guard `turno!==seat`;
  e `currentSeat` deve apontar o próximo a agir (leilão/proposta) para
  os bots serem acionados. Demo real (Playwright, humano × robô): passei
  numa compra → **leilão** de Av. Sete de Setembro (painel + lance);
  **hipotequei** Av. Goethe (+120, selo HIP, botão resgatar −132); e
  **propus** Av. Goethe por Ladeira da Misericórdia ao robô, que aceitou
  ("Troca fechada") — os imóveis trocaram de dono.
- **DESAFIO DIÁRIO COM SEED (pedido do usuário 2026-07-09, "vamos fazer
  tudo isso")**: o MESMO puzzle para todos a cada dia (seed = a data
  'YYYY-MM-DD') nos 4 jogos seedáveis — Sudoku, Caça-palavras,
  Cruzadinha e Mahjong — com UMA tentativa por dia e ranking próprio
  do dia. Espelha o padrão da Palavra do Dia (Termo). **Backend**:
  model `DesafioPlay` (@@id userId+gameSlug+date, migração
  `20260709120000_desafio_diario`), rota `desafio.ts` (`GET
  /api/desafio/hoje` = data + o que você já fez; `POST /start` abre e
  crava o cronômetro do servisor em startedAt; `POST /finish` mede a
  duração contra o `PLAUSIBILITY` — extraído p/ `lib/plausibility.ts`,
  usado por solo E desafio —, recusa impossível SEM queimar a tentativa
  e crava done+points; `GET /ranking/:slug` = top do dia sem
  convidados). Config única em `shared/desafio.ts` (`DESAFIOS_DIARIOS`
  com dificuldade FIXA por jogo p/ ranking justo: sudoku/mahjong médio).
  **Frontend**: helper `soloBackend.ts` abstrai partida LIVRE
  (/api/solo/*, seed aleatória, ranking 30d) × DIÁRIO (/api/desafio/*,
  seed = data, ranking do dia) — as 4 páginas de puzzle ganharam prop
  `daily?` (seed fixa, sem seletor de nível, selo "📅 desafio de hoje",
  botões de recomeço escondidos). Hub `/desafio` (DesafioHub, cards com
  ✓/pts feito) + despachante `/desafio/:slug` (DesafioJogo: se já jogou
  hoje → portão "concluído" com ranking; senão abre o puzzle diário).
  Banner na Mesa. 268 testes (4 novos: hoje autenticado, slug inválido,
  finish sem start, fluxo completo com retroação de startedAt p/ não
  esperar o minMs). Typecheck limpo nos 3 workspaces. **LIÇÃO**: os
  jogos diários têm minMs longo (20–30s) — o teste retroage
  `startedAt` no banco em vez de esperar. Demo real (Playwright, 2
  usuários): hub "0/4 feitos", A e B abriram o Sudoku do dia e
  receberam o MESMÍSSIMO tabuleiro (seed do dia confirmada), A resolveu
  respeitando o minMs → "948 pts, 1º no ranking de hoje", e reabrir
  caiu no portão "Desafio de hoje concluído!" com o placar do dia.
- **EXPANSÃO DOS BANCOS DE QUIZ (pedido do usuário 2026-07-09)**: mais
  perguntas nos três bancos de trivia, sem duplicar as existentes e com
  a correta sempre em `alts[0]`/`alternativas[0]`. **Quiz Pop** ~48→64
  (`backend/lib/quizPerguntas.ts`), **Quiz Nostalgia** ~41→56 (idem) e
  **Gira Gênio** 72→96 (`backend/lib/giraGenioPerguntas.ts`, +4 por
  categoria: geo/hist/cien/esp/arte/ent = 16 cada). Só dados — nenhuma
  mudança de engine. Typecheck limpo; 264 testes verdes (os testes de
  sanidade dos bancos garantem 4 alternativas únicas e sem vazio; a
  suíte só passa em série — `--no-file-parallelism` — porque os testes
  de integração dividem um Postgres e brigam em paralelo). Segue a
  "expansão dos bancos de quiz" da lista do usuário ("vamos fazer tudo
  isso"). Próximos da mesma leva: desafio diário com seed e o Magnata
  (negociação/leilão/hipoteca).
- **BOTS · LOTE 4 entregue — Quiz Pop e Quiz Nostalgia (realtime)
  (2026-07-09)**: fecha a iniciativa de bots. Como o quiz é REALTIME
  (não turn-based), criei um hook genérico `GameModule.botTick(state,
  botSeats, dt)` chamado pelo `RoomManager.startTicking` a cada tick com
  os assentos de robô (`isBot`). `createVsBot` passou a aceitar jogos
  realtime com `botTick` (além dos de turno com `bot`+`currentSeat`).
  `botTickQuiz`: cada bot responde com um tempinho de "pensar"
  (probabilístico por tick) e ~70% de acerto (erra numa alternativa
  aleatória); responde antes de o tempo esgotar. Botão do lobby
  estendido a quiz-pop/quiz-nostalgia. 264 testes (3 novos: bot responde
  índice válido, todos-bots revela a rodada, ~70% de acerto). Demo real:
  Quiz Pop 1×robô — Robô Zé acertou "1822" e fez +143; a revelação
  mostrou verde/vermelho. **Bots agora em 13 jogos** (só faltam os que
  não fazem sentido: puzzles solo, party de desenho/palavra).
- **FIX partidas/salas "travadas" na Visão geral (pedido do usuário
  2026-07-09)**: a Visão geral mostrava "Sendo jogados agora" (ex.:
  Cardume/Sudoku) e "Salas abertas" mesmo sem ninguém online — eram
  partidas SOLO IN_PROGRESS que ficavam para sempre quando o jogador
  fechava a aba (jogos solo são REST puro, sem socket p/ detectar a
  saída) e salas WAITING órfãs (o RoomManager é EM MEMÓRIA e some no
  restart, mas as linhas do banco ficavam). `lib/matches.ts`:
  `abandonarPartidasOrfas` + `fecharSalasOrfas` rodam NO BOOT (após um
  restart nada está vivo → toda partida IN_PROGRESS vira ABANDONED e
  toda sala WAITING/PLAYING vira CLOSED) e `reapSoloParadas` roda a cada
  10min (solo IN_PROGRESS parado >30min → ABANDONED). Chamados no
  `server.ts`. Assim a Visão geral só conta o que está REALMENTE ativo.
  258→261 testes (3 novos). Demo: antes "3 partidas / 10 salas", depois
  do boot "Partidas agora 0 / Salas abertas 0" e histórico intacto (172).
- **BOTS · LOTE 3 entregue — Truco, Memória e Forca (2026-07-09)**:
  fecha a cobertura de bots dos jogos de turno. `memoriaBot.ts` (memória
  JUSTA: só usa o mapa PÚBLICO `vistas` de cartas já reveladas — novo
  campo no MemoriaState, atualizado a cada virada — com ~82% de acerto,
  às vezes "esquece"), `forcaBot.ts` (escolhedor sorteia palavra de um
  banco; adivinhador chuta por FREQUÊNCIA de letras pt-BR, sem espiar) e
  `trucoBot.ts` (avalia a própria mão: manilhas+cartas altas → pede/
  aceita/aumenta/corre; joga a menor carta que vence ou descarta; deixa
  o parceiro ganhar). `currentSeat`/`bot` nos 3 módulos; `currentSeat` do
  truco resolve o RESPONDENTE certo na fase 'respondendo' e o da forca
  troca entre 'escolhendo'(escolhedor) e 'jogando'(turno). Botão do
  lobby estendido a truco/memoria/forca. 258 testes (5 novos: bot da
  memória mira par conhecido; bot×bot limpa a memória, fecha a forca e
  joga o truco até 12 tentos — tudo legal). Typecheck limpo. **Bots
  agora em 11 jogos** (Damas, Xadrez, Dominó, One, Pife, Gira Gênio,
  Magnata, Truco, Memória, Forca, Corrida do Ganso). Falta o Lote 4
  (Quiz, que é realtime).
- **NOVO JOGO — MAGNATA (clone do Monopoly, tema Brasil; pedido do
  usuário 2026-07-09)**: jogo de tabuleiro de imóveis, 2–6 jogadores +
  "🤖 Jogar contra o robô". **CARTÃO DE CRÉDITO (requisito do usuário)**:
  além do caixa, cada jogador tem um cartão cujo LIMITE sobe com os
  recebimentos (`+50%` do valor) e cai com os pagamentos (`−50%`, piso
  200); quando o caixa zera, o cartão banca o pagamento (vira `usado`,
  quitado automaticamente ao receber). `shared/magnata.ts`: tabuleiro de
  40 casas com ruas/praias/aeroportos do Brasil (nomes próprios — marca
  evitada), 8 grupos coloridos + 4 aeroportos + 2 serviços, helpers de
  aluguel (`aluguelPropriedade/Estacao/Servico`, monopólio dobra), custo
  de casa por grupo. `backend/games/magnata.ts`: turnos (rolar→
  comprar/passar→construir→encerrar; duplas jogam de novo, 3 duplas =
  prisão), aluguel, cartas Sorte/Cofre (8 cada, baralho embaralhado),
  prisão (dupla/fiança/3 turnos), IMPOSTOS, falência (imóveis voltam ao
  banco/credor; último de pé vence; trava de 400 turnos → mais rico) e
  BOTS heurísticos (compram com colchão de caixa, constroem em
  monopólios, pagam fiança). `MagnataBoard.tsx`: tabuleiro quadrado
  (perímetro 11×11) com cor do grupo/preço/dono/casas, peões, dados no
  centro, painel com o CARTÃO (caixa + crédito livre + limite/usado),
  ações, lista de jogadores e log. Registrado; RoomPage; catálogo 37
  jogos. 253 testes (7 novos: init, cartão paga/recebe nas 2 direções,
  falência→vencedor, comprar, rolar+encerrar, bot/currentSeat). Demo
  real: humano × Robô, 14 imóveis comprados, aluguel/Sorte no log e o
  limite do cartão variando com pagamentos (caiu ao piso 200).
- **NOVO JOGO — COBRA ARENA (clone do slither.io; pedido do usuário
  2026-07-09)**: multiplayer em TEMPO REAL, mundo simulado no SERVIDOR
  (reaproveita a infra realtime do co-op: `realtime {tickMs45,
  broadcastEvery2}` + tick + snapshot único). `shared/slither.ts`
  (tipos + constantes: raio da arena 1150, duração 150s, seg 8).
  `backend/games/slither.ts`: cobras com trilha de pontos (cabeça
  primeiro, aparada pelo tamanho-alvo), vira em direção à mira com taxa
  limitada, come comida e cresce, BOOST gasta massa (larga comida),
  borda circular mata, colisão cabeça×corpo alheio mata (vira comida),
  RESPAWN em 2s. **Arena povoada por cobras da IA** (steer p/ comida,
  foge da borda, desvia) → dá para jogar SOZINHO (minPlayers=1) ou com
  até 6. Fim por tempo → vence o MAIOR tamanho (best por assento em
  scoresFor). `SlitherGame.tsx`: canvas com INTERPOLAÇÃO entre snapshots,
  câmera seguindo a cabeça, grade/borda/comida com glow, corpo como
  traço grosso + olhos, HUD (tamanho, tempo, placar). Entrada: mover
  dedo/mouse = mira; toque/clique LONGO (segurar) = boost
  (`emitAck('game:action')` throttled). **RoomView ganhou `minPlayers`**
  e o botão "Começar" do RoomPage passou a usá-lo (permite começar solo).
  Registrado no socket; RoomPage; catálogo 36 jogos. 246 testes (6
  novos: arena povoada, mira/boost+tick move, comer cresce, borda mata,
  snapshot, fim por tempo+vencedor). Demo real: sala solo, 6 cobras +
  273 comidas, a cobra pilotada se moveu e o boost drenou massa (15→9).
- **TELA CHEIA nos jogos (pedido do usuário 2026-07-09)**: botão
  "⛶ Tela cheia / ⤢ Sair da tela cheia" que usa a Fullscreen API (PC e
  Android) com FALLBACK CSS para iOS (classe `mp-fs--fake` fixa cobrindo
  a viewport, pois o Safari do iPhone não expõe requestFullscreen em
  elemento). Hook reutilizável `lib/useFullscreen.ts`; CSS `.game-fs`
  (`:fullscreen` + fake) no `global.css`. Aplicado no **RoomPage** (TODOS
  os multiplayer — o alvo é a grade JOGO+CHAT, então na tela cheia o
  chat fica AO LADO) e no **SoloGamePage** (arcades/ação solo). Regra do
  usuário: **no celular/tablet o chat só aparece na HORIZONTAL** — a
  coluna do chat leva `max-lg:portrait:hidden` (em retrato abaixo de lg,
  some; paisagem/desktop aparece). Verificado por demo: a Fullscreen API
  real escondeu o header deixando tabuleiro+chat; retrato de celular
  ocultou o chat (display none) e paisagem mostrou. **LOTE 2 concluído**:
  botão reutilizável `components/FullscreenButton.tsx` aplicado às 8
  páginas solo dedicadas (Sudoku, Mahjong, Caça-palavras, Cruzadinha,
  Paciência, Memória solo, Palavra do Dia, Fazenda) — tela cheia agora
  em TODOS os jogos. Typecheck limpo.
- **NOVO JOGO — GIRA GÊNIO (clone do Perguntados; pedido do usuário
  2026-07-09, nome e escopo aprovados: jogo completo de uma vez)**:
  trivia com ROLETA de 6 categorias (🌎 Geografia · 📜 História · 🔬
  Ciência · ⚽ Esportes · 🎭 Arte & Cultura · 🎬 Entretenimento). Turno:
  gira → cai numa categoria → responde; ACERTOU numa categoria que não
  tem → ganha a COROA e joga de novo; ERROU → passa a vez. Junta as 6
  coroas e vence. 2–6 jogadores + "🤖 Jogar contra o robô" (bot ~72%
  de acerto). `shared/giraGenio.ts` (tipos, GG_CATEGORIAS, GGView SEM a
  resposta certa, GG_META=6). Banco NO SERVIDOR
  (`backend/lib/giraGenioPerguntas.ts`, ~12/categoria, alts[0]=correta)
  e `backend/games/giraGenio.ts` (módulo de turno: girar sorteia
  categoria+pergunta e EMBARALHA as opções rastreando a correta;
  responder valida; getStateFor NUNCA envia a correta; bot; recentes p/
  evitar repetição). `GiraGenioGame.tsx`: roleta SVG de 6 setores que
  GIRA até a categoria sorteada, card da pergunta com timer (cliente,
  20s → auto-erro), 4 alternativas A–D, coroas por jogador, reveal do
  último lance. Registrado no socket; RoomPage/GameLobby (hasBot);
  catálogo 35 jogos. 240 testes (5 novos: girar sorteia, acerto=coroa+
  joga de novo, erro passa a vez, resposta correta não vaza na view,
  junta 6 e vence, bot gira/responde). Demo real: humano × Robô Zé, a
  roleta parou em História ("Revolução Francesa?"), o robô juntou as 6
  coroas e venceu.
- **LANDING — botão trocado por chamada dos jogos (pedido do usuário
  2026-07-09)**: removido o botão "🎟️ Jogar sem conta" e o texto abaixo
  do hero; no lugar entrou "O que vai rolar na mesa / São N jogos na
  mesa" (N = contagem DINÂMICA via /api/games, não fixa) e a grade de
  jogos SUBIU (título duplicado do catálogo removido; espaçamento
  comprimido). `Home.tsx` sem `Link`/`useAuth` (não mais usados).
- **NOVO JOGO — CORRIDA DO GANSO (pedido do usuário 2026-07-09,
  aprovado com esse nome)**: jogo de trilha clássico (Jogo do Ganso,
  domínio público) — 2–4 jogadores + "🤖 Jogar contra o robô"
  (reaproveita 100% a infra de bots; o bot só rola o dado, sorte pura).
  `shared/ganso.ts`: trilha de 63 casas, dados sorteados NO SERVIDOR
  (`backend/games/ganso.ts`, crypto), regra pura `aplicaRolagem`
  (ricochete ao passar de 63; chegar EXATO vence). Casas especiais:
  🪿 ganso [5,9,14,18,23,27,32,36,41,45,50,54,59] avança de novo
  (encadeia); 🌉 ponte 6→12; 🏨 estalagem 19 (perde 1 vez); 🕳️ poço 31
  (perde 2); 🌀 labirinto 42→30; 💀 caveira 58→0. `GameModule` de turno
  (currentSeat/bot), sem rotação. `GansoBoard.tsx`: espiral 8×8 gerada
  em código, casas com ícone/cor, peões 🦢 coloridos que deslizam
  (transition), dados desenhados (pips SVG), narração do último lance,
  vez destacada. RoomPage/GameLobby (hasBot) ligados. Catálogo: 34
  jogos. 235 testes (9 novos: soma dos dados, ganso encadeia, ponte,
  poço=skip 2, caveira→0, ricochete/vitória exata, castigo consome
  skip, casaInfo). Typecheck limpo. Demo real: humano × Robô Zé, peões
  andando pela espiral com narração ("Robô Zé tirou 7 → casa 57").
- **NOVO JOGO — MAHJONG SOLITAIRE (pedido do usuário 2026-07-09)**:
  paciência de mahjong (combinar pares de peças LIVRES até esvaziar a
  mesa), SOLO com ranking, 3 níveis (fácil 2 camadas ~68, médio 3 ~122,
  difícil 4 ~140) e **deal novo e SEMPRE RESOLVÍVEL a cada partida**.
  `shared/mahjong.ts`: coordenadas em MEIAS-CÉLULAS (peça 2×2; camadas
  altas entram com staddle de 1 meia-célula = visual clássico);
  `montaLayout` (pirâmide por nível, contagem sempre PAR); `slotLivre`/
  `slotsLivres` (sem peça em cima + um lado aberto); geração por
  REVERSE-SOLVE (`gerarMahjong`: esvazia tirando pares de peças livres e
  atribui peças que casam do saco de 72 pares embaralhado → a ordem de
  saída vira a `solucao` garantida); `movimentosPossiveis` (dica/
  travamento) e `reembaralhar` (redistribui as peças restantes de forma
  resolvível quando trava). Flores casam com qualquer flor; estações com
  estações. `MahjongPage.tsx`: peças SVG realistas 3D (marfim + lábia de
  espessura), PONTOS e BAMBUS desenhados, caracteres 萬 + numeral,
  ventos 東南西北, dragões 中(v)/發(v)/白(moldura), flores/estações
  coloridas (glifos CJK usam o fallback do navegador do cliente).
  Peça LIVRE clicável e destacada; não-livre escurecida e sem clique
  (pointer-events none → o clique atinge a de cima); dica (anel ciano),
  reembaralhar, timer, "restam N". Pontos base 1200/2000/3000 − tempo −
  dicas − reembaralhos (mín 100); PLAUSIBILITY 'mahjong' {40/s, 20s,
  5000}. Catálogo: 33 jogos. 226 testes (7 novos: contagem par,
  resolvível seguindo a solução em 10 seeds × 3 níveis, ≤4 cópias por
  peça, determinismo por seed, sempre há par livre no início, cobertura/
  casamento). Typecheck limpo. Demo real: médio 122 peças resolvido →
  "Mesa limpa! 1954 pts" no ranking. Hook dev `window.__mahjong`.
- **QUEM ESTÁ ONLINE AGORA na Visão geral (pedido do usuário
  2026-07-09)**: dois boxes novos no Dashboard — "🎟️ Convidados online"
  e "🟢 Usuários online" — cada pessoa conectada com um selo do JOGO em
  que está (ícone/cor/nome) ou "no lobby". Presença rastreada no
  servidor (`realtime/presence.ts` — `Presence` conta socketIds por
  userId, suporta várias abas; `app.presence` decorado; add/remove no
  connect/disconnect do socket). O jogo vem do `RoomManager.roomOf` (só
  quando a sala está PLAYING). Rota `GET /api/admin/online`
  (`OnlineOverview {guests, users}` no `shared/admin.ts`; cruza presença
  + salas + catálogo p/ ícone). Frontend: o socket agora fica conectado
  ENQUANTO logado (connect no `AuthProvider` quando há user; disconnect
  no logout) — antes só conectava nas telas de jogo, então a presença
  vale em qualquer página. Boxes no polling de 4s (tempo real). Demo
  real: admin jogando Damas apareceu em "Usuários online", convidado
  "Tião" jogando Xadrez em "Convidados online". OBS: jogos SOLO (REST,
  fora do RoomManager) contam como "online / no lobby" (sem selo de
  jogo). LIÇÃO de demo: `page.goto` (reload) dispara o `pagehide` do
  convidado → beacon `/guest/leave` apaga o convidado; navegar por
  clique (SPA) preserva. Pacotes regenerados.
- **FIX SEO na ATUALIZAÇÃO WSRTA (pedido do usuário 2026-07-09)**: o
  `wsrta-update.sh` recompilava o site mas NÃO regravava o domínio no
  `robots.txt`/`sitemap.xml` — como o pacote de update traz esses
  arquivos com `localhost:8080`, cada atualização revertia o sitemap
  para localhost e derrubava o SEO. Corrigido: o update agora reaplica
  o mesmo `sed` do install ANTES do build, usando o `DOMAIN` do painel
  ou, na falta dele, derivando do `CORS_ORIGIN` já gravado no `.env`
  (`SITE_ORIGIN=${DOMAIN:+https://…}` → senão `${CORS_ORIGIN%%,*}`).
  Sintaxe conferida (`bash -n`) e o `sed` testado em cópias (sitemap/
  robots ficam com o domínio real). Contexto p/ indexar no Google:
  Search Console → adicionar propriedade (Domínio via DNS TXT, ou
  Prefixo via meta-tag) → enviar `sitemap.xml` → Inspeção de URL /
  Solicitar indexação. /admin e /sala já ficam fora (robots).
- **FIX visual Damas — dama do mesmo tamanho das peças (pedido do
  usuário 2026-07-09)**: a peça-dama (com 👑) esticava a célula porque
  as linhas do tabuleiro estavam em altura AUTO — a coroa fazia aquela
  linha crescer e a peça virava um oval, bagunçando o espaço. Corrigido
  no `CheckersBoard`: grade com `grid-rows-[repeat(8,minmax(0,1fr))]`
  (8 linhas iguais; conteúdo não estica mais a linha) + discos com
  `aspect-square` e a coroa `text-base leading-none` centralizada.
  Agora a dama é um disco redondo idêntico às outras peças, só com a
  coroa no centro. Verificado por demo (robô promoveu; tabuleiro sem
  distorção).
- **BOTS · LOTE 2 entregue — Dominó, One e Pife (mão escondida)
  (2026-07-09)**: bots que só olham a PRÓPRIA mão + o estado público
  (o `bot(state, seat)` recebe o estado completo mas cada bot lê apenas
  `hands[seat]`/`maos[seat]`). `dominoBot.ts` (greedy: joga a
  pedra/ponta que mais PONTUA pela dupla; empate solta a mais pesada;
  evita bater atrás no placar; abre com [6|6]), `oneBot.ts` (guarda
  curingas, prefere cartas de ação, solta números altos, cor do curinga
  = a que tem mais na mão), `pifeBot.ts` (compra do lixo só se formar
  par/vizinho; bate assim que dá; senão descarta a menos útil — turno de
  2 fases resolvido pelo encadeamento do `scheduleBotTurn`). Botão do
  lobby estendido a domino/one/pife (Dominó = 1 humano + 3 robôs;
  One/Pife = 1 humano + 1 robô). 219 testes (5 novos: abertura do
  Dominó com [6|6], mão inteira sem lance ilegal; One legal na abertura
  + partida 2p até vencer; Pife 200 lances legais nas 2 fases).
  Typecheck limpo. Demo real: Dominó com Robô Zé/Nina/Téo (spinner na
  mesa, "pontas somam 17", vez do humano), One round-trip (joguei
  amarelo 1, o robô respondeu amarelo 2), Pife montado. Próximos: 3 =
  Truco/Memória/Forca, 4 = Quiz Pop/Nostalgia.
- **BOTS NOS JOGOS DE TURNO — LOTE 1 entregue (Damas e Xadrez)
  (iniciativa aprovada pelo usuário 2026-07-09)**: opção "🤖 Jogar
  contra o robô" no lobby (cresce lote a lote; escopo combinado: máximo
  de jogos de turno; nível ÚNICO equilibrado; aciona por botão no
  lobby que cria sala privada com o robô já sentado e começa na hora).
  **Infra genérica reutilizável** no esqueleto: `GameModule.currentSeat`
  (de quem é a vez) + `GameModule.bot(state, seat)` (jogada da IA);
  `RoomManager` ganhou assento VIRTUAL de bot (`isBot`, sem socket,
  FORA do banco — sem FK de User: matchPlayer só p/ humanos),
  `createVsBot` (abandona sala anterior, senta humano no assento 0,
  preenche o resto com robôs até a menor contagem válida, `beginMatch`
  compartilhado com o `start`), e o loop de turno `scheduleBotTurn`/
  `runBotMove` (think-delay de 700ms → parece humano; encadeia se o
  próximo também for robô; limpa o timer em finish/close). Evento
  socket `room:createVsBot`; `RoomPlayerView.isBot`. **Bots**:
  `checkersBot.ts` (minimax alfa-beta prof. 6 sobre as regras de
  `/shared`; avaliação material + avanço) e `chessBot.ts` (negamax
  alfa-beta prof. 3 + quiescência de capturas p/ não pendurar peça;
  material + centro + avanço; `applyChessRaw` exportado do shared p/ a
  busca). Nomes 🤖 Robô Zé/Nina/Téo/Lia; entre lances quase iguais
  sorteia (partidas variadas). 214 testes (7 novos: lance sempre legal,
  24 meios-lances sem ilegalidade, captura dama pendurada, mate de
  corredor em 1, currentSeat). Typecheck limpo nos 3 workspaces. Demo
  real (Playwright): humano venceu a interação — em Damas fez o lance e
  o Robô Zé respondeu (vez voltou); em Xadrez jogou e2-e4 e o robô
  respondeu. Próximos lotes: 2 = Dominó/One/Pife (mão escondida), 3 =
  Truco/Memória/Forca, 4 = Quiz Pop/Nostalgia.
- **CONVIDADOS TEMPORÁRIOS + ÁREA EXCLUSIVA NO ADMIN (pedido do
  usuário 2026-07-08)**: os "jogar sem conta" agora são TEMPORÁRIOS —
  somem ao SAIR (logout apaga a conta-sombra) e ao FECHAR o navegador
  (`pagehide` → `navigator.sendBeacon('/api/auth/guest/leave')`), com
  rede de segurança (reaper de hora em hora no `server.ts`, remove
  convidados com >12h). Mas CONTAM no relatório mensal: cada visita
  grava uma linha PERMANENTE em `GuestVisit` (migração
  `20260708160000_guest_visits`) que sobrevive à remoção do convidado.
  Nome de convidado é ÚNICO enquanto ativo (case-insensitive; repetir
  → 409 GUEST_NAME_TAKEN; libera ao sair). `lib/guests.ts`
  (`deleteGuest` apaga as salas do host ANTES por causa da FK, +
  `reapOldGuests`, + `inicioDoMes`). `tokens.ts` ganhou
  `findUserByRefreshToken` (logout/leave descobrem o dono pelo cookie).
  No ADMIN: a lista principal de Usuários EXCLUI convidados
  (`where.isGuest=false`); nova seção "🎟️ Convidados (temporários)"
  com chips (nome/hora/✕), contadores "agora" e "jogaram este mês", e
  remoção manual via `DELETE /api/admin/guests/:id`
  (`GET /api/admin/guests` = ativos + monthCount de GuestVisit).
- **VISÃO GERAL: jogos AGORA e JÁ JOGADOS (pedido do usuário
  2026-07-08)**: novo `GET /api/admin/games-activity` (groupBy de Match
  por gameId: IN_PROGRESS = agora, todos = histórico) alimenta dois
  painéis no Dashboard — "🎮 Sendo jogados agora" e "🏆 Já jogados no
  sistema" — cada um com o total no topo e a listagem por jogo
  (ícone/cor/nome + contagem). **EM TEMPO REAL (pedido do usuário
  2026-07-09)**: o Dashboard faz polling silencioso a cada 4s
  (`useFetch` ganhou modo `{silent}` que atualiza sem voltar ao estado
  de carregamento — não pisca "…"), recarregando stats + games-activity
  sozinho; selo "● ao vivo" pulsando no título. Tipos `GuestView`/
  `GuestsOverview`/`GameActivityRow`/`GamesActivity` no `shared/admin.ts`.
  207 testes (4
  novos de convidados: cria+registra visita+recusa nome repetido; some
  da lista de contas mas aparece na área; sair apaga mas mantém a
  contagem mensal e libera o nome; /guest/leave apaga). Typecheck limpo
  nos 3 workspaces. Demo real (Playwright): 2 convidados entraram
  (Tião/Marli), nome repetido barrado, painel do admin com "12 agora /
  2 no mês", Visão geral com "75 agora / 174 já jogados" listados por
  jogo, e a saída de um convidado sumiu da área.
- **PROTEÇÃO CONTRA FORÇA BRUTA (pedido do usuário 2026-07-08)**: após
  N senhas erradas seguidas a conta BLOQUEIA (indefinido, até o admin
  liberar). N é CONFIGURÁVEL pelo painel admin → Usuários (controle
  "🔒 Bloquear conta após [N] tentativas"; padrão 5, faixa 3–20).
  Schema: `User.failedLogins`/`lockedUntil` + model `Setting` (kv);
  migração `20260708120000_bruteforce`. `lib/settings.ts`
  (get/setLoginMaxAttempts, sentinela LOCK_FOREVER). Login: checa
  lock ANTES da senha; erro incrementa e bloqueia no limite (403
  ACCOUNT_LOCKED; msg mostra tentativas restantes); acerto zera
  contador/lock. `POST /api/admin/users/:id/unlock` (botão
  Desbloquear, aparece só em conta travada) e `GET/PUT
  /api/admin/settings`. UserAdminView ganhou `locked`/`failedLogins`;
  status "Bloqueada" (magenta) na tabela. 203 testes (2 novos:
  bloqueia no limite + admin desbloqueia e zera). Demo real: limite 3,
  vítima travada, admin desbloqueou, vítima logou.
- **FIX loop do /setup ao deslogar após instalar (2026-07-08)**: depois
  de criar o admin na MESMA sessão, o SetupGate ficava com `needsSetup`
  cacheado (true) e, ao deslogar, empurrava de volta para /setup — que
  se auto-guardava mandando para /entrar → loop/pisca. Correção
  definitiva (pedido do usuário): (1) o setup NÃO abre mais sessão — o
  backend `POST /api/setup/admin` retorna `{ok:true}` e a tela vai para
  `/entrar` (login) com aviso "Administrador criado!"; (2) o SetupGate
  virou ONE-SHOT (`jaMandou` ref) — só força /setup UMA vez por
  carregamento, nunca mais depois (mata o loop ao deslogar/navegar); e
  redireciona /setup→/entrar quando não precisa de setup. A página
  /setup também se auto-guarda no mount. Verificado: fresh→/setup;
  criar admin→/entrar sem voltar; abrir /setup com admin existente→
  /entrar. Testes seguem em 201.
- **FIX logout com pisca-pisca (2026-07-08)**: ao clicar em "Sair" de
  uma rota protegida, o `logout()` zerava o user e o `RequireAuth` da
  rota atual disparava `Navigate → /entrar` competindo com o
  `navigate('/')` do Header — resultado: pisca login/spinner e terminava
  em /entrar (às vezes em loop). Correção no `Header.handleLogout`:
  `navigate('/')` ANTES de `await logout()` — sai da rota protegida
  primeiro, então o guard não desvia. Verificado: transições pós-Sair =
  `["/"]`, termina na home sem flash.
- **BANCO GERENCIADO pelo painel (WSRTA 1.0.2, pedido do usuário
  2026-07-08)**: com `database: postgres` no frontmatter, o WSRTA cria
  `app_<dominio>`, injeta a `DATABASE_URL` pronta e apaga o banco ao
  remover. Adicionado `database: postgres` aos dois `app.md`. Os
  scripts ganharam a flag `DB_MANAGED` (gravada no .env): quando o
  painel fornece a DATABASE_URL → `DB_MANAGED=wsrta` e o install NÃO
  cria/altera role nem banco (evita erro de permissão), e o
  `remove.sh` NÃO dropa (o painel apaga). Sem DATABASE_URL injetada →
  `DB_MANAGED=app` (modo self-managed do terminal/Docker: cria e dropa
  o `mp_<slug>` como antes). Precondição no painel: habilitar o
  PostgreSQL no cliente "Minha VPS". Sintaxe conferida com `bash -n`.
- **`## Remove` no app.md (WSRTA, pedido do usuário 2026-07-08)**: o
  painel passou a suportar a seção `## Remove` (roda ao REMOVER o app,
  no workdir com o .env carregado) — recomendada para apps que criam
  banco, senão o banco antigo persiste e remover+reinstalar falha na
  auth. Adicionado `deploy/wsrta-remove.sh` (lê DATABASE_URL do .env,
  só age em banco LOCAL, encerra conexões e faz DROP DATABASE + DROP
  ROLE do `mp_<slug>`; banco externo é preservado). Os dois `app.md`
  (install e update) ganharam `## Remove → bash remove.sh`, e o
  empacotador inclui `remove.sh` nos DOIS zips. Isso, junto do ALTER
  ROLE do fix anterior, deixa o ciclo remover→reinstalar limpo. Sintaxe
  conferida com `bash -n` (não testável sem psql/sudo no Windows).
- **FIX P1000 na instalação WSRTA (2026-07-07)**: `prisma migrate
  deploy` falhava com "Authentication failed ... credentials for
  `mesapop`" porque o role `mesapop` já existia no Postgres do servidor
  (tentativa anterior) e o script só fazia `CREATE ROLE IF NOT EXISTS`
  — a senha nova do .env não batia. Correções no `deploy/wsrta-install.sh`:
  (1) nome de role/banco derivado do DOMÍNIO (`mp_<slug>`) para não
  colidir com roles antigos/de outros apps; (2) `ALTER ROLE ... WITH
  LOGIN PASSWORD` SEMPRE (idempotente e auto-corretivo — força a senha
  a bater com o .env, mesmo em role pré-existente); (3) parsing de
  user/pass/db do DATABASE_URL por sed; (4) VALIDA a conexão
  (`psql "$DB_URL" -c 'SELECT 1'`) ANTES do migrate → mensagem clara em
  vez do P1000 no meio, com escape para DATABASE_URL externo; (5)
  DATABASE_URL passado inline aos comandos prisma. Reexecução reaproveita
  o .env e re-alinha a senha. `wsrta-update.sh` também passa o
  DATABASE_URL inline. (Não testável no Windows — sem psql/sudo local;
  sintaxe conferida com `bash -n` e parsing testado.)
- **SETUP INICIAL / login do admin pela TELA (pedido do usuário
  2026-07-06, instala via WSRTA sem editar .env)**: enquanto não
  existir nenhum admin, a plataforma abre `/setup` (SetupGate no App
  consulta GET /api/setup/status e redireciona). A tela cria a conta
  de administrador e já loga (POST /api/setup/admin → emite tokens como
  o register). SEGURANÇA: a rota se FECHA quando já há admin (403
  SETUP_DONE) — o primeiro a configurar vira o dono; sem segredo no
  .env. `shared/auth.ts` ganhou `setupSchema` (sem telefone).
  Instaladores NÃO pré-criam admin (WSRTA e Docker geram .env SEM
  ADMIN_PASSWORD → o seed pula o admin e o /setup assume). O seed
  antigo (ADMIN_PASSWORD no .env) ainda funciona e, se usado, fecha o
  /setup. 201 testes (2 do setup: status booleano e recusa de 2º
  admin). **FIX 2026-07-08 (feedback do usuário)**: (a) após criar o
  admin a tela ficava PRESA — o SetupGate tinha `needsSetup` cacheado
  (fetch único no load); agora o gate não força /setup quando há
  usuário logado e a página `/setup` se AUTO-GUARDA (consulta o status
  no mount e, se já há admin, redireciona para /entrar antes de
  renderizar o form) — garante que depois do 1º admin o /setup não
  funciona nem aparece. Demos: criar admin → vai para /mesa; abrir
  /setup com admin existente → cai em /entrar sem mostrar o form.
- **DEPLOY WSRTA (pedido do usuário 2026-07-06)**: o backend agora
  SERVE O SITE (build do frontend) na MESMA porta da API — porta única
  ($PORT) via `backend/src/plugins/static.ts` (@fastify/static + SPA
  fallback; só ativa se `frontend/dist` existir, então dev/Docker não
  mudam). Frontend usa URL relativa quando `VITE_API_URL` vazio (API e
  socket.io) — casa com a porta única. `deploy/`: `wsrta-install.sh`
  (instala deps, cria Postgres com senha aleatória, monta .env com
  segredos, prisma generate/deploy/seed, build do frontend; aceita
  DOMAIN/PORT do painel ou por argumento; bootstrap de Node/Postgres
  via apt no terminal) e `wsrta-update.sh` (mantém banco/.env, só deps
  + migração + rebuild). `app.install.md` e `app.update.md`
  (frontmatter name/port/workdir/envfile + Steps + Start
  `npm run start -w backend`). `npm run wsrta` empacota os dois zips em
  `releases/` (install fixo + update datado), código limpo e sem marca
  de IA. Verificado: porta única serve site+API+SPA, cópia limpa passa
  typecheck nos 3 workspaces, zip com barras normais extrai no Linux.
- **SEO / ROBÔS DE BUSCA (pedido do usuário 2026-07-06)**:
  `frontend/public/robots.txt` (Allow / geral; Disallow /admin e
  /sala/; aponta o sitemap) + `sitemap.xml` (/, /entrar, /criar-conta)
  — o install.sh grava o DOMÍNIO REAL nos dois na instalação (sed no
  localhost:8080; Google exige URL absoluta). `index.html` com title
  rico em palavras-chave, description, keywords, robots index/follow,
  canônico, Open Graph completo (og:image = icon-512) e JSON-LD
  WebSite pt-BR. Próximo passo do usuário quando tiver domínio:
  cadastrar no Google Search Console e enviar o sitemap.
- **AJUSTES 2026-07-06 (2ª rodada de feedback do usuário)**:
  - **Missão Elevador — agentes DESTRAVADOS e pegando elevador**: bug
    (screenshot do usuário: agentes presos na parede) — o clamp na
    parede não invertia a direção. Agora: PAREDE/poço → meia-volta com
    "vagar" (0.8–1.6s ignorando o jogador, senão a perseguição
    re-mirava todo frame); cabine parada/chegando no andar → agente
    CORRE (1.7×) para o poço, EMBARCA, viaja com a cabine (pega o
    jogador se estiverem juntos dentro!) e desce nas paradas (chance
    proporcional a dt — POR FRAME fazia embarcar/desembarcar em 16ms,
    lição!). Verificado determinístico: embarcou ✔ viajou de andar ✔
    e 25s orgânicos sem nenhum agente travado ✔.
  - **Telas de jogo SEM centralizar** (reversão a pedido): scroll
    automático removido do SoloGamePage e RoomPage — a página abre no
    topo, com o nome do jogo junto à barra superior.
  - **Cardume**: vórtices 5 → 3 (MAX_GIROS).
- **FIDELIDADE AOS CLÁSSICOS — Missão Elevador e Pega-Ladrão (pedidos
  do usuário 2026-07-06)**:
  - **Missão Elevador**: agora ATIRA e ABAIXA também DENTRO do
    elevador; ganhou PULO (↑/botão ⤴, também esquiva de tiros) e
    **LÂMPADAS DESTRUTÍVEIS como no Elevator Action**: atirar PULANDO
    (a bala sai na altura do pulo) apaga a luminária (+50) e a área
    fica ESCURA (gradiente radial por cima de portas/agentes/espião).
    Verificado por demo: bot pulou, atirou segurando espaço e apagou
    a lâmpada (área escurecida na captura).
  - **Pega-Ladrão**: obstáculos SEMPRE vêm de frente — contra o
    sentido da corrida do herói no andar (dirCaminho: par corre p/
    direita, ímpar p/ esquerda; hazards nascem à frente com vx
    contrário). Na ESCADA ROLANTE, herói e ladrão ACOMPANHAM A RAMPA
    (x desliza junto do progresso na diagonal, velocidade 0.95/s —
    sem teleporte de andar), como no Keystone Kapers. Verificado:
    hazards do andar 0 com vx<0 e progress 0.70 com x deslizando.
    **Ajustes (2026-07-06)**: relógio de 300s fixo e NO MÁXIMO UM
    obstáculo por andar (um objeto por vez para cima do herói) —
    invariante verificado em 20s de jogo real.
- **INSTALADOR EMPACOTADO (pedido do usuário 2026-07-06, processo
  PERMANENTE — ver regra 10)**: `npm run installer` →
  `scripts/build-installer.mjs` monta `dist/installer/` com SÓ o
  necessário (fontes dos 3 workspaces, prisma+migrações+seed,
  Dockerfiles, compose, nginx.conf, public/, install.sh, INSTALAR.txt)
  — sem testes/docs/demos —, remove TODOS os comentários da CÓPIA
  (printer do compilador TS com re-parse de conferência; css/html/
  prisma por limpeza dirigida; original intacto) e gera
  `dist/mesapop-installer.zip` (~368KB). VALIDADO: a cópia limpa passa
  no typecheck dos 3 workspaces (junction node_modules temporária).
  `install.sh`: confere Docker/Compose, gera .env com segredos
  (openssl), `docker compose --profile full up -d --build`, espera a
  API (migra+semeia no boot do container) e imprime URL/credenciais;
  aceita host/IP como argumento (CORS e VITE_API_URL corretos).
- **LANDING DINÂMICA (pedidos do usuário 2026-07-06, com prints)**: a
  grade de 6 jogos da home é VIVA — fileira de cima = 3 MAIS JOGADOS
  (partidas registradas), de baixo = 3 ALEATÓRIOS (novo sorteio a cada
  visita) — mas SEM rótulos entre as fileiras (ajuste do usuário:
  "retire os textos 🔥/🎲, não precisa disso"): uma grade única 2×3,
  layout idêntico ao original. Endpoint PÚBLICO GET /api/games/destaque
  (groupBy de Match + shuffle nos demais habilitados). **Espaçamento
  vertical COMPRIMIDO** (hero py-16/24→8/10, h1 menor, arte h-96→72,
  seção py-14→6) para a 1ª fileira de jogos aparecer JÁ NA ABERTURA
  sem rolar (verificado na dobra 1360×900).
- **RODADA DE CORREÇÕES pós-teste do usuário (2026-07-05, TODAS
  implementadas)** — feedback com screenshots:
  1. **Jogos centralizam na tela ao abrir** (sem rolagem acidental):
     scrollIntoView block:center no canvas do SoloGamePage e no
     container da partida do RoomPage; canvas com
     maxHeight calc(100vh−140px) mantendo proporção (o Come-Come não
     estoura mais a viewport).
  2. **Cardume**: órbita/vórtice virou ARMA LIMITADA — 5 giros, cada um
     com TIMER de 10s (anel dourado esvaziando ao redor do alvo), e
     recarga de 120s ao gastar os 5 (medidor de bolinhas no canto +
     HUD "🌀 giros x/5 / recarrega em Ns"). Cardume mais ESPALHADO
     (SEP 13→24, coesão 1.6→0.9, separação ×14) — bola compacta era
     fácil demais.
  3. **Come-Come — BUG dos fantasmas parados no centro CORRIGIDO**: o
     snap ao centro do tile comparava direção por REFERÊNCIA
     (`g.dir !== before` sempre true) → re-centralizava todo frame e o
     fantasma ficava vibrando preso. Comparar por VALOR resolveu
     (verificado: fantasmas percorrendo o labirinto na demo).
  4. **Missão Elevador**: elevador agora é AUTÔNOMO (sobe/desce sozinho
     parando 1,3s em cada andar — acabou o softlock de cabine parada
     entre andares; seta ▼/▲/▶◀ no poço); ABAIXAR (↓/botão novo)
     esquiva dos tiros altos e ATIRA RASTEIRO (agentes de elite atiram
     baixo 35% das vezes — abaixar não é imunidade); gráficos: lua +
     skyline, papel de parede alternado por andar, números de andar,
     luminárias penduradas com halo, portas com moldura/plaquinha,
     cabine com cabos/janela, garagem listrada, sombra + braço + pose
     agachada nos personagens.
  5. **Pega-Ladrão**: mundo 2500→4200px (~7,5 telas, relógio 105s);
     obstáculos nascem logo FORA da tela vindo na direção do guarda
     (metade no seu andar); gráficos: toldos listrados por seção, vidro
     com brilho diagonal, piso XADREZ, luminárias de teto, escada
     rolante com corpo/degraus animados/corrimão neon.
  6. **Desvio Estelar**: naves alienígenas ATIRAM (gotas verdes com
     glow, semi-miradas, mais rápidas com o tempo) — também é morte de
     1 toque.
  7. **CoinInsert**: a ficha agora nasce ancorada NA FENDA e entra de
     verdade (achata scaleY 0.75→0.08 na abertura e some dentro).
  8. **Login reordenado (pedido com print)**: "🎟️ Jogue sem conta" no
     TOPO; abaixo o box "💾 Salve seu progresso com um login grátis".
  - Typecheck limpo; 199 testes seguem verdes; demo visual das 8
    correções com capturas verificadas (fantasmas conferidos por
    posição via hook __solo).
- **FASE 9 · lote 5 entregue — CRUZADINHA (fecha os 9 jogos da fase)**
  (2026-07-05):
  - **Gerador** (`shared/cruzadinha.ts`): banco de 80 verbetes
    palavra+dica pt-BR (A–Z sem acento, dicas estilo Coquetel);
    `gerarCruzadinha(seed)` coloca a maior palavra no centro e encaixa
    ~11 outras SEMPRE cruzando (greedy pelo maior nº de cruzamentos,
    empate decidido pela seed) com as regras clássicas: célula
    antes/depois vazia e sem vizinhos paralelos acidentais (função
    `cabe`). Numeração pela ordem de leitura (linha→coluna). Devolve o
    gabarito completo (cells por palavra) — testado em 5 seeds: grade
    conectada (toda palavra cruza ≥1 outra), fiel ao gabarito, sem
    célula órfã.
  - **CruzadinhaPage** (solo, /jogos/cruzadinha): grade com numerinhos,
    palavra ativa em roxo + cursor, DICA ATIVA em destaque no topo,
    lista Horizontais/Verticais clicável com riscado ao completar,
    clicar 2× numa casa de cruzamento alterna →/↓, teclado físico E
    A–Z na tela (celular). Letra errada não entra (treme, −15). Pontos
    = 8×letra + 800 − 3×seg − 15×erros (mín 150), /api/solo com
    PLAUSIBILITY 'cruzadinha' {40/s, 30s, 2200}. Hook dev
    `window.__cruz`.
  - 199 testes (8 novos). Typecheck limpo. Seed: 32 jogos no banco.
  - Demo real: bot selecionou palavra por DICA (garante a direção
    certa), preencheu 11 palavras (CAJU, RELOGIO, ABACAXI…) respeitando
    o minMs do anti-cheat → "Cruzadinha fechada! 1176 pts, 1º no
    ranking".
- **FASE 9 · lote 4 entregue — QUIZ POP + QUIZ NOSTALGIA (uma engine,
  dois jogos)** (2026-07-05):
  - **Engine de trivia** (`shared/quiz.ts` + `backend/games/quiz.ts`
    com `makeQuizModule(slug, banco)` — registrada 2×): realtime
    perSeatView (tick 250ms), 10 perguntas sorteadas por partida
    (crypto), alternativas EMBARALHADAS por partida com a correta
    rastreada no servidor. Fases pergunta(15s)→revelação(4s); todos
    responderam → revela NA HORA. Pontos 100 + bônus de rapidez até 50
    (proporcional ao tempo restante ao travar). A CORRETA e as
    respostas alheias SÓ trafegam na revelação (durante a pergunta o
    rival vê apenas "✅ respondeu"); teste garante. 2–8 jogadores +
    espectadores; scoresFor grava o placar no Match.
  - **Bancos NO SERVIDOR** (`backend/lib/quizPerguntas.ts`, alts[0] =
    correta): **Quiz Pop** ~48 perguntas (Geografia/Ciência/Esportes/
    Cultura/História/Comida/Bichos) e **Quiz Nostalgia** ~41 (Música/
    Novelas/TV/Cinema/Anos Dourados/Brincadeiras — Roberto Carlos,
    Odete Roitman, Chacrinha, orelhão, fusca…). Teste de sanidade dos
    bancos (4 alternativas únicas, sem vazio). Expansão = melhoria
    contínua anotada.
  - `QuizGame.tsx`: barra de tempo, categoria + pergunta gigante, 4
    alternativas A/B/C/D coloridas, resposta travada em roxo,
    revelação verde/vermelho com "+148", placar com ✅ de quem já
    respondeu e ganho da última. UI única para os dois quizzes.
  - 191 testes (7 novos). Typecheck limpo. Seed: 31 jogos no banco.
  - Demo real (2 navegadores): partidas COMPLETAS dos dois quizzes —
    "O frevo é de qual estado?" revelado com Pernambuco verde e
    "Acertou! +148 🎉"; nostalgia com "o orelhão era o nome popular
    do…" (ANOS DOURADOS) e overlay de vencedor no fim.
- **FASE 9 · lote 3 entregue — FORCA + BINGO (o social do 60+)**
  (2026-07-05):
  - **Forca multiplayer** (`shared/forca.ts` + `backend/games/forca.ts`
    + `ForcaGame.tsx`): 2–6 jogadores, rodadas = jogadores (cada um
    ESCOLHE a palavra uma vez, 3–16 letras normalizadas A–Z). A PALAVRA
    NUNCA TRAFEGA para quem adivinha (palavraVista com null nas ocultas;
    escolhedor e fim de rodada veem tudo; teste de serialização).
    Adivinhadores se revezam PULANDO o escolhedor; letra certa revela
    ocorrências (+10 cada) e MANTÉM a vez; errada cresce a forca (+8 ao
    escolhedor) e passa. Completar = +40; CHUTE da palavra inteira = +60
    +2/oculta (errado conta na forca); 6 erros = enforcou (+50
    escolhedor). Fim = maior pontuação (scoresFor grava no Match). UI:
    boneco SVG que cresce parte a parte, tracinhos, teclado A–Z pintado
    (verde/riscado), narração ("B apareceu 2×!"), botão de arriscar.
  - **Bingo 75** (`shared/bingo.ts` + `backend/games/bingo.ts` +
    `BingoGame.tsx`): REALTIME perSeatView (tick 500ms) — o SERVIDOR
    canta uma bola a cada 3,5s (saco crypto). Cartela 5×5 por assento
    (colunas B-I-N-G-O em faixas de 15, centro LIVRE ★). MARCAR exige
    bola já cantada (servidor valida); BINGO! conferido no servidor
    (BINGO_LINHAS: 5 linhas + 5 colunas + 2 diagonais) — falso é
    recusado. 2–16 jogadores + espectadores ("só torce! 📣"). UI: bola
    da vez GIGANTE colorida por coluna, contagem regressiva, histórico
    de bolas, progresso dos rivais (x/25), botão BINGO! que pula quando
    o cliente detecta linha, linha vencedora dourada no fim.
  - 184 testes (10 novos). Typecheck limpo. Seed: 29 jogos no banco.
  - Demo real (2 navegadores): Vera escolheu CHUVEIRO, Tino errou Z/X
    (boneco na forca) e completou a palavra → rodada 2 ROTACIONOU o
    escolhedor; no Bingo, linha fechada após 38 bolas cantadas ao vivo
    e BINGO! validado com a linha dourada + overlay no rival.
    **LIÇÃO de demo**: Playwright recusa clicar em botão com
    animate-bounce ("element is not stable") — usar click force:true.
- **FASE 9 · lote 2 entregue — SUDOKU + CAÇA-PALAVRAS (geradores por
  seed)** (2026-07-05):
  - **`shared/seed.ts`**: mulberry32 + hashSeed (FNV-1a) + embaralha/
    intAte — PRNG DETERMINÍSTICO compartilhado. Mesma seed = mesmo
    puzzle → alicerce do futuro "desafio diário" (seed = data).
  - **Sudoku** (`shared/sudoku.ts` + `SudokuPage.tsx`): gerador com
    SOLUÇÃO ÚNICA garantida (preenche por backtracking com dígitos
    embaralhados pela seed; remove células só se `contaSolucoes(…,2)
    === 1`, com heurística de menor-candidato — 3 dificuldades geram em
    ~20ms). Alvos de pistas 40/32/26 (fácil/médio/difícil), base de
    pontos 600/1000/1500 − 2×seg − 30×erros (mín 100). UI: seletor de
    nível, feedback IMEDIATO (número errado NÃO entra, treme e custa
    30), modo LÁPIS (anotações 3×3 na célula), apagar notas, dígito
    esgotado some do teclado, highlight de linha/coluna/bloco e do
    mesmo dígito. Hook dev `window.__sudoku`.
  - **Caça-palavras** (`shared/cacaPalavras.ts` + `CacaPalavrasPage`):
    4 temas pt-BR (Frutas/Bichos/Cozinha/Brasil, 20 palavras cada, sem
    acento), 10 por sopa em grade 12×12, 8 direções com cruzamentos,
    completada com letras das PRÓPRIAS palavras (camuflagem). Arrasto
    pointer com `releasePointerCapture` no pointerdown (faz
    pointerenter disparar nas células vizinhas — funciona em toque E
    mouse), seleção só em linha reta, vale de trás pra frente, cor
    própria por palavra achada + lista com riscado. +30/palavra +
    bônus 600−2×seg. Hook dev `window.__caca`.
  - PLAUSIBILITY sudoku {60/s, 25s, 2500} e caca-palavras {50/s, 20s,
    1500} — as demos automatizadas precisam ESPERAR o minMs antes do
    último movimento, senão o finish é rejeitado (422).
  - 174 testes (8 novos: determinismo por seed, solução única nas 3
    dificuldades, grade válida, pistas no alvo, palavras presentes
    letra a letra em linha reta, tema respeitado). Typecheck limpo.
    Seed do banco: 27 jogos.
  - Demo real: Sudoku médio (32 pistas) fechado com lápis demonstrado
    → "946 pts, 1º no ranking"; sopa "Brasil" limpa (10/10, FEIJOADA a
    FORRO riscadas em cores) → "854 pts, 1º" — ambos validados no
    servidor respeitando o anti-cheat.
- **FASE 9 · lote 1 entregue — JOGO DA MEMÓRIA + PIFE** (2026-07-05):
  - **Jogo da Memória** (`shared/memoria.ts` tipos + `backend/games/
    memoria.ts` + `MemoriaBoard.tsx`): 6×6 = 18 pares de emojis; os
    VALORES das cartas ocultas vivem SÓ no servidor (view manda apenas
    viradas/presas — teste garante que oculta não tem `valor`); achou o
    par JOGA DE NOVO; erro → `ultimaJogada` revela a dupla e o cliente
    SEGURA o par errado 1.3s na tela antes de esconder (o servidor já
    virou de volta — animação sem timer no servidor). 2–4 jogadores,
    espectadores, rotação. Empate geral = draw. `MemoriaGrid` (grade
    burra com flip 3D rotateY) é REUTILIZADA pelo treino solo.
  - **Memória SOLO** (`MemoriaSoloPage`, rota /jogos/memoria/solo +
    card "Treino solo" no lobby): contra o relógio, +40/par, bônus
    900−5×seg−8×erros (mín 100). PLAUSIBILITY 'memoria'. **Ajuste de
    plataforma**: /api/solo/start não exige mais `maxPlayers === 1` —
    o whitelist real é o mapa PLAUSIBILITY (memória é multiplayer E
    solo). Convidado treina sem pontuar.
  - **Pife** (`shared/pife.ts` regras + `backend/games/pife.ts` +
    `PifeTable.tsx`): 2 baralhos (104), 9 cartas, 2–4 jogadores;
    comprar do MONTE ou do LIXO → descartar; quem compra do lixo NÃO
    devolve a mesma carta (presaDoLixo, destacada em amarelo); BATER =
    10 cartas com descarte que deixa 3 jogos de 3 (trinca OU sequência
    do MESMO naipe; A baixa A-2-3 e alta Q-K-A, sem virar esquina) —
    `particiona9` por força bruta (280 partições), `melhorBatida` testa
    os 10 descartes; monte esgotado recicla o lixo embaralhado (menos o
    topo). `podeBater` calculado no servidor acende o botão. Jogos do
    vencedor revelados só no fim. MÃO ESCONDIDA por assento (teste de
    serialização com mãos determinísticas — mão do RIVAL e topo do lixo
    também precisam ser fixados no teste, senão o aleatório vaza o rank
    procurado). Espectadores + rotação. UI ordena a mão por naipe SÓ na
    exibição (envia o índice real do servidor).
  - 166 testes (13 novos). Typecheck limpo nos 3 workspaces. Seed
    idempotente criou os 2 novos (catálogo no banco: 25 jogos).
- **FASE 8 · lote 6 entregue — TRUCO, PACIÊNCIA E PUZZLE (fecha o
  catálogo)** (2026-07-05):
  - **Truco paulista** (`shared/truco.ts` + `backend/games/truco.ts` +
    `TrucoTable.tsx`): baralho de 40 (sem 8/9/10, crypto Fisher-Yates),
    vira → manilha = rank SEGUINTE (força por naipe ♣>♥>♠>♦), mão =
    melhor de 3 vazas (empate entre times → vaza empachada; leva quem já
    venceu qualquer vaza; tudo empatado anula), truco escala 1→3→6→9→12
    com aumentar por cima (só a dupla que responde), correr entrega o
    valor ANTERIOR, partida até 12 tentos. **MÃO ESCONDIDA por assento**
    (trucoViewFor; teste de serialização). 2 jogadores (1×1) ou 4
    (duplas 0+2×1+3) — **novo `GameModule.validPlayerCounts`** validado
    no manager.start ("Este jogo aceita 2 ou 4 jogadores"); 3 nunca.
    seatPicking + espectadores + rotação. Mesa de feltro com vira,
    manilha destacada em amarelo na mão, vazas ✓/✗/=, tentos /12,
    botões TRUCO!/SEIS!/NOVE!/DOZE!/Aceitar/Correr. Blefe = chat da mesa.
    Melhorias futuras anotadas: mão de onze e mão de ferro.
  - **Paciência** (`PacienciaPage.tsx`, Klondike DOM sem canvas):
    clique-inteligente (carta tenta a FUNDAÇÃO, senão a melhor coluna;
    corridas movem juntas; K em coluna vazia), compra 1 a 1 com
    reciclagem do descarte. +10 fundação, +5 carta virada, bônus de
    velocidade (600−2×seg, mín 100) ao fechar o baralho. Pontos via
    /api/solo start/finish (PLAUSIBILITY 'paciencia'); convidado joga
    sem pontuar.
  - **Puzzle** (`games/puzzle.ts` no esqueleto solo, canvas 720×520):
    3 níveis (3×2→4×3→5×4), imagens 100% procedurais (pôr-do-sol/fundo
    do mar/espaço), toque em DUAS peças troca (detecção por
    input.downAt — não perde cliques), pontinho verde na peça certa,
    seleção com glow ciano, MONTADO! = base−15×trocas−4×seg (mín 120)
    + confete. PLAUSIBILITY 'puzzle'.
  - 153 testes (9 novos do truco: manilha/força por naipe, vaza com
    empate entre times, vencedorMao com empates, aceitar sobe valor,
    correr entrega anterior, aumentar por cima 3→6, mão escondida por
    serialização, fim aos 12). Typecheck limpo nos 3 workspaces.
  - Demo real (2 navegadores): Zeca pediu TRUCO!, Nina viu
    Aceitar(3)/SEIS!/Correr e aceitou; vaza disputada valendo 3; Nina
    levou 3 tentos (3/12) e a mão seguinte redistribuiu. Paciência com
    fundações subindo (60 pts, 24 jogadas). Puzzle: bot resolveu o
    nível 1 pelo hook __solo → "MONTADO! +536" com confete.
- **FASE 8 · lote 5 entregue — JOGOS DE PALAVRA** (2026-07-05):
  - `backend/lib/palavras5.ts`: ~300 palavras-alvo de 5 letras pt-BR sem
    acento; `palavraDoDia(date)` determinística (hash da data);
    `avaliaPalpite` estilo termo (verde/amarelo/cinza com tratamento
    correto de letras repetidas — amarelos consomem sobras). Palpites
    aceitam QUALQUER 5 letras (dicionário de aceitas = melhoria futura).
  - **Palavra do Dia** (solo diário, FORA do esqueleto solo/PLAUSIBILITY):
    a palavra vive NO SERVIDOR (o cliente só recebe cores — impossível
    espiar). Model `TermoPlay` (userId+date PK, attempts Json, migração
    `termo`): UMA partida por dia; pontos 100/80/60/45/30/20 por
    tentativa. Rotas /api/termo/hoje|/palpite|/ranking (ranking do DIA,
    sem convidados; convidado JOGA mas fica fora). `TermoPage` com grade
    6×5, teclado virtual colorido pelo melhor feedback + teclado físico.
  - **Duelo de Palavras** (2–6, realtime 250ms): mesma palavra p/ todos;
    MÃO ESCONDIDA — rivais recebem SÓ as cores (letras nunca trafegam;
    teste de serialização). Acertou → vence NA HORA (empate por menos
    tentativas); tempo 240s esgotado → melhor progresso (verdes×10+
    amarelos). `DueloGame` com grade própria + mini-grades coloridas dos
    rivais.
  - **Stop!/Adedanha** (2–6, realtime): letra sorteada (sem K/W/X/Y/Z...),
    7 categorias fixas (Nome/Animal/Fruta/Cor/Objeto/Lugar/Profissão),
    4 rodadas com letras diferentes; respostas ficam OCULTAS no servidor
    até o STOP (rivais veem só progresso x/7); STOP exige tudo
    preenchido; pontos 10 única/5 repetida/0 inválida-vazia (valida
    inicial normalizada — "babá" vale como "baba"). Validação de
    dicionário/votação = melhoria futura anotada. `StopGame` com letra
    gigante, inputs com envio periódico (400ms) e tabela de resultado.
  - **CORREÇÃO DE PLATAFORMA importante**: módulos realtime transmitiam
    UM snapshot p/ todos (otimização dos eventos consumíveis do co-op) —
    quebrava mão escondida em realtime. Novo `realtime.perSeatView`:
    Desenha & Adivinha, Duelo e Stop transmitem visão POR ASSENTO
    (sem eventos consumíveis); co-op/corrida seguem no snapshot único.
  - 144 testes (10 novos). Demos reais dos três (rivais só com cores no
    duelo; "fulana gritou STOP!" com tabela 10/5/0).
- **FASE 8 · lote 4 entregue — PLATAFORMA (pedidos do usuário de
  2026-07-05, TODOS implementados)**:
  1. **MODO CONVIDADO** ("jogar sem conta", nome OBRIGATÓRIO): conta-
     sombra (User.isGuest, migração `guests`; email sintético; hash
     '!guest' impede login; claim `guest` no access token). POST
     /api/auth/guest. Convidado JOGA TUDO (inclusive senta em salas
     multiplayer e DESENHA no gartic), mas: chat da mesa bloqueado
     (manager + UI com CTA), fazenda bloqueada (hook preHandler no plugin
     + página CTA "guarda seu progresso"), solo start/finish 403
     LOGIN_REQUIRED (client pula as chamadas e mostra CTA no game over),
     favoritos bloqueados, e NUNCA aparece em rankings (leaderboards +
     admin + standing filtram isGuest). Header mostra "· convidado" +
     botão Criar conta. Landing com "🎟️ Jogar sem conta".
     **Link compartilhado sem sessão** → /entrar com `state.from` →
     formulário de convidado (nome) → volta DIRETO para a sala.
  2. **USERNAME único** (migração `usernames`, `User.username @unique`,
     minúsculo [a-z0-9_.] 3–20): campo novo no cadastro (registerSchema),
     409 USERNAME_TAKEN, `displayName = username` (rankings e jogos usam
     o nome de usuário). Seed: admin recebe ADMIN_USERNAME ?? 'admin'.
     **Minha mesa** ganhou GET /api/me/standing: card "Ranking global"
     (posição por vitórias) + card "Seu jogo mais jogado" (posição por
     pontos se solo, vitórias se multiplayer).
  3. **Salas**: botão 🔗 COMPARTILHAR em toda sala (navigator.share →
     fallback clipboard, URL /sala/CODE); FAVORITAR salas públicas
     (model FavoriteRoom, migração `favorites`, POST /api/rooms/:id/
     favorite alterna; GET /api/rooms com auth OPCIONAL devolve
     isFavorite e ordena favoritas no topo; estrela ★ na Mesa e no lobby).
  4. **DESENHA & ADIVINHA completo** (`shared/desenha.ts` +
     `backend/games/desenha.ts` + `DesenhaGame.tsx`): realtime 5Hz,
     fases escolhendo(45s)→desenhando(180s)→revelação(5s), rodadas =
     jogadores×2, desenhista digita a palavra (2–30) e desenha (traços
     [x,y...] normalizados 0..1000, lotes ~10Hz, desenhista renderiza
     traços LOCAIS p/ zero lag), palpite normalizado (minúsculas/sem
     acento) — **acerto NUNCA ecoa a palavra** (respostas.text=null →
     "✓ fulana acertou!"; input vira "Você acertou!"), pontos 100/80/60…
     por ordem + 25/acerto p/ desenhista, dica ganha letras aos 120s/60s,
     tela estilo gartic (lista c/ lápis e ✔, DICA, paleta 8 cores +
     borracha + 3 pinceis + limpar, barra de tempo) e chat RESPOSTAS =
     ÚNICO chat (RoomChat oculto durante a partida). Espectadores
     assistem. 9 testes (incl. vazamento por serialização). Timeout do
     desenhista escolhendo = passa a vez.
  5. **Google Ads SEM consentimento** (decisão do usuário: "todos os
     sites de jogos mostram ads sem consentimento; o gartic abre com
     ads"): `AdSlot.tsx` (VITE_ADSENSE_CLIENT/SLOT no env; sem client →
     nada em prod, marcador tracejado em dev) posicionado em Mesa, lobby,
     página solo e sala. **Rodapé REVISADO** (saiu "sem rastreadores";
     entrou "exibe anúncios para se manter no ar; seus dados de jogo
     ficam no nosso próprio servidor").
  - **LIÇÕES**: PowerShell Set-Content grava BOM que quebra migration.sql
    (usar a ferramenta Write); `prisma migrate dev` recusa terminal
    não-interativo → criar pasta de migração manual + `migrate deploy`;
    gate de convidado em página com hooks → componente porteiro separado
    (regra dos hooks).
- **FASE 8 · lote 3 entregue — RETRÔS (Come-Come, Pega-Ladrão, Missão
  Elevador)** (2026-07-05), todos no esqueleto solo:
  - **Come-Come** (`games/comeCome.ts`, labirinto 19×17 em string-art com
    túnel e casa): 4 fantasmas com PERSONALIDADES (caçador=você;
    emboscada=4 tiles à frente; errante alterna caça/canto; tímido foge
    de perto), power pellet inverte 7s (azuis, pisca no fim, 200/400/800/
    1600 em combo; comido vira olhos que voltam p/ casa), viradas só no
    centro do tile (meia-volta livre), fases + rápidas. Paredes neon.
  - **Pega-Ladrão** (`games/pegaLadrao.ts`, side-view): **upgrade pedido
    pelo usuário (2026-07-05): rolagem lateral evidente estilo Keystone
    Kapers + FASES múltiplas + ELEVADOR** — mundo 2500px (~4,5 telas) com
    câmera, RADAR na base (loja inteira: guarda ciano, ladrão magenta
    piscando, retângulo da janela visível — assinatura do KK), seções
    temáticas (BRINQUEDOS/ESPORTES/MODA/ELETRO) com vitrines variadas e
    pilares p/ sensação de rolagem; ELEVADOR central automático (cabine
    para 1.1s em cada andar, borda dourada = embarcável; entra parado
    sobre ele, sai andando); FASES liberam obstáculos novos: 1 =
    carrinhos+bolas, 2 = +aviõezinhos, 3+ = +RADINHOS velozes (♪, pular),
    tudo mais rápido/frequente por fase; acerto = stun + −8s; pegar =
    segundos restantes ×20 + 500.
  - **Missão Elevador** (`games/missaoElevador.ts`, prédio 8+ andares,
    câmera vertical): elevador dirigível (↑/↓ a bordo; poço bloqueia sem
    cabine), portas VERMELHAS = documentos (+500, coleta ao passar),
    agentes saem das portas e atiram, tiro do espião (espaço/botão),
    tudo coletado → "DESÇA À GARAGEM" → +1000 e próximo prédio maior.
    **Upgrade (pedido 2026-07-05): fases infinitas com dificuldade
    crescente** — prédios até 14 andares/10 docs, mais agentes
    simultâneos, balas mais rápidas por prédio, e do prédio 3 em diante
    AGENTES DE ELITE (terno vermelho, 2 de vida, +rápidos, atiram mais,
    valem 250).
  - PLAUSIBILITY dos 3; demos com bots (pathing de pastilhas no
    Come-Come; pulo/abaixo reativo; doc coletado no Elevador).
    **LIÇÃO**: page.evaluate com funções internas via tsx quebra
    (`__name is not defined` do esbuild) — demos com evaluate complexo
    devem ser .mjs PURO rodado com node.
- **FASE 8 · lote 2 entregue — ARCADES SOLO (Snake, Campo Minado,
  Invasores)** (2026-07-05): três jogos plugados no esqueleto solo
  (SoloGamePage + /api/solo start/finish + PLAUSIBILITY + leaderboard):
  - **Snake** (`games/snake.ts`, 22×16): swipe do dedo OU setas (fila de
    2 direções, sem meia-volta), fruta com glow que troca de cor, cobra
    com carinha/língua, acelera a cada mordida (0.15s→0.07s), morte =
    partículas + shake. 10 pts/fruta.
  - **Campo Minado** (`games/campoMinado.ts`, 14×10, 22 minas): 1º clique
    SEMPRE seguro (minas plantadas depois, longe do clique), flood fill,
    +5/casa, vitória = bônus 500−4/s (mín 100) + confete; bandeira por
    TOQUE LONGO 350ms (anel de progresso) ou botão 🚩 (modo bandeira).
    **LIÇÃO (bug real)**: detectar clique por polling isDown perde toques
    que começam E terminam entre dois frames — detectar pela mudança de
    `input.downAt`. **LIÇÃO 2**: botões de toque flutuantes NÃO podem
    cobrir tabuleiros de grade — novo `actionsOutside` no SoloGameDef
    põe as ações abaixo do canvas.
  - **Invasores** (`games/invasores.ts`, 560×640): 5×10 aliens (2 quadros
    de dança, cores/pontos por fileira 10–30), bloco acelera conforme
    encolhe, desce na borda; barreiras destrutíveis (blocos 3hp, arco);
    tiro inimigo da fileira de baixo; NAVE BÔNUS (100–300) a cada 12–20s;
    fogo automático 0.42s; 3 vidas c/ invulnerabilidade piscando; onda
    limpa → +200 e próxima mais baixa/rápida. Alcançar as barreiras = fim.
  - PLAUSIBILITY: snake 30/s, campo-minado 150/s (max 2000), invasores
    80/s. Hook de dev `window.__solo` no SoloGamePage (gameRef).
  - Demo real (bots): cobra comeu 6 frutas guiada por pathing; Campo
    Minado VENCIDO (1078 pts, "LIMPO! +488" com confete); Invasores com
    nave bônus abatida e barreiras roídas. Bots de teclado devem SEGURAR
    a tecla (down+50ms+up) — press instantâneo cai entre frames.
- **Upgrade do Xadrez — PEÇAS-PERSONAGEM ANIMADAS (pedido do usuário,
  2026-07-05: "peão como soldados, cavalo com cavaleiros, reis reais,
  torres se arrastando deixando rastro, bispo com cajado")**:
  - `ChessPieces.tsx`: peças SVG procedurais estilo Mesa Pop (chibi):
    peão = soldadinho com lança e capacete, cavalo = CAVALEIRO MONTADO
    com lança, bispo com mitra e CAJADO de voluta, torre de pedra com
    ameias e carinha, rainha com coroa de pontas e joias, rei com coroa
    fechada, barba, capa e cetro. Dois times (creme/ciano × roxo/magenta),
    carinha própria, sombra no chão.
  - Camada de sprites no `ChessBoard`: cada peça é um elemento
    posicionado por translate(col%,row%) com TRANSIÇÃO — a peça ANDA de
    casa em casa. Identidade rastreada por `advanceSprites` (aplica o
    lastMove aos sprites: captura/en passant/roque/promoção) com
    VERIFICAÇÃO contra o board oficial (mismatch → rebuild sem animar,
    p/ reconexão/rotação).
  - Animações por personagem (global.css): soldadinho MARCHA, cavaleiro
    GALOPA em arco, bispo anda apoiado no cajado, torre SE ARRASTA (sem
    pulo, espremendo no chão) deixando RASTRO na pista, rainha desliza
    com rastro dourado, rei em passo solene; capturada cambaleia e some
    com estouro (anel + 💨); coroação nasce com pop; rei em xeque PULSA
    vermelho; respiração idle sutil em todas (delay dessincronizado);
    moldura com coordenadas a–h/1–8.
  - **RoomPage: overlay de fim ATRASADO 1.1s** segurando o tabuleiro na
    tela (endSoon + endShowingRef) — sem isso a rotação volta a sala p/
    WAITING no mesmo instante do mate e a animação da captura final
    nunca aparecia. `dismissEnd()` centraliza o fechamento.
  - **LIÇÃO de demo**: mate → sala WAITING → `window.__game` vira null;
    roteiros de teste devem esperar 'venceu' no lance final, não o board.
- **Lobby mostra AS PESSOAS das salas de espera (pedido do usuário,
  2026-07-05)**: /api/rooms agora retorna `playerNames` (RoomPlayer →
  user.displayName, ordem de chegada); componente `RoomPeople` (chips
  com avatar-inicial + "N lugares livres") usado na "Minha mesa" e no
  lobby de cada jogo.
- **FASE 8 · lote 1 entregue — XADREZ** (2026-07-05):
  - `shared/src/chess.ts`: regras completas e puras — todos os movimentos,
    roque (rei/torre intactos, caminho livre, sem xeque no percurso), en
    passant (expira na jogada seguinte), promoção com escolha (dama por
    padrão), peça cravada, xeque, xeque-mate, afogamento, regra dos 50
    lances, TRIPLA REPETIÇÃO (positionKey com board+vez+roque+ep) e
    material insuficiente (K×K, K+B/N×K, K+B×K+B mesma cor).
    **LIÇÃO**: `export *` no index do shared COLIDE nomes — `legalMoves`
    já existia no checkers e o import resolvia para a versão errada
    (retornava [] silenciosamente). Renomeado p/ `legalChessMoves`/
    `allLegalChessMoves`. Ao criar módulo novo no /shared, checar colisão
    de nomes exportados. (Outra lição: NÃO usar PowerShell -replace em
    arquivo UTF-8 com acentos — corrompe a codificação; usar Edit/Write.)
  - Backend `games/chess.ts`: allowSpectators + rotation LIGADOS (pedido
    do usuário da Fase 3: "ligar também no Xadrez na Fase 8"). Rotação do
    manager é genérica por winnerUserIds — funcionou para 2p sem mudança.
    **Ajuste no manager**: se o anfitrião RODA para a fila (perdeu), o
    comando passa a quem está sentado (hostId reatribuído).
  - `ChessBoard.tsx`: casas creme/roxo Mesa Pop, glifos ♟♞♝♜♛♚ (brancas
    em creme com sombra), lances legais calculados LOCALMENTE com a mesma
    lógica compartilhada, destaque do último lance, seletor de promoção
    (dama/torre/bispo/cavalo), badge XEQUE! pulsando, contagem de
    capturadas, tabuleiro girado p/ o seat 1, modo espectador.
    Textos de rotação do RoomPage generalizados (era "dupla" fixo).
  - 125 testes (12 novos de regras: abertura, bispo preso, cravada, en
    passant com expiração, roque ok/através de xeque/direito perdido,
    promoção, mate do louco, mate do pastor, afogamento, 50 lances +
    material, tripla repetição, sinalização de xeque).
  - Demo real (3 usuárias): Eva entrou de espectadora (👀 sem interagir),
    mate do pastor na mesa, overlay de vitória com aviso de rotação e a
    sala voltou à ESPERA com Eva SENTADA no lugar da perdedora.
- **FASE 7 entregue** (Corrida Pop — PvP com client-side prediction, o
  "boss final técnico"). **REFEITA em TERCEIRA PESSOA estilo Top Gear no
  mesmo dia, a pedido do usuário** (a 1ª versão era top-down):
  - **Física compartilhada determinista** (`shared/src/racing.ts`): o
    veículo vive em coordenadas DA PISTA — `dist` (distância percorrida,
    total, sem zerar por volta) e `lat` (deslocamento lateral, |lat|≤1 =
    asfalto, >1.15 = grama). Pista = 14 segmentos {length, curve, hill}
    (TRACK_LENGTH 4800, curvas normalizadas por CURVE_SCALE p/ o traçado
    fechar 360° — minimapa fiel via `trackLayout`). `stepCar(car, input,
    dt, vehicle)` puro: centrífuga empurra p/ fora (∝ curva × velocidade²),
    volante contra-esterça, drift derruba o grip lateral (desliza) e
    CARREGA o boost quando |latV|>1.1, boost eleva o teto (carro 280→400)
    mas corta a esterçada a 45%, grama freia forte. **DOIS VEÍCULOS**
    (`VEHICLES`): carro (equilibrado) e moto (mais rápida 300/430, menos
    grip 4.4, mais centrífuga — escorrega mais; coberto por teste).
    Checkpoints = 4 quartos da pista validados em ordem pela distância.
  - **Servidor autoritativo** (`backend/src/games/racing.ts`): countdown
    3.5s → racing → finished; guarda de seq obsoleto; timer de 20s após o
    1º a completar; `options.vehicle` da criação da sala (validada) define
    carro/moto p/ TODOS. Tick 33ms, broadcast 2 ticks. Env RACE_LAPS.
  - **Cliente pseudo-3D** (`racingClient.ts`): prediction + reconciliação
    idênticas (histórico por seq, replay do stepCar). Render estilo anos
    90: fatias projetadas com perspectiva (FOCAL/z), curvas acumulando
    deslocamento parabólico, morros movendo o horizonte com OCLUSÃO de
    crista (clipY), zebras vermelhas/brancas, faixa central, linha de
    chegada xadrez, pôr-do-sol pop + montanhas em parallax (bgOff pela
    curva), árvores/placas de seta procedurais, PÓRTICO "MESA POP",
    minimapa com pontos ao vivo, fumaça de drift + chama de boost, sprite
    visto de trás (carro com aerofólio/lanternas; moto com piloto que
    inclina), velocímetro km/h. Rival só desenha se DE FATO à frente
    (rel ≥ CAM_BACK×1.2) e com teto de escala 1.15 — senão um rival
    colado atrás virava um gigante sobre o seu carro (lição da demo).
    Barra de boost no canto esquerdo (no centro cobria o veículo).
  - Lobby: cards 🏎️ Carro / 🏍️ Moto na criação (reusa `options` do co-op).
  - 113 testes (novos: acelera/satura, determinismo, drift carrega boost,
    boost estoura teto + corta esterçada, grama freia, centrífuga empurra
    e moto escorrega mais, checkpoints em ordem + volta, opção moto
    validada, corrida completa com bot que contra-esterça a centrífuga).
  - Demo real (2 navegadores): grid de largada com pórtico, drift com
    inclinação, disputa na volta 2/3 e "Piquetinho venceu"; demo extra de
    MOTO. Aproveitado: erros de tipo pré-existentes do farm.ts (casts de
    Json do Prisma) zerados com pontes asPlots/asJson — typecheck limpo.
- **FASE 6 entregue** (jogos autorais):
  - **Fazenda Pop** (`routes/farm.ts` + model Farm com plots/upgrades/
    animals em Json): economia 100% validada no servidor — crescimento
    derivado de plantedAt (funciona OFFLINE; testado com viagem no tempo),
    colher antes da hora → NOT_READY. 5 culturas (cenoura 1min → cacau 8h),
    loja (canteiros 4→12 com preço crescente, adubo −8%/nível). **CURRAL**
    (adendo do usuário): galinha 🐔 (ovo a cada 3min, carne 55 após 10min),
    porco 🐖 (carne 220 após 30min), vaca 🐄 (leite a cada 10min, carne 600
    após 1h) — coleta e abate validados pelo relógio do servidor
    (NOT_READY/NOT_MATURE). Rotas /api/farm(/plant|/harvest|/buy|
    /animal/buy|/animal/collect|/animal/slaughter). FarmPage com canteiros
    marrons, countdowns ao vivo, seletor de sementes, curral e loja.
  - **Cardume** (`games/cardume.ts`, solo com leaderboard): boids
    (separação+alinhamento+coesão) com os 3 comandos da visão — ponteiro
    move → cardume segue; toque rápido/espaço → DISPERSA; segurar/Shift →
    ORBITA em alta velocidade (arma). Peixinhos dourados = comida (+1
    peixe, cap 90); peixões perseguem e comem; cardume orbitando em
    velocidade ricocheteia e dá dano — peixão devorado = +200 e +3 peixes.
    Oceano com raios de luz, bolhas, vinheta. Engine Input ganhou
    hover/isDown/downAt (cursor sem clique). PLAUSIBILITY 'cardume'.
  - 103 testes (8 fazenda + curral). Migrações farm + farm_animals.
- **FASE 5 entregue** (tempo real tolerante — Esquadrão 42 Co-op):
  - Arquitetura: o SERVIDOR simula o mundo (inimigos, boss, balas,
    colisões, pontos) em `backend/src/games/esquadraoCoop.ts`; cada
    cliente move o próprio avião LOCALMENTE (zero latência) e reporta a
    posição (~15Hz, clampada no servidor) — a tolerância vem de estarem
    do mesmo lado. Snapshots a ~10Hz com eventos consumíveis (explosões/
    textos/shake tocados no cliente).
  - GameModule ganhou `realtime {tickMs, broadcastEvery}` + `tick()` +
    `scoresFor()`; RoomManager roda o loop de simulação por sala
    (startTicking/stopTicking), snapshot ÚNICO por broadcast, ações não
    retransmitem, scores por assento gravados no Match. `room:create`
    aceita `options` (sanitizadas) → `init(count, options)`; RoomView
    expõe `options`.
  - Modos (opção na criação): **'juntos'** — hit DERRUBA o avião (fumaça,
    "DERRUBADO!"); o parceiro voa até <46px e reanima em 2s (anel de
    progresso; power-up de vida reanima à distância); os dois derrubados =
    fim cooperativo (draw, "Fim de voo, esquadrão!"). **'lado-a-lado'** —
    3 vidas e placar por avião; fim quando ambos caem; vence o maior placar.
  - Cliente (`coopClient.ts` + `CoopGame.tsx`): interpolação de inimigos/
    parceiro entre snapshots, balas por dead-reckoning, terreno/boss/arte
    idênticos ao single-player (duplicação consciente — candidata a
    extração p/ esqArt.ts), HUD da dupla, botões toque LOOP/BOMBA.
    Meu avião roxo, parceiro ciano.
  - Lobby do co-op com seleção de modo (cards 🤝/⚔️). Env COOP_BOSS_EARLY
    p/ testes.
  - 95 testes (6 novos: derruba/reanima por proximidade, fim cooperativo,
    3 vidas e vencedor por placar, loop invulnerável, clamp de posição,
    sala realtime transmitindo snapshots com posição refletida).
  - Demo real: Maverick+Goose voando juntos; resgate capturado
    (Iceman derrubado, Slider reanimando).
- **FASE 4 entregue** (engine 2D + primeiros jogos de ação + leaderboard):
  - `frontend/src/engine/core.ts`: engine de canvas reutilizável — loop com
    dt limitado, Input unificado (setas/WASD + arrastar dedo/mouse),
    circleHit, Starfield parallax, Particles. Sem dependências.
  - **Desvio Estelar** (`games/desvio.ts`, slug nave-espacial): endless de
    desvio puro (1 toque = fim), asteroides/cometas/naves alienígenas,
    densidade e velocidade crescentes, 10 pts/segundo.
  - **Esquadrão 42** (`games/esquadrao.ts`, slug esquadrao-1942): shoot'em
    up com fogo automático e 5 armas — reto (infinito), espalhado (40),
    laser (feixe, 90), míssil teleguiado (16), bomba de tela (espaço/B,
    máx 3) —, power-ups caindo + drops de tanque, 4 tipos de inimigo
    (batedor/onda/caçador/tanque que atira), 3 vidas com invencibilidade.
    maxPlayers ajustado para 1 (co-op vira modo próprio na Fase 5).
  - **Leaderboard validado no servidor** (`routes/solo.ts`): fluxo
    start→finish com o SERVIDOR medindo a duração; teto de pontos/segundo
    por jogo (PLAUSIBILITY map) + mínimo de duração; score implausível →
    422 e partida descartada (sem replay). Usa Match/MatchPlayer/Score →
    alimenta rankings do admin. GET /api/leaderboards/:slug (melhor por
    usuário, top 20).
  - `SoloGamePage`: canvas + HUD (pontos/vidas/arma/bombas) + telas de
    início e game over (recorde/posição) + ranking ao lado. Rota
    /jogos/:slug decide solo (registry SOLO_GAMES) vs lobby multiplayer.
  - 89 testes passando (4 novos: score implausível rejeitado, partida não
    reaproveitável, plausível entra no ranking). Demo real: bot jogou os
    dois jogos, 1950 pts no Esquadrão aceitos → 1º no ranking.
  - **Upgrade v2 do Esquadrão (mesmo dia, pedidos do usuário)**: cenário
    vivo no chão (campos com faixas, estrada curva com faixa tracejada,
    árvores, casas, CARROS nos 2 sentidos — atingíveis, +50 — e TANQUES de
    chão com torre que mira e atira, 3hp, +300); inimigos aéreos novos
    (helicóptero com rotor animado 2hp/+150, aviãozinho rápido 1hp/+100,
    avião grande 4hp/+400 com barra de vida); BOSS a cada 5 min (avião
    gigante, hp escala por aparição, 2 padrões de ataque, barra no topo,
    morte em cadeia de explosões, +5000, solta 2 power-ups); manobra de
    LOOP (tecla L/Shift ou botão, invencível 0.9s, cooldown 6s, sombra se
    afasta = sensação de altura); botões de toque LOOP/BOMBA sobre o canvas
    (celular/tablet). Atalhos de dev gated por import.meta.env.DEV:
    __bossEarly (boss aos 14s) e __photoMode (invulnerável p/ capturas) —
    inertes em produção.
- **FASE 3 entregue** (mão escondida: Dominó e One + adendos):
  - `/shared/domino.ts`: regras completas (duplo-seis, 4p em duplas 0+2 vs
    1+3, abre com [6|6], captura de pontas com orientação, passe só sem
    jogada, trancado aos 4 passes → menos pontos vence, empate possível).
  - `/shared/one.ts`: baralho 108, combina cor/valor, curinga com escolha de
    cor, pular/inverter (vira pular com 2), +2/+4 sem acúmulo, compra com
    "jogar agora ou guardar", reembaralho do descarte.
  - **MÃO ESCONDIDA**: `dominoViewFor`/`oneViewFor` — a visão que trafega só
    tem a própria mão + contagens; testes garantem que nada vaza (inclusive
    para espectador, assento -1).
  - Refactor `winnerSeats[]` (vitória de dupla) em módulo/manager/UI.
  - **Adendos implementados**: escolha de assento/dupla na espera
    (`room:seat`, dupla cheia → outra automaticamente), espectadores (sem
    ver mãos, limite 20, podem sentar se houver vaga) e ROTAÇÃO estilo bar
    (dupla que perde vai pro fim da fila, próxima entra, vencedores ficam,
    sala volta a WAITING sem fechar, chat contínuo).
  - UI: SeatPicker (duplas Magenta/Ciano, fila numerada), DominoTable
    (linha, mão com peças jogáveis acesas, escolha de ponta, passar),
    OneTable (descarte com cor ativa, monte, comprada jogável, seletor de
    cor do curinga), RoomPage genérico por gameSlug + modo espectador.
  - 80 testes passando (22 novos de regras + 3 de integração da rotação com
    5 sockets). Demos reais: Dominó 4p com espectadora Eva promovida pela
    fila após a derrota da dupla Magenta; One 3p até a vitória.
  - **Upgrade All Fives (mesmo dia, feedback do usuário)**: Dominó refeito
    no padrão profissional — spinner [6|6] com 4 braços, pontuação pelas
    pontas abertas (múltiplos de 5; carroça conta dobrado; spinner vale 12
    até cobrir os lados), bater leva pontos das mãos adversárias, trancado
    decide por menos pontos, partida em VÁRIAS mãos até 100 (env
    DOMINO_TARGET p/ testes). Mesa SVG de feltro com pedras de pips,
    carroças atravessadas e serpente dobrando para os 4 cantos. Rotação
    refinada: só com fila E sala pública; senão revanche das mesmas duplas.
    83 testes passando.
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
- **PENDÊNCIA (2026-07-05)**: o usuário achou a fazenda "ainda duvidosa"
  visualmente mesmo após a repaginação em cena — deixada assim POR ORA a
  pedido dele. Melhorias futuras: sprites/arte de verdade em vez de emoji,
  isometria leve, mais densidade de decoração.
- **FILA DE JOGOS NOVOS (2026-07-09) — TODA ENTREGUE ✅** (o usuário
  pediu "continue sem parar, escolha as recomendações"; feito de forma
  autônoma, cada um com testes + demo + pacotes + push):
  Mahjong ✅, Corrida do Ganso ✅, Gira Gênio (Perguntados) ✅, Tela cheia
  (todos os jogos) ✅, Cobra Arena (slither) ✅, **Magnata (Monopoly BR
  com cartão de crédito) ✅** — todos descritos acima. **36 jogos** no
  catálogo do seed (Corrida do Ganso foi REMOVIDO depois, a pedido do
  usuário; + treino solo da memória e rotas dedicadas).
- **Próximo passo**: leva "vamos fazer tudo isso" (2026-07-09) 100%
  ENTREGUE — Bots Lote 3 (Truco/Memória/Forca) ✅, Lote 4 (Quiz) ✅
  (iniciativa de bots de turno FECHADA: 13 jogos com robô), fix das
  partidas/salas travadas ✅, expansão dos bancos de quiz ✅, Desafio
  Diário com seed ✅ e Magnata negociação/leilão/hipoteca ✅. Sem
  pendência do usuário no momento — aguardando o próximo pedido. Ideias
  aguardando priorização futura: Modo Conforto 60+
  (lote opcional sugerido: fontes/cartas maiores, alto contraste,
  timers relaxados, prefers-reduced-motion); expandir os bancos de quiz
  ainda mais; mão de onze/ferro no Truco; dicionário no termo/duelo;
  votação no Stop; moderação de chat no admin; arte da fazenda; extração
  do esqArt do co-op; estender o Desafio Diário a mais jogos seedáveis.
  Backlog antigo segue anotado: mão de onze/ferro no Truco; dicionário
  de palavras aceitas no termo/duelo; votação de respostas no Stop;
  moderação de chat no admin; arte da fazenda (pendência abaixo);
  extração do esqArt do co-op; desafio diário com seed nos puzzles.

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
11. **TODA ALTERAÇÃO vai para o GitHub** (pedido do usuário em
    2026-07-06): após cada commit, `git push` para
    https://github.com/jdobrito-cbs/mesa-pop (remote `origin`, branch
    `main`, conta jdobrito-cbs via gh). Repositório PÚBLICO — nunca
    commitar .env/segredos (já no .gitignore).
10. **A CADA REVISÃO DO SISTEMA, regenerar os pacotes** (pedido do
    usuário em 2026-07-06): rodar `npm run installer` E `npm run wsrta`
    ao fechar qualquer entrega. Ambos copiam só o necessário, REMOVEM
    TODOS OS COMENTÁRIOS (printer do TypeScript; shell por limpeza
    dirigida) e, no WSRTA, também barram qualquer marca de autoria por
    IA (varredura) — o original fica intacto. TODAS as saídas vão para
    `releases/` (versionado → GitHub): `mesapop-docker-install.zip`
    (Docker, com `install.sh`), `mesapop-wsrta-install.zip` e
    `mesapop-wsrta-update-AAAA-MM-DD.zip` (WSRTA; datar o update).
    `releases/README.md` explica qual baixar. ZIPs gerados por gerador
    nativo em Node (`scripts/lib/zip.mjs`) com barras normais — o
    Compress-Archive do Windows usa barra invertida e quebra no Linux.

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
- **Padrão de qualidade visual dos jogos de ação** (pedido do usuário em
  2026-07-05): os jogos de canvas devem parecer JOGOS DE CELULAR modernos,
  nunca "jogos de Atari". Exigências: gradientes e iluminação nos sprites,
  glow (shadowBlur), rastros de motor/projéteis, explosões com onda de
  choque + partículas, screen shake, textos de pontos flutuando, fundos
  ricos (nebulosas/nuvens em camadas, vinheta), power-ups pulsando,
  inclinação do avião ao manobrar. Tudo procedural (sem assets externos).
- **Animação de "ficha no fliperama"** (pedido do usuário em 2026-07-04): ao
  escolher um jogo, tocar uma animação de ficha/moeda sendo inserida num
  arcade — ar de jogos antigos. Componente reutilizável (`CoinInsert`) usado
  como transição padrão de entrada em TODOS os jogos.
- **Dominó profissional — All Fives com spinner** (pedido do usuário em
  2026-07-04, ref. play-domino-online.com/pt/regras-de-domino/ + imagem de
  mesa): a PRIMEIRA pedra ([6|6]) é o spinner — o jogo cresce **nas 4
  direções (4 cantos)** a partir dela (braços cima/baixo só abrem depois
  dos dois laterais). **Pontuação pelas pontas abertas**: a cada jogada,
  se a soma das pontas externas for múltiplo de 5, a dupla marca essa soma
  (carroça na ponta conta as duas metades; spinner conta 12 até os dois
  lados serem cobertos). **CORREÇÃO do usuário (2026-07-04): bater NÃO soma
  as mãos adversárias — os pontos vêm SÓ das pontas abertas. Quando alguém
  bate (ou o jogo tranca), vence a dupla que PONTUOU MAIS; empate em pontos
  → vence a dupla que colocou a ÚLTIMA PEDRA na mesa (ajuste do usuário em
  2026-07-05; não há "nova mão" — toda partida se decide na hora).**
  Visual: mesa estilo feltro com pedras desenhadas (pontinhos/pips),
  carroças atravessadas, linha serpenteando para os cantos.
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
  seguida para jogar — os vencedores FICAM na mesa. **Refinamento
  (2026-07-04): o placar é POR DUPLA; a rotação só acontece se HOUVER fila
  e a sala for PÚBLICA — sem fila, ou em sala privada, as mesmas duplas
  continuam (revanche direto).** A sala não fecha entre partidas (chat
  contínuo). Flags no GameModule: `allowSpectators`, `seatPicking`,
  `rotation` (ligar também no Xadrez na Fase 8).
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
- **"Duelo de Palavras"** — clone MULTIPLAYER do *Termo* (term.ooo) como
  referência (pedido do usuário em 2026-07-04), até 6 jogadores: todos
  tentam adivinhar a MESMA palavra secreta de 5 letras simultaneamente,
  cada um em sua grade (verde = letra certa no lugar, amarelo = letra
  existe em outra posição). Vence quem acertar primeiro (desempate: menos
  tentativas). Os outros veem o progresso dos rivais só como cores (sem as
  letras) — mão escondida aplicada a palavras. Nome genérico, sem a marca.
- **Desenha & Adivinha** (regras detalhadas pelo usuário em 2026-07-04,
  até 6 jogadores): o desenhista da rodada digita uma PALAVRA (fica oculta
  até o fim da rodada) e desenha no canvas para exemplificá-la; os outros
  tentam adivinhar. Quem escrever a palavra exata ganha a partida/rodada.
  Tempo de rodada: 3 minutos. Ao acertar OU estourar o tempo sem acerto, a
  vez de desenhar RODA para outro participante. A sala fica ativa em
  rodadas contínuas até o anfitrião encerrar. Dedução social ("impostor")
  como possível extensão futura.
  **Adendos do usuário (2026-07-05, refs gartic.io e garticphone.com +
  print da tela do gartic)**: o jogo tem CHAT PRÓPRIO de palpites
  ("RESPOSTAS") e esse é o ÚNICO chat liberado no jogo — o chat geral da
  sala fica OCULTO. Layout estilo gartic: lista de jogadores com pontos
  (ícone de lápis no desenhista), caixa DICA com tracinhos da palavra,
  painel REGISTROS (fulano entrou/saiu). Quando alguém acerta, a PALAVRA
  NÃO aparece no chat — só "✓ Fulana acertou!" em verde; para quem
  acertou, o campo de resposta vira "Você acertou!" e trava.

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
  - **"Invasores"** — clone de *Space Invaders* como referência (pedido do
    usuário em 2026-07-04): fileiras de alienígenas descendo em bloco,
    barreiras destrutíveis, nave bônus, velocidade crescente. Compartilha a
    base de tiro/colisão da engine 2D do 1942 (Fase 4).
- **Palavra**: Termo diário, caça-palavras.

### Ação 2D top-down (engine compartilhada)
- **MUDANÇA do usuário (2026-07-05, IMPLEMENTADA): a corrida (carro E
  moto) deve ser em TERCEIRA PESSOA, estilo Top Gear (SNES)** — câmera atrás do veículo,
  pista pseudo-3D (curvas/subidas por projeção de segmentos), rivais como
  sprites escalados pela distância. Substitui a visão de cima estilo
  Micro Machines. Manter o loop drift→boost e toda a infra de prediction/
  reconciliação (a física vira distância na pista + deslocamento lateral,
  que continua determinista e compartilhada).
- **Corrida (carro/moto), até 4p**: visão de cima estilo Micro Machines.
  **Boost carregado por drift**, recarregável, com trade-off: durante o boost,
  controle reduzido (arriscar na curva = caótico; na reta = seguro). Loop de
  habilidade: driftar bem = mais velocidade. PvP em tempo real (fase avançada).
  Moto = carro com física mais escorregadia.
- **1942 (avião)**: shoot'em up com scroll vertical. **Armas pegas no caminho,
  usadas até acabar**: tiro reto, espalhado, laser, míssil teleguiado, bomba de
  tela. Posicionamento dos power-ups coreografa a curva emocional da fase.
  **Especificação do usuário (2026-07-05)**: o fundo é um CENÁRIO VIVO com
  nuvens, estradas, árvores, CARROS (atingíveis por tiro) e TANQUES no chão
  (atingíveis E que atiram de volta). Inimigos aéreos: HELICÓPTEROS e aviões
  grandes e pequenos. A cada **5 minutos** aparece um **AVIÃO ENORME (boss)**
  para derrotar. Tecla/botão de **LOOP**: o avião faz um loop para escapar de
  mísseis/tiros em excesso (invencível durante, com cooldown).
  Single-player primeiro (zero rede); depois **co-op** (aviões vs. máquina —
  latência tolerante pois não há PvP direto) com dois modos:
  (a) **time que sobrevive junto** — vida/pontuação coletiva, revive aliado;
  (b) **lado a lado por pontos** — cada um seu placar.
- **Nave espacial**: endless de **desvio** (cometas, asteroides, naves).
  Densidade crescente. Highscore = tempo de sobrevivência. Identidade: desviar
  (não sobrepõe ao 1942, que cobre o atirar).

### Engines próprias
- **Fazenda como CENA VIVA (pedido do usuário em 2026-07-05, ref. visual
  "Family Farm Seaside")**: a fazenda não é um painel de cards — é uma cena
  interativa: gramado com árvores/cercas, canteiros de terra onde a planta
  CRESCE visualmente (broto → planta → pronta pulsando), animais ANDANDO
  pelo cercado com bolhas de produto (🥚/🥛) flutuando quando prontas —
  clica na bolha para coletar; indicador de abate no animal maduro.
- **Cardume em tela larga (pedido do usuário em 2026-07-05)**: o canvas do
  Cardume é PAISAGEM (mais espaço nas laterais para navegar o cardume),
  adaptado a tablets e celulares (escala fluida, toque).
- **Animais da fazenda (pedido do usuário em 2026-07-05)**: além das
  plantações, um CURRAL com galinhas 🐔 (põem OVOS coletáveis em ciclo e
  rendem carne de galinha no abate), porcos 🐖 (engordam e rendem carne de
  porco no abate) e vacas 🐄 (dão LEITE coletável em ciclo e rendem carne
  de vaca no abate). Abate só após a maturidade — validada pelo relógio do
  SERVIDOR, como as colheitas. Produção continua offline.
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
  **Reforço do usuário (2026-07-05): TODOS os jogos devem ser compatíveis
  com celular e tablet** — arrastar o dedo move; ações extras (bomba, loop)
  viram botões na tela sobre o canvas.
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
