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
