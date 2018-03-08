# TaskHub

Send it tasks, watch as they happen.

# Examples

## Server

```javascript
import { Server } from 'taskhub';

const hub = new Server({
  port: 9999,
  taskStartTimeout: 100 // if hub waits longer than this for subscribing services the task has failed.
  taskFinishTimeout: 1000 * 60 // default max time a task can run, override per task basis
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
  task.start(); 

  // Get payload
  const data = await task.getPayload();

  // Update the caller on current progress
  task.update(data);

  // Done and the data is sent to the caller/publisher.
  return data;
});

// Calling
try {
  let result = await client.pub('mail:send-bulk', emails).getResult();
} catch(err) { }

// Call it with value if error, to avoid the exceptions
let result = await client.pub('mail:send-bulk', emails, 1000 * 60 * 30 /* 30 min */)
  .getResult(valueIfError);

// Call it with progress updates
let finalResult = await client.pub('mail:send-bulk', emails)
  .on('update', (tmpResult) => { /* something */ })
  .getResult(valueIfError);
```
