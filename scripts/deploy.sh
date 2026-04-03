#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║       TrustSignal — Deploy Contracts     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Load env
[ -f .env.local ] && set -a && source .env.local 2>/dev/null && set +a

RPC="${RPC_URL:-https://sepolia.base.org}"
[ -z "${DEPLOYER_PRIVATE_KEY:-}" ] && echo "ERROR: Set DEPLOYER_PRIVATE_KEY" && exit 1
[ -z "${PLATFORM_TREASURY:-}" ] && echo "ERROR: Set PLATFORM_TREASURY" && exit 1

echo "Chain: Base Sepolia ($RPC)"
echo ""

# Build
echo "[1/3] Building..."
cd contracts && forge build --quiet && cd ..
echo "  ✓ Compiled"

# Deploy test USDC if needed
if [ -z "${PAYMENT_TOKEN_ADDRESS:-}" ]; then
  echo ""
  echo "[2/3] Deploying test USDC..."
  cd contracts && forge script script/Deploy.s.sol --sig "deployTestToken()" --rpc-url "$RPC" --broadcast 2>&1 | grep -E "Test USDC|Minted" && cd ..
else
  echo "[2/3] PAYMENT_TOKEN_ADDRESS already set"
fi

# Deploy ServiceContract
echo ""
echo "[3/3] Deploying ServiceContract..."
cd contracts && forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast 2>&1 | grep -E "ServiceContract|ContractToken|Add to"
cd ..

echo ""
echo "Done! Add the addresses to .env.local"
