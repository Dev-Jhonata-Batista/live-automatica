# GERENTE.md: estado da operação das lives

Última atualização: 22/11/2026 (Claude). Ler no início de toda sessão, atualizar no fim.

## Objetivo

Maximizar diamantes por hora de live, sem arriscar a conta @robloxgamer2501.

## Estado atual

| Item | Situação em 22/11/2026 |
|---|---|
| Conta TikTok | **55 seguidores, 0 curtidas, perfil privado, nenhum vídeo** (visto na página pública, sem login). |
| Acesso ao LIVE | **Provavelmente bloqueado.** A própria TikTok Brasil (@tiktoklivebr) diz que o LIVE libera com 18 anos ou mais e 1.000 seguidores. O Jhon precisa conferir no app e no LIVE Studio (ver abaixo). |
| Presentes | Exigem 18 anos e conta em dia; confirmar no app. |
| Launcher (Electron) | 0.3.0: vários jogos, corrida 2D sem presentes, modo teste. Código agora também no repositório (`launcher/`). |
| Ponte YouTube + Roblox | Funciona (Python + Flask + Cloudflare). Os scripts Lua não estão no repositório. |
| Jogo de assalto | Começando (nome de trabalho: **Fuga Neon**). |
| Lives feitas | Nenhuma registrada. |

### O que o Jhon precisa conferir (só ele, logado)

1. No celular: **Perfil > ☰ > Ferramentas de criador (ou TikTok Studio) > LIVE**. Se aparecer "Comece a fazer LIVE" ou o botão LIVE no "+", o acesso está liberado. Se aparecer um requisito (ex.: 1.000 seguidores), anote qual.
2. No mesmo lugar: **Presentes de LIVE** ou **Recompensas de LIVE**. Ver se está ativo e se há alguma restrição.
3. **Situação da conta / Status da LIVE**: ver se há aviso ou restrição.
4. No PC: abrir o TikTok LIVE Studio logado e ver se o botão "Entrar ao vivo" está habilitado.
5. **Deixar o perfil público** (Privacidade > Conta privada: desligar). Conta privada não cresce.

## Decisões (com o porquê)

| Data | Decisão | Por quê |
|---|---|---|
| 22/11 | Electron, não Tauri | O launcher já existe em Electron e a biblioteca da live é Node; Tauri exigiria Rust e refazer tudo. |
| 22/11 | TikTok-Live-Connector (Node) em vez de TikTokLive (Python) | Roda dentro do launcher sem um segundo processo; ambas são não oficiais e quebram quando o TikTok muda. Plano B: chat do YouTube pela API oficial. |
| 22/11 | Reaproveitar o launcher; a ponte Python fica para o Modo Roblox | O launcher já tem lista de jogos, janela 9:16, reconexão e status. |
| 22/11 | Banco SQLite com o `node:sqlite` embutido no Node | Não precisa instalar nem compilar nada no Windows. |
| 22/11 | Assalto antes da Fase 4 da corrida | O hype do GTA 6 é agora; a corrida espera. |
| 22/11 | Escolha de lado (ladrão/polícia) é grátis, por comentário; presentes só dão ações | A regra do TikTok desmonetiza "só apresentar dois lados e pedir presentes". |
| 22/11 | Chave do YouTube removida do `.env.example` | Estava uma chave real no arquivo de exemplo. **Jhon precisa revogar essa chave no Google Cloud** e criar outra só no `.env`. |
| 22/11 | **Pendente do Jhon:** live automática x Jhon presente narrando | A regra oficial desmonetiza live "operated primarily through automated systems" e "largely passive or unattended". Recomendação: Jhon presente com microfone; o watchdog é para travamentos, não para piloto automático. |

## Prioridades

1. Jogo de assalto jogável no modo teste (MVP) + launcher 0.4 (SQLite, watchdog, presente → ação, rotação).
2. Jhon: perfil público, conferir acesso ao LIVE, postar cortes para chegar a 1.000 seguidores.
3. Primeira live do assalto (TikTok se liberado; senão YouTube, que já funciona).

## Plano das próximas 2 semanas (23/11 a 06/12)

| Dia | Claude | Jhon |
|---|---|---|
| Dom 22 | Radar, plano, base do launcher 0.4 (banco SQLite, watchdog) | Conferir acesso ao LIVE; deixar o perfil público; revogar a chave do YouTube |
| Seg 23 e Ter 24 | **Fuga Neon MVP**: entrar como ladrão/polícia, rodada assalto → fuga → perseguição → resultado, ações por presente e por curtida, placar das equipes, top doadores | Testar no modo teste e mandar print/erro |
| Qua 25 | Presente → ação configurável no launcher; rotação automática; gravação de cortes (botão "salvar últimos 30 s") | Postar o 1º corte do jogo no modo teste (marcado como demonstração) |
| Qui 26 | Leitor do chat do YouTube no launcher (plano B e live no YouTube) | Teste de ponta a ponta numa live de teste |
| Sex 27 | Checklist "INICIAR LIVE", relatório pós-live a partir do banco | Ensaio de 20 min |
| **Sáb 28** | **1ª live do Fuga Neon** (TikTok se liberado, senão YouTube), check-ins e relatório | Ao vivo narrando |
| Dom 29 | Relatório, 3 correções | 2ª live |
| Seg 30 | Relatório semanal; eventos surpresa e troca de bairro | Live |
| Ter 1 a Sex 4 | Experimento 1: meta na tela (aumenta presentes por hora?), recordes, modo Roblox no catálogo | Lives e 1 corte por dia |
| Sáb 5 e Dom 6 | Comparar lives, cortar o que não funcionou | Lives |

Nada aqui garante ganho: o plano mede e corta o que não funcionar em 3 lives.

## Ferramentas do Claude neste projeto

| Item | Para quê | Quanto ajuda | Situação |
|---|---|---|---|
| Skills `iniciar-live`, `relatorio-pos-live`, `radar-hype` | Repetir os procedimentos sem reexplicar | Alta | Propostas, Jhon salva |
| GitHub (repositório) | Ler e gravar este repositório | Alta | Funcionando nesta sessão |
| Roblox Studio (MCP no PC) | Modo Roblox: editar e testar os scripts Lua | Média | Já aparece no PC do Jhon |
| Navegador embutido do app | Ler regras, ler o TikTok Studio com o Jhon logado | Alta | Funcionando |
| Controle do computador | Clicar "Entrar ao vivo" no LIVE Studio, só com "sim" | Média | Pedir acesso na 1ª live |
| Tarefas agendadas | Radar diário; check-in de hora em hora na live; relatório semanal às segundas | Alta | Criar com o "sim" do Jhon |
| OBS via WebSocket | Só se trocarmos o LIVE Studio pelo OBS | Baixa agora | Não instalar |
| Plugin "Social Media Skills" (comunitário) | Roteiros e legendas de cortes | Baixa | Não instalar por enquanto |

## Próximos passos

- Claude: terminar o Fuga Neon MVP e o launcher 0.4.
- Jhon: os 5 itens de "O que o Jhon precisa conferir" + revogar a chave do YouTube + responder a decisão sobre presença na live.
