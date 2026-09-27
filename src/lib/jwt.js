const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signToken({ userId, workspaceId = null }) {
  return jwt.sign({ sub: userId, workspaceId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { signToken, verifyToken };
