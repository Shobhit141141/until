import winston from "winston";

/** Default "debug" so no step is hidden. Set LOG_LEVEL=info in prod if desired. */
const LOG_LEVEL = process.env.LOG_LEVEL ?? "debug";

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.colorize({
      colors: { info: "green", error: "red", warn: "yellow", debug: "blue" },
      all: false,
    }),
    winston.format((info) => {
      const dateIST = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
      });
      info.timestamp = dateIST;
      return info;
    })(),
    winston.format.printf((info) => {
      const { level, message, timestamp, ...meta } = info;
      const metaStr =
        Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} ${level}: ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

/** Pretty log for credit/STX transactions. amountStx can be positive (credit) or negative (debit). */
export function logTransaction(
  type: string,
  walletAddress: string,
  amountStx: number,
  balanceStx: number,
  ref?: { txId?: string; runId?: string }
): void {
  const walletShort = walletAddress.length >= 12 ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-4)}` : walletAddress;
  const sign = amountStx >= 0 ? "+" : "";
  const refStr = ref?.txId ? ` txId=${ref.txId.slice(0, 12)}…` : ref?.runId ? ` runId=${ref.runId.slice(0, 8)}…` : "";
  logger.info(
    `[TX] ${type.padEnd(16)} wallet=${walletShort} ${sign}${amountStx.toFixed(4)} STX  balance=${balanceStx.toFixed(4)} STX${refStr}`
  );
}
