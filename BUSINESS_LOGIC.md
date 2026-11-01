Smart Taxi API — Business Logic & Domain Rules

Purpose

This document explains the business logic, domain rules, state machines, security rules, and important backend decisions implemented in Smart Taxi so far.

It is intended for:

personal revision

explaining the project to a mentor or training supervisor

reviewing the system before adding new features

1. Project Overview

Smart Taxi is a backend API for a taxi/ride-hailing system.

Current roles:

PASSENGER

DRIVER

ADMIN

Main stack:

Node.js

Express

MySQL

Sequelize

JWT

bcrypt

The backend follows a modular-monolith style with responsibilities separated roughly as:

Request
  ↓
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Model
  ↓
MySQL
  ↓
Response

The important business rules live mainly in the service layer.

Ride Offers and Expanding Radius

After a ride is persisted as PENDING, the backend starts an in-memory offer
attempt. It searches for connected, eligible drivers in these stages:

1. 3 km, then wait 15 seconds.
2. 5 km, then wait 15 seconds.
3. 10 km, then wait 20 seconds.

Driver eligibility is evaluated from current database state: DRIVER role,
unblocked account, ONLINE status, registered compatible car, and valid current
coordinates. The driver's authenticated private room is the only offer
recipient. NORMAL cars receive NORMAL rides; COMFORT cars receive both ride
types.

The `ride:offer` payload contains only the ride ID, ride type, pickup and
destination addresses, pickup coordinates, and driver-to-pickup distance.
Each driver receives at most one offer per in-memory attempt. A newly eligible
connected driver can receive an offer at a later radius stage.

Acceptance remains authoritative in `rideService.acceptRide()`. Successful
acceptance stops the attempt; passenger cancellation also stops it. After the
final wait, if the ride is still PENDING, the passenger's authenticated
private room receives `ride:no-driver-found`. The ride remains PENDING because
the existing Ride status enum has no compatible NO_DRIVER_FOUND value.

Offer timers are process-local and are cleared on acceptance, cancellation,
completion, and application shutdown. They are not durable across process
restarts. Socket.IO delivery failure never changes the result of successful
ride persistence.

2. Core Domain

Main entities:

User
 ├── Role
 ├── Account status
 ├── Driver status
 └── Car

Car
 └── belongs to a Driver

Ride
 ├── Passenger
 ├── Driver
 └── Car

RefreshToken
 └── belongs to a User

3. User Roles

PASSENGER

A passenger can:

register

login

create rides

view their rides

view an individual ride they are allowed to access

cancel their own eligible rides

manage their own account/password

DRIVER

A driver can:

login

have one registered car

change availability between OFFLINE and ONLINE

view available rides

accept a pending ride

start an accepted ride

complete an in-progress ride

cancel an assigned accepted ride according to the business rules

ADMIN

Admin functionality currently includes blocking and unblocking users.

Advanced admin management/dashboard functionality is intentionally deferred.

4. Registration Business Logic

Public registration creates a user with the default role:

PASSENGER

Required information:

full name

phone

password

Email is optional.

Phone must be unique.

Email is unique when provided.

Passwords are never stored as plain text.

Flow:

Register
  ↓
Validate input
  ↓
Hash password
  ↓
Create User
  ↓
Return safe user information

The client does not control privileged server-owned fields.

5. Authentication

Authentication uses:

short-lived Access JWT

long-lived Refresh Token

The access token is currently configured for about 15 minutes by default.

The JWT identifies the user and role, but it is not treated as the complete current user state.

The database remains the source of truth for mutable state such as blocking.

6. Refresh Tokens

Refresh tokens allow a user to obtain a new access token without logging in again.

Refresh tokens are:

randomly generated

stored only as hashes

associated with a user

given an expiration date

revocable

Raw refresh tokens are never stored in the database.

Flow:

Login
  ↓
Access Token + Refresh Token

Access token expires
  ↓
Refresh Token
  ↓
Verify hash
  ↓
Check expiration/revocation
  ↓
Check current user
  ↓
Revoke old refresh token
  ↓
Create new refresh token
  ↓
Return new tokens

This is refresh-token rotation.

7. Logout

Logout revokes the supplied refresh token.

After revocation it cannot be used to create another access session.

8. Password Change

A user can change their own password.

The backend:

