
module.exports = function Auth(server, client, msg) {
  // Validate message
  if (!Object.prototype.hasOwnProperty.call(msg, 'name')
  || !Object.prototype.hasOwnProperty.call(msg, 'key')) {
    throw new TypeError('Auth messages must have props: name, key.');
  }

  const creds = server.getCredentialFor(msg.name);
  if (!creds || creds.key !== msg.key) return false;

  // TODO: check if credentials already in use.

  return true;
};
