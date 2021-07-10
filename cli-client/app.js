const URL = require('url');
const co = require('co');
const prompt = require('co-prompt');
const yaml = require('js-yaml');
const chalk = require('chalk');
const parseArgs = require('./parseArgs');
const { Client } = require('..');

(async () => {
  try {
    const args = parseArgs() || process.exit(1);

    // Check that we have all required params to connect
    if (!['host', 'port', 'clientName', 'key'].every((key) => Object.prototype.hasOwnProperty.call(args, key))) {
      throw new Error('Not all required params are provided. Please see --help.');
    }

    const url = URL.format({
      protocol: args.protocol,
      hostname: args.host,
      port: args.port
    });
    console.log(chalk.blue('Connecting to:'), url);

    const client = await Client.create({
      url,
      clientName: args.clientName,
      key: args.key,
      timeout: 5 * 60 * 1000
    });

    // Ask for input
    co(function* ask() {
      console.log('\n');
      const action = yield prompt(`${chalk.inverse('  action: ')}  `);
      if (action) {
        const rawPayload = yield prompt.multiline(`${chalk.inverse(' payload: ')}  ${chalk.grey(`(${args.format})`)}`);
        let payload = rawPayload;
        if (args.format === 'yaml-to-json') payload = yaml.load(rawPayload);
        if (args.format === 'json') {
          try {
            payload = JSON.parse(rawPayload);
          } catch (e) {
            console.error('Invalid JSON');
          }
        }
        // console.log(chalk.blue('Response:'), yield client.do(action, payload));
        const task = yield client.pub(action, payload);
        console.log(chalk.blue('Response:'), yield task.getResult());
        task.once('end', () => co(ask));
      } else {
        co(ask);
      }
    });
  } catch (e) {
    console.error(e);
  }
})();
