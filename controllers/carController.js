const CarService = require("../services/carService");

const createCar = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming you have user authentication middleware that sets req.user
    const carData = req.body;
    const car = await CarService.createCar(userId, carData);
    res.status(201).json(car);
  } catch (error) {
    next(error);
  }
};
const getMyCar = async (req, res, next) => {
    try {
        const car = await CarService.getMyCar(req.user.id);

        res.status(200).json(car);
    } catch (error) {
        next(error);
    }
};
const updateMyCar = async (req, res, next) => {
    try {
        const car = await CarService.updateMyCar(
            req.user.id,
            req.body
        );

        res.status(200).json(car);
    } catch (error) {
        next(error);
    }
};
const deleteMyCar = async (req, res, next) => {
    try {
        const result = await CarService.deleteMyCar(
            req.user.id
        );

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
module.exports = {
  createCar,
  getMyCar,
  updateMyCar,
  deleteMyCar
};

/*يأخذ البيانات من req.body.
يأخذ userId من req.user.id القادم من JWT.
يستدعي createCar().
يرجّع Response مناسب. */