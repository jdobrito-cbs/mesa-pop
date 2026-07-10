# Avatares — Fases B, C e D (plano de execução contínua)

> Aprovado pelo usuário em 2026-07-10: "faça todos os planos sem parar e
> seguindo as recomendações como padrão. só pare quando finalizar
> completamente." As decisões abaixo são as recomendações adotadas.

**Meta:** fechar a visão completa do sistema de avatares: cor do peão no
Magnata (B), rankings gerais com banners e desbloqueio de avatares (C) e
economia de fichas com a máquina gumball (D).

## Global Constraints
- pt-BR na UI e comentários; servidor autoritativo; SVG procedural.
- Testes em série (`npx vitest run --no-file-parallelism`).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Fechar a entrega: suíte + demo Playwright + `npm run installer` +
  `npm run wsrta` + CLAUDE.md + push origin main.

## Decisões de design (recomendações adotadas)
1. **B — cor do peão**: 8 cores nomeadas em `shared/magnata.ts`
   (`MAGNATA_CORES`). Ação de jogo `{ tipo: 'cor', cor }` validada no
   servidor: só ANTES da primeira rolagem do jogador e cor não usada por
   outro. UI: paleta de bolinhas no painel do Magnata enquanto o jogador
   ainda não rolou (cores ocupadas desabilitadas). Bots ficam com a cor
   default do assento.
2. **C — rankings gerais**: `lib/rankingsGerais.ts` com cache de 60s.
   *Pontos* = SUM(`MatchPlayer.score`) por usuário (cobre solo e
   multiplayer sem dupla contagem; `Score` é só leaderboard por jogo).
   *Tempo* = SUM(`endedAt-startedAt`) de `Match` FINISHED que o usuário
   jogou. Convidados fora. Endpoint público `GET /api/rankings/gerais`
   (top 10 de cada + posição do usuário logado). **Desbloqueio
   posicional**: top 10 (qualquer um dos 2 rankings) pode equipar
   avatares ESPECIAIS; nº 1 (de qualquer um) pode equipar SUPER. Se cair
   de posição, o avatar equipado permanece (grandfather), mas não pode
   reequipar. Banners pop na "Minha mesa" com nome+posição (estilo da
   imagem de referência) + página `/rankings` com os dois top-10.
3. **D — fichas**: acúmulo = **1 ficha a cada 5 min ONLINE** (presença
   por socket, não-convidado): sweep de 60s no servidor soma segundos
   por usuário presente; a cada 300s acumulados → `fichas +1` no banco
   (contador em memória; reinício perde só a fração). **Troca**: `POST
   /api/fichas/trocar` valida `fichas >= 1000`, debita 1000 e sorteia um
   ESPECIAL ainda não possuído → grava em `AvatarOwned` (novo model
   userId+avatarId) e retorna o id. Avatar possuído é SEMPRE equipável
   (junta com a regra posicional da Fase C). UI: banner de fichas na
   Mesa ("🪙 X fichas · 1 a cada 5 min jogando") com botão **"Trocar por
   avatar"** → modal MÁQUINA GUMBALL (SVG procedural: globo de vidro com
   bolinhas coloridas): "Inserir fichas" despeja de 10 em 10 (animação
   automática acelerada até 1000; dá para parar), então "Retirar" solta
   a bolinha que cai e REVELA o avatar sorteado. "Meus avatares" passa a
   mostrar os especiais POSSUÍDOS como equipáveis. `UserPublic.fichas`
   para o banner.

## Tarefas
- [x] B1 (64c9537)
- [x] B2 (64c9537)
- [x] C1 (cb2df25)
- [x] C2 (cb2df25)
- [x] C3 (474d696)
- [x] D1 (bf04c95)
- [x] D2 (bf04c95)
- [x] D3 (38d377b)
- [x] Entrega: 297 testes + revisão APROVADA (fix 540498f) + demo + pacotes + push
