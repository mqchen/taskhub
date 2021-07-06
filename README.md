# TaskHub
Send it tasks, watch as they happen.

Important:
- This project is in early development and not all features are implemented yet.
- Backwards compatibility not guaranteed until version 1.x.x

[![Node.js CI](https://github.com/mqchen/taskhub/actions/workflows/node.js.yml/badge.svg)](https://github.com/mqchen/taskhub/actions/workflows/node.js.yml)

# Vocabulary

- `action`: A category of tasks. Example of actions can be: "email:send", "geo:geocode", "email/address:validate". Actions are composed of: `<noun>:<verb>` or `<noun>/<sub.noun>:<verb>`
- `task`: An instance of an `action`, like a job.
- `event`: An event that updates the state of a task. See task lifecycle for complete event reference
- `command`: Messages sent to the hub. Either "pub" or "sub". Kind of like requests. Internal, not exposed in APIs.
- `message`: Messages sent from the hub to the clients. Kind of like responses. Internal, not exposed in APIs.

# Task lifecycle

- `init`: A client asks to start this task.
- `start`: A task has been received by the hub and has been sent to subbing services. Event is triggered when one has started work on the task.
  - `update`: A service updates all other subbing services about an update.
  - `drop`: A service is done working on it without returning a result.
  - *return*: A service has returned a result, and thereby completed the task globally.
- `success`: A service has completed and returned a result. Task is considered complete and hub sends complete event to all subbing services.
- `fail`: A service failed or been cancelled.
- `end`: All subbing services have either timedout, succeeded or dropped, or the hub has cancelled/failed the task.


# Examples

## Server

```javascript
const hub = require('taskhub/server');

const hub = new Server({
  port: 9999,
  taskStartTimeout: 100 // if hub waits longer than this for subscribing services the task has failed.
  taskEndTimeout: 1000 * 60 // default max time a task can run, override per task basis
});
hub.addCredential('mailer', {
  key: '---super-secret-key---',
  subPermissions: [ 'mail:send-bulk' ], // what the service is allowed to listen to
  pubPermissions: [ 'log:error', 'log:warn', 'log:info', 'googlemaps' ], // what the service is allowed to emit. E.g. 'log' so that it can log stuff. 'googlemaps' to ask another service for geocoding there
  maxInstances: 1 // only allow one simultaneous instance from this service. If > 1 hub will distribute events to each connection by round robin. Not implemented.
});

hub.start(); // Open for business
```

## Client

```javascript
import { Client } from 'taskhub';

const client = new Client('ws:server:port', {
  name: 'mailer' // unique name
  key: '---super-secret-key---'
});
client.sub('email/bulk:send', async (task) => {
  // Tell the hub this service will begin work on this task, so that it knows to wait.
  // Otherwise, the hub will assume a task is complete when all listening services has seen it, or timedout. (The timeout is short.)
  task.start();

  // Get payload (async because it could be large)
  const data = await task.getPayload();

  // Update the caller on current progress
  task.update(data);

  // Triggers when another service updates the task
  task.on('update', (task) => { task.getLastUpdate() });

  // When another service returns and thereby completes the task globally.
  task.on('success', () => {});

  // Done and the data is sent to the caller/publisher.
  return data; // or task.success(result);

  // This service has completed but doesn't want to return a result to pub.
  task.drop();
});

// Calling
try {
  let result = await client.pub('email/bulk:send', emails).getResult();
} catch(err) { }

// Call it with value if error, to avoid the exceptions, and wait 30 min
let result = await client.pub('email/bulk:send', emails, 1000 * 60 * 30 /* 30 min */)
  .getResult(valueIfError);

// Call it with progress updates
let finalResult = await client.pub('email/bulk:send', emails)
  .on('update', (tmpResult) => { /* something */ })
  .getResult(valueIfError);
```
