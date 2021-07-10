const { Server, Client } = require('..');

async function wait(ms) {
  return new Promise((resolve) => { setTimeout(() => resolve(), ms); });
}

(async () => {
  const config = {
    port: 8080,
    clientName: 'test',
    key: 'asdf'
  };

  // Hub setup
  const hub = new Server({ port: config.port });
  hub.addCredentials(config.clientName, {
    key: config.key,
    // subPermissions: ['mail:send-bulk'],
    // pubPermissions: ['log:error', 'log:warn', 'log:info', 'googlemaps'],
  });
  hub.start();

  // Client: echo and rand number generator.
  const client = await Client.create({
    url: `ws://localhost:${config.port}`,
    clientName: config.clientName,
    key: config.key
  });
  client.sub('test:echo', async (task) => {
    const payload = await task.getPayload();
    console.log('test:echo', payload);
    task.success(payload);
  });
  client.sub('test:rand', async (task) => {
    const payload = await task.getPayload();
    const min = parseFloat(payload.min) || 0;
    const max = parseFloat(payload.max) || 100;
    const rand = Math.floor(Math.random() * ((max - min) + 1)) + min;
    await wait(rand + 1000);
    console.log('test:rand', `'${rand}' is a random int between ${min} and ${max}.`);
    task.success(rand);
  });

  // Info for example client to connect
  const url = `${config.clientName}:${config.key}@localhost:${config.port}`;
  console.log(`URL: ${url}`);
  console.log(`npm run cli-client -- --host localhost --port ${config.port} --clientName ${config.clientName} --key ${config.key}`);
  console.log('Available actions: server:echo, server:rand { min: 0, max: 1 }');
})();
