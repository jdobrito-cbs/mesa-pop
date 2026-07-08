/**
 * Gera os pacotes de deploy para o painel WSRTA (rodar a cada revisão):
 *   node scripts/build-wsrta.mjs   (ou: npm run wsrta)
 *
 * Produz DOIS zips em releases/, cada um com o seu app.md na RAIZ:
 *   - mesapop-install.zip            -> app.md + install.sh + código
 *   - mesapop-update-AAAA-MM-DD.zip  -> app.md + update.sh + código (datado)
 *
 * A cópia empacotada:
 *   - traz SÓ o necessário para instalar e rodar (sem Docker/testes/docs);
 *   - tem TODOS os comentários removidos (código e scripts);
 *   - passa por uma varredura que barra qualquer marca de autoria por IA.
 * O código original do repositório fica intacto.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { zipDir } from './lib/zip.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stage = path.join(raiz, 'dist', 'wsrta-stage')
const releases = path.join(raiz, 'releases')
const hoje = new Date().toISOString().slice(0, 10)

/* ---------- o que entra ---------- */
const ARQUIVOS = [
  'package.json',
  'package-lock.json',
  'tsconfig.base.json',
  '.env.example',
  'shared/package.json',
  'shared/tsconfig.json',
  'backend/package.json',
  'backend/tsconfig.json',
  'frontend/package.json',
  'frontend/tsconfig.json',
  'frontend/index.html',
  'frontend/vite.config.ts',
]
const PASTAS = [
  ['shared/src', true],
  ['backend/src', true],
  ['backend/prisma', true],
  ['frontend/src', true],
  ['frontend/public', false],
]
const IGNORAR = /(^|[\\/])(node_modules|dist|test|\.git)([\\/]|$)|\.test\.ts$|\.md$/

/* ---------- removedores de comentário ---------- */
function limpaTs(codigo, nome) {
  const kind = nome.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const fonte = ts.createSourceFile(nome, codigo, ts.ScriptTarget.Latest, true, kind)
  const saida = ts.createPrinter({ removeComments: true }).printFile(fonte)
  const confere = ts.createSourceFile(nome, saida, ts.ScriptTarget.Latest, false, kind)
  if (confere.parseDiagnostics?.length) throw new Error(`limpeza quebrou ${nome}`)
  return saida
}
const limpaCss = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '')
const limpaHtml = (c) => c.replace(/<!--[\s\S]*?-->/g, '')
const limpaPrisma = (c) => c.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')

