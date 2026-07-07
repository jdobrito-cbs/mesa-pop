/**
 * Gerador de ZIP nativo (sem dependências) — usa o zlib embutido do Node
 * e SEMPRE grava os caminhos com barra normal (/), então os pacotes
 * extraem corretamente no Linux (o Compress-Archive do Windows grava
 * com barra invertida e quebra a instalação no servidor).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import path from 'node:path'

const TABELA = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) c = TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (~c) >>> 0
}

function coleta(dir, base = dir, out = []) {
  for (const e of readdirSync(dir).sort()) {
    const abs = path.join(dir, e)
    if (statSync(abs).isDirectory()) coleta(abs, base, out)
    else out.push({ nome: path.relative(base, abs).split(path.sep).join('/'), abs })
  }
  return out
}

/** compacta o CONTEÚDO de `dir` (arquivos na raiz do zip) em `saida` */
export function zipDir(dir, saida) {
  const arquivos = coleta(dir)
  const partes = []
  const central = []
  let offset = 0
  for (const f of arquivos) {
    const dados = readFileSync(f.abs)
    const comp = deflateRawSync(dados)
    const crc = crc32(dados)
    const nome = Buffer.from(f.nome, 'utf8')
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(0x0800, 6) // UTF-8
    lh.writeUInt16LE(8, 8) // deflate
    lh.writeUInt16LE(0, 10)
    lh.writeUInt16LE(0x21, 12)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(comp.length, 18)
    lh.writeUInt32LE(dados.length, 22)
    lh.writeUInt16LE(nome.length, 26)
    lh.writeUInt16LE(0, 28)
    partes.push(lh, nome, comp)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0x0800, 8)
    cd.writeUInt16LE(8, 10)
    cd.writeUInt16LE(0, 12)
    cd.writeUInt16LE(0x21, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(comp.length, 20)
    cd.writeUInt32LE(dados.length, 24)
    cd.writeUInt16LE(nome.length, 28)
    cd.writeUInt32LE(0, 32)
    cd.writeUInt32LE(0, 36)
    cd.writeUInt32LE(offset, 42)
    central.push(Buffer.concat([cd, nome]))
    offset += lh.length + nome.length + comp.length
  }
  const dir_ = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(arquivos.length, 8)
  eocd.writeUInt16LE(arquivos.length, 10)
  eocd.writeUInt32LE(dir_.length, 12)
  eocd.writeUInt32LE(offset, 16)
  writeFileSync(saida, Buffer.concat([...partes, dir_, eocd]))
  return arquivos.length
}
