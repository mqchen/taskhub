const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

module.exports = () => {
  // CONFIG
  // args
  const argsDef = [
    {
      name: 'protocol',
      type: String,
      typeLabel: '{underline prototcol}',
      description: 'Either ws or wss',
      defaultValue: 'ws'
    },
    {
      name: 'host',
      type: String,
      typeLabel: '{underline server host/domain}',
      description: 'Host (domain) to the server, e.g. taskhub.io or localhost'
    },
    {
      name: 'port',
      type: Number,
      typeLabel: '{underline server port}',
      description: 'The port number your host is listening on'
    },
    {
      name: 'clientName',
      type: String,
      typeLabel: '{underline client name}',
      description: 'The name of your client for authentication as, e.g. debug'
    },
    {
      name: 'key',
      type: String,
      typeLabel: '{underline secret key}',
      description: 'The key your client uses for authentication. Your API key.'
    },
    {
      name: 'format',
      type: String,
      typeLabel: '{underline yaml-to-json, json, plain}',
      description: 'Choose a format for writing payloads. Default is yaml-to-json.',
      defaultValue: 'yaml-to-json'
    },
    {
      name: 'help',
      alias: 'h',
      type: Boolean,
      description: 'Prints this.',
      defaultValue: false
    }
  ];
  const args = commandLineArgs(argsDef);
  const usage = commandLineUsage([
    {
      header: 'Taskhub CLI client',
      content: 'CLI client for connecting to a Taskhub server. Use it for testing and debugging.'
    },
    {
      header: 'Options',
      optionList: argsDef
    }
  ]);

  if (args.help) {
    console.log(usage);
    return undefined;
  }

  return args;
};
