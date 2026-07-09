import crypto from 'node:crypto'
import {
  aluguelEstacao,
  aluguelPropriedade,
  aluguelServico,
  custoResgate,
  CUSTO_CASA,
  grupoDe,
  MAGNATA_CARTAO_INICIAL,
  MAGNATA_CASAS,
  MAGNATA_DINHEIRO_INICIAL,
  MAGNATA_FIANCA,
  MAGNATA_INICIO_BONUS,
  valorHipoteca,
  type MagnataAction,
  type MagnataFase,
  type MagnataGrupo,
  type MagnataJogador,
  type MagnataLeilao,
  type MagnataProposta,
  type MagnataView,
} from '@mesapop/shared'
import type { GameModule } from './module'

/**
 * Magnata — lógica de estado e turnos (servidor autoritativo). O cartão de
 * crédito é a mecânica-assinatura: o LIMITE sobe com recebimentos e cai com
 * pagamentos; quando o caixa zera, o cartão banca o pagamento (vira dívida).
 */

const CORES = ['#ff3ea5', '#22d3ee', '#facc15', '#34d399', '#a855f7', '#fb923c']
const CARTAO_FATOR = 0.5
const CARTAO_PISO = 200
const MAX_TURNOS = 400 // trava de segurança: além disso, vence o mais rico

interface Carta {
  texto: string
  ef: (s: MagState, seat: number) => void
}

export interface MagState {
  jogadores: MagnataJogador[]
  turno: number
  fase: MagnataFase
  dados: [number, number] | null
  rolagens: number
  somaDados: number
  donoDe: Array<number | null>
  log: string[]
  aviso: string | null
  compravel: number | null
  leilao: MagnataLeilao | null
  proposta: MagnataProposta | null
  doubles: number
  sorte: number[]
  cofre: number[]
  sIdx: number
  cIdx: number
  turnos: number
  winnerSeats: number[]
  vencedor: number | null
  finished: boolean
}

