// One Question Market — app config.
//
// DEVNET ONLY. Never point this at mainnet: the pm-AMM program ID is the
// same on devnet and mainnet, and mainnet uses real money.
export const PROGRAM_ID =
  "GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y";
export const MINT = "3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ";
export const RPC = "https://api.devnet.solana.com";
export const QUESTION = "Will SOL close above $X on Dec 5?";
export const CLOSE_UTC = "2026-12-05";

// The entry market does NOT exist yet: the test wallet has 0 devnet SOL and
// the pm-AMM faucet reserve is empty, so no market could be created.
// HOW TO POINT THE APP AT THE ENTRY MARKET: when the entry market is
// created, paste its market PDA address here (one line, nothing else).
export const MARKET_PDA = "";

// Trading closes at the end of Dec 5, 2026, UTC.
export const CLOSE_TIME_MS = Date.parse("2026-12-05T23:59:59Z");

// Fixed trade size for the one-tap buy buttons: 5 mUSDC.
export const TRADE_USDC = 5;
