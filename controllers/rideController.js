const defaultRideService = require("../services/rideService").defaultRideService;
const dispatchService = require("../services/dispatchService");

const createRideController = (rideService, dispatchProvider) => ({
  createRide: async (req, res, next) => {
    try {
        const ride = await rideService.createRide(req.user.id, req.body);
        res.status(201).json(ride);
    } catch (error) {
        next(error);
    }
  },
  acceptRide: async (req, res, next) => {
  try {
    const ride = await rideService.acceptRide(
      req.params.id,
      req.user.id
    );

    res.status(200).json(ride);
  } catch (error) {
    next(error);
  }
  },
  startRide: async (req, res, next) => {

  
    try {
        const ride = await rideService.startRide(req.params.id, req.user.id);
        res.status(200).json(ride);
    } catch (error) {
        next(error);
    } 

  },

  completeRide: async (req, res, next) => {
    try {
        const ride = await rideService.completeRide(req.params.id, req.user.id);
        res.status(200).json(ride);
    } catch (error) {
        next(error);
    }
  },
  cancelRide: async (req, res, next) => {
    try {
        const ride = await rideService.cancelRide(
            req.params.id,
            req.user.id,
            req.user.role,
            req.body.cancelReason
        );
        res.status(200).json(ride);
    } catch (error) {
        next(error);
    }
  },
  getAvailableRides: async (req, res, next) => {
    try {
        const rides = await rideService.getAvailableRides(
            req.query.rideType
        );

        res.status(200).json(rides);
    } catch (error) {
        next(error);
    }
  },
  getRideById: async (req, res, next) => {
    try {
        const ride = await rideService.getRideById(
            req.params.id,
            req.user.id,
            req.user.role
        );

        res.status(200).json(ride);
    } catch (error) {
        next(error);
    }
  },
  getMyRides: async (req, res, next) => {
    try {
        const rides = await rideService.getMyRides(
            req.user.id,
            req.user.role
        );

        res.status(200).json(rides);
    } catch (error) {
        next(error);
    }
  },
  getDispatchCandidates: async (req, res, next) => {
    try {
      const rides = await dispatchProvider.getDispatchCandidates(req.user.id);
      res.status(200).json({ rides });
    } catch (error) {
      next(error);
    }
  }
});

const defaultController = createRideController(defaultRideService, dispatchService);

module.exports = {
  ...defaultController,
  createRideController
};