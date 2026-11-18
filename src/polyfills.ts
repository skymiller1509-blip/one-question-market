// Polyfills for the Solana web3 stack. MUST be imported first in main.tsx,
// before App (and everything it pulls in) loads.
//
// The Solana libraries expect Node's Buffer and a `global` object. Vite's
// `define: { global: "globalThis" }` covers `global`; this file covers
// `Buffer`.
import { Buffer } from "buffer";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
