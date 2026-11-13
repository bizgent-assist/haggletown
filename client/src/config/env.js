export const config = {
  apiUrl: import.meta.env.VITE_API_URL || '/api/v1',
  network: import.meta.env.VITE_NEAR_NETWORK || 'testnet',
  marketContractId: import.meta.env.VITE_MARKET_CONTRACT_ID || 'market.haggletown-2026.testnet',
  explorerUrl: import.meta.env.VITE_EXPLORER_URL || 'https://testnet.nearblocks.io',
};

export const txUrl = (hash) => `${config.explorerUrl}/txns/${hash}`;
export const accountUrl = (id) => `${config.explorerUrl}/address/${id}`;
