export const PAYMENTS_CONFIG = {
  privy: {
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
    appSecret: process.env.PRIVY_APP_SECRET || "",
  },
  supportedTokens: [
    { symbol: "ETH", name: "Ether", decimals: 18, address: "native" },
  ],
  platformFeePercent: 2.5,
  maxBdFeePercent: 20,
} as const;
