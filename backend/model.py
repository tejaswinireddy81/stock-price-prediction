import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from indicators import add_indicators

WINDOW = 60   # look-back days

# ── Step 1: Fetch LIVE data from Yahoo Finance ────────────────────────────────
def get_live_data(ticker):
    print(f"[INFO] Downloading live data for {ticker} from Yahoo Finance...")

    # Downloads last 3 years of daily OHLCV — always live, always fresh
    df = yf.download(ticker, period='3y', auto_adjust=True, progress=False)

    if df.empty:
        raise ValueError(f"No data found for ticker '{ticker}'. Check the symbol.")

    # Fix multi-level columns that newer yfinance versions return
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # Keep only what we need
    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
    df.dropna(inplace=True)

    print(f"[INFO] Got {len(df)} rows  |  {df.index[0].date()} → {df.index[-1].date()}")

    # Add technical indicators
    df = add_indicators(df)

    return df


# ── Step 2: Train LSTM on live data ──────────────────────────────────────────
def train_model(ticker):
    df = get_live_data(ticker)

    # Scale closing prices to [0, 1]
    prices = df['Close'].values.reshape(-1, 1)
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(prices)

    # Build sliding window sequences  (X = past 60 days → y = next day)
    X, y = [], []
    for i in range(WINDOW, len(scaled)):
        X.append(scaled[i - WINDOW:i, 0])
        y.append(scaled[i, 0])
    X = np.array(X).reshape(-1, WINDOW, 1)
    y = np.array(y)

    # 80/20 train-test split (no shuffle — time order matters)
    split   = int(len(X) * 0.8)
    X_train = X[:split];  y_train = y[:split]
    X_test  = X[split:];  y_test  = y[split:]

    print(f"[INFO] Training LSTM  |  train={len(X_train)}  test={len(X_test)}")

    # LSTM model
    model = Sequential([
        LSTM(50, return_sequences=True, input_shape=(WINDOW, 1)),
        Dropout(0.2),
        LSTM(50, return_sequences=False),
        Dropout(0.2),
        Dense(1)
    ])
    model.compile(optimizer='adam', loss='mse')
    model.fit(
        X_train, y_train,
        epochs=20,
        batch_size=32,
        validation_data=(X_test, y_test),
        callbacks=[EarlyStopping(patience=5, restore_best_weights=True)],
        verbose=0
    )
    print("[INFO] Training complete.")

    # ── Evaluate on test set ──────────────────────────────────────────────────
    y_pred_scaled = model.predict(X_test, verbose=0)
    y_pred = scaler.inverse_transform(y_pred_scaled).flatten()
    y_true = scaler.inverse_transform(y_test.reshape(-1, 1)).flatten()

    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae  = float(mean_absolute_error(y_true, y_pred))
    da   = float(np.mean((np.diff(y_true) > 0) == (np.diff(y_pred) > 0)) * 100)

    # ── Predict next 7 days ───────────────────────────────────────────────────
    seq    = scaled[-WINDOW:].reshape(WINDOW, 1).tolist()
    future = []
    for _ in range(7):
        inp = np.array(seq[-WINDOW:]).reshape(1, WINDOW, 1)
        out = float(model.predict(inp, verbose=0)[0][0])
        future.append(round(float(scaler.inverse_transform([[out]])[0][0]), 2))
        seq.append([out])

    # ── Build signal from live indicators ─────────────────────────────────────
    current_price = float(df['Close'].iloc[-1])
    rsi   = float(df['RSI'].iloc[-1])
    macd  = float(df['MACD'].iloc[-1])
    sma20 = float(df['SMA_20'].iloc[-1])
    sma50 = float(df['SMA_50'].iloc[-1])
    bb_up = float(df['BB_Upper'].iloc[-1])
    bb_lo = float(df['BB_Lower'].iloc[-1])

    if rsi > 60 and macd > 0 and current_price > sma20:
        signal = 'BULLISH'
    elif rsi < 40 and macd < 0 and current_price < sma20:
        signal = 'BEARISH'
    else:
        signal = 'NEUTRAL'

    # ── Return everything the frontend needs ──────────────────────────────────
    return {
        'ticker':        ticker,
        'current_price': round(current_price, 2),
        'signal':        signal,

        'metrics': {
            'rmse': round(rmse, 2),
            'mae':  round(mae, 2),
            'da':   round(da, 1)
        },

        'indicators': {
            'rsi':      round(rsi, 2),
            'macd':     round(macd, 4),
            'sma20':    round(sma20, 2),
            'sma50':    round(sma50, 2),
            'bb_upper': round(bb_up, 2),
            'bb_lower': round(bb_lo, 2)
        },

        # Last 90 days of real prices for the price chart
        'history': {
            'dates':  [str(d.date()) for d in df.index[-90:]],
            'prices': df['Close'].tail(90).round(2).tolist()
        },

        # Test-set actual vs predicted (last 60 points) for LSTM chart
        'chart': {
            'actual':    [round(float(v), 2) for v in y_true[-60:]],
            'predicted': [round(float(v), 2) for v in y_pred[-60:]]
        },

        # 7-day future forecast
        'forecast': future
    }
