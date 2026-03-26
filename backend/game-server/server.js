/**
 * Office Fun Activity — SMS Pictionary Game Server
 * Node.js + Express + Socket.io + Twilio (or MSG91) SMS Webhook
 * 
 * SETUP:
 *   1. npm install
 *   2. Copy .env.example to .env and fill in your SMS credentials
 *   3. node server.js  (or: npx nodemon server.js for dev)
 *   4. Expose port 3000 via ngrok: npx ngrok http 3000
 *   5. Set ngrok URL as your Twilio webhook: https://<id>.ngrok.io/api/sms/webhook
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const multer  = require('multer');
const XLSX    = require('xlsx');
const path    = require('path');
const fs      = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT        = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'office-fun-admin';

// SMS Provider: 'twilio' | 'msg91' | 'mock' (mock = no real SMS, answer via web UI)
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';
const TWILIO_ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID  || '';
const TWILIO_AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN   || '';
const TWILIO_PHONE_NUMBER  = process.env.TWILIO_PHONE         || '';
const MSG91_AUTH_KEY       = process.env.MSG91_AUTH_KEY       || '';

// ── App setup ─────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // required for Twilio webhook

// ── Game State ────────────────────────────────────────────────────────────────
let state = {
  status: 'idle',        // 'idle' | 'playing' | 'paused' | 'break' | 'finished'
  questions: [],         // loaded from Excel
  phonebook: {},         // { "+911234567890": "Alice" }
  currentIndex: -1,
  currentQuestion: null,
  timerRemaining: 0,
  scores: {},            // { playerName: totalPoints }
  smsLog: [],            // [{ phone, name, message, time, correct }]
  winner: null,
  breakRemaining: 0,
};

let timerInterval = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function broadcast(event, data) {
  io.emit(event, data);
}

function getPlayerName(phone) {
  // Normalize: strip spaces, dashes; ensure leading +
  const normalized = phone.replace(/[\s\-\(\)]/g, '');
  return state.phonebook[normalized] || state.phonebook[phone] || phone;
}

function checkAnswer(incoming, correct) {
  return incoming.trim().toLowerCase() === correct.trim().toLowerCase();
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function startQuestionTimer(seconds) {
  stopTimer();
  state.timerRemaining = seconds;
  broadcast('timer', { remaining: state.timerRemaining, total: seconds });

  timerInterval = setInterval(() => {
    state.timerRemaining--;
    broadcast('timer', { remaining: state.timerRemaining, total: seconds });

    if (state.timerRemaining <= 0) {
      stopTimer();
      state.status = 'paused';
      broadcast('time_up', { question: state.currentQuestion, answer: state.currentQuestion.answer });
      broadcast('game_state', getPublicState());
      
      // Auto-transition to break after 3s reveal
      setTimeout(() => {
        if (state.status === 'paused' && state.currentIndex === getPublicState().currentIndex) {
          startBreakTimer(5);
        }
      }, 3000);
    }
  }, 1000);
}

function startBreakTimer(seconds) {
  stopTimer();
  state.breakRemaining = seconds;
  state.status = 'break';
  broadcast('break_start', { remaining: seconds });
  broadcast('game_state', getPublicState());

  timerInterval = setInterval(() => {
    state.breakRemaining--;
    broadcast('break_timer', { remaining: state.breakRemaining });

    if (state.breakRemaining <= 0) {
      stopTimer();
      nextQuestion();
    }
  }, 1000);
}

function nextQuestion() {
  state.currentIndex++;
  if (state.currentIndex >= state.questions.length) {
    // Game over
    state.status = 'finished';
    state.currentQuestion = null;
    stopTimer();
    broadcast('game_over', { scores: state.scores });
    broadcast('game_state', getPublicState());
    return;
  }

  state.currentQuestion = state.questions[state.currentIndex];
  state.winner = null;
  state.status = 'playing';
  broadcast('question', state.currentQuestion);
  broadcast('game_state', getPublicState());
  startQuestionTimer(state.currentQuestion.timer || 60);
}

function getPublicState() {
  // Don't expose the answer to clients
  const q = state.currentQuestion ? {
    ...state.currentQuestion,
    answer: (state.status === 'paused' || state.status === 'break' || state.status === 'finished') 
      ? state.currentQuestion.answer : undefined,
  } : null;
  return {
    status: state.status,
    currentIndex: state.currentIndex,
    totalQuestions: state.questions.length,
    currentQuestion: q,
    timerRemaining: state.timerRemaining,
    breakRemaining: state.breakRemaining,
    scores: state.scores,
    smsLog: state.smsLog.slice(-20), // last 20 messages
    winner: state.winner,
  };
}

function handleSmsAnswer(phone, message) {
  const name = getPlayerName(phone);
  const time = new Date().toISOString();

  const logEntry = { phone, name, message, time, correct: false };

  if (state.status !== 'playing' || !state.currentQuestion) {
    state.smsLog.push(logEntry);
    broadcast('sms_received', logEntry);
    return;
  }

  const correct = checkAnswer(message, state.currentQuestion.answer);
  logEntry.correct = correct;
  state.smsLog.push(logEntry);
  broadcast('sms_received', logEntry);

  if (correct) {
    // Award points
    const points = state.currentQuestion.points || 10;
    state.scores[name] = (state.scores[name] || 0) + points;
    state.winner = { name, phone, points, message };
    state.status = 'paused';
    stopTimer();
    broadcast('winner', { winner: state.winner, scores: state.scores });
    broadcast('game_state', getPublicState());

    // Auto-advance after 4s reveal
    const breakSecs = state.currentQuestion.breakAfterWin || 5;
    setTimeout(() => {
      if (state.status === 'paused' && state.currentIndex === getPublicState().currentIndex) {
        startBreakTimer(breakSecs);
      }
    }, 4000);
  }
}

// ── REST API ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, provider: SMS_PROVIDER, timestamp: new Date().toISOString() });
});

// Get full game state (admin) or public state
app.get('/api/game/state', (req, res) => {
  res.json(getPublicState());
});

// Admin control
app.post('/api/game/control', (req, res) => {
  const { action } = req.body;

  switch (action) {
    case 'start':
      if (state.questions.length === 0) return res.status(400).json({ error: 'No questions loaded' });
      state.status = 'playing';
      state.scores = {};
      state.smsLog = [];
      state.currentIndex = -1;
      nextQuestion();
      break;
    case 'next':
      const { skipBreak } = req.body;
      stopTimer();
      if (skipBreak || !state.currentQuestion) {
        nextQuestion();
      } else {
        const breakSecs = state.currentQuestion.breakAfterWin || 3;
        startBreakTimer(breakSecs);
      }
      break;
    case 'pause':
      stopTimer();
      state.status = 'paused';
      broadcast('game_state', getPublicState());
      break;
    case 'resume':
      if (state.currentQuestion && state.timerRemaining > 0) {
        state.status = 'playing';
        startQuestionTimer(state.timerRemaining);
        broadcast('game_state', getPublicState());
      }
      break;
    case 'reset':
      stopTimer();
      state.status = 'idle';
      state.currentIndex = -1;
      state.currentQuestion = null;
      state.scores = {};
      state.smsLog = [];
      state.winner = null;
      state.timerRemaining = 0;
      broadcast('game_reset', {});
      broadcast('game_state', getPublicState());
      break;
    default:
      return res.status(400).json({ error: 'Unknown action' });
  }

  res.json({ ok: true, status: state.status });
});

// Upload Excel config
app.post('/api/game/upload-config', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    
    // Parse Questions sheet
    if (wb.SheetNames.includes('Questions')) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Questions']);
      state.questions = rows.map((r, i) => ({
        no: r['No'] || i + 1,
        contentUrl: r['ContentURL'] || '',
        contentType: (r['ContentType'] || 'image').toLowerCase(),
        answer: String(r['Answer'] || ''),
        timer: parseInt(r['Timer(s)']) || 60,
        points: parseInt(r['Points']) || 10,
        breakAfterWin: parseInt(r['BreakAfterWin(s)']) || 5,
        hint: r['Hint'] || '',
      }));
    }

    // Parse Phonebook sheet
    if (wb.SheetNames.includes('Phonebook')) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Phonebook']);
      state.phonebook = {};
      rows.forEach(r => {
        if (r['Phone']) state.phonebook[String(r['Phone']).trim()] = String(r['PlayerName'] || r['Phone']);
      });
    }

    // Reset game state but keep scores if game is idle
    if (state.status === 'idle') {
      state.currentIndex = -1;
      state.currentQuestion = null;
    }

    broadcast('config_loaded', { 
      questionCount: state.questions.length, 
      phonebookCount: Object.keys(state.phonebook).length 
    });
    res.json({ ok: true, questions: state.questions.length, players: Object.keys(state.phonebook).length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse Excel: ' + err.message });
  }
});

// Download Excel template
app.get('/api/game/template', (req, res) => {
  const wb = XLSX.utils.book_new();
  const questions = [
    {
      'No': 1,
      'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Dog_Breeds.jpg/640px-Dog_Breeds.jpg',
      'ContentType': 'image',
      'Answer': 'Dog',
      'Timer(s)': 60,
      'Points': 10,
      'BreakAfterWin(s)': 5,
      'Hint': 'Man\'s best friend 🐾',
    },
    {
      'No': 2,
      'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Cute_dog.jpg/640px-Cute_dog.jpg',
      'ContentType': 'image',
      'Answer': 'Eiffel Tower',
      'Timer(s)': 60,
      'Points': 15,
      'BreakAfterWin(s)': 5,
      'Hint': 'Famous landmark in France 🗼',
    },
    {
      'No': 3,
      'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/640px-Camponotus_flavomarginatus_ant.jpg',
      'ContentType': 'image',
      'Answer': 'Ant',
      'Timer(s)': 45,
      'Points': 10,
      'BreakAfterWin(s)': 5,
      'Hint': 'Tiny insect that carries 50x its weight 🐜',
    },
    {
      'No': 4,
      'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Sunflower_from_Silesia2.jpg/640px-Sunflower_from_Silesia2.jpg',
      'ContentType': 'image',
      'Answer': 'Sunflower',
      'Timer(s)': 45,
      'Points': 10,
      'BreakAfterWin(s)': 5,
      'Hint': 'It always faces the ☀️',
    },
    {
      'No': 5,
      'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Cat03.jpg/640px-Cat03.jpg',
      'ContentType': 'image',
      'Answer': 'Cat',
      'Timer(s)': 30,
      'Points': 5,
      'BreakAfterWin(s)': 5,
      'Hint': 'Says meow 🐱',
    },
  ];

  const phonebook = [
    { 'Phone': '+911234567890', 'PlayerName': 'Alice' },
    { 'Phone': '+910987654321', 'PlayerName': 'Bob' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questions), 'Questions');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(phonebook), 'Phonebook');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="GameConfig_Template.xlsx"',
  });
  res.send(buf);
});

// Export leaderboard
app.get('/api/game/export-scores', (req, res) => {
  const rows = Object.entries(state.scores)
    .sort(([, a], [, b]) => b - a)
    .map(([name, score], i) => ({ Rank: i + 1, Player: name, Score: score }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Leaderboard');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="GameLeaderboard.xlsx"',
  });
  res.send(buf);
});

// Mock SMS (for testing without real SMS)
app.post('/api/sms/mock', (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });
  handleSmsAnswer(phone, message);
  res.json({ ok: true });
});

// Get phonebook
app.get('/api/game/phonebook', (req, res) => {
  res.json(state.phonebook);
});

// Add/update phonebook entry
app.post('/api/game/phonebook', (req, res) => {
  const { phone, name } = req.body;
  if (!phone || !name) return res.status(400).json({ error: 'phone and name required' });
  state.phonebook[phone.trim()] = name.trim();
  res.json({ ok: true });
});

// ── SMS Webhooks ──────────────────────────────────────────────────────────────

// Twilio webhook (POST)
app.post('/api/sms/webhook', (req, res) => {
  const phone   = req.body.From || '';
  const message = req.body.Body || '';
  console.log(`[SMS] From: ${phone}, Message: ${message}`);
  handleSmsAnswer(phone, message.trim());
  
  // Twilio expects TwiML response (can be empty to not reply)
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

// MSG91 webhook (GET/POST — configurable in MSG91 dashboard)
app.all('/api/sms/msg91', (req, res) => {
  const phone   = req.body.sender || req.query.sender || '';
  const message = req.body.message || req.query.message || '';
  console.log(`[MSG91] From: ${phone}, Message: ${message}`);
  handleSmsAnswer(phone, message.trim());
  res.json({ ok: true });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[WS] Client connected:', socket.id);
  
  // Send current state on connect
  socket.emit('game_state', getPublicState());

  socket.on('disconnect', () => {
    console.log('[WS] Client disconnected:', socket.id);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🎮 Office Fun Game Server running on port ${PORT}`);
  console.log(`📡 SMS Provider  : ${SMS_PROVIDER}`);
  console.log(`🔗 Health check  : http://localhost:${PORT}/api/health`);
  console.log(`📋 Template DL   : http://localhost:${PORT}/api/game/template`);
  console.log(`📲 Twilio webhook: http://localhost:${PORT}/api/sms/webhook`);
  console.log(`📲 MSG91 webhook : http://localhost:${PORT}/api/sms/msg91`);
  console.log(`\n💡 Expose via ngrok: npx ngrok http ${PORT}\n`);
});
