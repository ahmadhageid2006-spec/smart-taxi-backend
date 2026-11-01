const allowedOrigin = process.env.FRONTEND_URL;
const isProduction = process.env.NODE_ENV === "production";

const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      origin === allowedOrigin ||
      (!isProduction &&
        (/^https?:\/\/localhost(?::\d+)?$/.test(origin) ||
          /^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin)))
    ) {
      return callback(null, true);
    }

    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true
};

module.exports = corsOptions;
