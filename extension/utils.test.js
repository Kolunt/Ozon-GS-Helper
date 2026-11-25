const {
  insertGsSeparators,
  looksLikeMarkingCode,
  isReadyToFormat,
  findAi91Index,
  findAi92Index,
  GS,
} = require('./utils');

const SAMPLE_CODES = [
  '0104630301673229215Y%l?Y91EE1292xjU+A8qhtFrM7jaZby0146+W2Fn4Vma/TuCEBEsQQL4=',
  '01046303016732292157KbsN91EE12923QA8RHOD0tcftzM8gsWTyZfN/Bk7Z0GrhVIjhGetMLc=',
  '0104630301673229215JaJBs91EE1292X21Grlc5tRtLLmq6KmJxwiKFW2+NdXAjGbOVCAMEDpw=',
  '0104630301673298215Lmab&91EE1292EXecPQPqhGJND+AHhQmDxxe3r8VmQ/usZv609Tlln78=',
  '0104630301673298215XC<mV91EE1292zoFBCW0qtsFRQPWy8J7yEYYtCmQLYoBhCFSqBs7zfb0=',
  '0104630301673298215oqfek91EE1292ZQt+LND6a10jY01lojPofgnTfSaj1GWahVtvSPJNGt8=',
  '0104630301673298215ZS:k-91EE1292WMwPVGoTkQCak5FrkARRvOSPR5QNMWCsZjyKfDyOwIs=',
];

const OZON_DOC_EXAMPLE =
  '0104670169195143215I"JGrqKtde;"91EE1092VVq30cfr3rwkHolbZkUITFzWddIGY8UKrjdV+OPYAM4=';

const OZON_DOC_EXPECTED =
  '0104670169195143215I"JGrqKtde;"' + GS + '91EE10' + GS + '92VVq30cfr3rwkHolbZkUITFzWddIGY8UKrjdV+OPYAM4=';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertGsPositions(raw, formatted) {
  const idx91 = findAi91Index(raw);
  const idx92 = findAi92Index(raw, idx91);

  assert(idx91 !== -1, 'AI 91 should be found');
  assert(idx92 !== -1, 'AI 92 should be found');
  assert(formatted.length === raw.length + 2, 'should add exactly 2 GS characters');
  assert(formatted.slice(0, idx91) === raw.slice(0, idx91), 'prefix before AI 91 must match');
  assert(formatted.charCodeAt(idx91) === 29, `GS expected before AI 91 at ${idx91}`);
  assert(formatted.slice(idx91 + 1, idx91 + 3) === '91', 'AI 91 must follow first GS');
  assert(
    formatted.charCodeAt(idx92 + 1) === 29,
    `GS expected before AI 92 at ${idx92 + 1}`
  );
  assert(formatted.slice(idx92 + 2, idx92 + 4) === '92', 'AI 92 must follow second GS');
  assert(
    formatted.slice(idx92 + 4) === raw.slice(idx92 + 2),
    'crypto tail after AI 92 must match'
  );
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  OK  ${name}`);
  } catch (err) {
    failed++;
    console.error(` FAIL ${name}: ${err.message}`);
  }
}

console.log('Running utils tests...\n');

for (let i = 0; i < SAMPLE_CODES.length; i++) {
  const raw = SAMPLE_CODES[i];
  test(`sample code #${i + 1}`, () => {
    assert(looksLikeMarkingCode(raw), 'should look like marking code');
    const formatted = insertGsSeparators(raw);
    assertGsPositions(raw, formatted);
  });
}

test('Ozon documentation example', () => {
  const formatted = insertGsSeparators(OZON_DOC_EXAMPLE);
  assert(formatted === OZON_DOC_EXPECTED, 'should match Ozon documentation output');
});

test('screenshot code from Ozon modal', () => {
  const raw =
    '0104630301673298215nRG5Q91EE1292Frt+SinadEZar+zgNC4jnxQyJ7c/Q3y+hVQbAnYme64=';
  assert(looksLikeMarkingCode(raw), 'should look like marking code');
  assertGsPositions(raw, insertGsSeparators(raw));
});

test('second screenshot code from Ozon modal', () => {
  const raw =
    '0104630301670143215nRCS091EE1292Ert+5lna8EZaR+agNC4jnXQyJ7c/Q3y+hVQbAeYeo64=';
  assert(looksLikeMarkingCode(raw), 'should look like marking code');
  assertGsPositions(raw, insertGsSeparators(raw));
});

test('already formatted code is unchanged', () => {
  const raw = SAMPLE_CODES[0];
  const formatted = insertGsSeparators(raw);
  const again = insertGsSeparators(formatted);
  assert(again === formatted, 'double formatting should be no-op');
});

test('arbitrary text is unchanged', () => {
  const text = 'hello world';
  assert(!looksLikeMarkingCode(text), 'plain text should not match');
  assert(insertGsSeparators(text) === text, 'plain text should pass through');
});

test('short string is unchanged', () => {
  const short = '0104630301673229215Y';
  assert(insertGsSeparators(short) === short, 'short code should pass through');
});

test('wrong structure is unchanged', () => {
  const bad = '0104630301673229215Y%l?YXXEE1292xjU+A8qhtFrM7jaZby0146+W2Fn4Vma/TuCEBEsQQL4=';
  assert(insertGsSeparators(bad) === bad, 'invalid AI markers should pass through');
});

test('isReadyToFormat detects complete scanner input', () => {
  const partial = '0104630301670143215nRCS0';
  const complete =
    '0104630301670143215nRCS091EE1292Ert+5lna8EZaR+agNC4jnXQyJ7c/Q3y+hVQbAeYeo64=';
  assert(!isReadyToFormat(partial), 'partial scan should not be ready');
  assert(isReadyToFormat(complete), 'complete scan should be ready');
});

test('multiline paste is rejected', () => {
  const multiline = `${SAMPLE_CODES[0]}\n${SAMPLE_CODES[1]}`;
  assert(!looksLikeMarkingCode(multiline), 'multiline should not match');
  assert(insertGsSeparators(multiline) === multiline.trim(), 'multiline should pass through unchanged');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
