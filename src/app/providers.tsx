"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { PrivyProvider } from "@privy-io/react-auth";
import { Toaster } from "sonner";
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Chain config — uses explicit NEXT_PUBLIC_ env vars with presets as fallback
// For Anvil fork: NEXT_PUBLIC_CHAIN_ID=84532, NEXT_PUBLIC_RPC_URL=http://localhost:8545
const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
const isLocal = rpcUrl.includes("localhost");

const appChain = {
  id: chainId,
  name: isLocal ? "Local Fork" : chainId === 8453 ? "Base" : "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: {
      name: isLocal ? "Local" : "BaseScan",
      url: isLocal ? "http://localhost:8545" : chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org",
    },
  },
  testnet: chainId !== 8453,
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

  // Skip Privy in local dev (use Anvil accounts directly)
  const isLocal = process.env.NEXT_PUBLIC_ENV === "local";
  if (!PRIVY_APP_ID || isLocal) return themed;

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
