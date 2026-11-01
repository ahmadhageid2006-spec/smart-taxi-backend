const swaggerJsdoc = require("swagger-jsdoc");

const errorResponses = {
  BadRequest: {
    description: "Bad request",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" }
      }
    }
  },
  ValidationError: {
    description: "Validation failed",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ValidationError" }
      }
    }
  },
  Unauthorized: {
    description: "Authentication is required or the token is invalid"
  },
  Forbidden: {
    description: "The authenticated user is not allowed to perform this action"
  },
  NotFound: {
    description: "Resource not found"
  },
  Conflict: {
    description: "Resource conflict"
  },
  InternalServerError: {
    description: "Internal server error"
  }
};

const protectedOperation = ["bearerAuth"];

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Smart Taxi API",
      version: "1.0.0",
      description: "Backend API for Smart Taxi"
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server"
      }
    ],
    tags: [
      { name: "Authentication", description: "Registration and authentication" },
      { name: "Administration", description: "Administrative account controls" },
      { name: "Drivers", description: "Driver lifecycle operations" },
      { name: "Cars", description: "Driver car management" },
      { name: "Addresses", description: "Saved address management" },
      { name: "Rides", description: "Passenger and driver ride operations" },
      { name: "Notifications", description: "Authenticated in-app notifications" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer", readOnly: true },
            fullName: { type: "string" },
            phone: { type: "string" },
            email: { type: "string", format: "email", nullable: true },
            role: { type: "string", enum: ["PASSENGER", "DRIVER"], readOnly: true }
          }
        },
        UserRegistration: {
          type: "object",
          required: ["fullName", "phone", "password"],
          properties: {
            fullName: { type: "string" },
            phone: { type: "string" },
            password: { type: "string", minLength: 6, format: "password" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["PASSENGER", "DRIVER"] }
          }
        },
        LoginRequest: {
          type: "object",
          required: ["phone", "password"],
          properties: {
            phone: { type: "string" },
            password: { type: "string", format: "password" }
          }
        },
        ProfileUpdate: {
          type: "object",
          properties: {
            fullName: { type: "string" },
            phone: { type: "string" },
            email: { type: "string", format: "email" }
          }
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", format: "password" },
            newPassword: { type: "string", minLength: 6, format: "password" }
          }
        },
        AuthResponse: {
          allOf: [
            { $ref: "#/components/schemas/User" },
            {
              type: "object",
              properties: {
              token: { type: "string", readOnly: true },
              refreshToken: { type: "string", readOnly: true }
              }
            }
          ]
        },
        RefreshTokenRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" }
          }
        },
        BlockUserRequest: {
          type: "object",
          properties: {
            reason: { type: "string", maxLength: 500 }
          }
        },
        DriverStatusRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["ONLINE", "OFFLINE"] }
          }
        },
        DriverStatusResponse: {
          type: "object",
          properties: {
            driverStatus: {
              type: "string",
              enum: ["OFFLINE", "ONLINE", "BUSY"],
              readOnly: true
            }
          }
        },
        DriverLocationRequest: {
          type: "object",
          required: ["latitude", "longitude"],
          additionalProperties: false,
          properties: {
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 }
          }
        },
        DriverLocationResponse: {
          type: "object",
          properties: {
            currentLatitude: { type: "number", format: "double", nullable: true },
            currentLongitude: { type: "number", format: "double", nullable: true }
          }
        },
        Car: {
          type: "object",
          properties: {
            id: { type: "integer", readOnly: true },
            userId: { type: "integer", readOnly: true },
            type: { type: "string", enum: ["NORMAL", "COMFORT"] },
            manufacturer: { type: "string" },
            model: { type: "string" },
            color: { type: "string" },
            plateNumber: { type: "string" },
            createdAt: { type: "string", format: "date-time", readOnly: true },
            updatedAt: { type: "string", format: "date-time", readOnly: true }
          }
        },
        CarRequest: {
          type: "object",
          required: ["type", "manufacturer", "model", "color", "plateNumber"],
          properties: {
            type: { type: "string", enum: ["NORMAL", "COMFORT"] },
            manufacturer: { type: "string" },
            model: { type: "string" },
            color: { type: "string" },
            plateNumber: { type: "string" }
          }
        },
        CarUpdate: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["NORMAL", "COMFORT"] },
            manufacturer: { type: "string" },
            model: { type: "string" },
            color: { type: "string" },
            plateNumber: { type: "string" }
          }
        },
        SavedAddress: {
          type: "object",
          properties: {
            id: { type: "integer", readOnly: true },
            userId: { type: "integer", readOnly: true },
            label: { type: "string", maxLength: 100 },
            address: { type: "string", maxLength: 500 },
            latitude: { type: "number", format: "double", minimum: -90, maximum: 90 },
            longitude: { type: "number", format: "double", minimum: -180, maximum: 180 },
            isDefault: { type: "boolean" },
            createdAt: { type: "string", format: "date-time", readOnly: true },
            updatedAt: { type: "string", format: "date-time", readOnly: true }
          }
        },
        SavedAddressRequest: {
          type: "object",
          required: ["label", "address", "latitude", "longitude"],
          properties: {
            label: { type: "string", maxLength: 100 },
            address: { type: "string", maxLength: 500 },
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
            isDefault: { type: "boolean" }
          }
        },
        SavedAddressUpdate: {
          type: "object",
          properties: {
            label: { type: "string", maxLength: 100 },
            address: { type: "string", maxLength: 500 },
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 }
          }
        },
        Ride: {
          type: "object",
          properties: {
            id: { type: "integer", readOnly: true },
            userId: { type: "integer", readOnly: true },
            workerId: { type: "integer", nullable: true, readOnly: true },
            carId: { type: "integer", nullable: true, readOnly: true },
            pickupAddress: { type: "string" },
            destinationAddress: { type: "string" },
            pickupLatitude: { type: "number", format: "double", minimum: -90, maximum: 90 },
            pickupLongitude: { type: "number", format: "double", minimum: -180, maximum: 180 },
            destinationLatitude: { type: "number", format: "double", minimum: -90, maximum: 90 },
            destinationLongitude: { type: "number", format: "double", minimum: -180, maximum: 180 },
            rideType: { type: "string", enum: ["NORMAL", "COMFORT"] },
            scheduledAt: { type: "string", format: "date-time", nullable: true },
            status: {
              type: "string",
              enum: ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
              readOnly: true
            },
            distanceKm: { type: "number", format: "double", readOnly: true },
            price: { type: "number", format: "double", readOnly: true },
            cancelReason: { type: "string", nullable: true },
            startAt: { type: "string", format: "date-time", nullable: true, readOnly: true },
            completedAt: { type: "string", format: "date-time", nullable: true, readOnly: true },
            cancelAt: { type: "string", format: "date-time", nullable: true, readOnly: true },
            createdAt: { type: "string", format: "date-time", readOnly: true },
            updatedAt: { type: "string", format: "date-time", readOnly: true }
          }
        },
        DispatchRide: {
          type: "object",
          properties: {
            id: { type: "integer", readOnly: true },
            rideType: { type: "string", enum: ["NORMAL", "COMFORT"] },
            pickupAddress: { type: "string" },
            destinationAddress: { type: "string" },
            pickupLatitude: { type: "number", format: "double" },
            pickupLongitude: { type: "number", format: "double" },
            distanceToPickupKm: { type: "number", format: "double" },
            createdAt: { type: "string", format: "date-time", readOnly: true }
          }
        },
        RideRequest: {
          type: "object",
          required: [
            "pickupAddress",
            "destinationAddress",
            "pickupLatitude",
            "pickupLongitude",
            "destinationLatitude",
            "destinationLongitude",
            "rideType"
          ],
          properties: {
            pickupAddress: { type: "string" },
            destinationAddress: { type: "string" },
            pickupLatitude: { type: "number", minimum: -90, maximum: 90 },
            pickupLongitude: { type: "number", minimum: -180, maximum: 180 },
            destinationLatitude: { type: "number", minimum: -90, maximum: 90 },
            destinationLongitude: { type: "number", minimum: -180, maximum: 180 },
            rideType: { type: "string", enum: ["NORMAL", "COMFORT"] },
            scheduledAt: { type: "string", format: "date-time" }
          }
        },
        CancelRideRequest: {
          type: "object",
          properties: {
            cancelReason: { type: "string" }
          }
        },
        Notification: {
          type: "object",
          properties: {
            id: { type: "integer", readOnly: true },
            type: {
              type: "string",
              enum: [
                "RIDE_ACCEPTED",
                "RIDE_STARTED",
                "RIDE_COMPLETED",
                "RIDE_CANCELLED",
                "NO_DRIVER_FOUND"
              ]
            },
            title: { type: "string" },
            message: { type: "string" },
            metadata: { type: "object", nullable: true, additionalProperties: true },
            rideId: { type: "integer", nullable: true },
            readAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time", readOnly: true },
            updatedAt: { type: "string", format: "date-time", readOnly: true }
          }
        },
        NotificationListResponse: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/Notification" }
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
                totalPages: { type: "integer" }
              }
            }
          }
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        },
        ValidationError: {
          type: "object",
          properties: {
            error: { type: "string", example: "Validation failed" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" }
                }
              }
            }
        }
      },
      },
      responses: errorResponses
    },
    paths: {
      "/api/auth/register": {
        post: {
          tags: ["Authentication"],
          summary: "Register a user",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserRegistration" } } }
          },
          responses: {
            201: { description: "User registered", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        }
      },
      "/api/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Log in",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } }
          },
          responses: {
            200: { description: "Authenticated", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" }
          }
        }
      },
      "/api/auth/test-auth": {
        get: {
          tags: ["Authentication"],
          summary: "Verify the current token",
          security: protectedOperation,
          responses: {
            200: { description: "Authenticated user" },
            401: { $ref: "#/components/responses/Unauthorized" }
          }
        }
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Authentication"],
          summary: "Rotate a refresh token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshTokenRequest" }
              }
            }
          },
          responses: {
            200: {
              description: "New access and refresh tokens",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthResponse" }
                }
              }
            },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" }
          }
        }
      },
      "/api/auth/logout": {
        post: {
          tags: ["Authentication"],
          summary: "Revoke a refresh token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshTokenRequest" }
              }
            }
          },
          responses: {
            200: { description: "Logged out successfully" },
            400: { $ref: "#/components/responses/ValidationError" }
          }
        }
      },
      "/api/auth/me": {
        patch: {
          tags: ["Authentication"],
          summary: "Update the authenticated user's profile",
          security: protectedOperation,
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProfileUpdate" } } }
          },
          responses: {
            200: { description: "Profile updated", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        }
      },
      "/api/auth/me/change-password": {
        patch: {
          tags: ["Authentication"],
          summary: "Change the authenticated user's password",
          security: protectedOperation,
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordRequest" } } }
          },
          responses: {
            200: { description: "Password changed" },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" }
          }
        }
      },
      "/api/admin/users/{id}/block": {
        patch: {
          tags: ["Administration"],
          summary: "Block a user",
          description: "ADMIN role required. Revokes all active refresh tokens for the target user.",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/UserId" }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BlockUserRequest" }
              }
            }
          },
          responses: {
            200: { description: "User blocked successfully" },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/admin/users/{id}/unblock": {
        patch: {
          tags: ["Administration"],
          summary: "Unblock a user",
          description: "ADMIN role required.",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/UserId" }],
          responses: {
            200: { description: "User unblocked successfully" },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/drivers/me/status": {
        get: {
          tags: ["Drivers"],
          summary: "Get the authenticated driver's status",
          description: "DRIVER role required.",
          security: protectedOperation,
          responses: {
            200: {
              description: "Current driver status",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DriverStatusResponse" }
                }
              }
            },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" }
          }
        },
        patch: {
          tags: ["Drivers"],
          summary: "Change the authenticated driver's status",
          description: "DRIVER role required. Clients may request ONLINE or OFFLINE; BUSY is controlled by ride lifecycle.",
          security: protectedOperation,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DriverStatusRequest" }
              }
            }
          },
          responses: {
            200: {
              description: "Driver status updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DriverStatusResponse" }
                }
              }
            },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        }
      },
      "/api/drivers/me/location": {
        patch: {
          tags: ["Drivers"],
          summary: "Update the authenticated driver's current location",
          description: "DRIVER role required. The location is always updated for the authenticated driver only.",
          security: protectedOperation,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DriverLocationRequest" }
              }
            }
          },
          responses: {
            200: {
              description: "Driver location updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DriverLocationResponse" }
                }
              }
            },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        }
      },
      "/api/cars": {
        post: {
          tags: ["Cars"],
          summary: "Create the driver's car",
          security: protectedOperation,
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CarRequest" } } }
          },
          responses: {
            201: { description: "Car created", content: { "application/json": { schema: { $ref: "#/components/schemas/Car" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        }
      },
      "/api/cars/me": {
        get: {
          tags: ["Cars"],
          summary: "Get the driver's car",
          security: protectedOperation,
          responses: {
            200: { description: "Driver car", content: { "application/json": { schema: { $ref: "#/components/schemas/Car" } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        },
        patch: {
          tags: ["Cars"],
          summary: "Update the driver's car",
          security: protectedOperation,
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CarUpdate" } } }
          },
          responses: {
            200: { description: "Car updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Car" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        },
        delete: {
          tags: ["Cars"],
          summary: "Delete the driver's car",
          security: protectedOperation,
          responses: {
            200: { description: "Car deleted" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        }
      },
      "/api/addresses": {
        post: {
          tags: ["Addresses"],
          summary: "Create a saved address",
          security: protectedOperation,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SavedAddressRequest" }
              }
            }
          },
          responses: {
            201: {
              description: "Saved address created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SavedAddress" }
                }
              }
            },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" }
          }
        },
        get: {
          tags: ["Addresses"],
          summary: "List the authenticated user's saved addresses",
          security: protectedOperation,
          responses: {
            200: {
              description: "Saved addresses",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/SavedAddress" }
                  }
                }
              }
            },
            401: { $ref: "#/components/responses/Unauthorized" }
          }
        }
      },
      "/api/addresses/{id}": {
        get: {
          tags: ["Addresses"],
          summary: "Get one of the authenticated user's saved addresses",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/AddressId" }],
          responses: {
            200: {
              description: "Saved address",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SavedAddress" }
                }
              }
            },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        },
        patch: {
          tags: ["Addresses"],
          summary: "Update a saved address",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/AddressId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SavedAddressUpdate" }
              }
            }
          },
          responses: {
            200: {
              description: "Saved address updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SavedAddress" }
                }
              }
            },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        },
        delete: {
          tags: ["Addresses"],
          summary: "Delete a saved address",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/AddressId" }],
          responses: {
            200: { description: "Saved address deleted" },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/addresses/{id}/default": {
        patch: {
          tags: ["Addresses"],
          summary: "Set a saved address as the default",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/AddressId" }],
          responses: {
            200: {
              description: "Default address updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SavedAddress" }
                }
              }
            },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/rides": {
        post: {
          tags: ["Rides"],
          summary: "Create a ride",
          description: "PASSENGER role required. Distance and price are calculated by the server.",
          security: protectedOperation,
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RideRequest" } } }
          },
          responses: {
            201: { description: "Ride created", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" }
          }
        }
      },
      "/api/rides/available": {
        get: {
          tags: ["Rides"],
          summary: "List available rides",
          description: "DRIVER role required.",
          security: protectedOperation,
          parameters: [
            { name: "rideType", in: "query", required: false, schema: { type: "string", enum: ["NORMAL", "COMFORT"] } }
          ],
          responses: {
            200: { description: "Available rides", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Ride" } } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" }
          }
        }
      },
      "/api/rides/dispatch": {
        get: {
          tags: ["Rides"],
          summary: "List dispatch candidates for the authenticated driver",
          description: "DRIVER role required. Only pending, car-compatible rides with valid pickup coordinates are returned. This endpoint never assigns or reserves rides.",
          security: protectedOperation,
          responses: {
            200: {
              description: "Dispatch candidates ordered by distance to pickup",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      rides: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DispatchRide" }
                      }
                    }
                  }
                }
              }
            },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        }
      },
      "/api/rides/my-rides": {
        get: {
          tags: ["Rides"],
          summary: "List the authenticated user's rides",
          description: "PASSENGER and DRIVER roles are supported; results are scoped by the server.",
          security: protectedOperation,
          responses: {
            200: { description: "User rides", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Ride" } } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" }
          }
        }
      },
      "/api/rides/{id}": {
        get: {
          tags: ["Rides"],
          summary: "Get a ride",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/RideId" }],
          responses: {
            200: { description: "Ride details", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/rides/{id}/accept": {
        patch: {
          tags: ["Rides"],
          summary: "Accept a pending ride",
          description: "DRIVER role required. The server assigns the driver and car.",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/RideId" }],
          responses: {
            200: { description: "Ride accepted", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
            409: { $ref: "#/components/responses/Conflict" }
          }
        }
      },
      "/api/rides/{id}/start": {
        patch: {
          tags: ["Rides"],
          summary: "Start an accepted ride",
          description: "DRIVER role required; only the assigned driver can start it.",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/RideId" }],
          responses: {
            200: { description: "Ride started", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/rides/{id}/complete": {
        patch: {
          tags: ["Rides"],
          summary: "Complete an in-progress ride",
          description: "DRIVER role required; only the assigned driver can complete it.",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/RideId" }],
          responses: {
            200: { description: "Ride completed", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/rides/{id}/cancel": {
        patch: {
          tags: ["Rides"],
          summary: "Cancel a ride",
          description: "PASSENGER can cancel their own pending or accepted ride. DRIVER can cancel their own accepted ride.",
          security: protectedOperation,
          parameters: [{ $ref: "#/components/parameters/RideId" }],
          requestBody: {
            required: false,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CancelRideRequest" } } }
          },
          responses: {
            200: { description: "Ride cancelled", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/notifications": {
          get: {
            tags: ["Notifications"],
            summary: "List the authenticated user's notifications",
            security: protectedOperation,
            parameters: [
              {
                name: "page",
                in: "query",
                schema: { type: "integer", minimum: 1, default: 1 }
              },
              {
                name: "limit",
                in: "query",
                schema: { type: "integer", minimum: 1, maximum: 50, default: 20 }
              },
              {
                name: "unreadOnly",
                in: "query",
                schema: { type: "boolean", default: false }
              }
            ],
            responses: {
              200: {
                description: "Paginated notifications",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/NotificationListResponse" }
                  }
                }
              },
              400: { $ref: "#/components/responses/ValidationError" },
              401: { $ref: "#/components/responses/Unauthorized" }
            }
          }
        },
        "/api/notifications/unread-count": {
          get: {
            tags: ["Notifications"],
            summary: "Count unread notifications",
            security: protectedOperation,
            responses: {
              200: {
                description: "Unread notification count",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { count: { type: "integer" } }
                    }
                  }
                }
              },
              401: { $ref: "#/components/responses/Unauthorized" }
            }
          }
        },
        "/api/notifications/{id}/read": {
          patch: {
            tags: ["Notifications"],
            summary: "Mark one owned notification as read",
            security: protectedOperation,
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "integer", minimum: 1 }
              }
            ],
            responses: {
              200: {
                description: "Notification marked as read",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Notification" }
                  }
                }
              },
              400: { $ref: "#/components/responses/ValidationError" },
              401: { $ref: "#/components/responses/Unauthorized" },
              404: { $ref: "#/components/responses/NotFound" }
            }
          }
        },
        "/api/notifications/read-all": {
          patch: {
            tags: ["Notifications"],
            summary: "Mark all owned notifications as read",
            security: protectedOperation,
            responses: {
              200: {
                description: "Notifications marked as read",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { updatedCount: { type: "integer" } }
                    }
                  }
                }
              },
              401: { $ref: "#/components/responses/Unauthorized" }
            }
          }
        }
      }
    },
  apis: []
};

options.definition.components.parameters = {
  UserId: {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 },
    description: "Positive user ID"
  },
  RideId: {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 },
    description: "Positive ride ID"
  },
  AddressId: {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 },
    description: "Positive saved address ID"
  }
};

module.exports = swaggerJsdoc(options);