authenticates the user

verifies the current password

validates the new password

hashes the new password

stores the new hash

revokes active refresh tokens

Revoking sessions after a password change is a security rule.

9. Account Blocking

User account state includes:

isBlocked
blockedAt
blockReason

An admin can block or unblock a user.

When blocked:

isBlocked = true
blockedAt = current server time
blockReason = provided reason

Active refresh tokens are revoked.

Blocking is also checked by authentication middleware, not only at login.

Flow:

Request
  ↓
Verify JWT
  ↓
Load current User from DB
  ↓
Is blocked?
 ├── Yes → reject
 └── No  → continue

Important principle:

JWT identifies the user, but the database is the source of truth for current account state.

An admin cannot block themselves.

Blocking/unblocking uses transactions for consistency.

10. Driver Lifecycle

A driver has an operational state:

OFFLINE
ONLINE
BUSY

This is separate from the user's role.

Example:

role = DRIVER
driverStatus = ONLINE

means the user is a driver and currently available for rides.

State machine:

OFFLINE
   ↓
ONLINE
   ↓
BUSY
   ↓
ONLINE
   ↓
OFFLINE

11. Driver Status Rules

The client can manually request only:

ONLINE
OFFLINE

The client cannot manually set:

BUSY

BUSY is controlled by ride operations.

This prevents the client from falsely manipulating the driver's operational state.

12. Going ONLINE

A driver must have a registered car before becoming ONLINE.

Driver has car
+
Request ONLINE
      ↓
ONLINE allowed

Without a car:

ONLINE request
      ↓
No car
      ↓
409 Conflict

This is a business rule, not simple input validation.

13. Going OFFLINE

Normal transition:

ONLINE → OFFLINE

A BUSY driver cannot manually change to OFFLINE.

Why?

Because BUSY means the driver is currently involved in a ride.

The ride lifecycle is responsible for returning the driver to ONLINE.

14. Car Business Logic

Each driver can have one registered car.

Car information includes:

type

manufacturer

model

color

plate number

The backend determines ownership from the authenticated user.

The client cannot choose another driver's userId.

15. Car Deletion Rules

A driver cannot delete their car while:

ONLINE

or:

BUSY

Otherwise the system could reach:

Driver = ONLINE/BUSY
Car = NULL

which violates the domain rules.

Therefore the driver must be OFFLINE before deleting the car.

Existing protection also prevents deletion when the car is referenced by rides where the historical relationship must be preserved.

16. Ride Lifecycle

Ride states:

PENDING
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED

Normal flow:

PENDING
   ↓
ACCEPTED
   ↓
IN_PROGRESS
   ↓
COMPLETED

Cancellation:

PENDING ─────→ CANCELLED

ACCEPTED ────→ CANCELLED

Currently:

IN_PROGRESS → CANCELLED

is not allowed.

17. Ride Creation

A passenger creates a ride.

Ride information can include:

pickup address

destination address

pickup coordinates

destination coordinates

ride type

notes

scheduled time

Passenger identity comes from authentication.

The client does not decide ownership by sending an arbitrary userId.

New rides start as:

PENDING

18. Available Rides

Drivers can request available rides.

Available rides are:

status = PENDING

They can optionally be filtered by:

NORMAL
COMFORT

Passenger information exposed to drivers is intentionally limited to required fields.

19. Ride Access Rules

A passenger can access their own rides.

A driver can access rides assigned to them.

Knowing a ride ID is not enough to access another user's private ride.

Ownership and assignment are enforced server-side.

20. Accept Ride

Only a driver can accept a ride.

Requirements:

Driver has car
+
Driver is ONLINE
+
Ride is PENDING

Successful acceptance changes:

Ride:
PENDING → ACCEPTED

Driver:
ONLINE → BUSY

The driver is assigned to the ride.

The car is associated with the ride for operational and historical tracking.

21. Accept Ride Concurrency

Two drivers may attempt to accept the same ride at nearly the same time.

The backend protects this using:

database transactions

row locking

conditional state updates

Conceptually:

BEGIN TRANSACTION

Lock ride
Lock driver

Check:
  Ride is PENDING
  Driver is ONLINE

Ride:
  PENDING → ACCEPTED

Driver:
  ONLINE → BUSY

COMMIT

