/**
 * Must load before any other local modules read process.env.
 * (Imports are hoisted; this module has no app imports — only dotenv.)
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const rootEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
  console.log('✅ Loaded .env from project root');
} else if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
  console.log('✅ Loaded .env from backend directory');
} else {
  dotenv.config();
  console.log('⚠️ No .env file found, using system environment variables');
}

/** Safe startup hint: which GEMINI key the process sees (never log full secrets). */
function logGeminiApiKeyFingerprint(): void {
  const raw = process.env.GEMINI_API_KEY;
  if (raw === undefined || String(raw).trim() === '') {
    console.log('ℹ️ [Env] GEMINI_API_KEY: (not set or empty)');
    return;
  }
  const key = String(raw).trim();
  if (key.length < 9) {
    console.log(`ℹ️ [Env] GEMINI_API_KEY: set but very short (len=${key.length}) — check .env`);
    return;
  }
  console.log(
    `ℹ️ [Env] GEMINI_API_KEY fingerprint: ${key.slice(0, 4)}…${key.slice(-4)} (len=${key.length})`
  );
}

logGeminiApiKeyFingerprint();
