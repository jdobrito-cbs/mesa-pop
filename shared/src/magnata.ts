/**
 * Magnata — jogo de tabuleiro de compra de imóveis (gênero "Monopoly", nome e
 * ruas próprios, tema Brasil). 2–6 jogadores + robô. Destaque do projeto: além
 * do dinheiro em caixa, cada jogador tem um CARTÃO DE CRÉDITO com LIMITE que
 * CRESCE com os recebimentos e DIMINUI com os pagamentos — uma linha de crédito
 * que banca os pagamentos quando o caixa zera.
 *
 * Regras aqui são puras (tabuleiro + cálculo de aluguel); o estado/turnos vivem
 * no servidor (backend/games/magnata.ts).
 */

export type MagnataGrupo =
  | 'marrom' | 'azulc' | 'rosa' | 'laranja' | 'vermelho' | 'amarelo' | 'verde' | 'azul'
  | 'estacao' | 'servico'

export type MagnataTipo =
  | 'inicio' | 'propriedade' | 'estacao' | 'servico' | 'sorte' | 'cofre' | 'imposto' | 'prisao' | 'vaprisao' | 'parada'

export interface MagnataCasa {
  i: number
  tipo: MagnataTipo
  nome: string
  grupo?: MagnataGrupo
  preco?: number
  imposto?: number
}

export const CORES_GRUPO: Record<MagnataGrupo, string> = {
  marrom: '#8a5a2b',
  azulc: '#7fd3ef',
  rosa: '#e75a9c',
  laranja: '#f08a24',
  vermelho: '#e03131',
  amarelo: '#f4d03f',
  verde: '#2f9e44',
  azul: '#1f6feb',
  estacao: '#5a6270',
  servico: '#9aa3af',
}

const P = (i: number, nome: string, grupo: MagnataGrupo, preco: number): MagnataCasa => ({ i, tipo: 'propriedade', nome, grupo, preco })

export const MAGNATA_CASAS: MagnataCasa[] = [
  { i: 0, tipo: 'inicio', nome: 'Início' },
  P(1, 'Rua da Praia', 'marrom', 60),
  { i: 2, tipo: 'cofre', nome: 'Cofre' },
  P(3, 'Ladeira da Misericórdia', 'marrom', 60),
  { i: 4, tipo: 'imposto', nome: 'Imposto de Renda', imposto: 200 },
  { i: 5, tipo: 'estacao', nome: 'Aeroporto de Guarulhos', grupo: 'estacao', preco: 200 },
  P(6, 'Rua XV de Novembro', 'azulc', 100),
  { i: 7, tipo: 'sorte', nome: 'Sorte' },
  P(8, 'Av. Sete de Setembro', 'azulc', 100),
  P(9, 'Rua das Flores', 'azulc', 120),
  { i: 10, tipo: 'prisao', nome: 'Prisão' },
  P(11, 'Av. Boa Viagem', 'rosa', 140),
  { i: 12, tipo: 'servico', nome: 'Companhia de Luz', grupo: 'servico', preco: 150 },
  P(13, 'Rua Oscar Freire', 'rosa', 140),
  P(14, 'Praia de Iracema', 'rosa', 160),
  { i: 15, tipo: 'estacao', nome: 'Aeroporto do Galeão', grupo: 'estacao', preco: 200 },
  P(16, 'Av. Atlântica', 'laranja', 180),
  { i: 17, tipo: 'cofre', nome: 'Cofre' },
  P(18, 'Rua 25 de Março', 'laranja', 180),
  P(19, 'Av. Afonso Pena', 'laranja', 200),
  { i: 20, tipo: 'parada', nome: 'Parada Livre' },
  P(21, 'Av. Beira-Mar', 'vermelho', 220),
  { i: 22, tipo: 'sorte', nome: 'Sorte' },
  P(23, 'Praia da Costa', 'vermelho', 220),
  P(24, 'Av. Goethe', 'vermelho', 240),
  { i: 25, tipo: 'estacao', nome: 'Aeroporto de Brasília', grupo: 'estacao', preco: 200 },
  P(26, 'Av. Brasil', 'amarelo', 260),
  P(27, 'Orla de Atalaia', 'amarelo', 260),
  { i: 28, tipo: 'servico', nome: 'Companhia de Água', grupo: 'servico', preco: 150 },
  P(29, 'Av. N. S. de Copacabana', 'amarelo', 280),
  { i: 30, tipo: 'vaprisao', nome: 'Vá para a Prisão' },
  P(31, 'Av. Faria Lima', 'verde', 300),
  P(32, 'Praia de Jericoacoara', 'verde', 300),
  { i: 33, tipo: 'cofre', nome: 'Cofre' },
  P(34, 'Av. das Nações', 'verde', 320),
  { i: 35, tipo: 'estacao', nome: 'Aeroporto de Confins', grupo: 'estacao', preco: 200 },
  { i: 36, tipo: 'sorte', nome: 'Sorte' },
  P(37, 'Av. Paulista', 'azul', 350),
  { i: 38, tipo: 'imposto', nome: 'Imposto de Luxo', imposto: 100 },
  P(39, 'Praia de Copacabana', 'azul', 400),
]

