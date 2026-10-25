const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "api",
      cwd: path.resolve(__dirname, "../server"),
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "350M",
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    }
  ]
};