If another driver has already accepted the ride, the second driver gets a conflict.

Important invariant:

A pending ride can be successfully accepted by only one driver.

22. Start Ride

Only the assigned driver can start an accepted ride.

Requirements:

Ride = ACCEPTED
+
Authenticated driver = assigned driver
+
Driver = BUSY

Transition:

ACCEPTED → IN_PROGRESS

The server sets the official start time:

startAt = current server time

The client does not control the official start timestamp.

23. Complete Ride

Only the assigned driver can complete an in-progress ride.

Requirements:

Ride = IN_PROGRESS
+
Authenticated driver = assigned driver
+
Driver = BUSY

Successful transition:

Ride:
IN_PROGRESS → COMPLETED

Driver:
BUSY → ONLINE

The server sets:

completedAt = current server time

The related state changes are protected so the system does not end in an inconsistent state such as:

Ride = COMPLETED
Driver = BUSY

24. Passenger Cancellation

A passenger can cancel only their own ride.

Allowed states:

PENDING
ACCEPTED

PENDING

PENDING → CANCELLED

No driver state changes.

ACCEPTED

ACCEPTED → CANCELLED

The assigned driver returns:

BUSY → ONLINE

Driver/car assignment remains stored for historical consistency.

25. Driver Cancellation

A driver can cancel only an assigned ride that is:

ACCEPTED

After cancellation:

Ride:
ACCEPTED → CANCELLED

Driver:
BUSY → ONLINE

26. In-Progress Cancellation

Currently:

IN_PROGRESS → CANCELLED

is not allowed.

This is an intentional MVP business rule.

27. Server-Owned State

A major principle throughout the project is:

The client requests an action; the server owns the resulting state.

The client should not control protected fields such as:

userId
workerId
role
driverStatus = BUSY
ride status
price
distance
timestamps

For example, a client cannot assign itself to a ride simply by sending another workerId.

The authenticated identity and business rules determine the assignment.

Likewise, the client cannot simply send:

status = COMPLETED

and force a ride to complete.

28. Validation vs Business Rules

These are deliberately separated.

Validation

Checks whether input is structurally valid.

Example:

status = HELLO

is invalid input.

Usually:

400 Bad Request

Business Rule

Checks whether a valid action is allowed in the current state.

Example:

Driver = BUSY
Request = OFFLINE

The input is valid, but the operation is not allowed.

Usually:

409 Conflict

29. HTTP Status Code Strategy

General strategy:

400
Invalid/malformed input or validation error

401
Missing/invalid authentication

403
Authenticated but not authorized

404
Resource not found

409
Business-state conflict

500
Unexpected server error

Examples:

Invalid status value
→ 400

No JWT
→ 401

Passenger using driver-only endpoint
→ 403

Ride does not exist
→ 404

Accepting an already accepted ride
→ 409

Deleting car while ONLINE
→ 409

30. Middleware Responsibilities

Authentication Middleware

Responsible for:

reading the Bearer token

verifying the JWT

loading the current user

checking that the user still exists

checking whether the user is blocked

attaching authenticated information to req.user

Role Middleware

Checks whether the authenticated user has the required role.

Validation Middleware

Checks and normalizes request input.

It does not decide business state transitions.

31. Controller Responsibilities

Controllers are intentionally thin.

General flow:

Receive request
  ↓
Read authenticated user / validated input
  ↓
Call service
  ↓
Send HTTP response

Controllers should not contain large business workflows.

For example:

rideController.acceptRide()

delegates the actual business logic to:

rideService.acceptRide()

32. Service Responsibilities

Services contain business/domain logic.

Examples:

authService
carService
driverService
rideService

Services decide:

whether an operation is allowed

valid state transitions

database changes

whether a transaction is needed

business errors

33. Transactions

Transactions are used when multiple database changes must succeed together.

Examples:

Accept

Ride PENDING → ACCEPTED
+
Driver ONLINE → BUSY

Complete

Ride IN_PROGRESS → COMPLETED
+
Driver BUSY → ONLINE

Accepted cancellation

Ride ACCEPTED → CANCELLED
+
Driver BUSY → ONLINE

Account blocking

User blocked
+
Refresh tokens revoked

If a required operation fails, the transaction can roll back.

34. Important Domain Invariants

Driver

BUSY should represent a driver who is currently involved in a ride.

