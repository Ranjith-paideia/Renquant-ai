'use client';
/* oxlint-disable react/react-compiler -- hydration intentionally synchronizes external localStorage state */

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CircleStop,
  ExternalLink,
  FlaskConical,
  Gauge,
  History,
  LayoutDashboard,
  LineChart,
  LockKeyhole,
  Menu,
  Newspaper,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  WalletCards,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  calculateFeasibility,
  deriveBalancePolicy,
  estimateRoundTripCosts,
  money,
  rankOpportunity,
  type Opportunity,
} from '@/lib/trading-engine';
import { localVaultExists, openEncryptedVault, type VaultHandle } from '@/lib/encrypted-vault';
import type { BacktestResult } from '@/lib/backtest-engine';
import type { MarketQuote, PriceBar } from '@/lib/market-data';

const nav = [
  [LayoutDashboard, 'Overview', true],
  [Activity, 'Opportunities', false],
  [FlaskConical, 'Strategy lab', false],
  [BarChart3, 'Paper trading', false],
  [WalletCards, 'Portfolio', false],
  [BookOpen, 'Journal', false],
  [LockKeyhole, 'Data vault', false],
  [Newspaper, 'Research', false],
] as const;

const equity = [22, 26, 24, 29, 33, 30, 38, 42, 39, 46, 49, 54, 52, 59, 63, 68, 66, 74, 78, 83];

