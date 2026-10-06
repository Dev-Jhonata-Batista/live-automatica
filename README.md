# Live Automática

Integração entre uma **live do YouTube** e um **jogo no Roblox**. O programa lê os comentários e os Super Chats do chat da live em tempo real e os envia para uma API local, que o jogo pode consultar para reagir ao que acontece na transmissão.

> Status: funcional, testado em uma transmissão real.

## Como funciona

```
Chat da live (YouTube) --> youtube_chat.py --> api.py (Flask) --> Roblox
```

1. `youtube_chat.py` usa a YouTube Data API v3 para ler o chat da live a cada poucos segundos.
2. Cada comentário vira um evento `{"tipo": "comentario", ...}` e cada Super Chat vira `{"tipo": "presente", ...}`.
3. Os eventos são enviados por `POST` para a API em `api.py`.
4. O jogo no Roblox consulta a API (`GET /eventos`). Para o Roblox alcançar a API que roda no computador, usa-se o Cloudflare Tunnel.

## Arquivos

| Arquivo | Função |
|---|---|
| `api.py` | API em Flask que recebe (`POST /eventos`) e lista (`GET /eventos`) os eventos |
| `youtube_chat.py` | Lê o chat da live do YouTube e envia os eventos para a API |
| `teste_live.py` | Experimento anterior, lia uma live do TikTok (não é usado no fluxo atual) |
| `requirements.txt` | Bibliotecas do projeto |
| `.env.example` | Modelo do arquivo `.env` |

## Tecnologias

Python, Flask, YouTube Data API v3 (Google Cloud), Cloudflare Tunnel, Lua e Roblox Studio.

## Como rodar

1. Clone o repositório e entre na pasta.
2. Crie e ative um ambiente virtual e instale as dependências:
   ```bash
   python -m venv venv
   pip install -r requirements.txt
   ```
3. Crie uma chave da YouTube Data API v3 no Google Cloud.
4. Copie `.env.example` para `.env` e coloque a sua chave:
   ```
   YOUTUBE_API_KEY=sua_chave_aqui
   ```
5. Em `youtube_chat.py`, troque `VIDEO_ID` pelo ID da sua live.
6. Em um terminal, inicie a API:
   ```bash
   python api.py
   ```
7. Em outro terminal, inicie a leitura do chat (a live precisa estar no ar):
   ```bash
   python youtube_chat.py
   ```

## Segurança

A chave da API fica no arquivo `.env`, que está no `.gitignore` e não é enviado ao GitHub.

## Próximos passos

- Adicionar o código Lua do jogo no repositório.
- Receber o `VIDEO_ID` por argumento, em vez de escrever no código.
