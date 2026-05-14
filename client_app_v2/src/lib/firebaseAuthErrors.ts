/**
 * Maps Firebase / Identity Toolkit errors to actionable copy for the UI.
 * Email/password `OPERATION_NOT_ALLOWED` means the provider is disabled in Firebase Console.
 */
function getAuthCode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null || !('code' in err)) return null;
  const code = (err as { code: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function getMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

export function formatFirebaseAuthError(err: unknown): string {
  const code = getAuthCode(err);

  if (code === 'auth/operation-not-allowed') {
    return (
      'Email and password sign-in is disabled for this Firebase project. ' +
      'In the Firebase console: Authentication → Sign-in method → enable Email/Password, then try again.'
    );
  }
  if (code === 'auth/admin-restricted-operation') {
    return (
      'This sign-in method is restricted. In Firebase: Authentication → Sign-in method → enable Email/Password ' +
      '(and check Identity Platform policies if applicable).'
    );
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Use a stronger password.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'That email is already registered. Sign in instead.';
  }
  if (code === 'auth/invalid-email') {
    return 'Enter a valid email address.';
  }
  if (
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential'
  ) {
    return 'Incorrect email or password.';
  }

  const raw = getMessage(err);
  if (raw.includes('OPERATION_NOT_ALLOWED')) {
    return (
      'Email and password sign-in is disabled for this Firebase project. ' +
      'In the Firebase console: Authentication → Sign-in method → enable Email/Password, then try again.'
    );
  }

  return raw || 'Authentication failed.';
}
