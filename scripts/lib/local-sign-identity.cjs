/**
 * The stable local code-signing identity for macOS builds that are not
 * Developer ID signed (NATIVELY_LOCAL_SIGN_IDENTITY).
 *
 * An ad-hoc signature's designated requirement is its cdhash, so every rebuild
 * is a new app to TCC and Screen Recording / Microphone are asked for again.
 * Signing with one local certificate (e.g. a self-signed "Natively Dev"
 * code-signing cert) makes the requirement that certificate, so the grants
 * survive rebuilds. Read from the environment, else from <rootDir>/.env, so it
 * does not have to be typed on every build. '' means ad-hoc, as before.
 */
const fs = require('fs');
const path = require('path');

const ENV_NAME = 'NATIVELY_LOCAL_SIGN_IDENTITY';

function resolveLocalSignIdentity(rootDir, env = process.env) {
    const fromEnv = (env[ENV_NAME] || '').trim();
    if (fromEnv) return fromEnv;
    const envFile = path.join(rootDir, '.env');
    if (!fs.existsSync(envFile)) return '';
    const parsed = require('dotenv').parse(fs.readFileSync(envFile));
    return (parsed[ENV_NAME] || '').trim();
}

module.exports = { ENV_NAME, resolveLocalSignIdentity };