/** shell: remove comentários de linha inteira, preservando shebang e heredocs */
function limpaSh(c) {
  const out = []
  let heredoc = null
  for (const linha of c.split('\n')) {
    if (heredoc) {
      out.push(linha)
      if (linha.trim() === heredoc) heredoc = null
      continue
    }
    const m = linha.match(/<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?/)
    if (m) {
      heredoc = m[1]
      out.push(linha)
      continue
    }
    if (/^#!/.test(linha)) { out.push(linha); continue }
    if (/^\s*#/.test(linha)) continue
    out.push(linha)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

function limpa(nome, conteudo) {
  if (/\.(ts|tsx|mts)$/.test(nome)) return limpaTs(conteudo, nome)
  if (nome.endsWith('.css')) return limpaCss(conteudo)
  if (nome.endsWith('.html')) return limpaHtml(conteudo)
  if (nome.endsWith('.prisma')) return limpaPrisma(conteudo)
  if (nome.endsWith('.sh')) return limpaSh(conteudo)
  return conteudo
}

function escreve(origem, destino) {
  const nome = path.basename(origem)
  const limpavel = /\.(ts|tsx|mts|css|html|prisma|sh)$/.test(nome)
  mkdirSync(path.dirname(destino), { recursive: true })
  if (limpavel) writeFileSync(destino, limpa(nome, readFileSync(origem, 'utf8')))
  else cpSync(origem, destino)
}

/* ---------- monta o staging comum ---------- */
rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
for (const rel of ARQUIVOS) {
  const abs = path.join(raiz, rel)
  if (existsSync(abs)) escreve(abs, path.join(stage, rel))
}
for (const [rel, limpar] of PASTAS) {
  const base = path.join(raiz, rel)
  if (!existsSync(base)) continue
  for (const e of readdirSync(base, { recursive: true })) {
    const abs = path.join(base, String(e))
    const relc = path.join(rel, String(e))
    if (IGNORAR.test(relc) || statSync(abs).isDirectory()) continue
    if (limpar && /\.(ts|tsx|css|html|prisma)$/.test(abs)) escreve(abs, path.join(stage, relc))
    else { mkdirSync(path.dirname(path.join(stage, relc)), { recursive: true }); cpSync(abs, path.join(stage, relc)) }
  }
}

/* ---------- varredura anti-marca de IA ---------- */
const PROIBIDO = /claude|anthropic|co-authored|gerado (com|por) ia|feito por ia|intelig[eê]ncia artificial|\bAI-generated\b/i
function varre(dir) {
  for (const e of readdirSync(dir, { recursive: true })) {
    const abs = path.join(dir, String(e))
    if (statSync(abs).isDirectory()) continue
    if (!/\.(ts|tsx|js|mjs|css|html|prisma|sh|json|txt|xml|webmanifest)$/.test(abs)) continue
    const txt = readFileSync(abs, 'utf8')
    const hit = txt.split('\n').find((l) => PROIBIDO.test(l))
    if (hit) throw new Error(`marca de IA em ${path.relative(stage, abs)}: ${hit.trim().slice(0, 80)}`)
  }
}
varre(stage)

/* ---------- empacota cada alvo ---------- */
mkdirSync(releases, { recursive: true })
function conta(dir) {
  let n = 0
  for (const e of readdirSync(dir, { recursive: true })) if (!statSync(path.join(dir, String(e))).isDirectory()) n++
  return n
}
function zipar(alvo, appMdOrigem, scriptOrigem, scriptNome, txt, saidaZip) {
  const tmp = path.join(raiz, 'dist', `wsrta-${alvo}`)
  rmSync(tmp, { recursive: true, force: true })
  cpSync(stage, tmp, { recursive: true })
  writeFileSync(path.join(tmp, 'app.md'), readFileSync(path.join(raiz, appMdOrigem), 'utf8'))
  writeFileSync(path.join(tmp, scriptNome), limpaSh(readFileSync(path.join(raiz, scriptOrigem), 'utf8')))
  // remove.sh vai nos DOIS zips (## Remove do app.md chama ele ao remover)
  writeFileSync(path.join(tmp, 'remove.sh'), limpaSh(readFileSync(path.join(raiz, 'deploy/wsrta-remove.sh'), 'utf8')))
  writeFileSync(path.join(tmp, 'LEIAME.txt'), txt)
  const zip = path.join(releases, saidaZip)
  rmSync(zip, { force: true })
  const n = zipDir(tmp, zip)
  const kb = Math.round(statSync(zip).size / 1024)
  console.log(`  ${saidaZip} (${kb} KB, ${n} arquivos)`)
  rmSync(tmp, { recursive: true, force: true })
}

const TXT_INSTALL = [
  'MESA POP - INSTALACAO (WSRTA)',
  '',
  'Publicar no painel: escolha o dominio, envie este zip (o app.md esta na raiz),',
  'confirme nome/porta e Publicar. O app instala tudo, cria o banco com senha',
  'aleatoria e monta o proprio .env. Site e API sobem juntos na porta do painel.',
  '',
  'Terminal Linux (opcional): bash install.sh SEU_DOMINIO PORTA',
].join('\n')

const TXT_UPDATE = [
  `MESA POP - ATUALIZACAO ${hoje} (WSRTA)`,
  '',
  'No painel do app, use Atualizar e envie este zip. Mantem o banco e o .env;',
  'aplica as migracoes pendentes e recompila o site com o codigo desta versao.',
  '',
  'Terminal Linux (opcional): bash update.sh',
].join('\n')

console.log('Gerando pacotes WSRTA em releases/:')
zipar('install', 'deploy/app.install.md', 'deploy/wsrta-install.sh', 'install.sh', TXT_INSTALL, 'mesapop-wsrta-install.zip')
zipar('update', 'deploy/app.update.md', 'deploy/wsrta-update.sh', 'update.sh', TXT_UPDATE, `mesapop-wsrta-update-${hoje}.zip`)
rmSync(stage, { recursive: true, force: true })

// guia na pasta releases/ (para quem navega pelo GitHub)
writeFileSync(
  path.join(releases, 'README.md'),
  [
    '# Pacotes de instalação',
    '',
    'Baixe o ARQUIVO ZIP daqui (não o "Code > Download ZIP" do repositório).',
    '',
    '## Painel WSRTA (cada zip já tem o `app.md` na raiz)',
    '- `mesapop-wsrta-install.zip` — instalação (cria banco, monta o .env e builda; porta única).',
    '- `mesapop-wsrta-update-AAAA-MM-DD.zip` — atualização (mantém banco/.env; migra e rebuilda).',
    '',
    'No painel: Publicar → escolha o domínio → envie o zip de instalação → confirme nome/porta.',
    'Para atualizar: Atualizar no app → envie o zip de update mais recente.',
    '',
    '## Docker (servidor próprio)',
    '- `mesapop-docker-install.zip` — traz `install.sh`; sobe Postgres + backend + site via',
    '  `docker compose`. Uso: `unzip`, `chmod +x install.sh`, `./install.sh SEU_HOST`.',
  ].join('\n'),
)
console.log('OK - pacotes prontos (codigo sem comentarios e sem marcas de autoria).')
