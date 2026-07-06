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
  lotes: 1) Memória+Pife ✅; 2) Sudoku+Caça-palavras ✅; 3) Forca+Bingo;
  4) Quiz Pop+Quiz Nostalgia (uma engine, dois jogos); 5) Cruzadinha.
  Lote 6 opcional sugerido: Modo Conforto 60+ (fontes grandes, alto
  contraste, timers relaxados). Roadmap original 0–8 ✅ completo
  (23 jogos); FASE 9 leva a 32. **27 jogos jogáveis.**
- **Última atualização**: 2026-07-05
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
- **Próximo passo**: FASE 9 · lote 3 (Forca multiplayer + Bingo) —
  mediante OK do usuário. Depois: lote 4 Quiz Pop+Nostalgia, lote 5
  Cruzadinha, lote 6 opcional Modo Conforto 60+.
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
