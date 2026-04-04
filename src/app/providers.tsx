"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { PrivyProvider } from "@privy-io/react-auth";
import { Toaster } from "sonner";
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Chain config — reads from env, defaults to Base Sepolia
// For local dev with Anvil: set NEXT_PUBLIC_CHAIN_ID=31337 and NEXT_PUBLIC_RPC_URL=http://localhost:8545
const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");
const appChain = {
  id: chainId,
  name: chainId === 31337 ? "Anvil (Local)" : "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"] },
  },
  blockExplorers: {
    default: {
      name: chainId === 31337 ? "Local" : "BaseScan",
      url: chainId === 31337 ? "http://localhost:8545" : "https://sepolia.basescan.org",
    },
  },
  testnet: true,
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
