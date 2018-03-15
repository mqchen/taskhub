const TaskHub = require('..');

const hub = new TaskHub.Server({ port: 8080 });
hub.addCredential('debug', {
  key: 'password123lol',
  // subPermissions: ['mail:send-bulk'],
  // pubPermissions: ['log:error', 'log:warn', 'log:info', 'googlemaps'],
});
hub.start();
