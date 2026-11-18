import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { MarketAccount } from "@pm-amm/sdk";
import {
  CLOSE_TIME_MS,
  CLOSE_UTC,
  MARKET_PDA,
  QUESTION,
  TRADE_USDC,
} from "./config";
import { marketState, minOutput, quoteSwap } from "./pm-amm-helpers";
import { useBurnerWallet } from "./useBurnerWallet";

// 1 mUSDC in raw 6-decimal units. send.swap takes raw units.
const RAW_PER_MUSDC = 1_000_000;
const TRADE_RAW = TRADE_USDC * RAW_PER_MUSDC;

function countdownText(msLeft: number): string {
  if (msLeft <= 0) return "Closed";
  const totalSecs = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
}

export default function App() {
  const { publicKey, client, connection, balances, status, error, refresh } =
    useBurnerWallet({ storageKey: "oqm-burner" });

  const [now, setNow] = useState(() => Date.now());
  const [market, setMarket] = useState<MarketAccount | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ yes: number; no: number }>({
    yes: 0,
    no: 0,
  });
  const [buying, setBuying] = useState<"yes" | "no" | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [tradeMsg, setTradeMsg] = useState<string | null>(null);

  // The market PDA comes from src/config.ts. Empty on purpose until the
  // entry market is created (no devnet SOL yet to create it with).
  const marketPda = useMemo(() => {
    if (!MARKET_PDA) return null;
    try {
      return new PublicKey(MARKET_PDA);
    } catch {
      return undefined; // invalid address in config
    }
  }, []);

  // Countdown ticker.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Live market state. One read per poll, every 15 seconds or more (the
  // public devnet RPC rate-limits hard), paused while the tab is hidden.
  useEffect(() => {
    if (!marketPda || !client) return;
    let stopped = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const m = await client.fetchMarket(marketPda);
        if (!stopped) {
          setMarket(m);
          setMarketError(m ? null : "Market account not found on-chain.");
        }
      } catch (e) {
        if (!stopped)
          setMarketError(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 15000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [marketPda, client]);

  // Your YES / NO token balances for this market.
  const loadPosition = useCallback(async () => {
    if (!marketPda || !client || !publicKey) return;
    const read = async (mint: PublicKey) => {
      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      try {
        const b = await connection.getTokenAccountBalance(ata);
        return Number(b.value.uiAmount ?? 0);
      } catch {
        return 0; // no token account yet
      }
    };
    const [yes, no] = await Promise.all([
      read(client.yesMint(marketPda)),
      read(client.noMint(marketPda)),
    ]);
    setPosition({ yes, no });
  }, [marketPda, client, publicKey, connection]);

  useEffect(() => {
    void loadPosition();
  }, [loadPosition, market]);

  const state = market ? marketState(market) : null;
  const yesPrice = state ? state.price : null;
  const noPrice = state ? 1 - state.price : null;
  const resolved = state?.resolved ?? false;
  const winner = state?.winner ?? null;
  const expired = state?.expired ?? false;
  const canTrade =
    !!marketPda && !!client && !!market && !resolved && !expired && status === "ready";
  const winningBalance =
    winner === "yes" ? position.yes : winner === "no" ? position.no : 0;

  const buy = async (side: "yes" | "no") => {
    if (!marketPda || !client || !market) return;
    setBuying(side);
    setTradeMsg(null);
    try {
      // Quotes come from the kit helpers, never hand-rolled: stored reserves
      // date from lastAccrualTs, so a naive quote over-promises and the swap
      // fails with SlippageExceeded. send.swap takes RAW 6-dp units and
      // creates BOTH the YES and NO token accounts if needed.
      const direction = side === "yes" ? "usdcToYes" : "usdcToNo";
      const quote = quoteSwap(market, direction, TRADE_RAW);
      const minOut = minOutput(quote, 100); // 1% slippage
      const sig = await client.send.swap(marketPda, direction, TRADE_RAW, minOut);
      setTradeMsg(
        `Bought ${side.toUpperCase()} with ${TRADE_USDC} mUSDC. Tx: ${sig}`,
      );
      await refresh();
      await loadPosition();
      const m = await client.fetchMarket(marketPda);
      setMarket(m);
    } catch (e) {
      setTradeMsg(`Buy failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBuying(null);
    }
  };

  const claim = async () => {
    if (!marketPda || !client) return;
    setClaiming(true);
    setTradeMsg(null);
    try {
      const sig = await client.send.claimWinnings(marketPda);
      setTradeMsg(`Claimed winnings (1 mUSDC per winning token). Tx: ${sig}`);
      await refresh();
      await loadPosition();
    } catch (e) {
      setTradeMsg(`Claim failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="page">
      <span className="badge">SOLANA DEVNET — TEST MONEY ONLY (mUSDC)</span>
      <h1>One Question Market</h1>
      <p className="sub">
        One question, one tap. Built on the PREDICT pm-AMM for the Solana
        Perps and Prediction Markets hackathon.
      </p>

      <div className="card">
        <h2>{QUESTION}</h2>
        <p className="muted">Closes {CLOSE_UTC}, 23:59 UTC</p>
        <div className="countdown">{countdownText(CLOSE_TIME_MS - now)}</div>
        <p className="muted">until the close</p>
      </div>

      <div className="card rule">
        <h2>How this resolves — read before you trade</h2>
        <p>
          At the close on Dec 5, 2026, the creator reads the Pyth SOL/USD
          price feed. If SOL closed above $X, YES wins. If not, NO wins.
        </p>
        <p>
          Winners claim 1 mUSDC per winning token. Resolution is manual: the
          creator resolves the market on-chain after the close, then anyone
          holding the winning side can claim.
        </p>
        <p>Swap fee: 2% on the mUSDC leg. YES to NO swaps are free.</p>
      </div>

      <div className="card">
        <h2>Your burner wallet</h2>
        {status === "loading" || status === "funding" ? (
          <p>Setting up your one-tap wallet…</p>
        ) : status === "error" ? (
          <p>
            Wallet could not be funded: {error ?? "unknown error"}. Try again
            later, or come back once the hackathon faucet is refilled.
          </p>
        ) : (
          <>
            <p className="mono">{publicKey?.toBase58() ?? ""}</p>
            <p>
              Balance: {balances?.usdc ?? 0} mUSDC · {balances?.sol ?? 0} SOL
            </p>
            <p className="muted">
              A fresh wallet is created in this browser and funded with test
              mUSDC. No extension, no sign-in, no real money.
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h2>Trade</h2>
        {marketPda === undefined ? (
          <p>
            The market address in src/config.ts is not a valid address. Fix
            MARKET_PDA to point at the entry market.
          </p>
        ) : marketPda === null ? (
          <>
            <p>
              <strong>The market is not created yet.</strong> The entry market
              will be created once devnet SOL is available to pay for it. Come
              back then — the question, countdown and rules above are already
              live.
            </p>
            <div className="prices">
              <div className="price yes">
                <div className="label">YES</div>
                <div className="value">50%</div>
              </div>
              <div className="price no">
                <div className="label">NO</div>
                <div className="value">50%</div>
              </div>
            </div>
            <p>
              <span className="demo-tag">DEMO</span> — these 50 / 50 prices
              are only a layout preview, not live prices. There is no market
              yet, so there is nothing real to price.
            </p>
            <div className="buttons">
              <button className="yes" disabled>
                Buy YES — {TRADE_USDC} mUSDC
              </button>
              <button className="no" disabled>
                Buy NO — {TRADE_USDC} mUSDC
              </button>
            </div>
          </>
        ) : marketError ? (
          <p>Could not load the market: {marketError}</p>
        ) : !market || !state || yesPrice === null || noPrice === null ? (
          <p>Loading live prices…</p>
        ) : (
          <>
            <div className="prices">
              <div className="price yes">
                <div className="label">YES</div>
                <div className="value">{(yesPrice * 100).toFixed(1)}%</div>
              </div>
              <div className="price no">
                <div className="label">NO</div>
                <div className="value">{(noPrice * 100).toFixed(1)}%</div>
              </div>
            </div>
            {resolved ? (
              <p>
                Resolved: <strong>{winner?.toUpperCase() ?? "?"}</strong> won.
              </p>
            ) : expired ? (
              <p>
                Trading is closed. Waiting for the creator to resolve from the
                Pyth SOL/USD feed.
              </p>
            ) : (
              <div className="buttons">
                <button
                  className="yes"
                  disabled={!canTrade || buying !== null}
                  onClick={() => void buy("yes")}
                >
                  {buying === "yes" ? "Buying…" : `Buy YES — ${TRADE_USDC} mUSDC`}
                </button>
                <button
                  className="no"
                  disabled={!canTrade || buying !== null}
                  onClick={() => void buy("no")}
                >
                  {buying === "no" ? "Buying…" : `Buy NO — ${TRADE_USDC} mUSDC`}
                </button>
              </div>
            )}
            <p>
              Your position: {position.yes.toFixed(2)} YES ·{" "}
              {position.no.toFixed(2)} NO
            </p>
            {resolved && winner && winningBalance > 0 && (
              <button
                className="claim"
                disabled={claiming}
                onClick={() => void claim()}
              >
                {claiming
                  ? "Claiming…"
                  : `Claim ${winningBalance.toFixed(2)} mUSDC winnings`}
              </button>
            )}
            {tradeMsg && <p className="msg">{tradeMsg}</p>}
          </>
        )}
      </div>

      <footer>
        Program: <span className="mono">GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y</span>
        <br />
        Devnet only. The same program runs on mainnet with real money — this
        app never touches mainnet.
      </footer>
    </div>
  );
}
