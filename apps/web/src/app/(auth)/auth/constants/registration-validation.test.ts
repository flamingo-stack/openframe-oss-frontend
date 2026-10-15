/**
 * Pins the registration rules to the auth server's (openframe-oss-lib `CoreUserRequest`,
 * `TenantRegistrationRequest`, `@ValidEmail`, `@TenantDomain`). What the form passes, the server must
 * accept, and the other way round: a name the form lets through came back as a 400, or as a bare 502
 * from the edge firewall when it carried `">`.
 */

import { describe, expect, it } from 'vitest';
import {
  getPasswordError,
  isValidPersonName,
  normalizePersonName,
  ORG_NAME_REGEX,
  PASSWORD_COMPLEXITY_ERROR,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_TOO_SHORT_ERROR,
  PERSON_NAME_REGEX,
  TENANT_SUBDOMAIN_REGEX,
  VALID_EMAIL_REGEX,
} from './registration-validation';

// फ़्राँसिस spelled out: फ + nukta, virama, र, vowel sign aa, candrabindu, स, vowel sign i, स.
const DEVANAGARI_WITH_MARKS = 'फ़्राँसिस';

describe('PERSON_NAME_REGEX', () => {
  it.each([
    'Антон',
    "Мар'яна",
    'फ़्राँसिस',
    DEVANAGARI_WITH_MARKS,
    'चद José-María',
    // José with a combining acute accent instead of the precomposed é.
    'José',
    "O'Brien",
    "Ng'ang'a",
    '王小明',
    'Mary Ann',
    'a'.repeat(50),
  ])('accepts %s', name => {
    expect(PERSON_NAME_REGEX.test(name)).toBe(true);
  });

  it.each(['Ivan "Vanya"', 'a">', '<b>', '1Ivan', '-Ivan', "'Ivan", ' Ivan', 'Ivan!', 'a'.repeat(51), ''])(
    'rejects %s',
    name => {
      expect(PERSON_NAME_REGEX.test(name)).toBe(false);
    },
  );

  it('counts the 50-character limit in characters, not UTF-16 units', () => {
    // 𠀀 is outside the BMP: two UTF-16 units, one letter to the server's regex.
    expect(PERSON_NAME_REGEX.test('𠀀'.repeat(50))).toBe(true);
    expect(PERSON_NAME_REGEX.test('𠀀'.repeat(51))).toBe(false);
  });
});

describe('isValidPersonName / normalizePersonName', () => {
  it('judges the name as it is sent: trimmed', () => {
    expect(isValidPersonName('  Ivan  ')).toBe(true);
    expect(normalizePersonName('  Ivan  ')).toBe('Ivan');
  });

  it('sends the typographic apostrophe iOS types as the plain one, which is the only one the server accepts', () => {
    expect(PERSON_NAME_REGEX.test('O’Brien')).toBe(false);
    expect(isValidPersonName('O’Brien')).toBe(true);
    expect(normalizePersonName('O’Brien')).toBe("O'Brien");
  });

  it('treats a blank name as invalid', () => {
    expect(isValidPersonName('   ')).toBe(false);
  });
});

describe('PASSWORD_COMPLEXITY_REGEX', () => {
  it.each([...'!@#$%^&*()_+-={}[]|:;"\'<>,.?/'])('counts %s as the special character', special => {
    expect(PASSWORD_COMPLEXITY_REGEX.test(`Passw0rd${special}`)).toBe(true);
  });

  it.each(['~', '`', '\\', ' ', '€'])('does not count %s, which the server does not either', special => {
    expect(PASSWORD_COMPLEXITY_REGEX.test(`Passw0rd${special}`)).toBe(false);
  });

  it.each([
    ['no uppercase letter', 'passw0rd!'],
    ['no lowercase letter', 'PASSW0RD!'],
    ['no digit', 'Password!'],
    ['no special character', 'Passw0rd'],
    // The server's [A-Z] / [a-z] are ASCII only.
    ['a non-ASCII uppercase letter only', 'Пassw0rd!'],
  ])('rejects a password with %s', (_case, password) => {
    expect(PASSWORD_COMPLEXITY_REGEX.test(password)).toBe(false);
  });
});

describe('getPasswordError', () => {
  it('reports the length first, then the complexity', () => {
    expect(getPasswordError('')).toBe(PASSWORD_TOO_SHORT_ERROR);
    expect(getPasswordError('Pa0!')).toBe(PASSWORD_TOO_SHORT_ERROR);
    expect(getPasswordError('password')).toBe(PASSWORD_COMPLEXITY_ERROR);
    expect(getPasswordError('Passw0rd!')).toBeUndefined();
  });
});

describe('VALID_EMAIL_REGEX', () => {
  it.each(['kate@acme.com', 'kate.lee+signup@mail.acme.co.uk', 'k_l%1@acme-corp.io'])('accepts %s', email => {
    expect(VALID_EMAIL_REGEX.test(email)).toBe(true);
  });

  it.each(['a@b.c', 'kate@acme', 'josé@acme.com', "o'brien@acme.com", 'kate@acme.c0m', 'kate @acme.com'])(
    'rejects %s',
    email => {
      expect(VALID_EMAIL_REGEX.test(email)).toBe(false);
    },
  );
});

describe('ORG_NAME_REGEX', () => {
  it.each(['Acme', 'Acme & Co.', 'Joe’s Shop', "Joe's Shop", 'Acme "Labs" (EU), Inc', 'Ätna-42'])(
    'accepts %s',
    name => {
      expect(ORG_NAME_REGEX.test(name)).toBe(true);
    },
  );

  it.each(['A', 'Acme!', 'a<b>', 'x'.repeat(101)])('rejects %s', name => {
    expect(ORG_NAME_REGEX.test(name)).toBe(false);
  });
});

describe('TENANT_SUBDOMAIN_REGEX', () => {
  it.each(['acme', 'acme-corp', 'a1-b2-c3', '0acme'])('accepts %s', subdomain => {
    expect(TENANT_SUBDOMAIN_REGEX.test(subdomain)).toBe(true);
  });

  // The server slugifies the subdomain and rejects it unless that changes nothing: Slugify trims
  // leading and trailing hyphens and collapses doubled ones.
  it.each(['-acme', 'acme-', 'a--b', '-', ''])('rejects %s', subdomain => {
    expect(TENANT_SUBDOMAIN_REGEX.test(subdomain)).toBe(false);
  });
});
