 Deploy & Test
                                                                                                                                          
  Deploy contracts
                                                                                                                                          
  # Set in .env.local:                                                                                                                  
  DEPLOYER_PRIVATE_KEY=0x...        # wallet with Base Sepolia ETH                                                                        
  PLATFORM_TREASURY=0x...           # your wallet (receives 2.5% fees)                                                                    
                                                                                                                                          
  # Deploy:                                                                                                                               
  ./scripts/deploy.sh                                                                                                                     
  # or:                                                                                                                                 
  pnpm deploy                                                                                                                             
   
  This will:                                                                                                                              
  1. Build contracts                                                                                                                    
  2. Deploy test USDC (if PAYMENT_TOKEN_ADDRESS not set)                                                                                
  3. Deploy ServiceContract + ContractToken             
                                                                                                                                          
  Get testnet ETH (for gas)
                                                                                                                                          
  Base Sepolia faucets:                                                                                                                   
  - https://www.alchemy.com/faucets/base-sepolia                                                                                          
  - https://faucet.quicknode.com/base/sepolia                                                                                             
                                                                                                                                        
  Get testnet USDC                                                                                                                        
   
  The deploy script deploys a test USDC and mints 1M to your wallet. Or use Circle's testnet USDC at                                      
  0x036CbD53842c5426634e7929541eC2318f3dCF7e on Base Sepolia.                                                                           
                                                                                                                                          
  Run locally                                                                                                                           

  pnpm install
  cp .env.example .env.local                                                                                                              
  # Fill in NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET, DATABASE_URL
  pnpm dev                                                                                                                                
  # → http://localhost:3000 (Privy works on localhost)      