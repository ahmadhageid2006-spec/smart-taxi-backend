const driverService = require("../services/driverService");

const getStatus = async (req, res, next) => {
  try {
    const status = await driverService.getStatus(req.user.id);
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const status = await driverService.updateStatus(
      req.user.id,
      req.body.status
    );
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const location = await driverService.updateLocation(
      req.user.id,
      req.body
    );
    res.status(200).json(location);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStatus,
  updateStatus,
  updateLocation
};
