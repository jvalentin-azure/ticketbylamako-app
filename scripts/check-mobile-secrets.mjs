import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");

const blockedPublicEnv = [
  { key: "EXPO_PUBLIC_WC_CONSUMER_KEY", processValue: process.env.EXPO_PUBLIC_WC_CONSUMER_KEY },
  { key: "EXPO_PUBLIC_WC_CONSUMER_SECRET", processValue: process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET },
  { key: "EXPO_PUBLIC_JWT_SECRET", processValue: process.env.EXPO_PUBLIC_JWT_SECRET },
  { key: "EXPO_PUBLIC_REWARDS_API_KEY", processValue: process.env.EXPO_PUBLIC_REWARDS_API_KEY },
];

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    values[key] = value;
  }
  return values;
}

const dotEnv = parseDotEnv(envPath);
const offenders = [];

for (const { key, processValue } of blockedPublicEnv) {
  const dotEnvValue = dotEnv[key];
  if (processValue) offenders.push(`${key} from process environment`);
  if (dotEnvValue) offenders.push(`${key} from .env`);
}

if (offenders.length > 0) {
  console.error("Mobile build blocked: deprecated public secrets are present.");
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  console.error("");
  console.error("Move WooCommerce, JWT, and rewards secrets to WordPress/server-side configuration.");
  console.error("Only safe public values may use the EXPO_PUBLIC_ prefix.");
  process.exit(1);
}

console.log("Mobile secret check passed: no deprecated public secrets found.");
