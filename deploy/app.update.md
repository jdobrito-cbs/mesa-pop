---
name: Mesa Pop
port: 3001
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
