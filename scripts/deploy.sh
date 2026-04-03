#!/usr/bin/env bash
# ============================================================================
# TrustSignal — Deploy All Contracts
# ============================================================================
# Deploys singletons to Privacy Node using DeployAll.s.sol (idempotent).
# Optionally deploys test stablecoin for demo mode.
#
# Run from project root: ./scripts/deploy.sh
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       TrustSignal — Deploy Contracts     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Load env ────────────────────────────────────────────────────────────────

if [ -f .env.local ]; then
  echo -e "${YELLOW}Loading .env.local...${NC}"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    export "$key"="$value"
  done < .env.local
elif [ -f .env ]; then
  echo -e "${YELLOW}Loading .env...${NC}"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    export "$key"="$value"
  done < .env
else
  echo -e "${RED}No .env.local or .env found. Copy .env.example first.${NC}"
  exit 1
fi

# ── Validate required vars ──────────────────────────────────────────────────

MISSING=""
[ -z "${PRIVACY_NODE_RPC_URL:-}" ] && MISSING="$MISSING PRIVACY_NODE_RPC_URL"
[ -z "${DEPLOYER_PRIVATE_KEY:-}" ] && MISSING="$MISSING DEPLOYER_PRIVATE_KEY"
[ -z "${DEPLOYMENT_PROXY_REGISTRY:-}" ] && MISSING="$MISSING DEPLOYMENT_PROXY_REGISTRY"

if [ -z "${PLATFORM_TREASURY:-}" ]; then
  if command -v cast &> /dev/null; then
    PLATFORM_TREASURY=$(cast wallet address "$DEPLOYER_PRIVATE_KEY" 2>/dev/null || echo "")
    if [ -n "$PLATFORM_TREASURY" ]; then
      echo -e "${YELLOW}Using deployer as PLATFORM_TREASURY: ${PLATFORM_TREASURY}${NC}"
      export PLATFORM_TREASURY
    else
      MISSING="$MISSING PLATFORM_TREASURY"
    fi
  else
    MISSING="$MISSING PLATFORM_TREASURY"
  fi
fi

if [ -n "$MISSING" ]; then
  echo -e "${RED}Missing required env vars:${MISSING}${NC}"
  exit 1
fi

if ! command -v forge &> /dev/null; then
  echo -e "${RED}forge not found. Install Foundry: https://book.getfoundry.sh${NC}"
  exit 1
fi

# ── Build ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}[1/4] Building contracts...${NC}"
cd contracts && forge build --quiet 2>/dev/null && cd ..
echo -e "${GREEN}  ✓ Contracts compiled${NC}"

# ── Deploy singletons (Factory + DocumentStore) ─────────────────────────────

echo ""
echo -e "${BLUE}[2/4] Deploying singletons to Privacy Node...${NC}"
echo -e "  RPC:      ${PRIVACY_NODE_RPC_URL}"
echo -e "  Registry: ${DEPLOYMENT_PROXY_REGISTRY}"
echo -e "  Treasury: ${PLATFORM_TREASURY}"

DEPLOY_OUTPUT=$(cd contracts && forge script script/DeployAll.s.sol \
  --rpc-url "$PRIVACY_NODE_RPC_URL" \
  --broadcast \
  --legacy \
  --code-size-limit 50000 \
  2>&1) || true

# Extract addresses
FACTORY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "ContractFactory:" | awk '{print $NF}')
DOCSTORE_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "DocumentStore:" | awk '{print $NF}')

if [ -n "$FACTORY_ADDR" ]; then
  echo -e "${GREEN}  ✓ ContractFactory: ${FACTORY_ADDR}${NC}"
else
  FACTORY_ADDR="${CONTRACT_FACTORY_ADDRESS:-}"
  [ -n "$FACTORY_ADDR" ] && echo -e "${YELLOW}  ○ ContractFactory: ${FACTORY_ADDR} (already deployed)${NC}" || echo -e "${RED}  ✗ ContractFactory: deployment failed${NC}"
fi

if [ -n "$DOCSTORE_ADDR" ]; then
  echo -e "${GREEN}  ✓ DocumentStore:   ${DOCSTORE_ADDR}${NC}"
else
  DOCSTORE_ADDR="${DOCUMENT_STORE_ADDRESS:-}"
  [ -n "$DOCSTORE_ADDR" ] && echo -e "${YELLOW}  ○ DocumentStore:   ${DOCSTORE_ADDR} (already deployed)${NC}" || echo -e "${YELLOW}  ○ DocumentStore:   not deployed${NC}"
fi

# ── Deploy test token (optional) ────────────────────────────────────────────

