# One Question Market — app scaffold

One question: "Will SOL close above $X on Dec 5?" One-tap YES/NO trades on
the PREDICT pm-AMM (Solana devnet). Built for the Solana Perps and
Prediction Markets hackathon ($101,000, deadline Dec 5, 2026).

## Status

Scaffold only. The entry market is NOT created yet: the test wallet has
0 devnet SOL and the pm-AMM faucet reserve is empty, so no market could be
created. With no market, the page says so clearly and shows a DEMO-labelled
50/50 layout preview. No market address is invented anywhere.

## Run

- `npm install`
- `npm run dev` — local dev server
- `npm run build` — type-check + production build into `dist/`
- `npm run preview` — serve the production build locally

## Point the app at the entry market

When the entry market is created (once devnet SOL lands), paste its market
PDA address into `src/config.ts`, field `MARKET_PDA`. That is the only
change needed: the app reads live YES/NO prices from `marketState`, polls
every 15 seconds, and enables one-tap buys through the burner wallet.

The strike $X goes in the market name when the market is created
("Will SOL close above $X on Dec 5?", 50 mUSDC seed, 50% start price),
not in this app.

## How it works

- `src/burner.ts`, `src/useBurnerWallet.ts`, `src/pm-amm-helpers.ts` are
  the pm-AMM kit files, copied unchanged from `../prep/`.
- Each visitor gets a browser burner wallet (localStorage), funded with
  test mUSDC from the pm-AMM faucet. Devnet only.
- Buy buttons use `client.send.swap` with quotes from
  `pm-amm-helpers.ts` `quoteSwap` / `minOutput` — never hand-rolled
  (stored reserves date from `lastAccrualTs`; naive quotes fail with
  SlippageExceeded). Swaps take raw 6-dp units; `send.swap` creates both
  the YES and NO token accounts.
- `src/polyfills.ts` sets `Buffer` and is imported first in `main.tsx`;
  `App` is dynamically imported after it. `@anchor-lang/core` is CommonJS
  and is pre-bundled by Vite (see `vite.config.ts`).
- Exactly one copy of `@solana/web3.js` is installed; check with
  `find node_modules -name "web3.js" -maxdepth 4 -type d` after install.

## Still to do before the entry can go live

1. Devnet SOL for the test wallet (faucet reserve empty; ask in the
   hackathon Discord or wait for the hackathon to open).
2. Run the throwaway test market (`node index.cjs` in `../prep/`) to
   verify create, buy YES, price and link end to end.
3. Create the entry market from the builder wallet (strike $X from the
   live SOL price then, duration until the Dec 5 close, 50 mUSDC seed).
4. Paste the entry market PDA into `src/config.ts` `MARKET_PDA`.
5. Create the GitHub repo and deploy this app to GitHub Pages.
6. Demo video (max 3 minutes, ffmpeg + TTS from real screenshots,
   YouTube), then submit on the hackathon page.
