const crypto = require('crypto');

// Matches the frontend's src/utils/history.js historyEntry() shape.
function historyEntry(type, user, details, from, to) {
  return {
    id: crypto.randomUUID(),
    type,
    user,
    timestamp: new Date().toISOString(),
    details,
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
  };
}

module.exports = { historyEntry };
