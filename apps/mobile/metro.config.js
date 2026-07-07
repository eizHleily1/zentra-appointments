const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

const config = getDefaultConfig(__dirname);
const backendUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

const apiProxy = createProxyMiddleware({
  changeOrigin: true,
  pathRewrite: { "^/api": "" },
  target: backendUrl
});

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url?.startsWith("/api")) {
        return apiProxy(req, res, next);
      }

      return middleware(req, res, next);
    };
  }
};

module.exports = config;
