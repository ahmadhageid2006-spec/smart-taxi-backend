
const PRICE_PER_KM = 2;

const calculatePrice = (distanceKm, rideType) => {
    if (distanceKm <= 0) {
        throw new Error("Distance must be greater than zero");
    }

    if (!["NORMAL", "COMFORT"].includes(rideType)) {
        throw new Error(
            "Invalid ride type. Must be either 'NORMAL' or 'COMFORT'"
        );
    }

    let price = distanceKm * PRICE_PER_KM;

    if (rideType === "COMFORT") {
        price *= 1.02;
    }

    return Number(price.toFixed(2));
};

module.exports = {
    calculatePrice,
};