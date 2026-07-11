const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");
const path = require("path");

module.exports = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    reactStrictMode: true,
    images: {
      unoptimized: true,
    },
    serverExternalPackages: ["firebase-admin"],
    webpack: (config, { dev }) => {
      if (dev) {
        config.resolve.alias["@/lib/firebase/admin"] = path.resolve(
          __dirname,
          "tests/mocks/admin-mock.ts"
        );
      }
      return config;
    },
    turbopack: {
      resolveAlias: {
        ...(isDev ? {
          "@/lib/firebase/admin": "./tests/mocks/admin-mock.ts",
        } : {}),
      },
    },
  };
};
