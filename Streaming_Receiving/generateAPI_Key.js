const crypto = require('crypto');

function generateApiKey(length = 32) {
  return crypto.randomBytes(length).toString('hex'); // or 'base64'
}

console.log(generateApiKey()); // 64 hex chars
