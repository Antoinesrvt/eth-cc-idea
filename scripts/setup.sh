#!/usr/bin/env bash
# ============================================================================
# TrustSignal — First-Time Setup
# ============================================================================
# Interactive setup script. Run once after cloning:
#   ./scripts/setup.sh
# ============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       TrustSignal — Project Setup        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Check Node.js ───────────────────────────────────────────────────────────

echo -e "${BLUE}[1/6] Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Install v22+: https://nodejs.org"
  exit 1
fi
NODE_V=$(node -v)
echo -e "  ${GREEN}✓${NC} Node.js ${NODE_V}"

if command -v forge &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} Foundry installed"
else
  echo -e "  ${YELLOW}⚠${NC} Foundry not found (optional — needed for contract deployment)"
  echo "    Install: curl -L https://foundry.paradigm.xyz | bash && foundryup"
fi

# ── Install dependencies ───────────────────────────────────────────────────

echo ""
echo -e "${BLUE}[2/6] Installing dependencies...${NC}"
npm install --quiet 2>&1 | tail -1
echo -e "  ${GREEN}✓${NC} npm packages installed"

if [ -d contracts ] && command -v forge &> /dev/null; then
  (cd contracts && forge install --quiet 2>/dev/null || true)
  echo -e "  ${GREEN}✓${NC} Foundry dependencies installed"
fi

# ── Create .env.local ──────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}[3/6] Environment configuration...${NC}"

if [ -f .env.local ]; then
  echo -e "  ${GREEN}✓${NC} .env.local already exists"
else
  cp .env.example .env.local
  echo -e "  ${GREEN}✓${NC} Created .env.local from .env.example"
  echo ""
  echo -e "  ${YELLOW}Fill in these values in .env.local:${NC}"
  echo ""
  echo "  Required for the app to work:"
  echo "    NEXT_PUBLIC_PRIVY_APP_ID     — from privy.io dashboard"
  echo "    PRIVY_APP_SECRET             — from privy.io dashboard"
  echo "    OPENROUTER_API_KEY           — from openrouter.ai"
  echo ""
  echo "  Required for blockchain (from hackathon organizers):"
  echo "    PRIVACY_NODE_RPC_URL"
  echo "    DEPLOYER_PRIVATE_KEY"
  echo "    DEPLOYMENT_PROXY_REGISTRY"
  echo ""
  echo "  Optional (set after deploying contracts):"
  echo "    CONTRACT_FACTORY_ADDRESS"
  echo "    PLATFORM_TREASURY"
  echo "    RESEND_API_KEY               — from resend.com (for email invites)"
fi

# ── Generate wallet ────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}[4/6] Wallet setup...${NC}"

if command -v cast &> /dev/null; then
  echo "  Generate a new deployer wallet? (y/n)"
  read -r REPLY
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    WALLET=$(cast wallet new 2>&1)
    ADDR=$(echo "$WALLET" | grep "Address:" | awk '{print $2}')
    KEY=$(echo "$WALLET" | grep "Private key:" | awk '{print $3}')
    echo -e "  ${GREEN}✓${NC} New wallet generated"
    echo -e "  Address:     ${ADDR}"
    echo -e "  Private Key: ${KEY}"
    echo ""
    echo -e "  ${YELLOW}Add to .env.local:${NC}"
    echo -e "    DEPLOYER_PRIVATE_KEY=${KEY}"
    echo -e "    PLATFORM_TREASURY=${ADDR}"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} cast not found — install Foundry to generate wallets"
fi

# ── Build contracts ────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}[5/6] Building smart contracts...${NC}"

if [ -d contracts ] && command -v forge &> /dev/null; then
  (cd contracts && forge build --quiet 2>&1) && echo -e "  ${GREEN}✓${NC} Contracts compiled"

  echo "  Generating TypeScript ABIs..."
  npx tsx scripts/generate-abis.ts 2>&1 | grep -c "OK" | xargs -I{} echo -e "  ${GREEN}✓${NC} {} ABIs generated"
else
  echo -e "  ${YELLOW}⚠${NC} Skipped (Foundry not installed)"
fi

# ── Done ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}[6/6] Ready!${NC}"
echo -e "══════════════════════════════════════════"
echo ""
echo -e "  ${GREEN}npm run dev${NC}          Start development server"
echo -e "  ${GREEN}npm test${NC}             Run tests"
echo -e "  ${GREEN}./scripts/deploy.sh${NC}  Deploy contracts to Rayls"
echo ""
echo -e "  Open ${BLUE}http://localhost:3000${NC}"
echo ""
