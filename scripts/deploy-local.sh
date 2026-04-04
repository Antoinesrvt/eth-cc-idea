#!/usr/bin/env bash
set -euo pipefail

echo "=== Deploy to local Anvil (localhost:8545) ==="
echo ""

# Check if anvil is running
if ! curl -s http://localhost:8545 -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}' > /dev/null 2>&1; then
  echo "ERROR: Anvil is not running. Start it first:"
  echo "  anvil"
  exit 1
fi

echo "✓ Anvil is running"

# Anvil default account #0
export DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export PLATFORM_TREASURY=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Build
echo ""
echo "[1/3] Building contracts..."
cd contracts && forge build --quiet && cd ..
echo "  ✓ Compiled"

# Deploy test USDC
echo ""
echo "[2/3] Deploying test USDC..."
USDC_OUTPUT=$(cd contracts && forge script script/Deploy.s.sol \
  --sig "deployTestToken()" \
  --rpc-url http://localhost:8545 \
  --broadcast 2>&1)

USDC_ADDR=$(echo "$USDC_OUTPUT" | grep "Test USDC:" | awk '{print $NF}')
echo "  ✓ Test USDC: ${USDC_ADDR:-unknown}"

if [ -n "$USDC_ADDR" ]; then
  export PAYMENT_TOKEN_ADDRESS="$USDC_ADDR"
fi

# Deploy ServiceContract
echo ""
echo "[3/3] Deploying ServiceContract..."
SC_OUTPUT=$(cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast 2>&1)

SC_ADDR=$(echo "$SC_OUTPUT" | grep "ServiceContract:" | awk '{print $NF}')
TOKEN_ADDR=$(echo "$SC_OUTPUT" | grep "ContractToken:" | awk '{print $NF}')
echo "  ✓ ServiceContract: ${SC_ADDR:-unknown}"
echo "  ✓ ContractToken:   ${TOKEN_ADDR:-unknown}"

echo ""
echo "=== Done! Add to .env.local: ==="
[ -n "$USDC_ADDR" ] && echo "  PAYMENT_TOKEN_ADDRESS=$USDC_ADDR"
[ -n "$SC_ADDR" ] && echo "  SERVICE_CONTRACT_ADDRESS=$SC_ADDR"
echo ""
echo "Then run: pnpm dev"
