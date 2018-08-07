const TaskHub = require('..');

const config = {
  port: 8080,
  service: 'test',
  key: 'password123lol'
};

const hub = new TaskHub.Server({ port: config.port });
hub.addCredential(config.service, {
  key: config.key,
  // subPermissions: ['mail:send-bulk'],
  // pubPermissions: ['log:error', 'log:warn', 'log:info', 'googlemaps'],
});

(async () => {
  const client = await TaskHub.Client.create(`ws://localhost:${config.port}`);
  client.sub('test:echo', async (task) => {
    console.log(await task.getPayload());
  });
})();

console.log(`RUN: wscat -c localhost:${config.port} -H service:${config.service} -H key:${config.key}`);
console.log('Available action: test:echo');

hub.start();
