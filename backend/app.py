from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os, traceback
from model import train_model

app = Flask(__name__)
CORS(app)

FRONTEND = os.path.join(os.path.dirname(__file__), '..', 'frontend')

# Serve the frontend
@app.route('/')
def index():
    return send_from_directory(FRONTEND, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(FRONTEND, filename)

# Single endpoint — fetches live data, trains LSTM, returns results
@app.route('/predict', methods=['POST'])
def predict():
    data   = request.get_json()
    ticker = data.get('ticker', 'AAPL').upper().strip()

    try:
        result = train_model(ticker)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 45)
    print("  StockPred AI  —  http://localhost:5000")
    print("  Live data via Yahoo Finance (yfinance)")
    print("=" * 45)
    app.run(debug=True, port=5000)
