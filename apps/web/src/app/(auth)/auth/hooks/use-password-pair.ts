'use client';

import { useState } from 'react';
import { getPasswordError } from '@/app/(auth)/auth/constants/registration-validation';

/**
 * A new password and its confirmation, as the invite and password reset forms take them: the two values, their
 * setters, whether the pair is acceptable, and the field errors (a password's own error once typed, a mismatch once
 * the confirmation is typed).
 */
export function usePasswordPair() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordError = getPasswordError(password);
  const isMismatch = !!confirmPassword && password !== confirmPassword;

  return {
    password,
    confirmPassword,
    onPasswordChange: setPassword,
    onConfirmPasswordChange: setConfirmPassword,
    /** The password passes the rules and the confirmation matches it. */
    isValid: !passwordError && password === confirmPassword,
    errors: {
      password: password ? passwordError : undefined,
      confirmPassword: isMismatch ? 'Passwords do not match' : undefined,
    },
  };
}
