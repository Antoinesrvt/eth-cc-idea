"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { PrivyProvider } from "@privy-io/react-auth";
import { Toaster } from "sonner";
import { arbitrumSepolia } from "viem/chains";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

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
        defaultChain: arbitrumSepolia,
        supportedChains: [arbitrumSepolia],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {themed}
    </PrivyProvider>
  );
}