const rolaDado = () => crypto.randomInt(1, 7)
const embaralha = (n: number) => {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function logar(s: MagState, msg: string) {
  s.aviso = msg
  s.log.unshift(msg)
  if (s.log.length > 40) s.log.length = 40
}

function nome(s: MagState, seat: number) {
  return s.jogadores[seat]!.nome
}

// —— dinheiro + cartão de crédito ——

export function receber(j: MagnataJogador, valor: number) {
  if (valor <= 0) return
  j.dinheiro += valor
  j.cartaoLimite += Math.round(valor * CARTAO_FATOR) // recebimento AUMENTA o limite
  if (j.cartaoUsado > 0) {
    const quita = Math.min(j.cartaoUsado, j.dinheiro)
    j.cartaoUsado -= quita
    j.dinheiro -= quita
  }
}

function podePagar(j: MagnataJogador, valor: number) {
  return j.dinheiro + (j.cartaoLimite - j.cartaoUsado) >= valor
}

/** paga `valor` (para o banco se paraSeat=null, senão para o dono). false = faliu */
export function pagar(s: MagState, seat: number, valor: number, paraSeat: number | null): boolean {
  const j = s.jogadores[seat]!
  if (valor <= 0) return true
  if (!podePagar(j, valor)) {
    falir(s, seat, paraSeat)
    return false
  }
  let resto = valor
  const doCaixa = Math.min(j.dinheiro, resto)
  j.dinheiro -= doCaixa
  resto -= doCaixa
  if (resto > 0) j.cartaoUsado += resto // o cartão banca o que faltou
  j.cartaoLimite = Math.max(CARTAO_PISO, j.cartaoLimite - Math.round(valor * CARTAO_FATOR)) // pagamento DIMINUI o limite
  if (paraSeat !== null) receber(s.jogadores[paraSeat]!, valor)
  return true
}

function falir(s: MagState, seat: number, credor: number | null) {
  const j = s.jogadores[seat]!
  j.falido = true
  logar(s, `💥 ${j.nome} faliu!`)
  // imóveis voltam ao banco (ou ao credor, se houver) — hipotecas acompanham
  for (const p of j.props) {
    s.donoDe[p] = credor
    if (credor !== null) {
      s.jogadores[credor]!.props.push(p)
      if (j.hipotecadas.includes(p)) s.jogadores[credor]!.hipotecadas.push(p)
    }
  }
  j.props = []
  j.casas = {}
  j.hipotecadas = []
  j.dinheiro = 0
  j.cartaoUsado = 0
  // um leilão/proposta que envolva o falido morre junto
  if (s.leilao && (s.leilao.lider === seat || s.leilao.ativos.includes(seat))) {
    s.leilao.ativos = s.leilao.ativos.filter((x) => x !== seat)
  }
  if (s.proposta && (s.proposta.de === seat || s.proposta.para === seat)) s.proposta = null
  verificaFim(s)
}

// —— tabuleiro / grupos ——

function donoTemGrupo(s: MagState, seat: number, grupo: MagnataGrupo): boolean {
  return grupoDe(grupo).every((i) => s.donoDe[i] === seat)
}
function qtdTipoDoDono(s: MagState, dono: number, tipo: 'estacao' | 'servico'): number {
  // uma propriedade hipotecada não conta para o aluguel
  const hip = s.jogadores[dono]!.hipotecadas
  return MAGNATA_CASAS.filter((c) => c.tipo === tipo && s.donoDe[c.i] === dono && !hip.includes(c.i)).length
}

// —— cartas ——

const SORTE: Carta[] = [
  { texto: 'Adiantamento salarial! Receba 150.', ef: (s, seat) => receber(s.jogadores[seat]!, 150) },
  { texto: 'Multa por excesso de velocidade: pague 100.', ef: (s, seat) => void pagar(s, seat, 100, null) },
  { texto: 'Vá para o Início e receba o bônus.', ef: (s, seat) => irPara(s, seat, 0, true) },
  { texto: 'Você foi preso! Vá para a Prisão.', ef: (s, seat) => irPreso(s, seat) },
  { texto: 'Dividendos de ações: receba 100.', ef: (s, seat) => receber(s.jogadores[seat]!, 100) },
  { texto: 'Reforma dos imóveis: pague 120.', ef: (s, seat) => void pagar(s, seat, 120, null) },
  { texto: 'Avance 3 casas.', ef: (s, seat) => andar(s, seat, 3) },
  { texto: 'Prêmio de loteria: receba 200.', ef: (s, seat) => receber(s.jogadores[seat]!, 200) },
]
const COFRE: Carta[] = [
  { texto: 'Herança: receba 200.', ef: (s, seat) => receber(s.jogadores[seat]!, 200) },
  { texto: 'Erro do banco a seu favor: receba 150.', ef: (s, seat) => receber(s.jogadores[seat]!, 150) },
  { texto: 'Conta de hospital: pague 100.', ef: (s, seat) => void pagar(s, seat, 100, null) },
  { texto: 'Restituição de imposto: receba 75.', ef: (s, seat) => receber(s.jogadores[seat]!, 75) },
  { texto: 'Você foi preso! Vá para a Prisão.', ef: (s, seat) => irPreso(s, seat) },
  {
    texto: 'É seu aniversário: cada jogador te dá 20.',
    ef: (s, seat) => {
      for (const o of s.jogadores) {
        if (o.seat !== seat && !o.falido) {
          if (pagar(s, o.seat, 20, seat)) void 0
        }
      }
    },
  },
  { texto: 'Conserto de rua: pague 90.', ef: (s, seat) => void pagar(s, seat, 90, null) },
  { texto: 'Venda de ações: receba 120.', ef: (s, seat) => receber(s.jogadores[seat]!, 120) },
]

function puxaSorte(s: MagState, seat: number) {
  const carta = SORTE[s.sorte[s.sIdx % s.sorte.length]!]!
  s.sIdx++
  logar(s, `🎲 ${nome(s, seat)} — Sorte: ${carta.texto}`)
  carta.ef(s, seat)
}
function puxaCofre(s: MagState, seat: number) {
  const carta = COFRE[s.cofre[s.cIdx % s.cofre.length]!]!
  s.cIdx++
  logar(s, `📦 ${nome(s, seat)} — Cofre: ${carta.texto}`)
  carta.ef(s, seat)
}

// —— movimento e resolução ——

function irPreso(s: MagState, seat: number) {
  const j = s.jogadores[seat]!
  j.pos = 10
  j.preso = true
  j.turnosPreso = 0
  logar(s, `🚓 ${j.nome} foi para a Prisão!`)
}

function andar(s: MagState, seat: number, casas: number) {
  const j = s.jogadores[seat]!
  const nova = (j.pos + casas) % 40
  if (j.pos + casas >= 40) receber(j, MAGNATA_INICIO_BONUS)
  j.pos = nova
  resolveCasa(s, seat)
}

function irPara(s: MagState, seat: number, destino: number, ganhaBonus: boolean) {
  const j = s.jogadores[seat]!
  if (ganhaBonus && destino <= j.pos) receber(j, MAGNATA_INICIO_BONUS)
  j.pos = destino
  resolveCasa(s, seat)
}

function resolveCasa(s: MagState, seat: number) {
  const j = s.jogadores[seat]!
  const casa = MAGNATA_CASAS[j.pos]!
  s.compravel = null
  if (casa.tipo === 'propriedade' || casa.tipo === 'estacao' || casa.tipo === 'servico') {
    const dono = s.donoDe[j.pos]
    if (dono === null || dono === undefined) {
      s.compravel = j.pos
    } else if (dono !== seat && !s.jogadores[dono]!.falido && s.jogadores[dono]!.hipotecadas.includes(j.pos)) {
      // propriedade hipotecada não rende aluguel
      logar(s, `🏚️ ${casa.nome} está hipotecada — ${j.nome} não paga aluguel.`)
    } else if (dono !== seat && !s.jogadores[dono]!.falido) {
      let aluguel = 0
      if (casa.tipo === 'propriedade') {
        aluguel = aluguelPropriedade(casa.preco!, s.jogadores[dono]!.casas[j.pos] ?? 0, donoTemGrupo(s, dono, casa.grupo!))
      } else if (casa.tipo === 'estacao') {
        aluguel = aluguelEstacao(qtdTipoDoDono(s, dono, 'estacao'))
      } else {
        aluguel = aluguelServico(s.somaDados, qtdTipoDoDono(s, dono, 'servico') >= 2)
      }
      logar(s, `💸 ${j.nome} pagou ${aluguel} de aluguel a ${nome(s, dono)} (${casa.nome}).`)
      pagar(s, seat, aluguel, dono)
    }
  } else if (casa.tipo === 'sorte') {
    puxaSorte(s, seat)
  } else if (casa.tipo === 'cofre') {
    puxaCofre(s, seat)
  } else if (casa.tipo === 'imposto') {
    logar(s, `🏛️ ${j.nome} pagou ${casa.imposto} de ${casa.nome}.`)
    pagar(s, seat, casa.imposto!, null)
  } else if (casa.tipo === 'vaprisao') {
    irPreso(s, seat)
  }
}

function verificaFim(s: MagState) {
  const vivos = s.jogadores.filter((j) => !j.falido)
  if (vivos.length <= 1) {
    s.finished = true
    s.vencedor = vivos[0]?.seat ?? null
    s.winnerSeats = s.vencedor !== null ? [s.vencedor] : []
  }
}

function patrimonio(s: MagState, j: MagnataJogador): number {
  let v = j.dinheiro - j.cartaoUsado
  for (const p of j.props) {
    const c = MAGNATA_CASAS[p]!
    // hipotecada vale só o valor de resgate (metade); senão, preço cheio + casas
    v += j.hipotecadas.includes(p) ? valorHipoteca(c.preco ?? 0) : c.preco ?? 0
    v += (j.casas[p] ?? 0) * (CUSTO_CASA[c.grupo ?? ''] ?? 100)
  }
  return v
}

function proximo(s: MagState) {
  let t = s.turno
  for (let i = 0; i < s.jogadores.length; i++) {
    t = (t + 1) % s.jogadores.length
    if (!s.jogadores[t]!.falido) break
  }
  s.turno = t
  s.turnos++
  s.doubles = 0
  s.fase = 'rolar'
  if (s.turnos > MAX_TURNOS && !s.finished) {
    s.finished = true
    const vivos = s.jogadores.filter((j) => !j.falido)
    const rico = vivos.slice().sort((a, b) => patrimonio(s, b) - patrimonio(s, a))[0]
    s.vencedor = rico?.seat ?? null
    s.winnerSeats = s.vencedor !== null ? [s.vencedor] : []
  }
}

// —— init ——

export function initialMagnataState(playerCount: number): MagState {
  const jogadores: MagnataJogador[] = Array.from({ length: playerCount }, (_, seat) => ({
    seat,
    nome: `Jogador ${seat + 1}`,
    cor: CORES[seat % CORES.length]!,
    pos: 0,
    dinheiro: MAGNATA_DINHEIRO_INICIAL,
    cartaoLimite: MAGNATA_CARTAO_INICIAL,
    cartaoUsado: 0,
    props: [],
    casas: {},
    hipotecadas: [],
    preso: false,
    turnosPreso: 0,
    falido: false,
  }))
  return {
    jogadores,
    turno: 0,
    fase: 'rolar',
    dados: null,
    rolagens: 0,
    somaDados: 0,
    donoDe: Array(40).fill(null),
    log: ['🏙️ A cidade está à venda — boa sorte, magnatas!'],
    aviso: null,
    compravel: null,
    leilao: null,
    proposta: null,
    doubles: 0,
    sorte: embaralha(SORTE.length),
    cofre: embaralha(COFRE.length),
    sIdx: 0,
    cIdx: 0,
    turnos: 0,
    winnerSeats: [],
    vencedor: null,
    finished: false,
  }
}

// —— leilão + negociação ——

function grupoTemCasa(s: MagState, seat: number, grupo: MagnataGrupo): boolean {
  const casas = s.jogadores[seat]!.casas
  return grupoDe(grupo).some((i) => (casas[i] ?? 0) > 0)
}
function grupoTemHipoteca(s: MagState, seat: number, grupo: MagnataGrupo): boolean {
  const hip = s.jogadores[seat]!.hipotecadas
  return grupoDe(grupo).some((i) => hip.includes(i))
}

/** próximo assento ATIVO no leilão que não seja o líder (senão o líder arremata) */
function proxLance(s: MagState): void {
  const l = s.leilao!
  for (let k = 1; k <= s.jogadores.length; k++) {
    const cand = (l.vez + k) % s.jogadores.length
    if (l.ativos.includes(cand) && cand !== l.lider) {
      l.vez = cand
      return
    }
  }
}

function iniciaLeilao(s: MagState, casa: number): void {
  const ativos = s.jogadores.filter((j) => !j.falido).map((j) => j.seat)
  s.compravel = null
  if (ativos.length < 2) {
    s.fase = 'agir'
    logar(s, `🔨 ${MAGNATA_CASAS[casa]!.nome} ficou sem comprador.`)
    return
  }
  s.leilao = { casa, lance: 0, lider: null, ativos, vez: s.turno }
  s.fase = 'leilao'
  proxLance(s) // começa por quem está depois do jogador da vez
  logar(s, `🔨 Leilão de ${MAGNATA_CASAS[casa]!.nome}! Deem seus lances.`)
}

function encerraLeilao(s: MagState): void {
  const l = s.leilao!
  const casa = MAGNATA_CASAS[l.casa]!
  if (l.lider !== null && l.lance > 0) {
    const dono = s.jogadores[l.lider]!
    pagar(s, l.lider, l.lance, null)
    s.donoDe[l.casa] = l.lider
    dono.props.push(l.casa)
    logar(s, `🔨 ${dono.nome} arrematou ${casa.nome} por ${l.lance}!`)
  } else {
    logar(s, `🔨 Ninguém quis ${casa.nome} — segue com o banco.`)
  }
  s.leilao = null
  s.fase = 'agir'
}

/** após um lance/desistência: se só sobrou o líder, arremata; senão passa a vez */
function avancaLeilao(s: MagState): void {
  const l = s.leilao!
  const outros = l.ativos.filter((x) => x !== l.lider)
  if (outros.length === 0) {
    encerraLeilao(s)
    return
  }
  proxLance(s)
}

function transfereProp(s: MagState, i: number, de: number, para: number): void {
  s.donoDe[i] = para
  const dj = s.jogadores[de]!
  const pj = s.jogadores[para]!
  dj.props = dj.props.filter((x) => x !== i)
  if (!pj.props.includes(i)) pj.props.push(i)
  if (dj.hipotecadas.includes(i)) {
    dj.hipotecadas = dj.hipotecadas.filter((x) => x !== i)
    if (!pj.hipotecadas.includes(i)) pj.hipotecadas.push(i)
  }
}

function executaTroca(s: MagState): boolean {
  const p = s.proposta!
  const de = s.jogadores[p.de]!
  const para = s.jogadores[p.para]!
  const okDe = p.ofereceProps.every((i) => s.donoDe[i] === p.de && (de.casas[i] ?? 0) === 0)
  const okPara = p.pedeProps.every((i) => s.donoDe[i] === p.para && (para.casas[i] ?? 0) === 0)
  if (!okDe || !okPara) return false
  if (!podePagar(de, p.ofereceDinheiro) || !podePagar(para, p.pedeDinheiro)) return false
  if (p.ofereceDinheiro > 0) pagar(s, p.de, p.ofereceDinheiro, p.para)
  if (p.pedeDinheiro > 0) pagar(s, p.para, p.pedeDinheiro, p.de)
  for (const i of p.ofereceProps) transfereProp(s, i, p.de, p.para)
  for (const i of p.pedeProps) transfereProp(s, i, p.para, p.de)
  logar(s, `🤝 Troca fechada entre ${de.nome} e ${para.nome}.`)
  return true
}

// —— ações ——

function aplica(s: MagState, seat: number, a: MagnataAction): { error: string } | { state: MagState } {
  if (s.finished) return { error: 'A partida já terminou' }
  const j = s.jogadores[seat]!
  if (j.falido) return { error: 'Você está fora do jogo' }

  // —— ações FORA do turno: lances de leilão e resposta de troca ——
  if (a.type === 'lance' || a.type === 'desistir') {
    if (!s.leilao) return { error: 'Nenhum leilão em andamento' }
    if (s.leilao.vez !== seat) return { error: 'Não é a sua vez de dar lance' }
    if (a.type === 'lance') {
      const valor = Math.floor(a.valor)
      if (!Number.isFinite(valor) || valor <= s.leilao.lance) return { error: 'O lance precisa superar o atual' }
      if (!podePagar(j, valor)) return { error: 'Você não pode cobrir esse lance' }
      s.leilao.lance = valor
      s.leilao.lider = seat
      logar(s, `🔨 ${j.nome} deu lance de ${valor} em ${MAGNATA_CASAS[s.leilao.casa]!.nome}.`)
    } else {
      logar(s, `🔨 ${j.nome} saiu do leilão.`)
      s.leilao.ativos = s.leilao.ativos.filter((x) => x !== seat)
    }
    avancaLeilao(s)
    return { state: s }
  }

  if (a.type === 'aceitarTroca' || a.type === 'recusarTroca') {
    if (!s.proposta) return { error: 'Nenhuma proposta pendente' }
    if (a.type === 'recusarTroca') {
      if (seat !== s.proposta.de && seat !== s.proposta.para) return { error: 'Essa proposta não é sua' }
      logar(s, `🚫 Troca entre ${nome(s, s.proposta.de)} e ${nome(s, s.proposta.para)} recusada.`)
      s.proposta = null
      return { state: s }
    }
    if (seat !== s.proposta.para) return { error: 'Só quem recebeu a proposta pode aceitar' }
    if (!executaTroca(s)) {
      s.proposta = null
      return { error: 'Troca ficou inviável (posse ou dinheiro mudou)' }
    }
    s.proposta = null
    return { state: s }
  }

  // —— demais ações exigem ser o jogador da vez ——
  if (s.turno !== seat) return { error: 'Não é a sua vez' }
  if (s.leilao) return { error: 'Aguarde o fim do leilão' }
  if (s.proposta) return { error: 'Aguarde a resposta da sua proposta' }

  if (a.type === 'rolar') {
    if (s.fase !== 'rolar') return { error: 'Você já rolou os dados' }
    const d1 = rolaDado()
    const d2 = rolaDado()
    s.dados = [d1, d2]
    s.somaDados = d1 + d2
    s.rolagens++
    const dobra = d1 === d2

    if (j.preso) {
      if (dobra) {
        j.preso = false
        logar(s, `🔓 ${j.nome} tirou dupla e saiu da prisão!`)
        andar(s, seat, d1 + d2)
      } else {
        j.turnosPreso++
        if (j.turnosPreso >= 3) {
          logar(s, `${j.nome} pagou a fiança e saiu.`)
          if (pagar(s, seat, MAGNATA_FIANCA, null)) andar(s, seat, d1 + d2)
        } else {
          logar(s, `${j.nome} tentou dupla na prisão e não conseguiu.`)
          s.fase = 'fim'
          return { state: s }
        }
      }
    } else {
      if (dobra) {
        s.doubles++
        if (s.doubles >= 3) {
          logar(s, `${j.nome} tirou 3 duplas seguidas — vai preso!`)
          irPreso(s, seat)
          s.fase = 'fim'
          return { state: s }
        }
      }
      logar(s, `🎲 ${j.nome} tirou ${d1}+${d2}.`)
      andar(s, seat, d1 + d2)
    }
    s.fase = s.compravel !== null ? 'comprar' : 'agir'
    return { state: s }
  }

  if (a.type === 'comprar') {
    if (s.fase !== 'comprar' || s.compravel === null) return { error: 'Nada para comprar agora' }
    const casa = MAGNATA_CASAS[s.compravel]!
    const preco = casa.preco!
    if (!podePagar(j, preco)) return { error: 'Dinheiro/crédito insuficiente' }
    pagar(s, seat, preco, null)
    s.donoDe[s.compravel] = seat
    j.props.push(s.compravel)
    logar(s, `🏠 ${j.nome} comprou ${casa.nome} por ${preco}.`)
    s.compravel = null
    s.fase = 'agir'
    return { state: s }
  }

  if (a.type === 'passar') {
    if (s.fase !== 'comprar' || s.compravel === null) return { error: 'Nada para recusar' }
    // recusou a compra → a propriedade vai a LEILÃO entre os solventes
    iniciaLeilao(s, s.compravel)
    return { state: s }
  }

  if (a.type === 'construir') {
    if (s.fase !== 'agir' && s.fase !== 'comprar') return { error: 'Não dá para construir agora' }
    const casa = MAGNATA_CASAS[a.casa]
    if (!casa || casa.tipo !== 'propriedade' || s.donoDe[a.casa] !== seat) return { error: 'Imóvel inválido' }
    if (!donoTemGrupo(s, seat, casa.grupo!)) return { error: 'Você precisa do grupo completo' }
    if (grupoTemHipoteca(s, seat, casa.grupo!)) return { error: 'Resgate a hipoteca do grupo antes de construir' }
    const nivel = j.casas[a.casa] ?? 0
    if (nivel >= 5) return { error: 'Já tem hotel' }
    const custo = CUSTO_CASA[casa.grupo!] ?? 100
    if (!podePagar(j, custo)) return { error: 'Sem dinheiro para construir' }
    pagar(s, seat, custo, null)
    j.casas[a.casa] = nivel + 1
    logar(s, `🏗️ ${j.nome} construiu em ${casa.nome} (${nivel + 1 === 5 ? 'hotel' : nivel + 1 + ' casa(s)'}).`)
    return { state: s }
  }

  if (a.type === 'venderCasa') {
    if (s.fase === 'fim' || s.fase === 'leilao') return { error: 'Não dá para vender casas agora' }
    const casa = MAGNATA_CASAS[a.casa]
    if (!casa || casa.tipo !== 'propriedade' || s.donoDe[a.casa] !== seat) return { error: 'Imóvel inválido' }
    const nivel = j.casas[a.casa] ?? 0
    if (nivel <= 0) return { error: 'Não há casas para vender' }
    const reembolso = Math.round((CUSTO_CASA[casa.grupo!] ?? 100) / 2)
    j.casas[a.casa] = nivel - 1
    receber(j, reembolso)
    logar(s, `🏚️ ${j.nome} vendeu uma casa de ${casa.nome} por ${reembolso}.`)
    return { state: s }
  }

  if (a.type === 'hipotecar') {
    if (s.fase === 'fim' || s.fase === 'leilao') return { error: 'Não dá para hipotecar agora' }
    const casa = MAGNATA_CASAS[a.casa]
    if (!casa || s.donoDe[a.casa] !== seat || casa.preco === undefined) return { error: 'Imóvel inválido' }
    if (j.hipotecadas.includes(a.casa)) return { error: 'Já está hipotecada' }
    if ((j.casas[a.casa] ?? 0) > 0) return { error: 'Venda as casas antes de hipotecar' }
    if (casa.tipo === 'propriedade' && grupoTemCasa(s, seat, casa.grupo!)) {
      return { error: 'Venda as casas do grupo antes de hipotecar' }
    }
    const valor = valorHipoteca(casa.preco)
    j.hipotecadas.push(a.casa)
    receber(j, valor)
    logar(s, `🏦 ${j.nome} hipotecou ${casa.nome} e recebeu ${valor}.`)
    return { state: s }
  }

  if (a.type === 'resgatar') {
    if (s.fase === 'fim' || s.fase === 'leilao') return { error: 'Não dá para resgatar agora' }
    const casa = MAGNATA_CASAS[a.casa]
    if (!casa || s.donoDe[a.casa] !== seat || casa.preco === undefined) return { error: 'Imóvel inválido' }
    if (!j.hipotecadas.includes(a.casa)) return { error: 'Essa não está hipotecada' }
    const custo = custoResgate(casa.preco)
    if (!podePagar(j, custo)) return { error: 'Sem dinheiro para resgatar' }
    pagar(s, seat, custo, null)
    j.hipotecadas = j.hipotecadas.filter((x) => x !== a.casa)
    logar(s, `🏦 ${j.nome} resgatou ${casa.nome} por ${custo}.`)
    return { state: s }
  }

  if (a.type === 'propor') {
    if (s.fase !== 'agir' && s.fase !== 'comprar') return { error: 'Proponha na sua vez de agir' }
    const alvo = a.para
    if (!Number.isInteger(alvo) || alvo < 0 || alvo >= s.jogadores.length || alvo === seat) return { error: 'Alvo inválido' }
    if (s.jogadores[alvo]!.falido) return { error: 'Esse jogador está fora do jogo' }
    const ofP = [...new Set(a.ofereceProps ?? [])]
    const peP = [...new Set(a.pedeProps ?? [])]
    const ofD = Math.max(0, Math.floor(a.ofereceDinheiro ?? 0))
    const peD = Math.max(0, Math.floor(a.pedeDinheiro ?? 0))
    if (!ofP.every((i) => s.donoDe[i] === seat && (j.casas[i] ?? 0) === 0)) {
      return { error: 'Você só cede imóveis seus e sem casas' }
    }
    if (!peP.every((i) => s.donoDe[i] === alvo && (s.jogadores[alvo]!.casas[i] ?? 0) === 0)) {
      return { error: 'O alvo precisa ter esses imóveis, sem casas' }
    }
    if (ofP.length + peP.length + (ofD > 0 ? 1 : 0) + (peD > 0 ? 1 : 0) === 0) return { error: 'Proposta vazia' }
    if (!podePagar(j, ofD)) return { error: 'Você não tem esse dinheiro para oferecer' }
    s.proposta = { de: seat, para: alvo, ofereceProps: ofP, ofereceDinheiro: ofD, pedeProps: peP, pedeDinheiro: peD }
    logar(s, `🤝 ${j.nome} propôs uma troca a ${nome(s, alvo)}.`)
    return { state: s }
  }

  if (a.type === 'fianca') {
    if (!j.preso) return { error: 'Você não está preso' }
    if (!podePagar(j, MAGNATA_FIANCA)) return { error: 'Sem dinheiro para a fiança' }
    pagar(s, seat, MAGNATA_FIANCA, null)
    j.preso = false
    logar(s, `${j.nome} pagou fiança e está livre.`)
    s.fase = 'rolar'
    return { state: s }
  }

  if (a.type === 'encerrar') {
    if (s.fase === 'rolar') return { error: 'Role os dados primeiro' }
    // dupla (e não foi preso) → joga de novo
    const foiDupla = s.dados && s.dados[0] === s.dados[1] && !j.preso && s.fase !== 'fim'
    if (foiDupla && s.doubles > 0 && s.doubles < 3) {
      s.fase = 'rolar'
      s.compravel = null
      return { state: s }
    }
    proximo(s)
    return { state: s }
  }

  return { error: 'Ação inválida' }
}

// —— bot ——

/** valor de mercado de uma lista de imóveis (metade se hipotecado) */
function valorProps(s: MagState, ids: number[]): number {
  let v = 0
  for (const i of ids) {
    const c = MAGNATA_CASAS[i]!
    const dono = s.donoDe[i]
    const hip = dono !== null && dono !== undefined && s.jogadores[dono]!.hipotecadas.includes(i)
    v += hip ? valorHipoteca(c.preco ?? 0) : c.preco ?? 0
  }
  return v
}

function botAction(s: MagState, seat: number): MagnataAction | null {
  if (s.finished) return null
  const j = s.jogadores[seat]!
  if (j.falido) return null

  // leilão: sobe até ~60% do preço, só com dinheiro em caixa
  if (s.leilao && s.leilao.vez === seat) {
    const preco = MAGNATA_CASAS[s.leilao.casa]!.preco!
    const teto = Math.round(preco * 0.6)
    const inc = Math.max(10, Math.round(preco * 0.1))
    const prox = s.leilao.lance + inc
    return prox <= teto && j.dinheiro >= prox ? { type: 'lance', valor: prox } : { type: 'desistir' }
  }

  // resposta de troca: aceita só se ganhar valor e puder pagar o que foi pedido
  if (s.proposta && s.proposta.para === seat) {
    const p = s.proposta
    const ganha = valorProps(s, p.ofereceProps) + p.ofereceDinheiro
    const perde = valorProps(s, p.pedeProps) + p.pedeDinheiro
    return ganha >= perde && j.dinheiro >= p.pedeDinheiro ? { type: 'aceitarTroca' } : { type: 'recusarTroca' }
  }

  // fora disso, o robô só age no próprio turno (e sem leilão/proposta pendente)
  if (s.turno !== seat || s.leilao || s.proposta) return null

  if (s.fase === 'rolar') {
    if (j.preso && j.turnosPreso >= 1 && podePagar(j, MAGNATA_FIANCA) && j.dinheiro > 300) {
      return { type: 'fianca' }
    }
    return { type: 'rolar' }
  }
  if (s.fase === 'comprar' && s.compravel !== null) {
    const preco = MAGNATA_CASAS[s.compravel]!.preco!
    // compra se sobrar um bom colchão de caixa
    return j.dinheiro >= preco + 120 ? { type: 'comprar' } : { type: 'passar' }
  }
  if (s.fase === 'agir') {
    // constrói 1 casa se tiver monopólio e caixa folgado
    if (j.dinheiro > 350) {
      for (const grupo of ['azul', 'verde', 'amarelo', 'vermelho', 'laranja', 'rosa', 'azulc', 'marrom'] as MagnataGrupo[]) {
        if (donoTemGrupo(s, seat, grupo)) {
          const alvo = grupoDe(grupo).find((i) => (j.casas[i] ?? 0) < 5)
          if (alvo !== undefined && podePagar(j, CUSTO_CASA[grupo] ?? 100) && Math.random() < 0.7) {
            return { type: 'construir', casa: alvo }
          }
        }
      }
    }
    return { type: 'encerrar' }
  }
  if (s.fase === 'fim') return { type: 'encerrar' }
  return { type: 'encerrar' }
}

// —— view ——

function view(s: MagState): MagnataView {
  return {
    jogadores: s.jogadores,
    turno: s.turno,
    fase: s.fase,
    dados: s.dados,
    rolagens: s.rolagens,
    donoDe: s.donoDe,
    log: s.log,
    aviso: s.aviso,
    compravel: s.compravel,
    leilao: s.leilao,
    proposta: s.proposta,
    winnerSeats: s.winnerSeats,
    vencedor: s.vencedor,
  }
}

export const magnataModule: GameModule<MagState, MagnataAction> = {
  slug: 'magnata',
  minPlayers: 2,
  maxPlayers: 6,

  init(playerCount) {
    return initialMagnataState(playerCount)
  },

  play(state, seat, action) {
    if (!action || typeof (action as { type?: unknown }).type !== 'string') return { error: 'Ação inválida' }
    return aplica(state, seat, action)
  },

  getStateFor(state) {
    return view(state)
  },

  currentSeat(state) {
    if (state.finished) return null
    // durante um leilão, quem age é o próximo a dar lance; durante uma
    // proposta, quem age é o alvo (precisa aceitar/recusar); senão, o turno
    if (state.leilao) return state.leilao.vez
    if (state.proposta) return state.proposta.para
    return state.turno
  },

  bot(state, seat) {
    return botAction(state, seat)
  },

  scoresFor(state) {
    return state.jogadores.map((j) => patrimonio(state, j))
  },

  result(state) {
    return {
      finished: state.finished,
      winnerSeats: state.winnerSeats,
      draw: false,
    }
  },
}
