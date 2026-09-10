from flask import Flask, request, jsonify

app = Flask(__name__)
eventos = []

@app.route("/eventos", methods=["POST"])
def receber_evento():
    dados = request.get_json()
    eventos.append(dados)
    return jsonify({"status": "recebido"}), 201

@app.route("/eventos", methods=["GET"])
def listar_eventos():
    return jsonify(eventos)

if __name__ == "__main__":
    app.run(port=5000, debug=True)