echo ""
echo -e "${BLUE}[3/4] Test stablecoin...${NC}"

if [ -n "${TEST_TOKEN_ADDRESS:-}" ]; then
  echo -e "${YELLOW}  ○ TrustUSD already deployed: ${TEST_TOKEN_ADDRESS}${NC}"
else
  echo "  Deploy test stablecoin (1M tUSD)? (y/n)"
  read -r REPLY
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    TOKEN_OUTPUT=$(cd contracts && forge script script/DeployTestToken.s.sol \
      --rpc-url "$PRIVACY_NODE_RPC_URL" \
      --broadcast \
      --legacy \
      --code-size-limit 50000 \
      2>&1) || true
    TOKEN_ADDR=$(echo "$TOKEN_OUTPUT" | grep "TrustUSD" | grep "0x" | awk '{print $NF}')
    if [ -n "$TOKEN_ADDR" ]; then
      echo -e "${GREEN}  ✓ TrustUSD (tUSD): ${TOKEN_ADDR}${NC}"
    else
      echo -e "${YELLOW}  ○ Could not extract token address. Check output.${NC}"
    fi
  else
    echo -e "  Skipped."
  fi
fi

# ── Deploy Public Chain singletons (Oracle) ─────────────────────────────────

echo ""
echo -e "${BLUE}[4/6] Public Chain singletons (Oracle)...${NC}"

PUBLIC_RPC="${PUBLIC_CHAIN_RPC_URL:-https://testnet-rpc.rayls.com}"

if [ -n "${AGENCY_PROFILE_ADDRESS:-}" ] && [ -n "${ATTESTATION_ADDRESS:-}" ]; then
  echo -e "${YELLOW}  ○ Already deployed:${NC}"
  echo -e "    AgencyProfile: ${AGENCY_PROFILE_ADDRESS}"
  echo -e "    Attestation:   ${ATTESTATION_ADDRESS}"
else
  echo "  Deploy Oracle contracts to Public Chain? (y/n)"
  read -r REPLY
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    PUBLIC_OUTPUT=$(cd contracts && forge script script/DeployPublicChain.s.sol \
      --rpc-url "$PUBLIC_RPC" \
      --broadcast \
      --legacy \
      --code-size-limit 50000 \
      2>&1) || true

    PROFILE_ADDR=$(echo "$PUBLIC_OUTPUT" | grep "AgencyProfile:" | awk '{print $NF}')
    ATTEST_ADDR=$(echo "$PUBLIC_OUTPUT" | grep "Attestation:" | awk '{print $NF}')
    MARKET_ADDR=$(echo "$PUBLIC_OUTPUT" | grep "Marketplace:" | awk '{print $NF}')

    [ -n "$PROFILE_ADDR" ] && echo -e "${GREEN}  ✓ AgencyProfile: ${PROFILE_ADDR}${NC}"
    [ -n "$ATTEST_ADDR" ] && echo -e "${GREEN}  ✓ Attestation:   ${ATTEST_ADDR}${NC}"
    [ -n "$MARKET_ADDR" ] && echo -e "${GREEN}  ✓ Marketplace:   ${MARKET_ADDR}${NC}"
  else
    echo -e "  Skipped."
  fi
fi

# ── Generate ABIs ───────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}[5/6] Generating TypeScript ABIs...${NC}"
npx tsx scripts/generate-abis.ts 2>&1 | grep "OK\|Generated" | tail -3
echo -e "${GREEN}  ✓ ABIs generated${NC}"

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}[6/6] Summary${NC}"
echo -e "${BLUE}══════════════════════════════════════════${NC}"
echo -e "  Add to .env.local:"
echo ""
[ -n "$FACTORY_ADDR" ] && echo -e "  CONTRACT_FACTORY_ADDRESS=${FACTORY_ADDR}"
[ -n "$DOCSTORE_ADDR" ] && echo -e "  DOCUMENT_STORE_ADDRESS=${DOCSTORE_ADDR}"
[ -n "${TOKEN_ADDR:-}" ] && echo -e "  TEST_TOKEN_ADDRESS=${TOKEN_ADDR}"
[ -n "${PROFILE_ADDR:-}" ] && echo -e "  AGENCY_PROFILE_ADDRESS=${PROFILE_ADDR}"
[ -n "${ATTEST_ADDR:-}" ] && echo -e "  ATTESTATION_ADDRESS=${ATTEST_ADDR}"
[ -n "${MARKET_ADDR:-}" ] && echo -e "  MARKETPLACE_ADDRESS=${MARKET_ADDR}"
echo ""
echo -e "  Then: npm run dev"
echo ""
echo -e "${GREEN}Deploy complete!${NC}"
