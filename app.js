require("dotenv").config();

const http = require("http");
const sequelize = require("./config/database");
const User = require("./models/user");
const { createApp } = require("./appFactory");
const { initializeSocket } = require("./socket");
const { stopAllDispatches } = require("./services/rideOfferService");

const app = createApp();
const server = http.createServer(app);
let io;
let startupPromise;
let shutdownPromise;
let transportClosePromise;
let databaseClosePromise;
let startupState = "starting";
let isShuttingDown = false;

const PORT = process.env.PORT || 3000;
const shouldAlterDevelopmentSchema = () =>
  process.env.NODE_ENV === "development";
const shouldSyncSchema = () => process.env.NODE_ENV !== "integration";

// نحتفظ بوعود الإغلاق حتى لا يؤدي أكثر من signal أو مسار فشل إلى
// إغلاق الاتصال نفسه عدة مرات.
const closeDatabase = () => {
  if (!databaseClosePromise) {
    databaseClosePromise = sequelize.close().then(
      () => {
        console.log("Database connection closed.");
      },
      (error) => {
        console.error("Failed to close the database connection.");
        throw error;
      }
    );
  }

  return databaseClosePromise;
};

const closeHttpServer = () =>
  new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
        reject(error);
        return;
      }

      resolve();
    });
  });

const closeTransport = () => {
  if (!transportClosePromise) {
    transportClosePromise = (async () => {
      if (io) {
        await new Promise((resolve, reject) => {
          try {
            io.close((error) => {
              if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
                reject(error);
                return;
              }

              resolve();
            });
          } catch (error) {
            reject(error);
          }
        });
      }

      await closeHttpServer();
    })();
  }

  return transportClosePromise;
};

const startServer = async () => {
  if (startupPromise) {
    return startupPromise;
  }

  startupPromise = (async () => {
    // أي dispatch مؤقت من تشغيل سابق داخل العملية يجب ألا يبقى فعالاً
    // أثناء بدء تشغيل transport جديد.
    stopAllDispatches();

    try {
      if (shouldSyncSchema()) {
        if (shouldAlterDevelopmentSchema()) {
          await User.sync({ alter: true });
        }
        await sequelize.sync();
      }
      console.log("Database synced successfully.");

      if (isShuttingDown) {
        startupState = "cancelled";
        return false;
      }

      // Socket.IO يركب على نفس HTTP server حتى تشترك طلبات REST
      // واتصالات WebSocket في دورة حياة واحدة.
      io = initializeSocket(server);
      await new Promise((resolve, reject) => {
        const handleError = (error) => {
          server.removeListener("error", handleError);
          reject(error);
        };

        server.once("error", handleError);
        server.listen(PORT, () => {
          server.removeListener("error", handleError);
          resolve();
        });
      });

      if (isShuttingDown) {
        startupState = "cancelled";
        return false;
      }

      startupState = "started";
      console.log(`Server running on port ${PORT}`);
      return true;
    } catch (error) {
      startupState = "failed";
      console.error("Failed to initialize the application.");
      try {
        await closeTransport();
      } catch (closeError) {
        console.error("Failed to close the HTTP server.");
      }
      try {
        await closeDatabase();
      } catch (closeError) {
        console.error("Failed to close the database connection.");
      }
      process.exitCode = 1;
      return false;
    }
  })();

  return startupPromise;
};

const gracefulShutdown = (signal) => {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  isShuttingDown = true;
  shutdownPromise = (async () => {
    console.log(`${signal} received. Shutting down gracefully.`);

    try {
      if (startupPromise) {
        await startupPromise;
      }

      // نوقف مؤقتات وحالات dispatch قبل إغلاق النقل وقاعدة البيانات؛
      // ويمكن للـ callbacks التي تفحص stopped التوقف عند نقاطها اللاحقة،
      // لكن العمل غير المتزامن الذي بدأ فعلاً قد يكمل جزءاً من تنفيذه.
      stopAllDispatches();

      try {
        await closeTransport();
      } catch (closeError) {
        console.error("Failed to close the HTTP server.");
        process.exitCode = 1;
      }

      try {
        await closeDatabase();
      } catch (closeError) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error("Failed to shut down gracefully.");
      process.exitCode = 1;
    }
  })();

  return shutdownPromise;
};

if (require.main === module) {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  startServer();
}

module.exports = {
  app,
  server,
  startServer,
  gracefulShutdown,
  shouldAlterDevelopmentSchema,
  shouldSyncSchema
};
