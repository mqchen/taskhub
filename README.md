# TaskHub

Send it tasks, watch as they happen.

# Examples

## Server

```javascript
import { Server } from 'taskhub';

const hub = new Server({ port: 9999 });
hub.addCredential('geocode', {
  key: '---super-secret-key---',
  listenPermissions: [ 'geocode' ], // what the service is allowed to listen to
  emitPermissions: [ 'log', 'googlemaps' ], // what the service is allowed to emit. E.g. 'log' so that it can log stuff. 'googlemaps' to ask another service for geocoding there
  maxInstances: 1 // only allow one simultaneous instance from this service. If > 1 hub will distribute events to each connection by round robin. Not implemented.
});

hub.start(); // Open for business
```

## Client

```javascript
import { Client } from 'taskhub';

const client = new Client('ws:server:port', {
  name: 'geocode' // unique name
  key: '---super-secret-key---'
});
client.on('geocode:coords-to-address', async (task) => {
  const data = await task.getPayload();
  // Do something magical
  return data; // done
});

let result = await client.emit('geocode:coords-to-address').getResult(valueIfError);
```
