const crypto = require('crypto');

// Generate a random string of 32 characters (256 bits)
const secretKey = crypto.randomBytes(32).toString('hex');

console.log(secretKey);
