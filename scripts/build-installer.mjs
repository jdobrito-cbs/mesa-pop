/**
 * Gera o PACOTE DE INSTALAÇÃO do Mesa Pop (rodar a cada revisão):
 *   node scripts/build-installer.mjs   (ou: npm run installer)
 *
 * 1. Copia para dist/installer SÓ o necessário para o site funcionar
 *    (fontes, prisma, Dockerfiles, compose, install.sh) — sem testes,
 *    docs, demos ou node_modules.
 * 2. Remove TODOS os comentários da CÓPIA (o código original fica
 *    intacto): .ts/.tsx pelo printer do próprio compilador TypeScript
 *    (garante código válido — cada arquivo é re-parseado e conferido),
 *    .css/.html/.prisma por limpeza dirigida.
 * 3. Empacota tudo em dist/mesapop-installer.zip.
 */
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const staging = path.join(raiz, 'dist', 'installer')
const zipFinal = path.join(raiz, 'dist', 'mesapop-installer.zip')

/* ---------- 1. seleção do que entra no pacote ---------- */

const ARQUIVOS_RAIZ = [
  'package.json',
  'package-lock.json',
  'tsconfig.base.json',
  'docker-compose.yml',
  '.env.example',
  'install.sh',
]

const PASTAS = [
  ['shared/src', true],
  ['backend/src', true],
  ['backend/prisma', true],
  ['frontend/src', true],
  ['frontend/public', false], // ícones/manifest: copiar como estão
]

const ARQUIVOS_WORKSPACE = [
  'shared/package.json',
  'shared/tsconfig.json',
  'backend/package.json',
  'backend/tsconfig.json',
  'backend/Dockerfile',
  'frontend/package.json',
  'frontend/tsconfig.json',
  'frontend/Dockerfile',
  'frontend/nginx.conf',
  'frontend/index.html',
  'frontend/vite.config.ts',
]

const IGNORAR = /(^|[\\/])(node_modules|dist|test|\.git)([\\/]|$)|\.test\.ts$|\.md$/

/* ---------- 2. removedores de comentário (na CÓPIA) ---------- */

function limpaTs(codigo, nomeArquivo) {
  const kind = nomeArquivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const fonte = ts.createSourceFile(nomeArquivo, codigo, ts.ScriptTarget.Latest, true, kind)
  const printer = ts.createPrinter({ removeComments: true })
  const saida = printer.printFile(fonte)
  // rede de segurança: a cópia precisa continuar parseando sem erros
  const confere = ts.createSourceFile(nomeArquivo, saida, ts.ScriptTarget.Latest, false, kind)
  if (confere.parseDiagnostics?.length) {
    throw new Error(`limpeza quebrou ${nomeArquivo}: ${confere.parseDiagnostics[0].messageText}`)
  }
  return saida
}

const limpaCss = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '')
const limpaHtml = (c) => c.replace(/<!--[\s\S]*?-->/g, '')
const limpaPrisma = (c) =>
  c
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')

function processa(origem, destino) {
  const nome = path.basename(origem)
  let conteudo = readFileSync(origem, 'utf8')
  if (/\.(ts|tsx|mts)$/.test(nome)) conteudo = limpaTs(conteudo, nome)
  else if (nome.endsWith('.css')) conteudo = limpaCss(conteudo)
  else if (nome.endsWith('.html')) conteudo = limpaHtml(conteudo)
  else if (nome.endsWith('.prisma')) conteudo = limpaPrisma(conteudo)
  mkdirSync(path.dirname(destino), { recursive: true })
  writeFileSync(destino, conteudo)
}

function copiaPasta(rel, limpar) {
  const origem = path.join(raiz, rel)
  if (!existsSync(origem)) return
  for (const entrada of readdirSync(origem, { recursive: true })) {
    const abs = path.join(origem, String(entrada))
    const relCompleto = path.join(rel, String(entrada))
    if (IGNORAR.test(relCompleto) || statSync(abs).isDirectory()) continue
    const destino = path.join(staging, relCompleto)
    if (limpar && /\.(ts|tsx|mts|css|html|prisma)$/.test(abs)) {
      processa(abs, destino)
    } else {
      mkdirSync(path.dirname(destino), { recursive: true })
      cpSync(abs, destino)
    }
  }
}

/* ---------- 3. monta o pacote ---------- */

rmSync(staging, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })

let total = 0
for (const rel of [...ARQUIVOS_RAIZ, ...ARQUIVOS_WORKSPACE]) {
  const abs = path.join(raiz, rel)
  if (!existsSync(abs)) {
    console.warn(`aviso: ${rel} não existe — pulado`)
    continue
  }
  if (/\.(ts|tsx|css|html|prisma)$/.test(rel)) processa(abs, path.join(staging, rel))
  else {
    mkdirSync(path.dirname(path.join(staging, rel)), { recursive: true })
    cpSync(abs, path.join(staging, rel))
  }
  total++
}
for (const [rel, limpar] of PASTAS) copiaPasta(rel, limpar)

// conta arquivos copiados nas pastas
function conta(dir) {
  let n = 0
  for (const e of readdirSync(dir, { recursive: true })) {
    if (!statSync(path.join(dir, String(e))).isDirectory()) n++
  }
  return n
}
total = conta(staging)

// instruções curtas dentro do pacote
writeFileSync(
  path.join(staging, 'INSTALAR.txt'),
  [
    'MESA POP — INSTALACAO',
    '',
    'Requisitos: Linux com Docker + Docker Compose v2.',
    '',
    '  chmod +x install.sh',
    '  ./install.sh                # site em http://localhost:8080',
    '  ./install.sh SEU_IP_OU_HOST # site em http://SEU_IP:8080',
    '',
    'Admin: e-mail e senha ficam no .env gerado (ADMIN_EMAIL / ADMIN_PASSWORD).',
    'Atualizar: substitua os arquivos e rode ./install.sh de novo (o banco fica).',
    'Logs: docker compose logs -f   |   Parar: docker compose --profile full down',
  ].join('\n'),
)

/* ---------- 4. zip ---------- */

rmSync(zipFinal, { force: true })
const cmd =
  process.platform === 'win32'
    ? `powershell -NoProfile -Command "Compress-Archive -Path '${staging}\\*' -DestinationPath '${zipFinal}' -Force"`
    : `cd '${staging}' && zip -rq '${zipFinal}' .`
execSync(cmd, { stdio: 'inherit' })

const kb = Math.round(statSync(zipFinal).size / 1024)
console.log(`✔ instalador pronto: dist/mesapop-installer.zip (${kb} KB, ${total} arquivos, sem comentários)`)
