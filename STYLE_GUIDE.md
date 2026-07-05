# Mesa Pop — Guia de Estilo

Identidade: **colorida, amigável, arredondada e enérgica**. Entre um fliperama
moderno e um app casual alegre. Nunca corporativa ou sóbria.

## Paleta

Fundo violeta-noite (escuro suave) para as cores pop saltarem.

| Token | Hex | Uso |
|---|---|---|
| `ink-950` | `#140E26` | fundo mais profundo (hero, contrastes) |
| `ink-900` | `#1B1235` | fundo padrão da página |
| `ink-800` | `#251A47` | superfícies (cards, modais) |
| `ink-700` | `#32245F` | bordas, superfícies elevadas |
| `pop-purple` | `#9D5CFF` | **primária** — CTAs, links, marca |
| `pop-magenta` | `#F252C1` | par da primária em gradientes, destaques |
| `pop-cyan` | `#33E0D6` | **secundária** — foco, wordmark "pop", info |
| `pop-yellow` | `#FFC53D` | acento "pop!" — faísca, badges, estrelas |
| `pop-orange` | `#FF8244` | acento quente — energia, avisos amigáveis |
| `pop-green` | `#55E07F` | sucesso, fazenda, positivo |
| `cream` | `#FFF9F0` | superfícies claras (ficha do logo), texto sobre cor |
| `text` | `#F4EFFF` | texto principal |
| `text-muted` | `#B4A8D8` | texto secundário |

**Gradiente da marca**: `pop-purple → pop-magenta` (135°). Usado no ícone,
CTAs principais e destaques do hero.

## Tipografia

| Papel | Fonte | Uso |
|---|---|---|
| Display | **Baloo 2** (variável) | títulos, logo, botões — pesos 600–800 |
| Corpo | **Nunito** (variável) | texto corrido, formulários — pesos 400–700 |

Ambas arredondadas de propósito: a identidade é 100% "round".
Servidas localmente via `@fontsource-variable/*` (sem CDN — self-hosted).

## Raios e espaçamento

- Cards e modais: `--radius-card` = **24px**
- Campos de formulário: `--radius-field` = **16px**
- Botões: **pílula** (rounded-full)
- Espaçamento: escala padrão do Tailwind (4px base)

## Microinterações

- Botões: escala `1.05` no hover, `0.96` no clique (`.btn-pop`)
- Cards de jogo: elevação + leve rotação no hover
- Elementos do hero: flutuação suave (`--animate-float`, 6s)
- Foco visível: outline ciano 3px em tudo (`:focus-visible`)
- `prefers-reduced-motion` sempre respeitado

## Logo

- **Conceito**: wordmark "mesa pop" em Baloo 2; o "o" de "pop" é uma **ficha
  de jogo** (chip) com faísca amarela — o "pop!" da mesa.
- Arquivos em [branding/](branding/): `logo-horizontal.svg`, `logo-stacked.svg`,
  `logo-mono.svg` (monocromático, herda `currentColor`), `icon.svg`.
- Os SVGs de wordmark usam a fonte Baloo 2 via `font-family` — para renderizar
  fora do app, instale a fonte. Dentro do app use o componente `<Logo />`
  (renderização perfeita com a webfont carregada).
- "mesa" em `text` (quase branco), "pop" em `pop-cyan`, faísca em `pop-yellow`.

## Ícone / favicon / PWA

- Fonte única: `frontend/public/favicon.svg` (idêntico a `branding/icon.svg`).
- Quadrado arredondado com gradiente da marca + ficha cream + faísca amarela.
- PNGs 192/512 gerados com `npm run icons -w frontend`.
- Manifest: `frontend/public/manifest.webmanifest` (nome "Mesa Pop",
  tema `#1B1235`).

## Cores por jogo (cards do lobby)

Cada jogo tem uma cor do catálogo (`shared/src/games.ts`): use-a no fundo do
ícone e em detalhes do card, sobre superfície `ink-800`.

## Voz e escrita

- pt-BR informal e caloroso: "bora jogar?", "chama os amigos".
- Botões dizem o que fazem: "Criar conta", "Entrar na sala".
- Erros explicam e orientam, sem tom de culpa: "E-mail ou senha incorretos".
