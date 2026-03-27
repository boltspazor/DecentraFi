/**
 * Optional Railway pre-deploy hook: set RAILWAY_RUN_DEPLOY=true and DEPLOY_NETWORK (sepolia | mainnet).
 * Add to railway.toml: preDeployCommand = ["npm run railway:predeploy"]
 */
const { execSync } = require("child_process");

if (process.env.RAILWAY_RUN_DEPLOY !== "true") {
  console.log(
    "[railway-predeploy] Skipped (set RAILWAY_RUN_DEPLOY=true to deploy contracts before start)."
  );
  process.exit(0);
}

const network = process.env.DEPLOY_NETWORK || "sepolia";
if (!["sepolia", "mainnet"].includes(network)) {
  console.error("[railway-predeploy] DEPLOY_NETWORK must be sepolia or mainnet");
  process.exit(1);
}

console.log(`[railway-predeploy] Deploying to ${network}...`);
execSync(`npx hardhat run scripts/deploy.ts --network ${network}`, {
  stdio: "inherit",
  env: process.env,
});
