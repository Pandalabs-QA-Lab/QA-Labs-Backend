// Ported from the frontend's src/utils/testCaseId.js / bugId.js so the
// canonical TC-{code}-{seq} / BUG-{code}-{seq} format stays identical.

function moduleCode(moduleName) {
  const letters = (moduleName || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length >= 2) return letters.slice(0, 2);
  if (letters.length === 1) return `${letters}X`;
  return 'GE';
}

const TC_ID_REGEX = /^TC-([A-Z]{2})-(\d+)$/;
const BUG_ID_REGEX = /^BUG-([A-Z]{2})-(\d+)$/;

function isValidTcId(id) {
  return typeof id === 'string' && TC_ID_REGEX.test(id);
}

function isValidBugId(id) {
  return typeof id === 'string' && BUG_ID_REGEX.test(id);
}

function nextSequence(existingIds, code, regex) {
  let max = 0;
  for (const id of existingIds) {
    const match = typeof id === 'string' ? id.match(regex) : null;
    if (match && match[1] === code) {
      const num = parseInt(match[2], 10);
      if (num > max) max = num;
    }
  }
  return max + 1;
}

// existingTcIds: array of sourceTcId strings already used in the project
// (across all modules - the regex match filters to the relevant code).
function nextTcId(moduleName, existingTcIds) {
  const code = moduleCode(moduleName);
  const seq = nextSequence(existingTcIds, code, TC_ID_REGEX);
  return `TC-${code}-${String(seq).padStart(3, '0')}`;
}

function nextBugId(moduleName, existingBugIds) {
  const code = moduleCode(moduleName);
  const seq = nextSequence(existingBugIds, code, BUG_ID_REGEX);
  return `BUG-${code}-${String(seq).padStart(3, '0')}`;
}

module.exports = { moduleCode, isValidTcId, isValidBugId, nextTcId, nextBugId };
