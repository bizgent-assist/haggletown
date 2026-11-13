import 'dotenv/config';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4100),
  appName: process.env.APP_NAME || 'Haggletown',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5174').split(',').map((s) => s.trim()),
  mongoUri: () => required('MONGODB_URI'),
  jwtSecret: () => required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    senderEmail: process.env.BREVO_SENDER_EMAIL || '',
    senderName: process.env.BREVO_SENDER_NAME || 'Haggletown',
  },
  ai: {
    baseUrl: process.env.AI_BASE_URL || 'https://cloud-api.near.ai/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'anthropic/claude-haiku-5-5',
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 400),
  },
  near: {
    network: process.env.NEAR_NETWORK || 'testnet',
    rpcUrl: process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com',
    explorerUrl: process.env.NEAR_EXPLORER_URL || 'https://testnet.nearblocks.io',
    marketContractId: process.env.MARKET_CONTRACT_ID || '',
    operatorAccountId: process.env.OPERATOR_ACCOUNT_ID || '',
    npcKeys: JSON.parse(process.env.NPC_KEYS || '{}'),
  },
  marketTickEnabled: process.env.MARKET_TICK_ENABLED === 'true',
  marketTickSeconds: Math.max(30, Number(process.env.MARKET_TICK_SECONDS || 300)),
};
