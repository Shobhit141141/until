export const STACKS_API_URL =
  process.env.STACKS_API_URL ?? "https://api.testnet.hiro.so";

export const STACKS_RECIPIENT_ADDRESS = process.env.STACKS_RECIPIENT_ADDRESS ?? "";

/** Platform wallet private key (hex) for sending STX on withdrawals. Must hold sufficient balance. */
export const STACKS_SENDER_SECRET_KEY = process.env.STACKS_SENDER_SECRET_KEY ?? "";

/** "testnet" | "mainnet" — network for withdrawals. */
export const STACKS_NETWORK = process.env.STACKS_NETWORK === "mainnet" ? "mainnet" : "testnet";
