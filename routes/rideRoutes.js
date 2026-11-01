const express = require('express');
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validationMiddleware");
const {
  positiveId,
  rideCreateValidation,
  rideTypeValidation,
  cancelRideValidation
} = require("../middleware/validators");
const { createRideController } = require("../controllers/rideController");
const defaultRideService = require("../services/rideService").defaultRideService;
const defaultDispatchService = require("../services/dispatchService");

const createRideRoutes = ({
  rideService = defaultRideService,
  dispatchService = defaultDispatchService
} = {}) => {
  const {
    createRide,
    acceptRide,
    startRide,
    completeRide,
    cancelRide,
    getAvailableRides,
    getMyRides,
    getRideById,
    getDispatchCandidates
  } = createRideController(rideService, dispatchService);
  const router = express.Router();

  router.post(
  "/",
  authMiddleware,
  roleMiddleware("PASSENGER"),
  rideCreateValidation,
  validate,
  createRide
  );
  router.get(
  "/available",
  authMiddleware,
  roleMiddleware("DRIVER"),
  rideTypeValidation,
  validate,
  getAvailableRides
  );
  router.get(
  "/dispatch",
  authMiddleware,
  roleMiddleware("DRIVER"),
  getDispatchCandidates
  );
  router.get(
    "/my-rides",
    authMiddleware,
    roleMiddleware("PASSENGER", "DRIVER"),
    getMyRides
  );

  router.get(
    "/:id",
    authMiddleware,
    positiveId,
    validate,
    getRideById
  );

  router.patch(
  "/:id/accept",
  authMiddleware,
  roleMiddleware("DRIVER"),
  positiveId,
  validate,
  acceptRide
  );
  router.patch(
  "/:id/start",
  authMiddleware,
  roleMiddleware("DRIVER"),
  positiveId,
  validate,
  startRide
  );

  router.patch(
  "/:id/complete",
  authMiddleware,
  roleMiddleware("DRIVER"),
  positiveId,
  validate,
  completeRide
  );

  router.patch(
  "/:id/cancel",
  authMiddleware,
  roleMiddleware("PASSENGER", "DRIVER"),
  cancelRideValidation,
  validate,
  cancelRide
  );

  return router;
};

module.exports = createRideRoutes;