import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const RPC_URL = "https://rpc-bradbury.genlayer.com";
export const EXPLORER_URL = "https://explorer-bradbury.genlayer.com";
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || "") as `0x${string}`;

declare global {
  interface Window { ethereum?: any; }
}

export function readClient() {
  return createClient({ chain: testnetBradbury, endpoint: RPC_URL });
}

export function writeClient(account: `0x${string}`) {
  return createClient({
    chain: testnetBradbury,
    endpoint: RPC_URL,
    account,
    provider: window.ethereum,
  });
}

export async function waitForBradbury(client: any, hash: string) {
  return client.waitForTransactionReceipt({
    hash: hash as any,
    status: TransactionStatus.ACCEPTED,
    interval: 2000,
    retries: 150,
  });
}