Car

An ONLINE driver must have a registered car.

Ride

An ACCEPTED or IN_PROGRESS ride has an assigned driver.

Acceptance

Only one driver can successfully accept a pending ride.

Passenger ownership

A passenger can manage only their own rides.

Driver assignment

A driver can manage only rides assigned to them.

Account security

Blocked users cannot continue using protected endpoints.

35. Security Principles

Current security-related business rules include:

bcrypt password hashing

JWT authentication

refresh-token rotation

hashed refresh-token storage

refresh-token revocation

session revocation after password change

blocked-user checks

role-based authorization

request validation

rate limiting

Helmet

controlled CORS

centralized error handling

server-owned state

selective database attributes

no unnecessary sensitive data exposure

36. Full Ride Flow

Passenger
   │
   │ Create ride
   ↓
Ride PENDING
   │
   │ Driver goes ONLINE
   ↓
Driver available
   │
   │ Accept
   ↓
Ride ACCEPTED
Driver BUSY
   │
   │ Start
   ↓
Ride IN_PROGRESS
Driver BUSY
   │
   │ Complete
   ↓
Ride COMPLETED
Driver ONLINE

Cancellation:

PENDING
   │
   └── Cancel → CANCELLED


ACCEPTED
   │
   └── Cancel → CANCELLED
                   +
                 Driver ONLINE

37. Current Project Status

Implemented:

Authentication
    ✅

Refresh Tokens
    ✅

Account Blocking
    ✅

Car Management
    ✅

Driver Lifecycle
    ✅

Ride Lifecycle
    ✅

Validation / Authorization
    ✅

Security Middleware
    ✅

Swagger Documentation
    ✅

Transactions / Concurrency Protection
    ✅

Planned next features:

Saved Addresses
Driver Dispatch
Socket.IO / Realtime
Scheduled Rides
Pricing V2
Database Migrations

Notification V1 implementation

Notifications are persisted in the `notifications` table and are scoped to the
authenticated recipient. Ride acceptance, start, completion, and eligible
cancellation notifications are created inside the existing ride transaction.
The `notification:new` Socket.IO event is emitted only after commit and is
best-effort; the database feed remains authoritative for offline users.

The no-driver-found dispatch path preserves the existing `ride:no-driver-found`
event and additionally stores an idempotent `NO_DRIVER_FOUND` notification.
Notification rows use a server-generated unique deduplication key, so repeated
event processing does not create duplicate persistent rows. This does not
provide exactly-once Socket.IO delivery.

Advanced admin dashboard/management and automated testing are intentionally deferred for now.

38. Key Engineering Lessons

Controller != Business Logic

Controllers coordinate HTTP requests. Services implement domain rules.

JWT != Current User State

JWT identifies the user. The database remains the source of truth for mutable state.

Validation != Business Rules

Validation checks input. Business logic checks whether the operation is allowed now.

State Machines Matter

Driver and Ride states represent valid transitions, not arbitrary strings.

Server-Owned State

The client requests operations. The server decides the resulting state.

Transactions

Related database changes that must succeed together should be atomic.

Concurrency

Two clients can act at nearly the same time, so critical state transitions need database-level protection.

Invariants

A good backend actively prevents impossible or inconsistent domain states.

39. Mentor-Level Summary

Smart Taxi is a Node.js/Express/MySQL backend for a taxi system. It is structured as a modular monolith with separated routes, middleware, controllers, services, and models.

The backend currently implements JWT authentication with rotating hashed refresh tokens, role-based authorization, account blocking, car management, driver availability, and a ride lifecycle.

The driver uses OFFLINE, ONLINE, and BUSY. Rides use PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, and CANCELLED.

Business rules are enforced server-side. A driver must have a car before going online. A busy driver cannot manually go offline. Only an online driver can accept a pending ride. Accepting a ride atomically changes the ride to accepted and the driver to busy. Starting and completing rides require the correct assigned driver and valid state. Completing or cancelling an assigned accepted ride restores the driver to online.

The system also protects ride acceptance against concurrent drivers using transactions, row locking, and conditional updates, ensuring that only one driver can win a pending ride.

The project is therefore beyond basic CRUD: it models domain rules, state machines, ownership, authorization, transactions, concurrency, and security in a realistic backend architecture.