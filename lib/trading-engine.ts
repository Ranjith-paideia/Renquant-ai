export type Market = 'Equity' | 'Crypto' | 'Forex' | 'Futures' | 'Options';

export type CostModel = {
  brokerage: number;
  taxesAndFees: number;
  spread: number;
  slippage: number;
  total: number;
};

export type Opportunity = {
  symbol: string;
  market: Market;
  expectedValue: number;
  confidence: number;
  liquidity: number;
  probability: number;
  riskReward: number;
};

export function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function deriveBalancePolicy(balance: number) {
  if (balance < 500) {
    return {
      tier: 'Preserve',
      maxTrades: 0,
      riskPerTradePct: 0,
      dailyLossPct: 0,
      leverage: 1,
      eligible: ['Research only'],
      blocked: ['All instruments — capital below cost floor'],
    };
  }
  if (balance < 5_000) {
    return {
      tier: 'Micro',
      maxTrades: 1,
      riskPerTradePct: 0.5,
      dailyLossPct: 1,
      leverage: 1,
      eligible: ['Liquid cash equities', 'Crypto spot (paper)'],
      blocked: ['Intraday', 'Forex', 'Futures', 'Options'],
    };
  }
  if (balance < 25_000) {
    return {
      tier: 'Foundation',
      maxTrades: 2,
      riskPerTradePct: 0.65,
      dailyLossPct: 1.3,
      leverage: 1,
      eligible: ['Liquid cash equities', 'Swing stocks', 'Crypto spot (paper)'],
      blocked: ['Futures', 'Naked options', 'Leveraged forex'],
    };
  }
  if (balance < 100_000) {
    return {
      tier: 'Growth',
      maxTrades: 3,
      riskPerTradePct: 0.75,
      dailyLossPct: 1.5,
      leverage: 1.25,
      eligible: ['Equities', 'Swing stocks', 'Defined-risk options (paper)', 'Currency futures (paper)'],
      blocked: ['Naked options', 'High leverage', 'Illiquid contracts'],
    };
  }
  return {
    tier: 'Diversified',
    maxTrades: 4,
    riskPerTradePct: 0.8,
    dailyLossPct: 1.6,
    leverage: 1.5,
    eligible: ['Equities', 'Crypto spot', 'Forex', 'Futures', 'Defined-risk options'],
    blocked: ['Naked options', 'Borrowed capital', 'Illiquid contracts'],
  };
}

export function estimateRoundTripCosts(notional: number, market: Market = 'Equity'): CostModel {
  const rate = market === 'Options' ? 0.0014 : market === 'Crypto' ? 0.002 : 0.0006;
  const brokerage = market === 'Options' ? 40 : Math.min(40, notional * rate);
  const taxesAndFees = notional * (market === 'Crypto' ? 0.001 : 0.00052);
  const spread = notional * (market === 'Crypto' ? 0.0008 : 0.00035);
  const slippage = notional * (market === 'Crypto' ? 0.001 : 0.00055);
  const total = brokerage + taxesAndFees + spread + slippage;
  return { brokerage, taxesAndFees, spread, slippage, total };
}

function normalCdf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * a);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return 0.5 * (1 + sign * erf);
}

export function calculateFeasibility({
  balance,
  target = 1_000,
  market = 'Equity',
  expectedDailyEdgePct = 0.08,
  dailyVolatilityPct = 1.4,
}: {
  balance: number;
  target?: number;
  market?: Market;
  expectedDailyEdgePct?: number;
  dailyVolatilityPct?: number;
}) {
  const costs = estimateRoundTripCosts(Math.max(balance * 0.6, 0), market);
  const requiredReturnPct = balance > 0 ? ((target + costs.total) / balance) * 100 : Infinity;
  const z = (requiredReturnPct - expectedDailyEdgePct) / dailyVolatilityPct;
  const probabilityPct = Math.max(0, Math.min(100, (1 - normalCdf(z)) * 100));
  const expectedGross = balance * (expectedDailyEdgePct / 100);
  const expectedNet = expectedGross - costs.total;
  const feasible = balance >= 500 && expectedNet > 0 && probabilityPct >= 5 && requiredReturnPct <= 3;
  return { costs, requiredReturnPct, probabilityPct, expectedNet, feasible };
}

export function rankOpportunity(item: Opportunity) {
  const evScore = Math.max(0, Math.min(100, 50 + item.expectedValue * 10));
  const rrScore = Math.max(0, Math.min(100, item.riskReward * 30));
  return Math.round(
    evScore * 0.28 +
      item.confidence * 0.24 +
      item.liquidity * 0.18 +
      item.probability * 0.18 +
      rrScore * 0.12,
  );
}

export function shouldHaltRisk({
  dailyLossPct,
  drawdownPct,
  consecutiveLosses,
  confidence,
  liquidity,
  adverseNews,
}: {
  dailyLossPct: number;
  drawdownPct: number;
  consecutiveLosses: number;
  confidence: number;
  liquidity: number;
  adverseNews: boolean;
}) {
  const reasons: string[] = [];
  if (dailyLossPct >= 1.5) reasons.push('Daily loss limit');
  if (drawdownPct >= 8) reasons.push('Drawdown limit');
  if (consecutiveLosses >= 3) reasons.push('Consecutive-loss limit');
  if (confidence < 60) reasons.push('Confidence deterioration');
  if (liquidity < 65) reasons.push('Liquidity deterioration');
  if (adverseNews) reasons.push('Adverse-news trigger');
  return { halt: reasons.length > 0, reasons };
}
