import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.colorize({ colors: { info: "green", error: "red", warn: "yellow", debug: "blue" }, all: false }),
    winston.format((info) => {
      const dateIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      info.timestamp = dateIST;
      return info;
    })(),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`),
  ),
  transports: [new winston.transports.Console()],
});
