import assert from 'node:assert/strict';
import test from 'node:test';
/* oxlint-disable typescript/no-floating-promises -- node:test registers tests synchronously */
import {
  calculateFeasibility,
  deriveBalancePolicy,
  rankOpportunity,
  shouldHaltRisk,
} from './trading-engine.ts';

test('micro balance blocks derivatives and limits trade count', () => {
  const policy = deriveBalancePolicy(2_840);
  assert.equal(policy.tier, 'Micro');
  assert.equal(policy.maxTrades, 1);
  assert.ok(policy.blocked.includes('Options'));
});

test('₹1,000 target is rejected for a micro account after costs', () => {
  const result = calculateFeasibility({ balance: 2_840, target: 1_000 });
  assert.equal(result.feasible, false);
  assert.ok(result.requiredReturnPct > 35);
  assert.ok(result.expectedNet < 0);
});

test('opportunity score rewards validation quality and liquidity', () => {
  const strong = rankOpportunity({ symbol: 'A', market: 'Equity', expectedValue: 1.2, confidence: 84, liquidity: 94, probability: 61, riskReward: 2.4 });
  const weak = rankOpportunity({ symbol: 'B', market: 'Equity', expectedValue: -0.4, confidence: 48, liquidity: 44, probability: 42, riskReward: 1.1 });
  assert.ok(strong > weak);
});

test('risk governor halts on any hard trigger', () => {
  const result = shouldHaltRisk({ dailyLossPct: 0.2, drawdownPct: 2, consecutiveLosses: 3, confidence: 72, liquidity: 88, adverseNews: false });
  assert.equal(result.halt, true);
  assert.deepEqual(result.reasons, ['Consecutive-loss limit']);
});
