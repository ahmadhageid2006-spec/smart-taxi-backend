const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateHaversineDistance = (
  driverLatitude,
  driverLongitude,
  pickupLatitude,
  pickupLongitude
) => {
  const latitudeDelta = toRadians(pickupLatitude - driverLatitude);
  const longitudeDelta = toRadians(pickupLongitude - driverLongitude);
  const driverLatitudeRadians = toRadians(driverLatitude);
  const pickupLatitudeRadians = toRadians(pickupLatitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(driverLatitudeRadians) *
      Math.cos(pickupLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

module.exports = { calculateHaversineDistance };
