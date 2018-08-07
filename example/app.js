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
  const client = await TaskHub.Client.create(`ws://localhost:${config.port}`, config.service, config.key);
  client.sub('test:echo', async (task) => {
    console.log('test:echo', await task.getPayload());
  });
  client.sub('test:rand', async (task) => {
    const payload = await task.getPayload();
    const min = parseFloat(payload.min) || 0;
    const max = parseFloat(payload.max) || 100;
    const rand = Math.floor(Math.random() * ((max - min) + 1)) + min;
    console.log('test:rand', `'${rand}' is a random int between ${min} and ${max}.`);
  });
})();

console.log(`RUN: wscat -c localhost:${config.port} -H service:${config.service} -H key:${config.key}`);
console.log('Available action: test:echo');

hub.start();
