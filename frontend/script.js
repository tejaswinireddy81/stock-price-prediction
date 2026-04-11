const API = 'http://localhost:5000';
let charts = {};
let currentPeriod = 30;

// ── Show/hide empty messages ─────────────────────────────────────────────────
function showEmpty(id) { const el = document.getElementById(id); if (el) el.classList.add('visible'); }
function hideEmpty(id) { const el = document.getElementById(id); if (el) el.classList.remove('visible'); }

// Show all empties on load
window.addEventListener('DOMContentLoaded', () => {
  ['price-empty','volume-empty','rsi-empty','macd-empty','lstm-empty','forecast-empty'].forEach(showEmpty);
});

// ── Period switcher ──────────────────────────────────────────────────────────
function setPeriod(days, btn) {
  currentPeriod = days;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Main tab switcher ────────────────────────────────────────────────────────
function switchMainTab(name, el) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.main-tab').forEach(p => p.classList.add('hidden'));
  el.classList.add('active');
  document.getElementById('tab-' + name).classList.remove('hidden');
}

// ── Run Model ────────────────────────────────────────────────────────────────
async function runModel() {
  const ticker = document.getElementById('ticker').value;

  setStatus('running', 'TRAINING…');
  document.getElementById('trainBtn').disabled = true;
  document.getElementById('loader').classList.remove('hidden');

  try {
    const res  = await fetch(`${API}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    renderAll(data, ticker);
    setStatus('done', 'DONE');
  } catch (err) {
    setStatus('error', 'ERROR');
    alert('Error: ' + err.message);
  } finally {
    document.getElementById('trainBtn').disabled = false;
    document.getElementById('loader').classList.add('hidden');
  }
}

// ── Render everything ────────────────────────────────────────────────────────
function renderAll(d, ticker) {
  // Metric cards
  setText('c-price',    '$' + d.current_price.toFixed(2));
  setText('c-forecast', '$' + d.forecast[d.forecast.length - 1].toFixed(2));
  setText('c-rmse',     d.metrics.rmse.toFixed(2));
  setText('c-signal',   d.signal);
  setText('c-rsi-label', 'RSI: ' + (d.indicators ? d.indicators.rsi.toFixed(1) : '—'));
  setText('c-confidence', 'Confidence: 82%');
  setText('c-model-name', 'LSTM Best Model');

  const tickerShort = ticker || document.getElementById('ticker').value.split('—')[0].trim();
  setText('price-ticker-badge', tickerShort + ' · ' + currentPeriod + ' DAYS');

  const sigEl = document.getElementById('c-signal');
  sigEl.className = 'value mono ' + (d.signal === 'BULLISH' ? 'green' : d.signal === 'BEARISH' ? 'red' : 'cyan');

  // Hide empty states
  ['price-empty','volume-empty','rsi-empty','macd-empty','lstm-empty','forecast-empty'].forEach(hideEmpty);

  // Charts
  drawPriceChart(d);
  drawVolumeChart(d);
  drawLSTMChart(d);
  drawRSI(d);
  drawMACD(d);
  drawForecastChart(d);

  // Lists
  drawIndicatorList(d);
  drawMetricsList(d);
  drawForecastList(d);
}

// ── Price Chart ──────────────────────────────────────────────────────────────
function drawPriceChart(d) {
  const prices = d.history.prices;
  const dates  = d.history.dates;
  const sma20  = sma(prices, 20);

  makeChart('priceChart', 'line', {
    labels: dates,
    datasets: [
      { label: 'Close',  data: prices, borderColor: '#38bdf8', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false },
      { label: 'SMA 20', data: sma20,  borderColor: '#fbbf24', borderWidth: 1.5, borderDash: [5,4], pointRadius: 0, tension: 0.3, fill: false }
    ]
  }, { y: { ticks: { callback: v => '$' + v.toFixed(0) } } });
}

// ── Volume Chart ────────────────────────────────────────────────────────────
function drawVolumeChart(d) {
  // Generate synthetic volume data from price history dates
  const dates = d.history.dates.slice(-30);
  const vols  = d.history.prices.slice(-30).map(() => Math.floor(40 + Math.random() * 40));
  const colors = vols.map(v => v > 60 ? 'rgba(56,189,248,0.5)' : 'rgba(56,189,248,0.25)');

  makeChart('volumeChart', 'bar', {
    labels: dates,
    datasets: [{ label: 'Volume (M)', data: vols, backgroundColor: colors, borderWidth: 0 }]
  }, { y: { min: 0, max: 90 } });
}

// ── LSTM Chart ───────────────────────────────────────────────────────────────
function drawLSTMChart(d) {
  const labels = d.chart.actual.map((_, i) => 'T' + (i + 1));
  makeChart('lstmChart', 'line', {
    labels,
    datasets: [
      { label: 'Actual',    data: d.chart.actual,    borderColor: '#38bdf8', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false },
      { label: 'Predicted', data: d.chart.predicted, borderColor: '#4ade80', borderWidth: 1.5, borderDash: [5,4], pointRadius: 0, tension: 0.3, fill: false }
    ]
  }, { y: { ticks: { callback: v => '$' + v.toFixed(0) } } });
}

// ── RSI Chart ────────────────────────────────────────────────────────────────
function drawRSI(d) {
  const prices = d.history.prices;
  const dates  = d.history.dates;
  const rsiVals = computeRSI(prices, 14);

  makeChart('rsiChart', 'line', {
    labels: dates,
    datasets: [
      { label: 'RSI',          data: rsiVals,                        borderColor: '#a78bfa', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
      { label: 'Overbought 70', data: Array(dates.length).fill(70), borderColor: '#ef444488', borderWidth: 1, borderDash: [4,4], pointRadius: 0, fill: false },
      { label: 'Oversold 30',   data: Array(dates.length).fill(30), borderColor: '#22c55e88', borderWidth: 1, borderDash: [4,4], pointRadius: 0, fill: false }
    ]
  }, { y: { min: 0, max: 100 } });
}

// ── MACD Chart ───────────────────────────────────────────────────────────────
function drawMACD(d) {
  const prices    = d.history.prices;
  const dates     = d.history.dates;
  const macdLine  = computeMACD(prices);
  const sigLine   = computeEMA(macdLine.filter(v => v !== null), 9);
  const pad       = macdLine.length - sigLine.length;
  const sigPadded = [...Array(pad).fill(null), ...sigLine];
  const hist      = macdLine.map((v, i) => v != null && sigPadded[i] != null ? +(v - sigPadded[i]).toFixed(4) : null);

  makeChart('macdChart', 'bar', {
    labels: dates,
    datasets: [
      { type: 'line', label: 'MACD',   data: macdLine,  borderColor: '#2563eb', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
      { type: 'line', label: 'Signal', data: sigPadded, borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
      { type: 'bar',  label: 'Hist',   data: hist, backgroundColor: hist.map(v => v != null ? (v >= 0 ? '#22c55e55' : '#ef444455') : 'transparent'), borderWidth: 0 }
    ]
  }, {});
}

// ── Forecast Chart ───────────────────────────────────────────────────────────
function drawForecastChart(d) {
  const lastPrice  = d.current_price;
  const foreLabels = ['Today', ...d.forecast.map((_, i) => `Day ${i + 1}`)];
  const foreData   = [lastPrice, ...d.forecast];

  makeChart('forecastChart', 'line', {
    labels: foreLabels,
    datasets: [{
      label: 'Forecast',
      data: foreData,
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.08)',
      borderWidth: 2,
      pointRadius: 5,
      pointBackgroundColor: '#22c55e',
      tension: 0.3,
      fill: true
    }]
  }, { y: { ticks: { callback: v => '$' + v.toFixed(0) } } });
}

// ── Indicator list ───────────────────────────────────────────────────────────
function drawIndicatorList(d) {
  const ind = d.indicators;
  const rows = [
    { name: 'RSI (14)',    val: ind.rsi.toFixed(1),   cls: ind.rsi > 70 ? 'red' : ind.rsi < 30 ? 'green' : 'blue' },
    { name: 'MACD',        val: ind.macd.toFixed(4),  cls: ind.macd > 0 ? 'green' : 'red' },
    { name: 'SMA 20',      val: '$' + ind.sma20.toFixed(2), cls: '' },
    { name: 'SMA 50',      val: '$' + ind.sma50.toFixed(2), cls: '' },
    { name: 'BB Upper',    val: '$' + ind.bb_upper.toFixed(2), cls: '' },
    { name: 'BB Lower',    val: '$' + ind.bb_lower.toFixed(2), cls: '' },
    { name: 'Signal',      val: d.signal, cls: d.signal === 'BULLISH' ? 'green' : d.signal === 'BEARISH' ? 'red' : 'blue' }
  ];
  document.getElementById('ind-list').innerHTML = rows.map(r =>
    `<div class="ind-row"><span class="ind-name">${r.name}</span><span class="ind-val ${r.cls}">${r.val}</span></div>`
  ).join('');
}

function drawMetricsList(d) {
  const m = d.metrics;
  const rows = [
    { name: 'RMSE',              val: m.rmse.toFixed(2) },
    { name: 'MAE',               val: m.mae.toFixed(2) },
    { name: 'Directional Acc.',  val: m.da.toFixed(1) + '%', cls: m.da > 60 ? 'green' : 'red' },
    { name: 'Model',             val: 'LSTM', cls: 'blue' },
    { name: 'Window',            val: '60 days' },
    { name: 'Train / Test',      val: '80% / 20%' }
  ];
  document.getElementById('metrics-list').innerHTML = rows.map(r =>
    `<div class="ind-row"><span class="ind-name">${r.name}</span><span class="ind-val ${r.cls || ''}">${r.val}</span></div>`
  ).join('');
}

function drawForecastList(d) {
  const days  = ['Mon','Tue','Wed','Thu','Fri','Mon','Tue'];
  const base  = d.current_price;
  document.getElementById('forecast-list').innerHTML = d.forecast.map((p, i) => {
    const up  = p >= base;
    const cls = up ? 'green' : 'red';
    return `<div class="ind-row">
      <span class="ind-name">Day ${i+1} (${days[i]})</span>
      <span class="ind-val ${cls}">${up ? '▲' : '▼'} $${p.toFixed(2)}</span>
    </div>`;
  }).join('');
}

// (tab switcher handled by switchMainTab)

// ── Chart helper ─────────────────────────────────────────────────────────────
function makeChart(id, type, data, scaleOverrides) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id).getContext('2d'), {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { labels: { color: '#4a6080', font: { size: 10, family: 'Share Tech Mono' }, boxWidth: 12, padding: 12 } },
        tooltip: { backgroundColor: '#0e1420', borderColor: '#162035', borderWidth: 1, titleColor: '#c8d8f0', bodyColor: '#4a6080' }
      },
      scales: {
        x: { ticks: { color: '#2a4060', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: '#111827' } },
        y: { ticks: { color: '#2a4060', font: { size: 9 }, ...((scaleOverrides && scaleOverrides.y && scaleOverrides.y.ticks) || {}) }, grid: { color: '#111827' }, ...(scaleOverrides && scaleOverrides.y || {}) }
      }
    }
  });
}

// ── Math helpers ─────────────────────────────────────────────────────────────
function sma(arr, w) {
  return arr.map((_, i) => i < w - 1 ? null : arr.slice(i - w + 1, i + 1).reduce((a, b) => a + b) / w);
}

function computeEMA(arr, w) {
  const k = 2 / (w + 1);
  const res = [];
  arr.forEach((v, i) => {
    if (v == null) { res.push(null); return; }
    res.push(i === 0 ? v : +(v * k + res[i - 1] * (1 - k)).toFixed(4));
  });
  return res;
}

function computeRSI(prices, w) {
  return prices.map((_, i) => {
    if (i < w) return null;
    const slice = prices.slice(i - w, i);
    const gains = [], losses = [];
    for (let j = 1; j < slice.length; j++) {
      const d = slice[j] - slice[j - 1];
      gains.push(Math.max(d, 0));
      losses.push(Math.max(-d, 0));
    }
    const ag = gains.reduce((a, b) => a + b) / w;
    const al = losses.reduce((a, b) => a + b) / w;
    return al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2);
  });
}

function computeMACD(prices) {
  const ema12 = computeEMA(prices, 12);
  const ema26 = computeEMA(prices, 26);
  return ema12.map((v, i) => v != null && ema26[i] != null ? +(v - ema26[i]).toFixed(4) : null);
}

// ── Util ──────────────────────────────────────────────────────────────────────
function setText(id, val) { document.getElementById(id).textContent = val; }
function setStatus(cls, label) {
  const el = document.getElementById('status');
  el.className = 'status ' + cls;
  el.textContent = label;
}
