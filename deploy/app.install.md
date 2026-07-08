---
name: Mesa Pop
port: 3001
workdir: .
envfile: .env
---

## Steps
```bash
# roda com DOMAIN e PORT no ambiente. O app faz tudo: instala as
# dependencias, cria o banco (senha aleatoria), monta o .env, aplica as
# migracoes + seed e compila o site. Site e API sobem juntos na $PORT.
bash install.sh
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
