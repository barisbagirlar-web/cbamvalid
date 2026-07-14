const { execSync } = require('child_process');

console.log("Running next dev with mock...");
try {
  const output = execSync("NODE_OPTIONS='--require ./tests/e2e/mock-firebase-admin.js' npm run dev", { 
    env: { ...process.env, AUTH_ALLOW_MOCK: 'true' },
    timeout: 10000 
  });
  console.log(output.toString());
} catch (e) {
  if (e.stdout) console.log("STDOUT:", e.stdout.toString());
  if (e.stderr) console.log("STDERR:", e.stderr.toString());
}