export default function Home() {
  const [active, setActive] = useState('Overview');
  const [balance, setBalance] = useState(2_840);
  const [deposits, setDeposits] = useState(2_600);
  const [contribution, setContribution] = useState(50);
  const [carryForward, setCarryForward] = useState(190);
  const [killed, setKilled] = useState(false);
  const [resumeReview, setResumeReview] = useState(false);
  const [journal, setJournal] = useState([
    'Passed on BTC momentum: spread widened and confidence fell below 65.',
    'No trades. Target feasibility gate correctly stayed closed.',
  ]);
  const [audit, setAudit] = useState([
    '20:06 · Session gate blocked new orders — negative expected net result',
    '20:05 · Balance policy updated to Micro tier',
    '19:58 · Demo market snapshot loaded locally',
  ]);
  const [hydrated, setHydrated] = useState(false);
  const [vault, setVault] = useState<VaultHandle | null>(null);
  const [vaultStatus, setVaultStatus] = useState<'checking' | 'new' | 'locked' | 'unlocked' | 'error'>('checking');
  const [vaultError, setVaultError] = useState('');
  const points = equity.map((value, index) => `${(index / (equity.length - 1)) * 100},${100 - value}`).join(' ');
  const policy = useMemo(() => deriveBalancePolicy(balance), [balance]);
  const feasibility = useMemo(() => calculateFeasibility({ balance, target: 1_000 }), [balance]);
  const genuineProfit = balance - deposits;

  useEffect(() => {
    void localVaultExists().then((exists) => setVaultStatus(exists ? 'locked' : 'new')).catch(() => setVaultStatus('error'));
    const raw = window.localStorage.getItem('aegis-alpha-v1');
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { balance?: number; deposits?: number; carryForward?: number; journal?: string[]; audit?: string[]; killed?: boolean };
        if (typeof saved.balance === 'number') setBalance(saved.balance);
        if (typeof saved.deposits === 'number') setDeposits(saved.deposits);
        if (typeof saved.carryForward === 'number') setCarryForward(saved.carryForward);
        if (Array.isArray(saved.journal)) setJournal(saved.journal);
        if (Array.isArray(saved.audit)) setAudit(saved.audit);
        if (typeof saved.killed === 'boolean') setKilled(saved.killed);
      } catch { /* Ignore corrupt local demo state and keep safe defaults. */ }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !vault) return;
    const timeout = window.setTimeout(() => {
      void vault.save({ balance, deposits, carryForward, journal, audit, killed }).catch((error: unknown) => {
        setVaultError(error instanceof Error ? error.message : 'Encrypted vault write failed.');
        setVaultStatus('error');
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [audit, balance, carryForward, deposits, hydrated, journal, killed, vault]);

  async function unlockVault(passphrase: string) {
    setVaultError('');
    try {
      const handle = await openEncryptedVault(passphrase);
      const snapshot = handle.load();
      if (snapshot) {
        setBalance(snapshot.balance);
        setDeposits(snapshot.deposits);
        setCarryForward(snapshot.carryForward);
        setKilled(snapshot.killed);
        setJournal(snapshot.journal);
        setAudit(snapshot.audit);
      } else {
        await handle.save({ balance, deposits, carryForward, killed, journal, audit });
      }
      window.localStorage.removeItem('aegis-alpha-v1');
      setVault(handle);
      setVaultStatus('unlocked');
      addAudit('Encrypted SQLite vault unlocked; passphrase retained in memory only');
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : 'Unable to unlock local vault.');
      setVaultStatus('error');
    }
  }

  function lockVault() {
    vault?.close();
    setVault(null);
    setVaultStatus('locked');
    setActive('Data vault');
  }

  function addAudit(message: string) {
    setAudit((items) => [`Now · ${message}`, ...items].slice(0, 20));
  }

  function addContribution() {
    const amount = Math.max(10, Math.min(100, contribution));
    setBalance((value) => value + amount);
    setDeposits((value) => value + amount);
    setCarryForward((value) => Math.max(0, value - amount));
    addAudit(`₹${amount} contribution recorded separately from profit`);
  }

  function triggerKillSwitch() {
    setKilled(true);
    setResumeReview(false);
    addAudit('EMERGENCY HALT — pending orders cancelled; simulated exposure flattened');
  }

  function approveResume() {
    setKilled(false);
    setResumeReview(false);
    addAudit('Paper session resumed after explicit approval');
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[238px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/8 bg-[#091019] p-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid size-9 place-items-center rounded-xl bg-[#d7ff64] text-[#0a1118] shadow-[0_0_28px_rgba(215,255,100,.18)]">
              <Zap className="size-5" fill="currentColor" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">REN</div>
              <div className="text-[10px] uppercase tracking-[.18em] text-slate-500">Research terminal</div>
            </div>
          </div>

          <nav className="mt-8 space-y-1" aria-label="Primary navigation">
            {nav.map(([Icon, label]) => (
              <button key={label} onClick={() => setActive(label)} className={`nav-item ${active === label ? 'nav-active' : ''}`}>
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>

          <button onClick={() => setActive('Data vault')} className="mt-auto rounded-2xl border border-white/8 bg-white/[.035] p-4 text-left transition-colors hover:bg-white/[.06]">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <LockKeyhole className="size-3.5 text-[#d7ff64]" /> Local vault
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{vaultStatus === 'unlocked' ? 'SQLite encrypted and open for this session.' : 'Unlock to persist journals and capital locally.'}</p>
            <div className={`mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wider ${vaultStatus === 'unlocked' ? 'text-[#d7ff64]' : 'text-amber-300'}`}>
              <span className={`size-1.5 rounded-full ${vaultStatus === 'unlocked' ? 'bg-[#d7ff64]' : 'bg-amber-300'}`} /> {vaultStatus === 'unlocked' ? 'Encrypted on device' : 'Vault locked'}
            </div>
          </button>
        </aside>

        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b border-white/8 bg-[#0d151f]/90 px-4 backdrop-blur-xl sm:px-7">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu /></Button>
              <div>
                <h1 className="text-sm font-semibold">Good evening, Arjun</h1>
                <p className="hidden text-xs text-slate-500 sm:block">Friday, 29 August · Indian markets closed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-amber-400/25 bg-amber-400/8 text-amber-300">
                <span className="size-1.5 rounded-full bg-amber-300" /> Paper trading
              </Badge>
              <Button variant="ghost" size="icon" aria-label="Notifications"><Bell /></Button>
              <Button variant="destructive" className="border border-red-400/20" onClick={triggerKillSwitch}>
                <CircleStop /> {killed ? 'Halted' : 'Kill switch'}
              </Button>
            </div>
          </header>

          {active === 'Overview' ? <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-7">
            {killed && (
              <div className="flex flex-col gap-3 rounded-xl border border-red-400/25 bg-red-400/8 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-300" /><div><div className="font-medium text-red-200">Emergency halt is active</div><p className="mt-1 text-xs text-red-200/65">New trades are blocked, pending orders are cancelled, and simulated exposure is flat.</p></div></div>
                {resumeReview ? <Button variant="outline" onClick={approveResume}><RotateCcw /> Approve paper resume</Button> : <Button variant="outline" onClick={() => setResumeReview(true)}>Review resume</Button>}
              </div>
            )}
            <section className="grid gap-4 xl:grid-cols-[1.55fr_.8fr]">
              <Card className="risk-card border-0 ring-0">
                <CardContent className="flex h-full flex-col justify-between gap-5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="eyebrow">Session readiness</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="size-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.7)]" />
                        <h2 className="text-xl font-semibold tracking-tight">Observe only — no positive edge</h2>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Your {money(balance)} balance cannot support today&apos;s ₹1,000 aspiration without a {feasibility.requiredReturnPct.toFixed(1)}% net return. Costs and risk make that infeasible.</p>
                    </div>
                    <Badge className="bg-amber-300/10 text-amber-300">Trading paused</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['Required return', `${feasibility.requiredReturnPct.toFixed(1)}%`, 'Very high'],
                      ['Model probability', feasibility.probabilityPct < 0.1 ? '<0.1%' : `${feasibility.probabilityPct.toFixed(1)}%`, 'Illustrative estimate'],
                      ['Expected net', money(feasibility.expectedNet), feasibility.expectedNet > 0 ? 'Positive' : 'After modeled costs'],
                      ['Allowed risk', money(balance * policy.riskPerTradePct / 100), `${policy.riskPerTradePct}% max`],
                    ].map(([label, value, note]) => (
                      <div key={label} className="rounded-xl border border-white/8 bg-black/15 p-3">
                        <div className="text-[10px] uppercase tracking-[.12em] text-slate-500">{label}</div>
                        <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
                        <div className="text-[11px] text-slate-500">{note}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111b27]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="eyebrow">Daily contribution</div>
                      <CardTitle className="mt-1 text-2xl">₹{contribution} <span className="text-xs font-normal text-slate-500">today</span></CardTitle>
                    </div>
                    <div className="grid size-10 place-items-center rounded-xl bg-[#d7ff64]/10 text-[#d7ff64]"><WalletCards /></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <input aria-label="Daily contribution" type="range" min="10" max="100" step="10" value={contribution} onChange={(event) => setContribution(Number(event.target.value))} className="accent-[#d7ff64] w-full" />
                  <div className="mt-2 flex justify-between text-[11px] text-slate-500"><span>₹10</span><span>₹100 max</span></div>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-white/[.035] px-3 py-2 text-xs"><span className="text-slate-400">Carry-forward: {money(carryForward)}</span><Button size="xs" onClick={addContribution}>Add funds</Button></div>
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Account value', money(balance), '+₹86.40', true],
                ['Net deposits', money(deposits), `${Math.round((deposits / balance) * 100)}% of value`, true],
                ['Genuine profit', money(genuineProfit), `${((genuineProfit / deposits) * 100).toFixed(2)}%`, genuineProfit >= 0],
                ['Today P&L', '₹0.00', 'No trades', false],
              ].map(([label, value, delta, positive]) => (
                <Card key={String(label)} size="sm" className="bg-[#111b27]">
                  <CardContent>
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
                    <div className={`mt-1 flex items-center gap-1 text-xs ${positive ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{delta}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
              <Card className="bg-[#111b27]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div><div className="eyebrow">Portfolio curve</div><CardTitle className="mt-1">Capital vs. contributions</CardTitle></div>
                    <div className="flex gap-4 text-[11px] text-slate-500"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#d7ff64]" />Equity</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-slate-600" />Deposits</span></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="chart-grid relative h-48 overflow-hidden rounded-xl border border-white/6 bg-[#0c151f]">
                    <div className="absolute left-4 top-4 z-10"><div className="text-2xl font-semibold">{money(balance)}</div><div className="text-xs text-emerald-400">+3.14% this month</div></div>
                    <svg className="absolute inset-x-0 bottom-0 h-40 w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Portfolio equity curve">
                      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d7ff64" stopOpacity=".25"/><stop offset="1" stopColor="#d7ff64" stopOpacity="0"/></linearGradient></defs>
                      <polygon points={`0,100 ${points} 100,100`} fill="url(#area)" />
                      <polyline points={points} fill="none" stroke="#d7ff64" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                      <polyline points="0,91 15,87 30,83 45,79 60,75 75,71 100,65" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111b27]">
                <CardHeader><div className="flex items-center justify-between"><div><div className="eyebrow">Risk governor</div><CardTitle className="mt-1">All limits healthy</CardTitle></div><ShieldCheck className="size-5 text-emerald-400" /></div></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    ['Daily loss', `₹0 / ${money(balance * policy.dailyLossPct / 100)}`, 0],
                    ['Open risk', `₹0 / ${money(balance * policy.riskPerTradePct / 100)}`, 0],
                    ['Drawdown', '1.8% / 8%', 23],
                    ['Consecutive losses', '1 / 3', 33],
                  ].map(([name, value, progress]) => (
                    <div key={String(name)}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">{name}</span><span>{value}</span></div><Progress value={progress as number} className="[&_[data-slot=progress-indicator]]:bg-emerald-400" /></div>
                  ))}
                  <div className="flex gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-300"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> New orders remain blocked by the feasibility gate.</div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {[
                ['NIFTY 50 pullback', 'Swing equity', '78', 'Watch', '1 : 2.4'],
                ['BTC momentum', 'Crypto spot', '64', 'Reject', '1 : 1.6'],
                ['USDINR compression', 'FX futures', '58', 'Ineligible', '1 : 2.0'],
              ].map(([name, market, score, status, rr]) => (
                <Card key={name} className="bg-[#111b27]">
                  <CardContent>
                    <div className="flex items-start justify-between"><div><div className="font-medium">{name}</div><div className="mt-1 text-xs text-slate-500">{market}</div></div><Badge variant="outline" className="border-white/10">{status}</Badge></div>
                    <div className="mt-5 grid grid-cols-2 gap-3"><div><div className="eyebrow">Confidence</div><div className="mt-1 text-lg font-semibold">{score}<span className="text-xs text-slate-500">/100</span></div></div><div><div className="eyebrow">Risk / reward</div><div className="mt-1 text-lg font-semibold">{rr}</div></div></div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-[#0d151f] p-4 text-xs leading-5 text-slate-500">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <p>₹1,000/day is an aspiration, not a promise. Aegis Alpha will prefer no trade to a low-quality trade and never borrows, risks the full account, or increases leverage to chase a target.</p>
            </div>
          </div> : <WorkspaceView active={active} balance={balance} deposits={deposits} policy={policy} killed={killed} journal={journal} setJournal={setJournal} audit={audit} addAudit={addAudit} vaultStatus={vaultStatus} vaultError={vaultError} unlockVault={unlockVault} lockVault={lockVault} />}
        </section>
      </div>
    </main>
  );
}

const opportunitySeed: Opportunity[] = [
  { symbol: 'NIFTYBEES', market: 'Equity', expectedValue: 0.86, confidence: 78, liquidity: 96, probability: 62, riskReward: 2.4 },
  { symbol: 'RELIANCE', market: 'Equity', expectedValue: 0.48, confidence: 71, liquidity: 98, probability: 58, riskReward: 2.1 },
  { symbol: 'BTC-INR', market: 'Crypto', expectedValue: 0.31, confidence: 64, liquidity: 82, probability: 55, riskReward: 1.6 },
  { symbol: 'USDINR', market: 'Forex', expectedValue: 0.12, confidence: 58, liquidity: 91, probability: 53, riskReward: 2.0 },
  { symbol: 'NIFTY 25000 CE', market: 'Options', expectedValue: -0.22, confidence: 51, liquidity: 74, probability: 42, riskReward: 1.3 },
  { symbol: 'GOLDM', market: 'Futures', expectedValue: 0.21, confidence: 61, liquidity: 77, probability: 54, riskReward: 1.8 },
];

type Policy = ReturnType<typeof deriveBalancePolicy>;

function PageTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="mb-6"><div className="eyebrow">{eyebrow}</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{detail}</p></div>;
}

function WorkspaceView({
  active,
  balance,
  deposits,
  policy,
  killed,
  journal,
  setJournal,
  audit,
  addAudit,
  vaultStatus,
  vaultError,
  unlockVault,
  lockVault,
}: {
  active: string;
  balance: number;
  deposits: number;
  policy: Policy;
  killed: boolean;
  journal: string[];
  setJournal: React.Dispatch<React.SetStateAction<string[]>>;
  audit: string[];
  addAudit: (message: string) => void;
  vaultStatus: 'checking' | 'new' | 'locked' | 'unlocked' | 'error';
  vaultError: string;
  unlockVault: (passphrase: string) => Promise<void>;
  lockVault: () => void;
}) {
  const [note, setNote] = useState('');
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [marketState, setMarketState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [marketMessage, setMarketMessage] = useState('');
  const [backtestState, setBacktestState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<{ lossProbabilityPct: number; drawdown95Pct: number } | null>(null);
  const [backtestMessage, setBacktestMessage] = useState('');
  const ranked = [...opportunitySeed].sort((a, b) => rankOpportunity(b) - rankOpportunity(a));

  async function refreshMarkets() {
    setMarketState('loading');
    setMarketMessage('');
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'RELIANCE.BSE', 'EURUSD', 'WTI', 'IBM_OPTIONS'];
      const results = await Promise.all(symbols.map(async (symbol) => {
        const response = await fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
        const body = await response.json() as { quote?: MarketQuote; error?: string };
        return { symbol, response, body };
      }));
      const live = results.flatMap(({ body }) => body.quote ? [body.quote] : []);
      setQuotes(live);
      const unavailable = results.filter(({ body }) => !body.quote).length;
      setMarketMessage(`${live.length} live feeds refreshed; ${unavailable} licensed/keyed adapters remain safely unavailable.`);
      setMarketState(live.length ? 'ready' : 'error');
      addAudit(`Market-data refresh completed — ${live.length} live, ${unavailable} unavailable`);
    } catch (error) {
      setMarketState('error');
      setMarketMessage(error instanceof Error ? error.message : 'Market-data refresh failed.');
    }
  }

  async function runLiveBacktest() {
    setBacktestState('loading');
    setBacktestMessage('Loading one year of BTCUSDT daily bars from Binance…');
    try {
      const response = await fetch('/api/market-data?symbol=BTCUSDT&mode=history', { cache: 'no-store' });
      const body = await response.json() as { bars?: PriceBar[]; error?: string };
      if (!response.ok || !body.bars) throw new Error(body.error ?? 'Historical data unavailable.');
      const worker = new Worker(new URL('../lib/backtest.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: BacktestResult; monteCarlo?: { lossProbabilityPct: number; drawdown95Pct: number }; error?: string }>) => {
        if (event.data.ok && event.data.result && event.data.monteCarlo) {
          setBacktestResult(event.data.result);
          setMonteCarlo(event.data.monteCarlo);
          setBacktestState('ready');
          setBacktestMessage(`Completed on ${body.bars?.length ?? 0} real daily bars with next-bar fills.`);
          addAudit('Event-driven BTCUSDT backtest and Monte Carlo analysis completed');
        } else {
          setBacktestState('error');
          setBacktestMessage(event.data.error ?? 'Backtest worker failed.');
        }
        worker.terminate();
      };
      worker.onerror = () => { setBacktestState('error'); setBacktestMessage('Backtest worker crashed safely.'); worker.terminate(); };
      worker.postMessage({ bars: body.bars, initialCapital: Math.max(balance, 10_000) });
    } catch (error) {
      setBacktestState('error');
      setBacktestMessage(error instanceof Error ? error.message : 'Backtest failed.');
    }
  }

  if (active === 'Opportunities') {
    return (
      <div className="workspace">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><PageTitle eyebrow="Multi-asset scanner" title="Only the best validated setups survive" detail="The ranking blends expected value, confidence, liquidity, modeled probability and risk–reward. Eligibility and trade frequency are then constrained by your current balance tier." /><Button onClick={refreshMarkets} disabled={marketState === 'loading'} variant="outline"><Wifi /> {marketState === 'loading' ? 'Refreshing…' : 'Refresh live feeds'}</Button></div>
        <Card className="mb-4 bg-[#111b27]"><CardContent><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3">{marketState === 'ready' ? <Wifi className="size-4 text-emerald-400"/> : <WifiOff className="size-4 text-slate-500"/>}<div><div className="text-sm font-medium">Provider adapters</div><div className="mt-1 text-xs text-slate-500">{marketMessage || 'Binance public market data is ready; Alpha Vantage adapters require a server-side key.'}</div></div></div><div className="flex flex-wrap gap-2">{quotes.map((quote)=><Badge key={quote.symbol} variant="outline" className="border-emerald-400/20 text-emerald-300">{quote.symbol} {quote.price.toLocaleString('en-IN')} · {quote.changePct > 0 ? '+' : ''}{quote.changePct.toFixed(2)}%</Badge>)}</div></div></CardContent></Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          {[['Balance tier', policy.tier], ['Eligible now', String(policy.eligible.length)], ['Max trades', String(policy.maxTrades)], ['Max leverage', `${policy.leverage}×`]].map(([label, value]) => <Card key={label} size="sm" className="bg-[#111b27]"><CardContent><div className="eyebrow">{label}</div><div className="mt-2 text-xl font-semibold">{value}</div></CardContent></Card>)}
        </div>
        <Card className="bg-[#111b27]">
          <CardContent className="overflow-x-auto p-0">
            <table className="data-table min-w-[860px]">
              <thead><tr><th>Rank</th><th>Instrument</th><th>Market</th><th>EV / risk unit</th><th>Probability</th><th>Liquidity</th><th>R:R</th><th>Score</th><th>Decision</th></tr></thead>
              <tbody>{ranked.map((item, index) => {
                const score = rankOpportunity(item);
                const eligible = item.market === 'Equity' && score >= 70;
                return <tr key={item.symbol}><td className="text-slate-500">0{index + 1}</td><td className="font-medium">{item.symbol}</td><td>{item.market}</td><td className={item.expectedValue > 0 ? 'text-emerald-400' : 'text-red-300'}>{item.expectedValue > 0 ? '+' : ''}{item.expectedValue.toFixed(2)}R</td><td>{item.probability}%</td><td>{item.liquidity}/100</td><td>1:{item.riskReward}</td><td className="font-semibold">{score}</td><td><Badge variant="outline" className={eligible ? 'border-[#d7ff64]/25 text-[#d7ff64]' : 'border-white/10 text-slate-500'}>{eligible ? 'Watch only' : 'Rejected'}</Badge></td></tr>;
              })}</tbody>
            </table>
          </CardContent>
        </Card>
        <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-xs leading-5 text-amber-200/75">Scores are research aids, not forecasts. Current account policy permits only liquid cash-equity paper setups; the session feasibility gate still blocks order entry.</div>
      </div>
    );
  }

  if (active === 'Strategy lab') {
    const tests = [
      ['Realistic backtest', 'PASS', '4.8 years · fees, spreads, slippage, rejected fills', '1.31', '+0.42R'],
      ['Walk-forward', 'PASS', '8 folds · anchored training · 24% degradation', '1.08', '+0.29R'],
      ['Out-of-sample', 'PASS', 'Latest 9 months kept fully unseen', '0.96', '+0.24R'],
      ['Monte Carlo', 'CAUTION', '10,000 reshuffles · 95th percentile drawdown 11.7%', '0.82', '+0.18R'],
      ['Paper trading', 'RUNNING', '41 of 100 minimum forward observations', '0.71', '+0.14R'],
    ];
    return <div className="workspace">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><PageTitle eyebrow="Validation pipeline" title="Evidence before execution" detail="A strategy cannot graduate until costs, unseen data, multiple regimes, Monte Carlo uncertainty, and a forward paper-trading sample all clear thresholds." /><Button onClick={runLiveBacktest} disabled={backtestState === 'loading'}><Play /> {backtestState === 'loading' ? 'Running…' : 'Run real-data backtest'}</Button></div>
      <Card className={`mb-4 ${backtestState === 'error' ? 'border-red-400/20 bg-red-400/5' : 'bg-[#111b27]'}`}><CardContent><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="eyebrow">Event-driven worker</div><div className="mt-1 text-sm">{backtestMessage || 'Ready for Binance BTCUSDT daily history. No synthetic bars are used in this run.'}</div></div>{backtestResult && <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-5">{[['Return',`${backtestResult.totalReturnPct.toFixed(2)}%`],['Drawdown',`${backtestResult.maxDrawdownPct.toFixed(2)}%`],['Trades',String(backtestResult.trades.length)],['Costs',money(backtestResult.totalCosts)],['MC loss',`${monteCarlo?.lossProbabilityPct.toFixed(1)}%`]].map(([a,b])=><div key={a}><span className="text-slate-500">{a}</span><b className="ml-2">{b}</b></div>)}</div>}</div></CardContent></Card>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="bg-[#111b27]"><CardHeader><CardTitle>Adaptive pullback v0.7</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="data-table min-w-[720px]"><thead><tr><th>Stage</th><th>Status</th><th>Protocol</th><th>Sharpe</th><th>Expectancy</th></tr></thead><tbody>{tests.map(([stage,status,protocol,sharpe,ev]) => <tr key={stage}><td className="font-medium">{stage}</td><td><Badge variant="outline" className={status === 'PASS' ? 'border-emerald-400/20 text-emerald-400' : 'border-amber-300/20 text-amber-300'}>{status}</Badge></td><td className="text-slate-500">{protocol}</td><td>{sharpe}</td><td className="text-emerald-400">{ev}</td></tr>)}</tbody></table></CardContent></Card>
        <div className="space-y-4">
          <Card className="bg-[#111b27]"><CardHeader><CardTitle>Regime coverage</CardTitle></CardHeader><CardContent className="space-y-4">{[['Bull trend',82],['Bear trend',68],['High volatility',61],['Range-bound',74]].map(([label,value]) => <div key={label as string}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">{label}</span><span>{value}%</span></div><Progress value={value as number} className="[&_[data-slot=progress-indicator]]:bg-[#d7ff64]" /></div>)}</CardContent></Card>
          <Card className="border-amber-300/15 bg-amber-300/5"><CardContent><div className="flex gap-3"><AlertTriangle className="size-5 shrink-0 text-amber-300"/><div><div className="font-medium text-amber-200">Not eligible for live use</div><p className="mt-1 text-xs leading-5 text-amber-200/60">Paper sample is incomplete and tail drawdown exceeds the 8% live threshold.</p></div></div></CardContent></Card>
        </div>
      </div>
      <Card className="mt-4 bg-[#111b27]"><CardHeader><div className="flex items-center justify-between"><CardTitle>Experiment controls</CardTitle><Badge variant="outline">Deterministic demo</Badge></div></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div className="control-tile"><SlidersHorizontal/><div><b>Costs always on</b><span>Brokerage, statutory fees, spread and slippage</span></div></div><div className="control-tile"><LineChart/><div><b>No look-ahead</b><span>Time-purged train / validation boundaries</span></div></div><div className="control-tile"><Gauge/><div><b>Risk-first selection</b><span>Deflated results and regime stability</span></div></div></CardContent></Card>
    </div>;
  }

  if (active === 'Paper trading') {
    const cost = estimateRoundTripCosts(balance * 0.6, 'Equity');
    return <div className="workspace">
      <PageTitle eyebrow="Execution simulator" title="Paper trading is the only enabled mode" detail="Orders model latency, partial fills, round-trip charges and slippage. Live connectivity has no implementation path in this MVP and requires a separate explicit approval gate." />
      <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
        <Card className="bg-[#111b27]"><CardHeader><div className="flex items-center justify-between"><CardTitle>Order ticket</CardTitle><Badge className="bg-amber-300/10 text-amber-300">PAPER</Badge></div></CardHeader><CardContent className="space-y-4">
          <label className="block text-xs text-slate-500">Instrument<input value="NIFTYBEES" readOnly className="terminal-input mt-2" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-500">Side<select className="terminal-input mt-2"><option>Buy</option><option>Sell</option></select></label><label className="text-xs text-slate-500">Order type<select className="terminal-input mt-2"><option>Limit</option><option>Market</option></select></label></div>
          <div className="rounded-xl bg-black/15 p-3 text-xs"><div className="flex justify-between py-1"><span className="text-slate-500">Max position</span><span>{money(balance * .2)}</span></div><div className="flex justify-between py-1"><span className="text-slate-500">Risk budget</span><span>{money(balance * policy.riskPerTradePct / 100)}</span></div><div className="flex justify-between py-1"><span className="text-slate-500">Modeled round trip</span><span>{money(cost.total)}</span></div></div>
          <Button className="w-full" disabled title="Blocked by session feasibility gate"><Play/> Preview blocked order</Button>
          <p className="text-center text-[11px] text-amber-300/75">No positive net expectancy after modeled costs.</p>
        </CardContent></Card>
        <div className="space-y-4"><Card className="bg-[#111b27]"><CardHeader><CardTitle>Positions</CardTitle></CardHeader><CardContent><div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-white/10 text-center"><div><ShieldCheck className="mx-auto size-7 text-emerald-400"/><div className="mt-3 text-sm font-medium">No open exposure</div><p className="mt-1 text-xs text-slate-500">The safest position can be no position.</p></div></div></CardContent></Card>
          <Card className="bg-[#111b27]"><CardHeader><CardTitle>Pending orders</CardTitle></CardHeader><CardContent><div className="flex items-center justify-between rounded-xl bg-black/15 p-4 text-sm"><span className="text-slate-500">0 pending</span><span className="text-xs text-emerald-400">Cancellation path verified</span></div></CardContent></Card></div>
      </div>
      {killed && <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/8 p-4 text-sm text-red-200">Emergency halt active. The simulator rejects all new orders until explicit resume approval.</div>}
    </div>;
  }

  if (active === 'Portfolio') {
    return <div className="workspace">
      <PageTitle eyebrow="Capital ledger" title="Deposits are not trading performance" detail="The ledger separates user contributions, carry-forward cash and genuine net trading profit so returns cannot be inflated by deposits." />
      <div className="grid gap-3 sm:grid-cols-3"><Card className="bg-[#111b27]"><CardContent><div className="eyebrow">Current value</div><div className="mt-2 text-3xl font-semibold">{money(balance)}</div></CardContent></Card><Card className="bg-[#111b27]"><CardContent><div className="eyebrow">Net deposits</div><div className="mt-2 text-3xl font-semibold">{money(deposits)}</div></CardContent></Card><Card className="bg-[#111b27]"><CardContent><div className="eyebrow">Genuine trading P&L</div><div className="mt-2 text-3xl font-semibold text-emerald-400">{money(balance - deposits)}</div></CardContent></Card></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Card className="bg-[#111b27]"><CardHeader><CardTitle>Deposit ledger</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Trading P&L impact</th></tr></thead><tbody>{[['29 Aug','Daily contribution','₹50','₹0'],['28 Aug','Daily contribution','₹40','₹0'],['27 Aug','Unused — carried forward','₹60','₹0'],['26 Aug','Daily contribution','₹30','₹0']].map(row=><tr key={row[0]}>{row.map((cell,i)=><td key={cell} className={i===3?'text-emerald-400':''}>{cell}</td>)}</tr>)}</tbody></table></CardContent></Card><Card className="bg-[#111b27]"><CardHeader><CardTitle>Adaptive mandate · {policy.tier}</CardTitle></CardHeader><CardContent><div className="space-y-3 text-xs">{[['Risk / trade',`${policy.riskPerTradePct}%`],['Daily loss cap',`${policy.dailyLossPct}%`],['Trades / day',String(policy.maxTrades)],['Leverage ceiling',`${policy.leverage}×`]].map(([a,b])=><div key={a} className="flex justify-between border-b border-white/6 pb-3"><span className="text-slate-500">{a}</span><span>{b}</span></div>)}</div><div className="mt-4"><div className="eyebrow">Eligible instruments</div><div className="mt-2 flex flex-wrap gap-2">{policy.eligible.map(x=><Badge key={x} variant="outline">{x}</Badge>)}</div></div></CardContent></Card></div>
    </div>;
  }

  if (active === 'Journal') {
    function saveNote() {
      if (!note.trim()) return;
      setJournal((items) => [note.trim(), ...items]);
      addAudit('Journal entry saved locally');
      setNote('');
    }
    return <div className="workspace">
      <PageTitle eyebrow="Decision journal & audit" title="Every action leaves a local trail" detail="Notes and machine events stay in this browser profile. The demo stores no broker credentials and sends no journal data to a server." />
      <div className="grid gap-4 xl:grid-cols-2"><Card className="bg-[#111b27]"><CardHeader><CardTitle>Trading journal</CardTitle></CardHeader><CardContent><textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} className="terminal-input resize-none" placeholder="What did you observe, decide, and learn?"/><Button onClick={saveNote} className="mt-3"><Save/> Save locally</Button><div className="mt-5 space-y-3">{journal.map((item,index)=><div key={`${item}-${index}`} className="rounded-xl border border-white/7 bg-black/10 p-4"><div className="mb-2 text-[10px] uppercase tracking-wider text-slate-600">Entry {journal.length-index}</div><p className="text-sm leading-6 text-slate-300">{item}</p></div>)}</div></CardContent></Card><Card className="bg-[#111b27]"><CardHeader><div className="flex items-center gap-2"><History className="size-4 text-[#d7ff64]"/><CardTitle>Immutable-style audit log</CardTitle></div></CardHeader><CardContent className="space-y-1">{audit.map((item,index)=><div key={`${item}-${index}`} className="flex gap-3 border-l border-white/10 py-3 pl-4 text-xs leading-5"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#d7ff64]"/><span className="text-slate-400">{item}</span></div>)}</CardContent></Card></div>
    </div>;
  }

  if (active === 'Data vault') {
    async function submitVault(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
      event.preventDefault();
      await unlockVault(vaultPassphrase);
      setVaultPassphrase('');
    }
    return <div className="workspace">
      <PageTitle eyebrow="Encrypted local persistence" title="Your research database stays on this device" detail="REN runs SQLite in WebAssembly, encrypts the entire exported database with AES-256-GCM, derives the key from your passphrase using PBKDF2, and stores only ciphertext in this browser’s IndexedDB." />
      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="bg-[#111b27]"><CardHeader><div className="flex items-center justify-between"><CardTitle>{vaultStatus === 'unlocked' ? 'Vault unlocked' : vaultStatus === 'new' ? 'Create local vault' : 'Unlock local vault'}</CardTitle><div className={`grid size-10 place-items-center rounded-xl ${vaultStatus === 'unlocked' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-300/10 text-amber-300'}`}><LockKeyhole/></div></div></CardHeader><CardContent>
          {vaultStatus === 'unlocked' ? <div><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-sm leading-6 text-emerald-200">SQLite is open in memory. Changes are encrypted before being written to IndexedDB; the key is never persisted.</div><Button className="mt-4" variant="outline" onClick={lockVault}><LockKeyhole/> Lock now</Button></div> : <form onSubmit={submitVault}><label className="text-xs text-slate-500">{vaultStatus === 'new' ? 'Choose a passphrase' : 'Vault passphrase'}<input type="password" autoComplete="current-password" minLength={8} required value={vaultPassphrase} onChange={(event)=>setVaultPassphrase(event.target.value)} className="terminal-input mt-2" placeholder="At least 8 characters" /></label><Button className="mt-4 w-full" type="submit" disabled={vaultStatus === 'checking'}><LockKeyhole/> {vaultStatus === 'new' ? 'Create encrypted vault' : 'Unlock vault'}</Button>{vaultError && <p className="mt-3 text-xs leading-5 text-red-300">{vaultError}</p>}</form>}
        </CardContent></Card>
        <Card className="bg-[#111b27]"><CardHeader><CardTitle>What is protected</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2">{[['Account ledger','Balance, deposits, contribution carry-forward'],['Research journal','Notes and rejected-trade reasoning'],['Audit events','Risk halts, resumes and data refreshes'],['Safety state','Emergency halt status and policy inputs']].map(([title,detail])=><div key={title} className="rounded-xl border border-white/7 bg-black/10 p-4"><ShieldCheck className="size-4 text-[#d7ff64]"/><div className="mt-3 text-sm font-medium">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>)}</div><div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4 text-xs leading-5 text-amber-200/70"><b className="text-amber-200">Recovery boundary:</b> there is no server copy and no passphrase recovery. Losing the passphrase means losing access to the encrypted database.</div></CardContent></Card>
      </div>
      <Card className="mt-4 bg-[#111b27]"><CardHeader><CardTitle>Storage design</CardTitle></CardHeader><CardContent className="grid gap-3 text-xs sm:grid-cols-4">{[['Database','SQLite WASM'],['Key derivation','PBKDF2 · SHA-256 · 250k'],['Encryption','AES-256-GCM · fresh IV'],['Persistence','Same-origin IndexedDB']].map(([a,b])=><div key={a} className="rounded-xl bg-black/15 p-4"><div className="eyebrow">{a}</div><div className="mt-2 font-medium text-slate-300">{b}</div></div>)}</CardContent></Card>
    </div>;
  }

  const sources = [
    ['SEBI · Equity F&O risk disclosure', 'Official regulator', 100, 'Risk disclosure and retail derivative-loss context.', 'https://www.sebi.gov.in/legal/circulars/may-2023/risk-disclosure-with-respect-to-trading-by-individual-traders-in-equity-futures-and-options-segment_71426.html'],
    ['RBI · Forex Alert List', 'Official regulator', 100, 'Only authorised persons, platforms and permitted purposes are eligible.', 'https://systemhealth.rbi.org.in/Scripts/bs_viewcontent.aspx?Id=4235'],
    ['Income Tax Department · ITR-2 VDA FAQ', 'Official tax authority', 100, 'VDA gains tax treatment; confirm current applicability with a professional.', 'https://www.incometax.gov.in/iec/foportal/help/FileITR-2Online-FAQ'],
    ['Zerodha · Charges', 'Broker primary documentation', 92, 'Brokerage and statutory-cost model baseline; rates remain configurable.', 'https://zerodha.com/charges/'],
    ['CFTC · Virtual currency risk', 'Official regulator', 100, 'Crypto volatility, platform, cyber and leverage warnings.', 'https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/understand_risks_of_virtual_currency.html'],
    ['Investor.gov · Options bulletin', 'Official investor education', 100, 'Options mechanics, approval levels and loss risks.', 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-63'],
    ['VectorBT · GitHub', 'Open-source project', 78, 'Reference architecture for vectorised portfolio simulation and robustness tests.', 'https://github.com/polakowo/vectorbt'],
    ['QuantConnect LEAN · GitHub', 'Open-source project', 88, 'Reference architecture for event-driven backtests and paper execution.', 'https://github.com/QuantConnect/Lean'],
    ['Arian, Mobarekeh & Seco (2024)', 'Peer-reviewed paper', 95, 'Backtest-overfitting comparison supports purged validation over naive splits.', 'https://doi.org/10.1016/j.knosys.2024.112477'],
    ['Binance · Spot API documentation', 'Official provider documentation', 92, 'Public ticker and kline endpoints used by the live crypto adapter.', 'https://developers.binance.com/en/docs/products/spot/rest-api'],
    ['Alpha Vantage · API documentation', 'Official provider documentation', 90, 'Keyed adapters for equities, FX, commodities and historical options.', 'https://www.alphavantage.co/documentation/'],
    ['sql.js · GitHub', 'Open-source project', 86, 'SQLite compiled to WebAssembly with database import and export in the browser.', 'https://github.com/sql-js/sql.js/'],
    ['MDN · Web Crypto API', 'Standards documentation', 94, 'PBKDF2 key derivation and AES-GCM encryption primitives used by the local vault.', 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API'],
    ['MDN · IndexedDB API', 'Standards documentation', 94, 'Same-origin browser persistence used only for encrypted SQLite ciphertext.', 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API'],
  ] as const;
  return <div className="workspace">
    <PageTitle eyebrow="Evidence library" title="Claims must earn their place" detail="Reliability is scored by provenance, methodological transparency, recency and directness. Regulatory and broker facts are rechecked before any future live integration." />
    <div className="grid gap-4 xl:grid-cols-[1.4fr_.6fr]"><Card className="bg-[#111b27]"><CardContent className="divide-y divide-white/6 p-0">{sources.map(([title,type,score,claim,url])=><a key={title} href={url} target="_blank" rel="noreferrer" className="group grid gap-3 p-4 transition-colors hover:bg-white/[.025] sm:grid-cols-[1fr_110px_64px_28px] sm:items-center"><div><div className="text-sm font-medium group-hover:text-[#d7ff64]">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{claim}</p></div><Badge variant="outline" className="border-white/10">{type}</Badge><div className="text-sm font-semibold text-emerald-400">{score}/100</div><ExternalLink className="size-4 text-slate-600"/></a>)}</CardContent></Card><div className="space-y-4"><Card className="bg-[#111b27]"><CardHeader><CardTitle>Reliability rubric</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-5 text-slate-400"><p><b className="text-slate-200">90–100</b> · Official or peer reviewed, directly supports claim.</p><p><b className="text-slate-200">75–89</b> · Reputable primary project documentation; implementation evidence, not financial truth.</p><p><b className="text-slate-200">Below 75</b> · Context only; never drives a strategy or risk rule.</p></CardContent></Card><Card className="border-red-400/15 bg-red-400/5"><CardHeader><CardTitle className="text-red-200">Rejected evidence</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-5 text-red-200/60"><p>“Guaranteed daily income” videos — unsupported and conflicts with regulator warnings.</p><p>Anonymous backtest screenshots — no data, costs, code or out-of-sample method.</p><p>YouTube transcripts — none admitted in this demo because no creator-licensed or official transcript was needed to support a claim.</p></CardContent></Card></div></div>
  </div>;
}
