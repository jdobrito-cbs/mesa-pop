---
name: Mesa Pop
port: 3001
database: postgres
workdir: .
envfile: .env
---

## Steps
```bash
# atualizacao: mantem o banco e o .env. Atualiza as dependencias, aplica
# as migracoes pendentes e recompila o site com o codigo desta versao.
bash update.sh
```

## Start
```bash
npm run start -w backend
```

## Remove
```bash
# limpa o banco e o usuario que a instalacao criou (senao um
# remover+reinstalar falha na autenticacao com o banco antigo).
bash remove.sh
```
