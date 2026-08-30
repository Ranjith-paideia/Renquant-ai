import type { PriceBar } from './market-data';

export type BacktestTrade = {
  entryTime: number;
  exitTime: number;
  entry: number;
  exit: number;
  quantity: number;
  pnl: number;
  costs: number;
  reason: 'signal' | 'stop' | 'end';
};

export type BacktestResult = {
  initialCapital: number;
  finalCapital: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  winRatePct: number;
  expectancy: number;
  totalCosts: number;
  rejectedOrders: number;
  trades: BacktestTrade[];
  equityCurve: Array<{ time: number; value: number }>;
};

export type BacktestConfig = {
  initialCapital: number;
  fastPeriod: number;
  slowPeriod: number;
  riskPerTradePct: number;
  stopLossPct: number;
  maxPositionPct: number;
  slippageBps: number;
};

const DEFAULTS: BacktestConfig = {
  initialCapital: 100_000,
  fastPeriod: 10,
  slowPeriod: 30,
  riskPerTradePct: 0.5,
  stopLossPct: 2,
  maxPositionPct: 20,
  slippageBps: 5,
};

function average(bars: PriceBar[], end: number, period: number) {
  if (end + 1 < period) return null;
  let sum = 0;
  for (let index = end - period + 1; index <= end; index += 1) sum += bars[index].close;
  return sum / period;
}

function roundTripCost(notional: number) {
  const brokerage = Math.min(40, notional * 0.0006);
  const statutory = notional * 0.00052;
  return brokerage + statutory;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

export function runEventDrivenBacktest(bars: PriceBar[], partial: Partial<BacktestConfig> = {}): BacktestResult {
  const config = { ...DEFAULTS, ...partial };
  if (bars.length < config.slowPeriod + 2) throw new Error('Not enough bars for the selected slow period.');
  if (config.fastPeriod >= config.slowPeriod) throw new Error('Fast period must be below slow period.');
  let cash = config.initialCapital;
  let quantity = 0;
  let entry = 0;
  let entryTime = 0;
  let entryCosts = 0;
  let pending: 'enter' | 'exit' | null = null;
  let rejectedOrders = 0;
  let totalCosts = 0;
  let peak = cash;
  let maxDrawdownPct = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ time: number; value: number }> = [];
  const dailyReturns: number[] = [];
  let previousEquity = cash;

  for (let index = config.slowPeriod; index < bars.length; index += 1) {
    const bar = bars[index];
    const slippage = config.slippageBps / 10_000;

    if (pending === 'enter' && quantity === 0) {
      const fill = bar.open * (1 + slippage);
      const riskBudget = cash * (config.riskPerTradePct / 100);
      const riskQuantity = Math.floor(riskBudget / (fill * config.stopLossPct / 100));
      const capitalQuantity = Math.floor((cash * config.maxPositionPct / 100) / fill);
      const proposed = Math.min(riskQuantity, capitalQuantity);
      const costs = roundTripCost(fill * proposed) / 2;
      if (proposed < 1 || fill * proposed + costs > cash) {
        rejectedOrders += 1;
      } else {
        quantity = proposed;
        entry = fill;
        entryTime = bar.time;
        entryCosts = costs;
        cash -= fill * quantity + costs;
        totalCosts += costs;
      }
      pending = null;
    }

    const stop = entry * (1 - config.stopLossPct / 100);
    const stopped = quantity > 0 && bar.low <= stop;
    if ((pending === 'exit' || stopped) && quantity > 0) {
      const rawExit = stopped ? stop : bar.open;
      const fill = rawExit * (1 - slippage);
      const exitCosts = roundTripCost(fill * quantity) / 2;
      const pnl = (fill - entry) * quantity - entryCosts - exitCosts;
      cash += fill * quantity - exitCosts;
      totalCosts += exitCosts;
      trades.push({ entryTime, exitTime: bar.time, entry, exit: fill, quantity, pnl, costs: entryCosts + exitCosts, reason: stopped ? 'stop' : 'signal' });
      quantity = 0;
      pending = null;
    }

    const fast = average(bars, index, config.fastPeriod);
    const slow = average(bars, index, config.slowPeriod);
    const previousFast = average(bars, index - 1, config.fastPeriod);
    const previousSlow = average(bars, index - 1, config.slowPeriod);
    if (fast !== null && slow !== null && previousFast !== null && previousSlow !== null) {
      if (quantity === 0 && previousFast <= previousSlow && fast > slow) pending = 'enter';
      if (quantity > 0 && previousFast >= previousSlow && fast < slow) pending = 'exit';
    }

    const equity = cash + quantity * bar.close;
    peak = Math.max(peak, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - equity) / peak) * 100);
    if (previousEquity > 0) dailyReturns.push(equity / previousEquity - 1);
    previousEquity = equity;
    equityCurve.push({ time: bar.time, value: equity });
  }

  if (quantity > 0) {
    const bar = bars.at(-1)!;
    const fill = bar.close * (1 - config.slippageBps / 10_000);
    const exitCosts = roundTripCost(fill * quantity) / 2;
    const pnl = (fill - entry) * quantity - entryCosts - exitCosts;
    cash += fill * quantity - exitCosts;
    totalCosts += exitCosts;
    trades.push({ entryTime, exitTime: bar.time, entry, exit: fill, quantity, pnl, costs: entryCosts + exitCosts, reason: 'end' });
    equityCurve[equityCurve.length - 1] = { time: bar.time, value: cash };
  }

  const wins = trades.filter((trade) => trade.pnl > 0);
  const deviation = standardDeviation(dailyReturns);
  const meanReturn = dailyReturns.length ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length : 0;
  return {
    initialCapital: config.initialCapital,
    finalCapital: cash,
    totalReturnPct: (cash / config.initialCapital - 1) * 100,
    maxDrawdownPct,
    sharpe: deviation > 0 ? (meanReturn / deviation) * Math.sqrt(365) : 0,
    winRatePct: trades.length ? wins.length / trades.length * 100 : 0,
    expectancy: trades.length ? trades.reduce((sum, trade) => sum + trade.pnl, 0) / trades.length : 0,
    totalCosts,
    rejectedOrders,
    trades,
    equityCurve,
  };
}

export function monteCarloLossProbability(trades: BacktestTrade[], initialCapital: number, iterations = 2_000) {
  if (!trades.length) return { lossProbabilityPct: 100, drawdown95Pct: 0 };
  const finalReturns: number[] = [];
  const drawdowns: number[] = [];
  let state = 0x9e3779b9;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4_294_967_296; };
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const shuffled = [...trades];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    let equity = initialCapital;
    let peak = equity;
    let maxDrawdown = 0;
    shuffled.forEach((trade) => { equity += trade.pnl; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100); });
    finalReturns.push((equity / initialCapital - 1) * 100);
    drawdowns.push(maxDrawdown);
  }
  drawdowns.sort((a, b) => a - b);
  return { lossProbabilityPct: finalReturns.filter((value) => value < 0).length / iterations * 100, drawdown95Pct: drawdowns[Math.floor(iterations * 0.95)] ?? 0 };
}
