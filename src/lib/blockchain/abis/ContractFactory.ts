// Auto-generated from contracts/src/ContractFactory.sol -- DO NOT EDIT
// Regenerate with: npm run generate:abis

export const CONTRACT_FACTORY_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_platformTreasury",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_paymentToken",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createDeal",
    "inputs": [
      {
        "name": "client",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "agency",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "bd",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "bdFeeBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "termsHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "milestoneNames",
        "type": "string[]",
        "internalType": "string[]"
      },
      {
        "name": "milestoneAmounts",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "milestoneDeadlines",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "tokenName",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "tokenSymbol",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "serviceContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "dealCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deals",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "serviceContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "createdAt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paymentToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "platformTreasury",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "DealCreated",
    "inputs": [
      {
        "name": "dealId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "serviceContract",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  }
] as const;
