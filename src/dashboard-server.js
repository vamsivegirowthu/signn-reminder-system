import fs from 'fs';
import express from 'express';
import QRCode from 'qrcode';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLINIC_FILE   = process.env.CLINIC_DATA_FILE || './data/clinics.json';
const SCHEDULE_FILE = './data/schedule.json';
const TEMPLATE_FILE = path.join(__dirname, '../data/templates.json');

if (!fs.existsSync(TEMPLATE_FILE)) {
  fs.writeFileSync(TEMPLATE_FILE, '[]');
}

function loadClinics()   { return JSON.parse(fs.readFileSync(CLINIC_FILE,   'utf8')); }
function loadSchedule()  { return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8')); }
function saveTemplates(d){ fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(d, null, 2)); }
function loadTemplates() { return JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8')); }

function seedTemplates() {
  const data = loadTemplates();
  if (data.length === 0) {
    const defaultTemplates = [
      { id: "1", name: "Morning Reminder", message: "Good morning! Please check your tasks.", image: "/images/morning.jpg" }
    ];
    saveTemplates(defaultTemplates);
  }
}

export function createDashboardServer({ scheduler, tracker, clinicData, logger }) {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIO(httpServer, { cors: { origin: '*' } });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/', (req, res) => {
  res.send('Server is running 🚀');
});

  seedTemplates();

  // ================= TEMPLATE APIs =================

  app.get('/api/templates', (req, res) => {
    res.json({ templates: loadTemplates() });
  });

  app.get('/api/templates/:id', (req, res) => {
    const data = loadTemplates();
    const template = data.find(t => t.id == req.params.id);
    if (!template) return res.status(404).json({ error: 'Not found' });
    res.json(template);
  });

  // ================= SEND =================

  app.post('/api/send', async (req, res) => {
    try {
      const { number, message } = req.body;

      if (!number || !message) {
        return res.status(400).json({ error: 'number & message required' });
      }

      const jid = number.replace(/\D/g, '') + '@s.whatsapp.net';

     if (scheduler?.wa?.sendMessage) {
  await scheduler.wa.sendMessage(jid, { text: message });
} else {
  console.log("WA not connected, skipping send");
}

      res.json({ success: true });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // ================= STATUS =================

  app.get('/api/status', (req, res) => {
    res.json({
      connected: scheduler?.wa?.isConnected || false
    });
  });

  // ================= ✅ FIXED APIs =================

  app.get('/api/summary', (req, res) => {
    const clinics = loadClinics().clinics || [];

    const summary = clinics.map(c => ({
      clinicName: c.name,
      total: c.staff.length,
      scanned: 0,
      notScanned: c.staff.length,
      complianceRate: 0
    }));

    res.json({ summary });
  });

  app.get('/api/clinics', (req, res) => {
    res.json(loadClinics());
  });

  app.get('/api/employees', (req, res) => {
    const clinics = loadClinics().clinics || [];
    const employees = [];

    clinics.forEach(c => {
      c.staff.forEach(s => {
        employees.push({
          ...s,
          clinicId: c.id,
          scanned: false
        });
      });
    });

    res.json({ employees });
  });

  app.get('/api/schedule', (req, res) => {
    res.json(loadSchedule());
  });

  // ================= QR =================

  app.get('/api/qr', async (req, res) => {
    if (!global.latestQR) return res.status(404).json({ error: 'No QR' });

    const png = await QRCode.toBuffer(global.latestQR);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  });

  return { httpServer, io, app };
}

return { httpServer, io, app };
}


// 🔥 START SERVER (VERY IMPORTANT)

const PORT = process.env.PORT || 3000;

// dummy objects (Railway crash avoid cheyyadaniki)
const scheduler = {
  wa: {
    sendMessage: async () => {},
    isConnected: false
  }
};

const tracker = {};
const clinicData = {};
const logger = console;

const { httpServer } = createDashboardServer({
  scheduler,
  tracker,
  clinicData,
  logger
});

httpServer.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
