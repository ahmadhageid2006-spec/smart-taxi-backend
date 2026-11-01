const calculateRoadDistance = async (origin, destination) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        throw new Error("Google Maps API key is not configured");
    }

    const url =
        "https://routes.googleapis.com/directions/v2:computeRoutes";

    const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters",
    };

    const body = {
        origin: {
            location: {
                latLng: {
                    latitude: origin.latitude,
                    longitude: origin.longitude,
                },
            },
        },

        destination: {
            location: {
                latLng: {
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                },
            },
        },

        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google Routes API error:", data);

            throw new Error("Failed to calculate road distance");
        }

        if (!data.routes || data.routes.length === 0) {
            throw new Error("No route found between the locations");
        }

        const distanceMeters = data.routes[0].distanceMeters;

        const distanceKm = distanceMeters / 1000;

        return distanceKm;
    } catch (error) {
        console.error("Error calculating road distance:", error);
        throw error;
    }
};
const getMyRides = async (userId, role) => {
    let where = {};

    if (role === "PASSENGER") {
        where.userId = userId;
    } else if (role === "DRIVER") {
        where.workerId = userId;
    } else {
        throw new Error(
            "Only passengers and drivers can view their rides"
        );
    }

    const rides = await Ride.findAll({
        where,
        order: [["createdAt", "DESC"]]
    });

    return rides;
};

module.exports = {
    calculateRoadDistance,
    getMyRides,
};