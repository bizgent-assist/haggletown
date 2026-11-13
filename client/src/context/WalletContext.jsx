// Player wallet via @hot-labs/near-connect. Players sign their own trades; Haggletown never holds their keys.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { config } from '../config/env.js';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const connectorRef = useRef(null);
  const [accountId, setAccountId] = useState(null);
  const [ready, setReady] = useState(false);

  const getConnector = useCallback(async () => {
    if (connectorRef.current) return connectorRef.current;
    const { NearConnector } = await import('@hot-labs/near-connect');
    const connector = new NearConnector({ network: config.network, features: { signAndSendTransaction: true } });
    connector.on('wallet:signIn', (e) => setAccountId(e.accounts?.[0]?.accountId || null));
    connector.on('wallet:signOut', () => setAccountId(null));
    connectorRef.current = connector;
    return connector;
  }, []);

  // Restore an existing session silently.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const connector = await getConnector();
        await connector.whenManifestLoaded;
        const wallet = await connector.wallet().catch(() => null);
        const accounts = wallet ? await wallet.getAccounts().catch(() => []) : [];
        if (alive) setAccountId(accounts[0]?.accountId || null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getConnector]);

  const connect = useCallback(async () => {
    const connector = await getConnector();
    await connector.connect();
    const wallet = await connector.wallet();
    const accounts = await wallet.getAccounts();
    setAccountId(accounts[0]?.accountId || null);
  }, [getConnector]);

  const disconnect = useCallback(async () => {
    const connector = await getConnector();
    await connector.disconnect().catch(() => {});
    setAccountId(null);
  }, [getConnector]);

  /** Signs one function call on the market contract. Returns the transaction hash. */
  const callMarket = useCallback(
    async ({ methodName, args, deposit = '0', gas = '50000000000000' }) => {
      const connector = await getConnector();
      const wallet = await connector.wallet();
      const [account] = await wallet.getAccounts();
      const result = await wallet.signAndSendTransaction({
        signerId: account.accountId,
        receiverId: config.marketContractId,
        actions: [{ type: 'FunctionCall', params: { methodName, args, gas, deposit } }],
      });
      const hash = result?.transaction?.hash || result?.transaction_outcome?.id;
      if (!hash) throw new Error('The wallet did not return a transaction hash');
      return hash;
    },
    [getConnector],
  );

  const value = useMemo(
    () => ({ ready, accountId, connect, disconnect, callMarket }),
    [ready, accountId, connect, disconnect, callMarket],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => useContext(WalletContext);
