/**
 * Palavras-alvo de 5 letras (pt-BR, sem acentos) para a Palavra do Dia e
 * o Duelo de Palavras. A palavra do dia é determinística pela data; a do
 * duelo é sorteada. Palpites aceitam QUALQUER sequência de 5 letras
 * (dicionário completo de aceitas é melhoria futura).
 */
export const PALAVRAS_5: string[] = [
  'abril', 'aceno', 'achar', 'acido', 'adubo', 'afeto', 'agora', 'aguia', 'ainda', 'alface',
  'algum', 'alho', 'almoco', 'altar', 'amigo', 'amora', 'andar', 'anexo', 'anjos', 'antes',
  'apito', 'apoio', 'aroma', 'arroz', 'artes', 'assar', 'astro', 'ate', 'atlas', 'atriz',
  'aviao', 'avisa', 'bairo', 'baixo', 'balde', 'banco', 'banho', 'barco', 'barro', 'batom',
  'beijo', 'beira', 'bexiga', 'bicho', 'bolsa', 'bombom', 'bonde', 'borda', 'bosque', 'brasa',
  'bravo', 'brisa', 'bruxa', 'bucho', 'cabelo', 'cacau', 'cacho', 'caixa', 'calor', 'campo',
  'canoa', 'canto', 'capim', 'carne', 'carta', 'casal', 'causa', 'cedro', 'cerca', 'chave',
  'chefe', 'cheio', 'chuva', 'cinto', 'circo', 'clima', 'cobra', 'coisa', 'colar', 'comum',
  'conta', 'copos', 'coral', 'coroa', 'corpo', 'costa', 'couro', 'credo', 'crime', 'cubos',
  'curva', 'dados', 'dedos', 'deusa', 'dever', 'dieta', 'disco', 'dobro', 'doce', 'dorso',
  'drama', 'dueto', 'dunas', 'elmo', 'enfim', 'entao', 'ervas', 'escoa', 'etapa', 'exame',
  'facas', 'faixa', 'falar', 'farol', 'fatia', 'fauna', 'febre', 'feira', 'ferro', 'festa',
  'ficha', 'firme', 'fivela', 'flauta', 'flora', 'fogao', 'folha', 'fonte', 'força', 'forma',
  'forno', 'forte', 'fosco', 'frase', 'freio', 'fresta', 'frota', 'fruta', 'fumo', 'fundo',
  'gaita', 'galho', 'ganso', 'garfo', 'garra', 'gelado', 'gemer', 'genro', 'gesso', 'girar',
  'globo', 'goiaba', 'gomo', 'gorro', 'gosto', 'graos', 'grade', 'grama', 'grave', 'greve',
  'grito', 'grupo', 'guiar', 'haste', 'hino', 'hotel', 'ideia', 'idoso', 'inove', 'ilhas',
  'jantar', 'jarro', 'jegue', 'jogos', 'joias', 'jovem', 'juizo', 'junho', 'juros', 'justo',
  'lapis', 'lavar', 'legal', 'leite', 'lenda', 'lenha', 'lento', 'leque', 'letra', 'levar',
  'licor', 'lider', 'limao', 'lindo', 'lugar', 'lutar', 'macio', 'magia', 'maior', 'malha',
  'manga', 'manha', 'manso', 'marca', 'massa', 'medir', 'meiga', 'menta', 'metro', 'milho',
  'mirar', 'moeda', 'moinho', 'molde', 'morro', 'motor', 'mudar', 'muito', 'mundo', 'museu',
  'nabos', 'nadar', 'navio', 'neves', 'ninho', 'nobre', 'noite', 'norte', 'notas', 'novos',
  'nuvem', 'obras', 'olhar', 'ondas', 'ontem', 'ordem', 'osso', 'ouro', 'outro', 'ovelha',
  'padre', 'pagar', 'palco', 'palma', 'papel', 'parar', 'parque', 'passo', 'pauta', 'peixe',
  'pedra', 'pente', 'perto', 'pesca', 'piano', 'pilha', 'pinto', 'pipa', 'pisar', 'placa',
  'plano', 'pluma', 'pneus', 'poder', 'poema', 'ponte', 'porta', 'posto', 'prata', 'prato',
  'praia', 'preto', 'primo', 'punho', 'quase', 'queda', 'quilo', 'radio', 'raiva', 'ramos',
  'rapaz', 'reais', 'reino', 'remar', 'renda', 'rezar', 'ricos', 'rio', 'risada', 'ritmo',
  'rocha', 'rodeo', 'rolha', 'rosto', 'roupa', 'rugas', 'sabor', 'salas', 'salto', 'santo',
  'sapos', 'saude', 'seiva', 'selva', 'senha', 'serra', 'sinal', 'sitio', 'sobre', 'sonho',
  'sopro', 'sorte', 'suave', 'sujo', 'talco', 'tarde', 'tecido', 'tempo', 'terra', 'tigre',
  'tinta', 'tocar', 'tomate', 'tonel', 'torre', 'trigo', 'trono', 'tumba', 'turma', 'uniao',
  'urso', 'usina', 'uvas', 'vagem', 'valor', 'vapor', 'varal', 'vasos', 'veias', 'velas',
  'vento', 'verde', 'verso', 'vidro', 'vigor', 'vinho', 'viola', 'virar', 'visao', 'volta',
].filter((p) => p.length === 5)

/** palavra do dia determinística (mesma para todo mundo no dia) */
export function palavraDoDia(date: Date): string {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PALAVRAS_5[hash % PALAVRAS_5.length]!
}

export function palavraAleatoria(): string {
  return PALAVRAS_5[Math.floor(Math.random() * PALAVRAS_5.length)]!
}

/** feedback estilo termo: 'g' verde (posição certa), 'y' amarelo, 'b' cinza */
export function avaliaPalpite(alvo: string, palpite: string): string {
  const a = [...alvo]
  const p = [...palpite]
  const res: string[] = Array.from({ length: 5 }, () => 'b')
  const sobras = new Map<string, number>()
  for (let i = 0; i < 5; i++) {
    if (p[i] === a[i]) res[i] = 'g'
    else sobras.set(a[i]!, (sobras.get(a[i]!) ?? 0) + 1)
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'g') continue
    const n = sobras.get(p[i]!) ?? 0
    if (n > 0) {
      res[i] = 'y'
      sobras.set(p[i]!, n - 1)
    }
  }
  return res.join('')
}

export function normaliza5(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
}
