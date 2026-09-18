import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { createServer as createViteServer } from 'vite';
import { initialData } from './src/data/initialData.ts';

const app = express();
const PORT = 3000;
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database.json if not present
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
}

// Persistent remote storage (jsonbin.io) — survives redeploys/restarts.
// Falls back to the local file (NOT persistent on Cloud Run) if unconfigured.
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_URL = JSONBIN_BIN_ID ? `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}` : '';
const REMOTE_ENABLED = Boolean(JSONBIN_API_KEY && JSONBIN_BIN_ID);

async function readData() {
  if (REMOTE_ENABLED) {
    try {
      const res = await fetch(`${JSONBIN_URL}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_API_KEY as string },
      });
      if (res.ok) {
        const json = await res.json();
        const record = json?.record;
        if (record) {
          if (record._compressed && record.data) {
            try {
              const raw = zlib.inflateSync(Buffer.from(record.data, 'base64')).toString('utf-8');
              const parsed = JSON.parse(raw);
              if (parsed && Array.isArray(parsed.subjects)) {
                return parsed;
              }
            } catch (decompErr) {
              console.warn('Failed to decompress jsonbin record, using local fallback:', decompErr);
            }
          } else if (Array.isArray(record.subjects)) {
            return record;
          }
        }
      } else {
        console.warn('jsonbin read returned non-200 status:', res.status);
      }
    } catch (err) {
      console.warn('Warning reading from jsonbin (falling back to local file):', err);
    }
  }
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('Error reading database.json:', err);
  }
  return initialData;
}

async function writeData(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Error writing database.json:', err);
  }
  if (REMOTE_ENABLED) {
    try {
      const rawString = JSON.stringify(data);
      // jsonbin.io free tier restricts records to <= 100KB.
      // Deflate + base64 shrinks ~150KB database to ~25KB.
      let payload: any;
      if (Buffer.byteLength(rawString, 'utf-8') > 40 * 1024) {
        const deflated = zlib.deflateSync(Buffer.from(rawString, 'utf-8')).toString('base64');
        payload = { _compressed: true, data: deflated };
      } else {
        payload = data;
      }

      const res = await fetch(JSONBIN_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_API_KEY as string,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn('jsonbin write status:', res.status, errText);
      }
    } catch (err) {
      console.warn('Warning writing to jsonbin:', err);
    }
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/database', async (req, res) => {
  const data = await readData();
  res.json(data);
});

app.post('/api/database/save', async (req, res) => {
  const newData = req.body;
  if (!newData || !newData.subjects) {
    return res.status(400).json({ error: 'Invalid database structure' });
  }
  await writeData(newData);
  res.json({ success: true, message: 'Database saved successfully' });
});

app.post('/api/database/reset', async (req, res) => {
  await writeData(initialData);
  res.json({ success: true, message: 'Database reset to default template', data: initialData });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`School Schedule Server running on http://localhost:${PORT}`);
  });
}

startServer();