export const MAGNATA_INICIO_BONUS = 200
export const MAGNATA_FIANCA = 50
export const MAGNATA_DINHEIRO_INICIAL = 1500
export const MAGNATA_CARTAO_INICIAL = 500

/** custo de uma casa por grupo (grupos mais caros custam mais para construir) */
export const CUSTO_CASA: Record<string, number> = {
  marrom: 50, azulc: 50, rosa: 100, laranja: 100, vermelho: 150, amarelo: 150, verde: 200, azul: 200,
}

/** propriedades (índices) de cada grupo colorido — para monopólio/construção */
export function grupoDe(grupo: MagnataGrupo): number[] {
  return MAGNATA_CASAS.filter((c) => c.grupo === grupo && c.tipo === 'propriedade').map((c) => c.i)
}

/** aluguel de uma propriedade colorida dado o nº de casas (0..5; 5 = hotel) e se o dono tem o grupo todo */
export function aluguelPropriedade(preco: number, casas: number, monopolio: boolean): number {
  const base = Math.max(4, Math.round(preco * 0.09))
  if (casas <= 0) return monopolio ? base * 2 : base
  const mult = [0, 5, 14, 40, 55, 70][Math.min(casas, 5)]!
  return base * mult
}

/** aluguel de aeroporto pelo nº de aeroportos do mesmo dono */
export function aluguelEstacao(qtd: number): number {
  return [0, 25, 50, 100, 200][Math.min(qtd, 4)]!
}

/** aluguel de serviço: soma dos dados × multiplicador (4 com um, 10 com os dois) */
export function aluguelServico(dados: number, ambos: boolean): number {
  return dados * (ambos ? 10 : 4)
}

/** valor que o banco paga ao hipotecar uma propriedade (metade do preço) */
export function valorHipoteca(preco: number): number {
  return Math.round(preco / 2)
}

/** custo para resgatar uma hipoteca (valor + 10% de juros) */
export function custoResgate(preco: number): number {
  return Math.round(valorHipoteca(preco) * 1.1)
}

// —— tipos de estado/visão/ação (compartilhados com o cliente) ——

export interface MagnataJogador {
  seat: number
  nome: string
  cor: string
  pos: number
  dinheiro: number
  /** cartão de crédito: limite dinâmico e valor usado (dívida) */
  cartaoLimite: number
  cartaoUsado: number
  props: number[]
  /** casas por propriedade (índice → 0..5) */
  casas: Record<number, number>
  /** propriedades hipotecadas (não rendem aluguel até o resgate) */
  hipotecadas: number[]
  preso: boolean
  turnosPreso: number
  falido: boolean
  isBot?: boolean
}

export type MagnataFase = 'rolar' | 'comprar' | 'agir' | 'leilao' | 'fim'

/** leilão de uma propriedade recusada — todos os solventes disputam por lances */
export interface MagnataLeilao {
  casa: number
  lance: number
  lider: number | null
  /** assentos ainda na disputa */
  ativos: number[]
  /** de quem é a vez de dar lance ou desistir */
  vez: number
}

/** proposta de troca entre dois jogadores (props + dinheiro dos dois lados) */
export interface MagnataProposta {
  de: number
  para: number
  ofereceProps: number[]
  ofereceDinheiro: number
  pedeProps: number[]
  pedeDinheiro: number
}

export interface MagnataView {
  jogadores: MagnataJogador[]
  turno: number
  fase: MagnataFase
  dados: [number, number] | null
  /** contador de rolagens — o cliente anima os dados quando ele aumenta */
  rolagens: number
  donoDe: Array<number | null>
  log: string[]
  aviso: string | null
  /** índice da propriedade que o jogador da vez pode comprar agora (ou null) */
  compravel: number | null
  /** leilão em andamento (ou null) */
  leilao: MagnataLeilao | null
  /** proposta de troca pendente (ou null) */
  proposta: MagnataProposta | null
  winnerSeats: number[]
  vencedor: number | null
}

export type MagnataAction =
  | { type: 'rolar' }
  | { type: 'comprar' }
  | { type: 'passar' }
  | { type: 'construir'; casa: number }
  | { type: 'venderCasa'; casa: number }
  | { type: 'hipotecar'; casa: number }
  | { type: 'resgatar'; casa: number }
  | { type: 'fianca' }
  | { type: 'encerrar' }
  // leilão da propriedade recusada
  | { type: 'lance'; valor: number }
  | { type: 'desistir' }
  // negociação entre jogadores
  | { type: 'propor'; para: number; ofereceProps: number[]; ofereceDinheiro: number; pedeProps: number[]; pedeDinheiro: number }
  | { type: 'aceitarTroca' }
  | { type: 'recusarTroca' }
