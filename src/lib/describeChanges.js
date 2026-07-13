// Generic version of the frontend's describeTestCaseChanges(), parameterized
// by which fields to track so it can be reused for bugs, requirements, etc.
function describeChanges(before, after, trackedFields) {
  const changes = [];
  for (const field of trackedFields) {
    const prev = before[field];
    const next = after[field];
    if (next !== undefined && JSON.stringify(prev) !== JSON.stringify(next)) {
      changes.push({ field, from: prev, to: next });
    }
  }
  return changes;
}

module.exports = { describeChanges };
