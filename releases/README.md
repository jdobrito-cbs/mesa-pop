# Pacotes de instalação

Baixe o ARQUIVO ZIP daqui (não o "Code > Download ZIP" do repositório).

## Painel WSRTA (cada zip já tem o `app.md` na raiz)
- `mesapop-wsrta-install.zip` — instalação (cria banco, monta o .env e builda; porta única).
- `mesapop-wsrta-update-AAAA-MM-DD.zip` — atualização (mantém banco/.env; migra e rebuilda).

No painel: Publicar → escolha o domínio → envie o zip de instalação → confirme nome/porta.
Para atualizar: Atualizar no app → envie o zip de update mais recente.

## Docker (servidor próprio)
- `mesapop-docker-install.zip` — traz `install.sh`; sobe Postgres + backend + site via
  `docker compose`. Uso: `unzip`, `chmod +x install.sh`, `./install.sh SEU_HOST`.