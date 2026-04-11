import pandas as pd

def add_indicators(df):
    close = df['Close']

    # Trend
    df['SMA_20'] = close.rolling(20).mean()
    df['SMA_50'] = close.rolling(50).mean()

    # RSI (14)
    delta = close.diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    df['RSI'] = 100 - (100 / (1 + gain / (loss + 1e-10)))

    # MACD
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df['MACD']        = ema12 - ema26
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

    # Bollinger Bands (20, 2sigma)
    df['BB_Mid']   = close.rolling(20).mean()
    df['BB_Upper'] = df['BB_Mid'] + 2 * close.rolling(20).std()
    df['BB_Lower'] = df['BB_Mid'] - 2 * close.rolling(20).std()

    df.dropna(inplace=True)
    return df
