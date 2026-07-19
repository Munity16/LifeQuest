const requiredSecrets = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "RATE_LIMIT_SALT",
  "CRON_SECRET",
];

const problems = [];
for (const name of requiredSecrets) {
  if (!process.env[name]?.trim()) problems.push(`${name} is missing`);
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!appUrl) {
  problems.push("NEXT_PUBLIC_APP_URL is missing");
} else {
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== "https:") problems.push("NEXT_PUBLIC_APP_URL must use HTTPS in production");
    if (["localhost", "127.0.0.1"].includes(parsed.hostname)) problems.push("NEXT_PUBLIC_APP_URL must use the deployed hostname");
  } catch {
    problems.push("NEXT_PUBLIC_APP_URL must be a valid URL");
  }
}

if (process.env.DEMO_MODE_ENABLED !== "false") problems.push("DEMO_MODE_ENABLED must be false for normal production use");
if ((process.env.RATE_LIMIT_SALT || "").length < 32) problems.push("RATE_LIMIT_SALT must contain at least 32 characters");
if ((process.env.CRON_SECRET || "").length < 32) problems.push("CRON_SECRET must contain at least 32 characters");

const retentionDays = Number(process.env.PROOF_RETENTION_DAYS || "30");
if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
  problems.push("PROOF_RETENTION_DAYS must be an integer from 1 to 365");
}

if (problems.length) {
  console.error("Production configuration is not ready:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("Production environment names and non-secret constraints are valid.");
}
