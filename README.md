## About Tracing API

Tracing API is a package, which allows tracking way of your business entity in the system.

## Installation

## Usage
First, you need to import package and init it. After it, you should to connect package to the database
for storing tracing data. Method `setup` of the storage instance will run migrations for creating tables of the package.
```
const TracingAPI = require("tracing-api");

const tracing = TracingAPI.init();
tracing
    .storage
    .connect('DB_HOST', 'DB_USER', 'DB_PASSWORD', DB_PORT, 'DB_NAME')
    .setup();
```

If you want to use current server as an api for UI, you should register routes:
```
const TracingAPIRoutes = require("tracing-api/routes");

app.use('/tracing-ui', TracingAPIRoutes)
```

## Tracing
Before calling any methods for tracing, tracing entities should be registered. Name and key of the entity are used as
parameters.
```
TracingAPI.registerEntity('Leads', 'leads');
TracingAPI.registerEntity('Users', 'users');
TracingAPI.registerEntity('Calls', 'calls');
```

For tracing instances of any entities you registered before, next method should be used:
```
await TracingAPI.trace('users', 1, "Event name", {
    firstValue: 1,
    secondValue: 'second value'
});
```
First parameter of the method shown above is a key of the registered entity. Second parameter is a unique id of your
tracing instance (id of the user or lead, as an example). Third parameter is an event name, like:
- Lead created;
- Lead transferred;
- Lead deleted etc.
Last parameter of the trace method is an additional data, which should be shown in the UI.

## UI
API package can be used with UI, created with React: https://github.com/VladyslavProkhorenko/tracing-ui
