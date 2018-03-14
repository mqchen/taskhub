# TaskHub

PubSubHub - Send it tasks, watch as they happen.

# Task lifecycle

- `start`: A task has been received by the hub and will be sent to subbing services.
  - `pickup`: A service subbing to this task type has picked it up and started work on it.
  - `update`: A service updates all other subbing services about an update.
  - `drop`: A service is done working on it without returning a result.
  - *return*: A service has returned a result, and thereby completed the task globally.
- `complete`: A service has completed and returned a result. Task is considered complete and hub sends complete event to all subbing services.
- `cancel`: The hub or the pub cancels the task. Rarely used.
- `end`: All subbing services have either timedout, completed or dropped, or the hub has cancelled the task.


# Examples

## Server

```javascript
import { Server } from 'taskhub';

const hub = new Server({
  port: 9999,
  taskPickUpTimeout: 100 // if hub waits longer than this for subscribing services the task has failed.
  taskCompleteTimeout: 1000 * 60 // default max time a task can run, override per task basis
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
client.sub('mail:send-bulk', async (task) => {
  // Tell the hub this service will begin work on this task, so that it knows to wait.
  // Otherwise, the hub will assume a task is complete when all listening services has seen it, or timedout. (The timeout is short.)
  task.pickup();

  // Get payload (async because it could be large)
  const data = await task.getPayload();

  // Update the caller on current progress
  task.update(data);

  // Triggers when another service updates the task
  task.on('update', () => {});

  // When another service returns and thereby completes the task globally.
  task.on('complete', () => {});

  // When the hub or the pub decides to cancel the task
  task.on('cancel', () => {});

  // Done and the data is sent to the caller/publisher.
  return data;

  // This service has completed but doesn't want to return a result to pub.
  task.drop();
});

// Calling
try {
  let result = await client.pub('mail:send-bulk', emails).getResult();
} catch(err) { }

// Call it with value if error, to avoid the exceptions, and wait 30 min
let result = await client.pub('mail:send-bulk', emails, 1000 * 60 * 30 /* 30 min */)
  .getResult(valueIfError);

// Call it with progress updates
let finalResult = await client.pub('mail:send-bulk', emails)
  .on('update', (tmpResult) => { /* something */ })
  .getResult(valueIfError);
```