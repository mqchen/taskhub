const TaskHub = require('..');

const hub = new TaskHub.Server({ port: 8080 });
hub.start();
