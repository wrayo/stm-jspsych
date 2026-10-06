const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
  },
  webServer: {
    command: "npx http-server . -a 127.0.0.1 -p 4174 -c-1",
    port: 4174,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
