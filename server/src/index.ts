import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { api } from "./routes.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: config.corsOrigins.length === 1 && config.corsOrigins[0] === "*"
      ? true
      : config.corsOrigins,
  }),
);

app.use("/api", api);

app.get("/", (_req, res) => {
  res.json({ name: "iris-server", env: config.env });
});

app.listen(config.port, () => {
  console.log(
    `\n  iris server — cross-chain options on Derive\n` +
      `  ─ env:      ${config.env} (${config.constants.restUrl})\n` +
      `  ─ trading:  ${config.tradingEnabled ? `enabled (subaccount ${config.subaccountId})` : "disabled (read-only — set .env to enable orders)"}\n` +
      `  ─ listening http://localhost:${config.port}\n`,
  );
});
