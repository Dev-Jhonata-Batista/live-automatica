import os
import time
import requests
from dotenv import load_dotenv
from googleapiclient.discovery import build

load_dotenv()

API_KEY = os.getenv("YOUTUBE_API_KEY")
VIDEO_ID = "Ka7pUo07aA4"
API_URL = "http://127.0.0.1:5000/eventos"

youtube = build("youtube", "v3", developerKey=API_KEY)

video_response = youtube.videos().list(
    part="liveStreamingDetails",
    id=VIDEO_ID
).execute()

live_chat_id = video_response["items"][0]["liveStreamingDetails"]["activeLiveChatId"]
print("Chat ID encontrado:", live_chat_id)

next_page_token = None

while True:
    chat_response = youtube.liveChatMessages().list(
        liveChatId=live_chat_id,
        part="snippet,authorDetails",
        pageToken=next_page_token
    ).execute()

    for item in chat_response["items"]:
        autor = item["authorDetails"]["displayName"]
        tipo = item["snippet"]["type"]
        texto = item["snippet"].get("displayMessage")

        if tipo == "superChatEvent":
            valor = item["snippet"]["superChatDetails"]["amountDisplayString"]
            print(f"{autor} enviou um Super Chat de {valor}: {texto}")
            evento = {"tipo": "presente", "usuario": autor, "presente": f"Super Chat ({valor})", "quantidade": 1}
        elif texto:
            print(f"{autor}: {texto}")
            evento = {"tipo": "comentario", "usuario": autor, "texto": texto}
        else:
            continue

        try:
            r = requests.post(API_URL, json=evento)
            print("  -> enviado, status:", r.status_code)
        except Exception as e:
            print("  -> ERRO ao enviar:", e)

    next_page_token = chat_response.get("nextPageToken")
    time.sleep(chat_response.get("pollingIntervalMillis", 5000) / 1000)