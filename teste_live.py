import requests
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, CommentEvent, GiftEvent

client = TikTokLiveClient(unique_id="@robloxgamer2501")
API_URL = "http://127.0.0.1:5000/eventos"

@client.on(ConnectEvent)
async def on_connect(event: ConnectEvent):
    print(f"Conectado à live de @{event.unique_id}")

@client.on(CommentEvent)
async def on_comment(event: CommentEvent):
    print(f"{event.user.nickname}: {event.comment}")
    try:
        resposta = requests.post(API_URL, json={"tipo": "comentario", "usuario": event.user.nickname, "texto": event.comment})
        print("  -> enviado, status:", resposta.status_code)
    except Exception as e:
        print("  -> ERRO ao enviar:", e)

@client.on(GiftEvent)
async def on_gift(event: GiftEvent):
    if event.gift.streakable and not event.streaking:
        qtd = event.repeat_count
    elif not event.gift.streakable:
        qtd = 1
    else:
        return
    print(f"{event.user.nickname} enviou {qtd}x \"{event.gift.name}\"")
    try:
        resposta = requests.post(API_URL, json={"tipo": "presente", "usuario": event.user.nickname, "presente": event.gift.name, "quantidade": qtd})
        print("  -> enviado, status:", resposta.status_code)
    except Exception as e:
        print("  -> ERRO ao enviar:", e)

client.run()