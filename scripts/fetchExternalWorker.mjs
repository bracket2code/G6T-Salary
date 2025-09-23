#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.env.VITE_API_BASE_URL;
const loginBodyEnv = process.env.EXTERNAL_LOGIN_BODY;
const loginEmail = process.env.EXTERNAL_LOGIN_EMAIL;
const loginPassword = process.env.EXTERNAL_LOGIN_PASSWORD;

if (!baseUrl) {
  console.error('❌ Missing VITE_API_BASE_URL in environment.');
  process.exit(1);
}

let loginBody;

try {
  if (loginBodyEnv) {
    loginBody = JSON.parse(loginBodyEnv);
  } else if (loginEmail && loginPassword) {
    loginBody = { email: loginEmail, password: loginPassword };
  }
} catch (error) {
  console.error('❌ Failed to parse EXTERNAL_LOGIN_BODY JSON:', error);
  process.exit(1);
}

if (!loginBody) {
  console.error('❌ Provide EXTERNAL_LOGIN_BODY as JSON or EXTERNAL_LOGIN_EMAIL/EXTERNAL_LOGIN_PASSWORD.');
  process.exit(1);
}

async function apiFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(decoded);
}

function resolveWorkerIdRelation(payload) {
  const relations = Array.isArray(payload?.parameterRelations)
    ? payload.parameterRelations
    : [];

  const relation = relations.find((item) => Number(item?.type) === 5);
  const candidate = relation?.id ?? relation?.parameterId ?? relation?.parameter_id;
  if (candidate) return candidate.toString();

  const fallback = payload?.workerIdRelation
    || payload?.worker_id_relation
    || payload?.workerId
    || payload?.worker_id
    || payload?.worker?.id
    || payload?.id;

  return fallback ? fallback.toString() : null;
}

async function main() {
  try {
    console.log('🔐 Authenticating with external API...');
    const loginResponse = await apiFetch(`${baseUrl}/User/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginBody),
    });

    const token = loginResponse?.token || loginResponse?.jwt || loginResponse?.accessToken || loginResponse?.access_token;
    if (!token) {
      throw new Error('Login response did not include a token. Inspect response structure.');
    }

    console.log('✅ Authentication successful. Token recibido:');
    console.log(token);
    console.log('🔓 JWT decodificado:');
    const payload = decodeJwt(token);
    console.dir(payload, { depth: null });
    const workerIdRelation = resolveWorkerIdRelation(payload);

    if (!workerIdRelation) {
      console.warn('⚠️ workerIdRelation not found in JWT payload. Full payload:', payload);
    } else {
      console.log(`🔎 workerIdRelation encontrado: ${workerIdRelation}`);
    }

    console.log('📥 Fetching workers from Parameter/List?Types=5 ...');
    const workers = await apiFetch(`${baseUrl}/Parameter/List?Types=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!Array.isArray(workers)) {
      console.warn('⚠️ Unexpected workers response shape:', workers);
      return;
    }

    const matchingWorkers = workerIdRelation
      ? workers.filter((worker) => {
          const workerId = worker?.id ?? worker?.workerId ?? worker?.worker_id;
          return workerId && workerId.toString() === workerIdRelation;
        })
      : [];

    if (workerIdRelation && matchingWorkers.length === 0) {
      console.warn(`⚠️ No worker entries matched workerIdRelation ${workerIdRelation}.`);
    }

    if (matchingWorkers.length > 0) {
      console.log(`✅ Found ${matchingWorkers.length} matching worker(s):`);
      console.dir(matchingWorkers, { depth: null });
    } else {
      console.log('📊 Workers response sample (first entry):');
      console.dir(workers[0], { depth: null });
    }
  } catch (error) {
    console.error('❌ Error fetching worker data:', error);
    process.exit(1);
  }
}

await main();
