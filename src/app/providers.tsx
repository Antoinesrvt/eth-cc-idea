"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { PrivyProvider } from "@privy-io/react-auth";
import { Toaster } from "sonner";
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Chain config — auto-detects from NEXT_PUBLIC_ENV
// Set NEXT_PUBLIC_ENV=local|testnet|mainnet in .env.local
const env = process.env.NEXT_PUBLIC_ENV || "local";
const chains: Record<string, { id: number; name: string; rpc: string; explorer: string }> = {
  local:   { id: 31337, name: "Anvil (Local)", rpc: "http://localhost:8545", explorer: "http://localhost:8545" },
  testnet: { id: 84532, name: "Base Sepolia",  rpc: "https://sepolia.base.org", explorer: "https://sepolia.basescan.org" },
  mainnet: { id: 8453,  name: "Base",          rpc: "https://mainnet.base.org", explorer: "https://basescan.org" },
};
const c = chains[env] || chains.local;

const appChain = {
  id: c.id,
  name: c.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [c.rpc] } },
  blockExplorers: { default: { name: c.name, url: c.explorer } },
  testnet: env !== "mainnet",
} as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const themed = (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          },
        }}
      />
    </NextThemesProvider>
  );

  if (!PRIVY_APP_ID) return themed;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "#0f1a14" as const,
          accentColor: "#2E8B57" as const,
          landingHeader: "Welcome to TrustSignal",
          loginMessage: "Tokenize contracts, verify deliverables, invest with confidence",
          showWalletLoginFirst: false,
          walletChainType: "ethereum-only" as const,
        },
        loginMethodsAndOrder: {
          primary: ["google", "telegram", "detected_ethereum_wallets"],
          overflow: ["email"],
        },
        defaultChain: appChain,
        supportedChains: [appChain],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {themed}
    </PrivyProvider>
  );
}
