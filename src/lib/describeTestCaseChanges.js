const TRACKED_FIELDS = [
  'title', 'module', 'scenario', 'preconditions', 'priority', 'assignee',
  'testData', 'expected', 'actual', 'status', 'devRemarks', 'qaRemarks',
];

// Ported from the frontend's src/utils/history.js describeTestCaseChanges().
function describeTestCaseChanges(before, after) {
  const changes = [];
  for (const field of TRACKED_FIELDS) {
    const prev = before[field];
    const next = after[field];
    if (next !== undefined && JSON.stringify(prev) !== JSON.stringify(next)) {
      changes.push({ field, from: prev, to: next });
    }
  }
  return changes;
}

module.exports = { describeTestCaseChanges };
