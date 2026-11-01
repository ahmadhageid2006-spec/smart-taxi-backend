const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const AppError = require("./utils/appError");
const swaggerSpec = require("./config/swagger");
const corsOptions = require("./config/cors");

const createApp = (options = {}) => {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";

  // هذا المصنع يركّب HTTP فقط؛ لذلك يمكن للاختبارات إنشاء نفس المسارات
  // دون تشغيل منفذ الإنتاج أو تهيئة Socket.IO تلقائياً.
  app.use(cors(corsOptions));
  app.use(helmet());
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use(express.json());

  const createRideRoutes = require("./routes/rideRoutes");
  app.use("/api/rides", createRideRoutes(options.ride));
  app.use("/api/cars", require("./routes/carRoutes"));
  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/admin", require("./routes/adminRoutes"));
  app.use("/api/drivers", require("./routes/driverRoutes"));
  app.use("/api/addresses", require("./routes/addressRoutes"));
  app.use("/api/notifications", require("./routes/notificationRoutes"));

  // تسجيل العلاقات هنا يضمن أن الاستعلامات التي تعتمد على aliases
  // تستخدم نفس نماذج Sequelize التي حمّلها التطبيق.
  require("./models/associations");

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/", (req, res) => {
    res.send("Smart Taxi API is running");
  });

  app.use((err, req, res, next) => {
    // تصل أخطاء Middleware وController وService إلى هذا الحد المركزي،
    // ثم تتحول أخطاء AppError إلى statusCode خاص بها، بينما تبقى الأخطاء
    // غير المتوقعة 500 ولا تكشف تفاصيلها في production.
    if (isProduction) {
      console.error("Unhandled application error");
    } else {
      console.error(err);
    }

    const isOperationalError = err instanceof AppError;
    const statusCode = isOperationalError ? err.statusCode : 500;
    const message =
      isOperationalError || !isProduction
        ? err.message
        : "Internal server error";

    res.status(statusCode).json({
      error: message || "Internal server error"
    });
  });

  return app;
};

module.exports = { createApp };
