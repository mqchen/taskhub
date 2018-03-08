# TaskHub

Send it tasks, watch as they happen.

# Examples

## Server

```javascript
import { Server } from 'taskhub';

const hub = new Server({ port: 9999 });
hub.addCredential('mailer', {
  key: '---super-secret-key---',
  listenPermissions: [ 'mail:send-bulk' ], // what the service is allowed to listen to
  emitPermissions: [ 'log:error', 'log:warn', 'log:info', 'googlemaps' ], // what the service is allowed to emit. E.g. 'log' so that it can log stuff. 'googlemaps' to ask another service for geocoding there
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
client.on('mail:send-bulk', async (task) => {
  // Tell the hub this service will begin work on this task, so that it knows to wait.
  // Otherwise, the hub will assume a task is complete when all listening services has seen it, or timedout. (The timeout is short.)
  task.start(); 

  // Get payload
  const data = await task.getPayload();

  // Update the caller on current progress
  task.update(data);

  // Done and the data is sent to the emitter.
  return data;
});

// Call it
try {
  let result = await client.emit('mail:send-bulk', emails).getResult();
} catch(TaskException e) { }

// Call it with value if error, to avoid the excpetions
let result = await client.emit('mail:send-bulk', emails).getResult(valueIfError);

// Call it with progress updates
let finalResult = await client.emit('mail:send-bulk', emails).on('update', (tmpResult) => { /* something */ }).getResult(null);
```
