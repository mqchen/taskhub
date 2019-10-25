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
    if (!['host', 'port', 'service', 'key'].every((key) => Object.prototype.hasOwnProperty.call(args, key))) {
      throw new Error('Not all required params are provided. Please see --help.');
    }

    const url = URL.format({
      protocol: args.protocol,
      hostname: args.host,
      port: args.port
    });
    console.log(chalk.blue('Connecting to:'), url);

    const client = await Client.create(url, args.service, args.key);

    // Ask for input
    co(function* ask() {
      console.log('\n');
      const action = yield prompt(`${chalk.inverse('  action: ')}  `);
      if (action) {
        const payload = yaml.safeLoad(yield prompt.multiline(`${chalk.inverse(' payload: ')}  ${chalk.grey('(yaml)')}`));
        console.log(chalk.blue('Response:'), yield client.do(action, payload));
      }
      co(ask);
    });
  } catch (e) {
    console.error(e);
  }
})();
