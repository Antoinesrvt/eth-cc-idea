import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Allow Privy iframe and API calls
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io https://*.privy.io",
              "style-src 'self' 'unsafe-inline' https://auth.privy.io",
              "frame-src https://auth.privy.io https://*.privy.io https://verify.walletconnect.org https://verify.walletconnect.com",
              "connect-src 'self' https://*.privy.io https://auth.privy.io https://openrouter.ai https://testnet-rpc.rayls.com https://privacy-node-0.rayls.com https://arb1.arbitrum.io wss://*.walletconnect.org wss://*.walletconnect.com https://*.walletconnect.org https://*.walletconnect.com https://rpc.walletconnect.org",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
