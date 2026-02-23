/**
 * Generate a Google Slides presentation for a Mathdoku puzzle from a YAML spec.
 *
 * Usage:
 *     npm run makeMathdokuSlides tests/fixtures/Blog15.yaml
 *
 * Creates a presentation named after the YAML file (e.g., "Blog15") in Google Drive,
 * binds the Apps Script solver, and opens the presentation URL.
 *
 * First-time setup:
 *     1. Create a Google Cloud project and enable APIs (see README)
 *     2. Create an OAuth Desktop client and download credentials.json to this directory
 *     3. Run the script — it will open a browser to authorize on first run
 */

/* eslint-disable no-console -- CLI script output. */

import { type GaxiosError } from 'gaxios';
import { type OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import yaml from 'js-yaml';
import { exec } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { createServer } from 'node:http';
import {
  basename,
  dirname,
  join,
  resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import ora from 'ora';

/* eslint-disable no-magic-numbers -- Enum values are literal status codes. */
enum HttpStatusCodes {
  Forbidden = 403,
  NoContent = 204,
  OK = 200
}
/* eslint-enable no-magic-numbers -- End enum block. */

const FIRST_CLI_ARG_INDEX = 2;
const JSON_INDENT = 2;
const OFF_SCREEN_COORDINATE = -10000;

interface Cage {
  cells: string[];
  operator?: string;
  value: number;
}

interface CredentialsFile {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
}

interface PuzzleJson {
  cages: Cage[];
  hasOperators?: boolean;
  meta?: string;
  puzzleSize: number;
  title?: string;
}

interface ScriptFile {
  name: string;
  source: string;
  type: string;
}

interface TokenData {
  access_token?: string;
  expiry_date?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface YamlCage {
  cells?: unknown[];
  op?: string;
  operator?: string;
  value?: number;
}

interface YamlSpec {
  cages?: unknown;
  difficulty?: string;
  hasOperators?: boolean;
  meta?: string;
  size?: number;
  title?: string;
}

const API_NAMES: Record<string, string> = {
  'drive.googleapis.com': 'Google Drive API',
  'script.googleapis.com': 'Apps Script API',
  'slides.googleapis.com': 'Google Slides API'
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CREDENTIALS_FILE = join(ROOT, 'credentials.json');
const TEMPLATE_PPTX = join(ROOT, 'assets', 'template-960x540.pptx');
const TOKEN_FILE = join(ROOT, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/script.projects'
];

async function bindAppsScript(auth: OAuth2Client, presId: string): Promise<string> {
  const scriptSvc = google.script({ auth, version: 'v1' });
  const appsDir = resolve(ROOT, 'dist');

  const project = await scriptSvc.projects.create({
    requestBody: { parentId: presId, title: 'Mathdoku Solver' }
  });
  const scriptId = project.data.scriptId;
  if (!scriptId) {
    throw new Error('Apps Script project creation returned no scriptId');
  }

  const files: ScriptFile[] = [];
  for (const entry of readdirSync(appsDir).sort()) {
    const filePath = join(appsDir, entry);
    if (entry.endsWith('.js')) {
      files.push({ name: entry.replace(/\.js$/, ''), source: readFileSync(filePath, 'utf-8'), type: 'SERVER_JS' });
    } else if (entry.endsWith('.html')) {
      files.push({ name: entry.replace(/\.html$/, ''), source: readFileSync(filePath, 'utf-8'), type: 'HTML' });
    } else if (entry === 'appsscript.json') {
      files.push({ name: 'appsscript', source: readFileSync(filePath, 'utf-8'), type: 'JSON' });
    }
  }

  if (files.length > 0) {
    await scriptSvc.projects.updateContent({
      requestBody: { files },
      scriptId
    });
  }

  return scriptId;
}

function buildPuzzleJson(spec: YamlSpec, name: string): PuzzleJson {
  if (spec.size === undefined) {
    throw new Error('size is required in YAML spec');
  }
  const n = spec.size;
  const difficulty = spec.difficulty;
  const hasOperators = spec.hasOperators ?? true;

  let title = (spec.title ?? '').trim();
  if (!title) {
    title = `#Mathdoku ${name}`;
  }

  let meta = (spec.meta ?? '').trim();
  if (!meta) {
    const parts = [`Size ${String(n)}x${String(n)}`];
    if (difficulty !== undefined) {
      parts.push(`Difficulty ${difficulty}`);
    }
    parts.push(hasOperators ? 'With operators' : 'Without operators');
    meta = parts.join(' \u2022 ');
  }

  const cagesIn = spec.cages;
  if (!Array.isArray(cagesIn) || cagesIn.length === 0) {
    throw new Error('cages must be a non-empty list');
  }

  const cages: Cage[] = [];
  for (const [idx, item] of (cagesIn as YamlCage[]).entries()) {
    const cellsRaw = item.cells;
    if (!Array.isArray(cellsRaw) || cellsRaw.length === 0) {
      throw new Error(`cages[${String(idx)}].cells must be a non-empty list`);
    }
    const cells = cellsRaw.map((c) => String(c).trim().toUpperCase());

    if (item.value === undefined) {
      throw new Error(`cages[${String(idx)}].value is required`);
    }

    const cage: Cage = { cells, value: item.value };
    const op = item.op ?? item.operator;
    if (op !== undefined) {
      cage.operator = op.trim();
    }

    cages.push(cage);
  }

  return { cages, hasOperators, meta, puzzleSize: n, title };
}

async function buildSlides(specPath: string): Promise<string> {
  const content = readFileSync(specPath, 'utf-8');
  const spec = yaml.load(content);
  if (typeof spec !== 'object' || spec === null) {
    throw new Error('YAML spec must be a mapping');
  }

  const name = basename(specPath, '.yaml');
  const puzzleJson = buildPuzzleJson(spec as YamlSpec, name);

  const auth = await getCredentials();
  const driveSvc = google.drive({ auth, version: 'v3' });
  const slidesSvc = google.slides({ auth, version: 'v1' });

  const spinner = ora();

  let presId: string;
  try {
    // 1. Upload PPTX template (960x540 pt) — presentations.create ignores pageSize
    if (!existsSync(TEMPLATE_PPTX)) {
      throw new Error(`Template not found: ${TEMPLATE_PPTX}`);
    }
    spinner.start('Uploading template...');
    const driveFile = await driveSvc.files.create({
      fields: 'id',
      media: {
        body: createReadStream(TEMPLATE_PPTX),
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      },
      requestBody: {
        mimeType: 'application/vnd.google-apps.presentation',
        name
      }
    });
    if (!driveFile.data.id) {
      throw new Error('Drive file creation returned no id');
    }
    presId = driveFile.data.id;
    spinner.succeed(`Created presentation: ${name} (${presId})`);

    // 2. Bind Apps Script
    spinner.start('Binding Apps Script...');
    const scriptId = await bindAppsScript(auth, presId);
    spinner.succeed(`Bound Apps Script project: ${scriptId}`);

    // 3. Embed puzzle JSON in the first slide for Init menu to read
    spinner.start('Embedding puzzle data...');
    await embedPuzzleData(slidesSvc, presId, puzzleJson);
    spinner.succeed('Puzzle data embedded');
  } catch (error: unknown) {
    spinner.fail();
    if ((error as GaxiosError).response !== undefined) {
      handleHttpError(error as GaxiosError);
    }
    throw error;
  }

  const url = `https://docs.google.com/presentation/d/${presId}/edit`;
  console.log(`\n${name} \u2192 ${url}`);
  openBrowser(url);
  return url;
}

async function getCredentials(): Promise<OAuth2Client> {
  const { clientId, clientSecret, redirectUri } = loadClientCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Try loading saved token
  if (existsSync(TOKEN_FILE)) {
    const tokenData = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')) as TokenData;
    /* eslint-disable camelcase -- Google API field names */
    oauth2Client.setCredentials({
      ...(tokenData.access_token !== undefined && { access_token: tokenData.access_token }),
      ...(tokenData.expiry_date !== undefined && { expiry_date: tokenData.expiry_date }),
      ...(tokenData.refresh_token !== undefined && { refresh_token: tokenData.refresh_token }),
      ...(tokenData.scope !== undefined && { scope: tokenData.scope }),
      ...(tokenData.token_type !== undefined && { token_type: tokenData.token_type })
    });
    /* eslint-enable camelcase -- end Google API block */

    // Refresh if expired
    if (tokenData.refresh_token) {
      const tokenInfo = oauth2Client.credentials;
      const isExpired = tokenInfo.expiry_date !== undefined
        && tokenInfo.expiry_date !== null
        && tokenInfo.expiry_date < Date.now();
      if (isExpired) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        saveToken(oauth2Client);
      }
      return oauth2Client;
    }
  }

  // No valid token — interactive OAuth via local server
  return interactiveAuth(clientId, clientSecret);
}

function handleHttpError(e: GaxiosError): never {
  const status = e.response?.status ?? 0;
  const errors = (e.response?.data as { error?: { details?: Record<string, unknown>[] } } | undefined)?.error?.details;
  const detail = errors?.[0];
  const reason = typeof detail?.['reason'] === 'string' ? detail['reason'] : '';

  if (reason === 'SERVICE_DISABLED') {
    const metadata = detail?.['metadata'] as Record<string, string> | undefined;
    const service = metadata?.['service'] ?? '';
    const friendly = API_NAMES[service] ?? service;
    console.error(
      `Error: ${friendly} is not enabled.\n`
        + '\n'
        + `  Run:  gcloud services enable ${service}\n`
        + '\n'
        + '  Then wait ~30 seconds and retry.'
    );
    process.exit(1);
  }

  if (reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' || status === (HttpStatusCodes.Forbidden as number)) {
    console.error(
      `Error: permission denied: ${e.message}\n`
        + '\n'
        + `Full error details: ${JSON.stringify(e.response?.data, null, JSON_INDENT)}\n`
        + '\n'
        + `Delete ${TOKEN_FILE} and re-run to re-authenticate.`
    );
    process.exit(1);
  }

  console.error(`Error: Google API request failed (${String(status)}): ${e.message}`);
  process.exit(1);
}

async function interactiveAuth(clientId: string, clientSecret: string): Promise<OAuth2Client> {
  const server = createServer();
  await new Promise<void>((done) => {
    server.listen(0, 'localhost', done);
  });

  const { port } = server.address() as { port: number };
  const redirectUri = `http://localhost:${String(port)}`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // eslint-disable-next-line camelcase -- Google API field name
  const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

  console.log('Opening browser for authorization...');
  openBrowser(authUrl);

  const code = await new Promise<string>((done, fail) => {
    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', redirectUri);
      const authCode = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(HttpStatusCodes.OK, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization failed</h1><p>You can close this tab.</p>');
        server.close();
        fail(new Error(`Authorization denied: ${error}`));
        return;
      }

      if (!authCode) {
        res.writeHead(HttpStatusCodes.NoContent);
        res.end();
        return;
      }

      res.writeHead(HttpStatusCodes.OK, { 'Content-Type': 'text/html' });
      res.end('<h1>Authorization successful!</h1><p>You can close this tab.</p>');
      server.close();
      done(authCode);
    });
  });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  saveToken(oauth2Client);
  return oauth2Client;
}

function loadClientCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  if (!existsSync(CREDENTIALS_FILE)) {
    console.error(
      'Error: credentials.json not found.\n'
        + '\n'
        + 'Create an OAuth Desktop client in Google Cloud Console and\n'
        + 'download the JSON to:\n'
        + `  ${CREDENTIALS_FILE}\n`
        + '\n'
        + 'See README for details.\n'
    );
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8')) as CredentialsFile;
  const installed = raw.installed;
  if (!installed) {
    throw new Error('credentials.json must contain an "installed" application config');
  }
  return {
    clientId: installed.client_id,
    clientSecret: installed.client_secret,
    redirectUri: installed.redirect_uris?.[0] ?? 'http://localhost'
  };
}

async function main(): Promise<void> {
  const specPath = process.argv[FIRST_CLI_ARG_INDEX];
  if (specPath === undefined) {
    console.error('Usage: npm run makeMathdokuSlides <puzzle.yaml>');
    process.exit(1);
  }
  if (!existsSync(specPath)) {
    console.error(`Error: ${specPath} not found`);
    process.exit(1);
  }
  await buildSlides(specPath);
}

function openBrowser(url: string): void {
  let cmd: string;
  if (process.platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd);
}

const PUZZLE_INIT_OBJECT_ID = 'PuzzleInitData';

async function embedPuzzleData(
  slidesSvc: ReturnType<typeof google.slides>,
  presId: string,
  puzzleJson: PuzzleJson
): Promise<void> {
  const pres = await slidesSvc.presentations.get({ presentationId: presId });
  const slideId = pres.data.slides?.[0]?.objectId;
  if (!slideId) {
    throw new Error('Presentation has no slides');
  }
  const text = JSON.stringify(puzzleJson);
  await slidesSvc.presentations.batchUpdate({
    presentationId: presId,
    requestBody: {
      requests: [
        {
          createShape: {
            elementProperties: {
              pageObjectId: slideId,
              size: {
                height: { magnitude: 1, unit: 'PT' },
                width: { magnitude: 1, unit: 'PT' }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: OFF_SCREEN_COORDINATE,
                translateY: OFF_SCREEN_COORDINATE,
                unit: 'PT'
              }
            },
            objectId: PUZZLE_INIT_OBJECT_ID,
            shapeType: 'TEXT_BOX'
          }
        },
        {
          insertText: {
            insertionIndex: 0,
            objectId: PUZZLE_INIT_OBJECT_ID,
            text
          }
        }
      ]
    }
  });
}

function saveToken(client: OAuth2Client): void {
  const creds = client.credentials;
  /* eslint-disable camelcase -- Google API field names */
  const tokenData = {
    access_token: creds.access_token ?? undefined,
    expiry_date: creds.expiry_date ?? undefined,
    refresh_token: creds.refresh_token ?? undefined,
    scope: typeof creds.scope === 'string' ? creds.scope : undefined,
    token_type: creds.token_type ?? undefined
  };
  /* eslint-enable camelcase -- end Google API block */
  writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, JSON_INDENT), 'utf-8');
}

await main();

/* eslint-enable no-console -- End CLI script output. */
