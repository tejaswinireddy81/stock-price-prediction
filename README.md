# StockPred AI — Mini Project

```
stockpred-ai/
├── backend/
│   ├── app.py          ← Flask server (run this)
│   ├── model.py        ← LSTM training + prediction
│   ├── indicators.py   ← RSI, MACD, Bollinger Bands, SMA
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## How to Run

```bash
# Step 1 — Install packages
cd backend
pip install -r requirements.txt

# Step 2 — Start the server
python app.py

# Step 3 — Open browser
# Go to http://localhost:5000
```

## How to Use

1. Select a stock ticker (AAPL, TSLA, GOOGL…)
2. Click **▶ Run Prediction**
3. Wait ~1–2 minutes for LSTM to train
4. View results across 4 powerful modules:

- **Dashboard**  
  Displays current price, predicted price, model performance (RMSE), and overall trend signal along with an interactive price chart.

- **Technical Analysis**  
  Includes key indicators such as RSI, MACD  for market trend evaluation.

- **ML Models**  
  Shows LSTM model results with actual vs predicted price comparison and performance metrics.

- **Prediction Engine**  
  Generates future stock price forecasts (7-day prediction) based on trained machine learning models.
