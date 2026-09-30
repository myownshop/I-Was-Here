import { describe, it, expect } from 'vitest';
import {
  isValidFirebaseApiKey,
  getFirebaseConfigStatus,
  getReadableFirebaseError,
  DEFAULT_FIREBASE_CONFIG,
} from './firebase';

describe('Firebase Configuration & Error Handling', () => {
  it('identifies valid and invalid Firebase API keys correctly', () => {
    // Valid format
    expect(isValidFirebaseApiKey('AIzaSyCkNMjZN-Gd28I6Zt-d2TrJBbbhOoG8xTk')).toBe(true);

    // Placeholders and invalid formats
    expect(isValidFirebaseApiKey('')).toBe(false);
    expect(isValidFirebaseApiKey(undefined)).toBe(false);
    expect(isValidFirebaseApiKey(null)).toBe(false);
    expect(isValidFirebaseApiKey('YOUR_FIREBASE_API_KEY')).toBe(false);
    expect(isValidFirebaseApiKey('MY_FIREBASE_API_KEY')).toBe(false);
    expect(isValidFirebaseApiKey('AIzaSyPlaceholderKeyForLocalDevelopment')).toBe(false);
    expect(isValidFirebaseApiKey('short')).toBe(false);
    expect(isValidFirebaseApiKey('undefined')).toBe(false);
  });

  it('provides a structured configuration status', () => {
    const status = getFirebaseConfigStatus();
    expect(status).toHaveProperty('isConfigured');
    expect(status).toHaveProperty('apiKeySource');
    expect(status).toHaveProperty('projectId');
    expect(status).toHaveProperty('hasValidApiKey');
    expect(status.hasValidApiKey).toBe(true);
    expect(status.projectId).toBeTruthy();
  });

  it('gracefully formats Firebase API key errors into clear feedback', () => {
    const apiKeyError = new Error('Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.).');
    const formatted = getReadableFirebaseError(apiKeyError);
    expect(formatted).toContain('Invalid Firebase API Key');
    expect(formatted).toContain('VITE_FIREBASE_API_KEY');
  });

  it('gracefully formats operational and auth errors', () => {
    const opError = new Error('Firebase: Error (auth/operation-not-allowed).');
    expect(getReadableFirebaseError(opError)).toContain('Email/Password sign-in is not enabled');

    const emailInUse = new Error('Firebase: Error (auth/email-already-in-use).');
    expect(getReadableFirebaseError(emailInUse)).toContain('already exists');

    const invalidCred = new Error('Firebase: Error (auth/invalid-credential).');
    expect(getReadableFirebaseError(invalidCred)).toContain('Incorrect email or password');

    const userNotFound = new Error('Firebase: Error (auth/user-not-found).');
    expect(getReadableFirebaseError(userNotFound)).toContain('No user account found');

    const networkErr = new Error('Firebase: Error (auth/network-request-failed).');
    expect(getReadableFirebaseError(networkErr)).toContain('Network connection');
  });

  it('contains valid default project fallback credentials', () => {
    expect(DEFAULT_FIREBASE_CONFIG.apiKey).toMatch(/^AIzaSy/);
    expect(DEFAULT_FIREBASE_CONFIG.projectId).toBeTruthy();
    expect(DEFAULT_FIREBASE_CONFIG.authDomain).toContain('firebaseapp.com');
  });
});
