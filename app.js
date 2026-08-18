import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAeG-PvskJxUg7d-GbkiGtJ36jGdW5NkDY",
  authDomain: "tracking-3535d.firebaseapp.com",
  projectId: "tracking-3535d",
  storageBucket: "tracking-3535d.firebasestorage.app",
  messagingSenderId: "636578616250",
  appId: "1:636578616250:web:d288618cb25f639dbe0383",
  measurementId: "G-JFEP9DNGL5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Constants ---
const CHARACTERS_CONFIG = [
  { emoji: "🌑", color: "#4a4a4a" },          // The Ex-Hunter (dark shadow)
  { emoji: "🇫🇷", color: "#0055A4" },         // Le Français (French flag blue)
];

const AUTO_COLORS = [
  "#06d6a0","#ffd166","#ef476f","#118ab2","#073b4c","#e63946",
  "#457b9d","#f4a261","#2a9d8f","#e9c46a","#264653","#6a0dad"
];

const CUSTOM_EMOJIS = ["🎭","🦊","🐸","👻","🤡","💀","🔥","⚡","🧠","😈","🦁","🐺"];

// --- Meme Toast Messages ---
const TOAST_MESSAGES = {
  visitStart: [
    "🚨 CODE RED — {{name}} has been spotted heading to her desk!!!",
    "⚠️ ALERT: Suspect {{name}} is moving into position... Good luck, New Bae.",
    "{{name}} just entered the building 🏃‍♂️💨 She can hear him already...",
    "🫣 AHHH — {{name}} is going back there AGAIN. The audacity.",
    "{{name}} must be on a mission... or an Uber to her desk 🗺️",
    "NEW DEVELOPMENT: {{name}} has made their move! This is a documentary now.",
  ],
  visitEnd: [
    "🚪 EXILE — {{name}} finally left after {{duration}} of pure chaos.",
    "{{name}} has been released! Police reports filed by HR pending. 📝",
    "{{name}} stopped visiting at {{date}}. We are NOT asking why they stopped. 😳",
    "BREAKING: {{name}} survived the visit at an ALL-TIME LOW of {{duration}}. Shocking.",
  ],
  addChar: [
    "{{emoji}} New suspect deployed to the operation! The conspiracy grows...",
    "A new player enters the game... and it's not on TikTok 🎮",
    "The surveillance network just expanded by one member. Trust no one. 🔍",
    "{{name}} has been recruited. Welcome to Team Creep. 🫡",
  ],
  removeChar: [
    "{{name}} has been discharged from the program (aka banned from her desk) 🚪",
    "{{name}}? Gone. Vanished. Disappeared into the parking lot like usual. 👀",
  ],
  clearVisits: [
    "🔥 OBLITERATED — All evidence destroyed. Cover your tracks, agents.",
    "The files have been burned. Even Big Brother won't know what happened tonight. 🕯️",
  ],
};

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- Helpers ---
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function fancyToast(msg, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(ts) {
  if (ts && ts.toDate) return ts.toDate().toLocaleString();
  return new Date(ts).toLocaleString();
}

function randomColor(idx) {
  return AUTO_COLORS[idx % AUTO_COLORS.length];
}

function getEmojiForChar(name, idx) {
  const customEmojis = CUSTOM_EMOJIS;
  return customEmojis[idx % customEmojis.length];
}

// --- ESCALATING ROASTS (based on total minutes spent) ---
function getRoast(totalTime, totalVisits) {
  const mins = totalTime / 60000;
  if (mins > 1500) return "💀 This ain't a visit anymore, this is cohabitation. They should just register as domestic partners.";
  if (mins > 1000) return "🏠 New Bae has set up an Airbnb listing with only your name on it now.";
  if (mins > 600) return "💍 The ring vendor knows you by first name. Wedding dates are being discussed at the watercooler.";
  if (mins > 400) return "📦 You have a drawer in her office. A DRAWER. For what?!";
  if (mins > 250) return "🍱 Someone already ordered you matching company hoodies and everything.";
  if (mins > 150) return "😳 New Bae's desk chair now has your fingerprints on both armrests.";
  if (mins > 100) return "💸 She started saving screenshots of your messages. For EVICTION purposes...?";
  if (mins > 70) return "🚨 The fire marshal noticed you don't leave and is now concerned for your wellbeing.";
  if (mins > 45) return "⏰ You've aged 3 business years since standing up. Neck says hi btw.";
  if (mins > 25) return "🧊 Someone should check if there's a pulse under all that desk furniture.";
  if (mins > 15) return "🤨 At this point HR is starting to take notes with actual concern.";
  if (mins > 8)  return "😬 The intern noticed. This is now official gossip in Slack #random.";
  if (mins > 4)  return "🦟 Just a casual visit. Respectable. You're practically professionals at this point.";
  return "🖨️ Still learning where the printer lives, huh? Grounds to keep. Proud of you!";
}

function getDailyRoast(totalMins) {
  if (totalMins > 120) return "🏃‍♂️ If speed was everything, this person would be an Olympic athlete by now.";
  if (totalMins > 60)  return "⚡ Speed record: they're collecting medals in other dimensions.";
  return "💤 A quiet day. The suspects are resting for the main event tomorrow.";
}

// --- State ---
let characters = [];
let visits = [];
let activeTimers = {};
let charts = { bar: null, line: null, donut: null };

// --- DOM References ---
const $charGrid = document.getElementById('characters-grid');
const $noCharMsg = document.getElementById('no-characters-msg');
const $addForm = document.getElementById('add-character-form');
const $charNameInput = document.getElementById('char-name-input');
const $rankingsGrid = document.getElementById('rankings-grid');
const $filterChar = document.getElementById('filter-char');
const $visitsBody = document.getElementById('visits-body');
const $noVisitsMsg = document.getElementById('no-visits-msg');
const $totalVisitCount = document.getElementById('total-visit-count');

// --- Character Card Rendering ---

function renderCharacters() {
  if (characters.length === 0) {
    $charGrid.innerHTML = '';
    $noCharMsg.style.display = 'block';
    return;
  }

  $noCharMsg.style.display = 'none';

  const existingCardMap = new Map();
  $charGrid.querySelectorAll('.char-card').forEach(card => {
    const id = card.dataset.id;
    if (id) existingCardMap.set(id, card);
  });

  characters.forEach((ch, i) => {
    const emoji = ch.emoji || getEmojiForChar(ch.name, i);
    const color = ch.color || randomColor(i + CHARACTERS_CONFIG.length);
    const isActive = !!activeTimers[ch.id];
    const elapsed = isActive ? (Date.now() - activeTimers[ch.id]) : 0;
    const elapsedStr = isActive ? formatDuration(elapsed) : '';

    if (!existingCardMap.has(ch.id)) {
      const card = document.createElement('div');
      let themeClass = 'normal-theme';
      if (color === '#4a4a4a' || color === '#333') themeClass = 'shadow-theme';

      card.className = 'char-card ' + themeClass;
      card.dataset.id = ch.id;
      card.style.setProperty('--card-color', color);
      card.style.borderColor = (!ch.color || ch.color === '#4a4a4a') ? '' : color + '44';
      card.innerHTML = `
        <span class="status-badge">${isActive ? '🔴 ACTIVE' : '⚪ IDLE'}</span>
        <div class="emoji">${emoji}</div>
        <div class="name" style="color:${color}">${ch.name}</div>
        <div class="card-label">— The Suspect —</div>
        <div class="running-stat">Total visits: 0 · Stolen time: 0m</div>
        <div class="timer-display" id="timer-${ch.id}" style="color:${color}">--:--:--</div>
        <button class="char-action-btn" data-id="${ch.id}" data-action="start"
                style="background:${color || 'linear-gradient(135deg, #ff006e, #8338ec)'}">▶ START SUSPICIOUS ACTIVITY</button>
        <div class="streak-info" id="streak-${ch.id}"></div>
        <div class="card-footer">
          <button class="remove-btn" data-id="${ch.id}">🗑 Discharge From Operation</button>
        </div>
      `;
      $charGrid.appendChild(card);
    } else {
      const card = existingCardMap.get(ch.id);
      const badge = card.querySelector('.status-badge');
      if (isActive) {
        badge.className = 'status-badge is-active';
        badge.textContent = '🔴 ACTIVE';

        const timerEl = document.getElementById(`timer-${ch.id}`);
        if (timerEl) timerEl.textContent = elapsedStr;

        const btn = card.querySelector('.char-action-btn');
        if (btn.dataset.action !== 'stop') {
          const funnyLabels = [
            '⏹ STOP BEING SUSPICIOUS',
            '🚪 PLEASE EXIT THE BUILDING',
            '⛔ ABORT MISSION NOW',
            '💀 STOP RIGHT THERE',
          ];
          btn.textContent = randomFrom(funnyLabels);
          btn.dataset.action = 'stop';
        }
      } else {
        badge.className = 'status-badge';
        badge.textContent = '⚪ IDLE';

        const timerEl = document.getElementById(`timer-${ch.id}`);
        if (timerEl) timerEl.textContent = '--:--:--';

        const btn = card.querySelector('.char-action-btn');
        if (btn && btn.dataset.action === 'stop') {
          btn.textContent = '▶ START SUSPICIOUS ACTIVITY';
          btn.dataset.action = 'start';
        }
      }

      // Update running stats on card
      const charVisits = visits.filter(v => v.characterId === ch.id);
      const totalT = charVisits.reduce((sum, v) => sum + (v.duration || 0), 0);
      const runEl = card.querySelector('.running-stat');
      if (runEl) {
        runEl.textContent = `Total visits: ${charVisits.length} · Stolen time: ${formatDuration(totalT)}`;
      }

      // Update streak
      const streakEl = document.getElementById(`streak-${ch.id}`);
      if (streakEl && charVisits.length > 0) {
        streakEl.textContent = getStreakInfo(charVisits);
      }
    }
  });
}

function getStreakInfo(charVisits) {
  const today = new Date().toISOString().split('T')[0];
  const daysThisWeek = new Set();
  for (const v of charVisits) {
    const d = v.startTime?.toDate ? v.startTime.toDate().toISOString().split('T')[0] : '';
    if (d) daysThisWeek.add(d);
  }

  // Count consecutive days backwards from today
  let streak = 0;
  const check = new Date();
  // Start from yesterday for streak calculation
  for (let i = 1; i <= 30; i++) {
    check.setDate(check.getDate() - 1);
    const ds = check.toISOString().split('T')[0];
    if (daysThisWeek.has(ds)) { streak++; } else { break; }
  }

  if (streak >= 7) return `🔥 ${streak}-day visit streak! This is now a lifestyle.`;
  if (streak >= 3) return `📅 ${streak} days in a row. The dedication. The commitment.`;
  if (streak >= 2) return `👀 Showing up every day... respect or concern?`;
  return '';
}

function renderRankings() {
  const totalVisitsAll = visits.length;
  if (totalVisitsAll === 0) {
    $rankingsGrid.innerHTML = '<p class="empty-msg">No shame to reveal yet. The suspects are still marshalling their courage 🤠</p>';
    return;
  }

  const stats = characters.map(ch => ({
    ...ch,
    totalCount: visits.filter(v => v.characterId === ch.id).length,
    totalTime: visits.filter(v => v.characterId === ch.id).reduce((sum, v) => sum + (v.duration || 0), 0),
  }));

  const maxTotal = Math.max(...stats.map(s => s.totalTime), 1);
  let rankHtml = '';

  stats.sort((a, b) => b.totalTime - a.totalTime).forEach((s, i) => {
    const percent = ((s.totalTime / maxTotal) * 100).toFixed(0);
    const roast = getRoast(s.totalTime, s.totalCount);

    if (i === 0 && stats.length > 1 && s.totalTime > stats[1].totalTime) {
      rankHtml += `<div class="crown" style="font-size:2.5rem;text-align:center;">👑</div>`;
    }

    rankHtml += `
      <div class="rank-card" style="border-top:4px solid ${s.color || '#888'}">
        <div class="rank-emoji">${s.emoji}</div>
        <div class="rank-name" style="color:${s.color || '#fff'}">${s.name}</div>
        <div style="font-size:0.75rem;color:#666;margin-bottom:0.3rem;">Rank #${i + 1} — The Champion of Suspicion 🏅</div>
        <div class="stat-row"><span>Total Time Wasted</span><span>${s.totalTime > 0 ? formatDuration(s.totalTime) : '—'}</span></div>
        <div class="stat-row"><span>Total Visits</span><span>${s.totalCount || 0}</span></div>
        <div class="stat-row"><span>Avg Duration</span><span>${s.totalCount > 0 ? formatDuration(Math.floor(s.totalTime / s.totalCount)) : '—'}</span></div>
        <div class="rank-bar"><div class="rank-bar-fill" style="width:${percent}%;background:linear-gradient(90deg, ${s.color || '#8338ec'}, #ffbe0b)"></div></div>
        <p class="roast-text">${roast}</p>
      </div>
    `;
  });

  $rankingsGrid.innerHTML = rankHtml;
}

function updateChartFilters() {
  document.getElementById('filter-char').innerHTML = '<option value="all">All Suspects</option>' +
    characters.map(ch => `<option value="${ch.id}">${ch.emoji} ${ch.name}</option>`).join('');
}

function renderVisitLog(filterId) {
  let filtered = filterId && filterId !== 'all' ? visits.filter(v => v.characterId === filterId) : [...visits];

  filtered.sort((a, b) => {
    const ta = a.endTime?.toDate?.() || new Date(a.endTime);
    const tb = b.endTime?.toDate?.() || new Date(b.endTime);
    return tb - ta;
  });

  if (filtered.length === 0) {
    $visitsBody.innerHTML = '';
    $noVisitsMsg.style.display = 'block';
    return;
  }

  $noVisitsMsg.style.display = 'none';

  let html = '';
  filtered.forEach((v, i) => {
    const ch = characters.find(c => c.id === v.characterId);
    const name = ch ? `${ch.emoji} ${ch.name}` : '🕵️ Unknown Suspect (deported?)';
    const duration = v.duration ? formatDuration(v.duration) : '<span style="color:#ff006e;animation:blinkBadge 1s infinite">⚠️ STILL ACTIVE</span>';
    html += `
      <tr>
        <td>${filtered.length - i}</td>
        <td>${name}</td>
        <td>${v.startTime?.toDate ? v.startTime.toDate().toLocaleString() : formatDate(v.startTime)}</td>
        <td>${v.endTime?.toDate ? v.endTime.toDate().toLocaleString() : '<span style="color:#ff006e">∞ — Never</span>'}</td>
        <td style="font-weight:bold;color:${v.duration ? '#ffbe0b' : '#ff006e'}">${duration}</td>
        <td><button class="delete-visit-btn" data-id="${v.id}">🗑 Erase</button></td>
      </tr>
    `;
  });

  $visitsBody.innerHTML = html;
}

// --- Charts ---

function renderCharts() {
  const labels = characters.length > 0 ? characters.map(c => c.name) : ['Nobody'];
  const totalTimePerChar = characters.length > 0 ? characters.map(ch => {
    const filtered = visits.filter(v => v.characterId === ch.id && v.duration);
    return filtered.reduce((sum, v) => sum + v.duration, 0) / 60000; // minutes
  }) : [0];

  // Bar chart — total time waster
  if (charts.bar) charts.bar.destroy();
  const barCtx = document.getElementById('barChart').getContext('2d');
  charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Minutes Spent in Her Proximity',
        data: totalTimePerChar,
        backgroundColor: characters.map(c => (c.color || '#8338ec') + 'aa'),
        borderColor: characters.map(c => c.color || '#8338ec'),
        borderWidth: 2,
        borderRadius: 10,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#aaa' }, grid: { color: '#2a2a4a' } },
        x: { ticks: { color: '#ccc', font: { family: 'Bangers', size: 13 } }, grid: { display: false } },
      }
    }
  });

  // Donut — visit share
  if (charts.donut) charts.donut.destroy();
  const donutCtx = document.getElementById('donutChart').getContext('2d');
  const visitCountPerChar = characters.map(ch => visits.filter(v => v.characterId === ch.id).length);

  let donutLabels = labels;
  if (characters.length === 0) donutLabels = ['Nobody yet'];

  charts.donut = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: donutLabels,
      datasets: [{
        data: visitCountPerChar.length > 0 ? visitCountPerChar : [1],
        backgroundColor: characters.map(c => (c.color || '#8338ec') + 'cc'),
        borderColor: '#1a1a2e',
        borderWidth: 4,
      }]
    },
    options: {
      responsive: true,
      cutout: '55%',
      plugins: { legend: { position: 'bottom', labels: { color: '#ccc', font: { family: 'Bangers' } } } }
    }
  });

  // Line chart — visits over last 14 days
  if (charts.line) charts.line.destroy();
  const now = new Date();
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });

  const visitsPerDay = last14.map(dayStr => {
    return visits.filter(v => {
      const d = v.startTime?.toDate ? v.startTime.toDate().toISOString().split('T')[0] : '';
      return d === dayStr;
    }).length;
  });

  charts.line = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: last14.map(d => d.slice(5)), // MM-DD
      datasets: [{
        label: 'Crimes Against Free Space That Day',
        data: visitsPerDay,
        borderColor: '#ffbe0b',
        backgroundColor: '#ffbe0b22',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ff006e',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#aaa', stepSize: 1 }, grid: { color: '#2a2a4a' } },
        x: { ticks: { color: '#aaa' }, grid: { display: false } },
      }
    }
  });
}

// --- Firebase: Characters ---

async function addCharacter(name) {
  const ch = await addDoc(collection(db, 'characters'), {
    name,
    emoji: getEmojiForChar(name, characters.length),
    color: randomColor(characters.length + CHARACTERS_CONFIG.length),
    createdAt: serverTimestamp(),
  });

  characters.push({ id: ch.id, name, emoji: getEmojiForChar(name, characters.length), color: randomColor(characters.length + CHARACTERS_CONFIG.length) });

  // Match preset if recognizable name
  const lowerName = name.toLowerCase();
  if (lowerName.includes('ex-hunter') || lowerName.includes('hunter')) { characters[characters.length-1].emoji = '🌑'; characters[characters.length-1].color = '#4a4a4a'; }
  else if (lowerName.includes('français') || lowerName.includes('french'))   { characters[characters.length-1].emoji = '🇫🇷'; characters[characters.length-1].color = '#0055A4'; }

  const chData = characters[characters.length - 1];
  renderCharacters();
  renderRankings();
  updateChartFilters();
  fancyToast(randomFrom(TOAST_MESSAGES.addChar).replace('{{emoji}}', chData.emoji).replace('{{name}}', `<strong>${chData.name}</strong>`), 'success');
}

async function removeCharacter(charId) {
  if (!confirm('Discharge this character? Their visits will remain as evidence forever. ⚖️')) return;
  const ch = characters.find(c => c.id === charId);
  delete activeTimers[charId];

  await deleteDoc(doc(db, 'characters', charId));
  characters = characters.filter(c => c.id !== charId);

  const card = $charGrid.querySelector(`.char-card[data-id="${charId}"]`);
  if (card) card.remove();

  renderRankings();
  updateChartFilters();
  renderVisitLog($filterChar.value);
  fancyToast(randomFrom(TOAST_MESSAGES.removeChar).replace('{{name}}', `<strong>${ch?.name || 'Unknown'}</strong>`), 'warning');
}

function listenToCharacters() {
  onSnapshot(collection(db, 'characters'), (snap) => {
    characters = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Auto-assign emojis/colors if missing
    characters.forEach((ch, i) => {
      const lowerName = ch.name.toLowerCase();
      if (lowerName.includes('ex-hunter') || lowerName.includes('hunter')) { ch.emoji = '🌑'; ch.color = '#4a4a4a'; }
      else if (lowerName.includes('français') || lowerName.includes('french') || lowerName.includes('france')) { ch.emoji = '🇫🇷'; ch.color = '#0055A4'; }

      if (!ch.emoji) ch.emoji = getEmojiForChar(ch.name, i);
      if (!ch.color)  ch.color = randomColor(i + CHARACTERS_CONFIG.length);
    });

    renderCharacters();
    renderRankings();
    updateChartFilters();
  }, (err) => {
    console.error('Firestore characters error:', err.message || err);
  });
}

async function ensurePresets(currentChars) {
  const hasExHunter = currentChars.some(c => c.emoji === '🌑' || c.name.toLowerCase().includes('ex-hunter'));
  const hasFrenchMan = currentChars.some(c => c.emoji === '🇫🇷' || c.name.toLowerCase() === 'le français 🍷');

  if (!hasExHunter) {
    await addDoc(collection(db, 'characters'), {
      name: 'The Ex-Hunter 🌑', emoji: '🌑', color: '#4a4a4a', createdAt: serverTimestamp(),
    });
  }
  if (!hasFrenchMan) {
    await addDoc(collection(db, 'characters'), {
      name: 'Le Français 🍷', emoji: '🇫🇷', color: '#0055A4', createdAt: serverTimestamp(),
    });
  }
}

// --- Firebase: Visits ---

async function endVisit(charId, startTime) {
  const endTime = new Date();
  const duration = endTime - startTime;

  if (duration < 2000) {
    showToast('⏱️ That was a walk-by! Stay at least 2 seconds first. 😐');
    return;
  }

  delete activeTimers[charId];
  const ch = characters.find(c => c.id === charId);
  const name = ch ? ch.name : '[deleted]';

  await addDoc(collection(db, 'visits'), {
    characterId: charId,
    startTime: Timestamp.fromDate(new Date(startTime)),
    endTime: Timestamp.fromDate(endTime),
    duration,
  });

  renderCharacters();
  renderVisitLog($filterChar.value);
  fancyToast(
    randomFrom(TOAST_MESSAGES.visitEnd)
      .replace('{{name}}', `<strong>${name}</strong>`)
      .replace('{{duration}}', `<strong>${formatDuration(duration)}</strong>`)
      .replace('{{date}}', `<strong>${endTime.toLocaleTimeString()}</strong>`),
  'drama');

  // Dramatic one-time milestone toast
  const milestones = JSON.parse(localStorage.getItem('nb_watch_milestones') || '{}');
  if (totalT > 3600000 && !milestones[charId]) {
    milestones[charId] = true;
    localStorage.setItem('nb_watch_milestones', JSON.stringify(milestones));
    setTimeout(() => fancyToast(`🏠 <strong>${name}</strong> has now spent 1+ HOURS at her desk. This is no longer a "visit." <em>This is... other stuff.</em>`, 'drama'), 1000);
  }
}

async function addActiveVisit(charId) {
  activeTimers[charId] = Date.now();
  const ch = characters.find(c => c.id === charId);
  await addDoc(collection(db, 'visits'), {
    characterId: charId,
    startTime: Timestamp.fromDate(new Date(activeTimers[charId])),
    endTime: null,
    duration: null,
  });

  renderCharacters();
  fancyToast(
    randomFrom(TOAST_MESSAGES.visitStart).replace('{{name}}', `<strong>${ch?.name || '???'}</strong>`),
    'drama'
  );
}

async function deleteVisit(visitId) {
  await deleteDoc(doc(db, 'visits', visitId));
  showToast('🗑️ One piece of evidence erased. But the rumors remain.');
}

async function clearAllVisits() {
  if (!confirm('⚠️ REAL. DELETE ALL VISITS? This will burn the entire case file. Are you SURE?')) return;

  for (const v of visits) {
    await deleteDoc(doc(db, 'visits', v.id));
  }
  fancyToast(randomFrom(TOAST_MESSAGES.clearVisits), 'warning');
}

function listenToVisits() {
  onSnapshot(query(collection(db, 'visits'), orderBy('startTime', 'desc')), (snap) => {
    visits = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Restore any ongoing timers from unsaved visits (page refresh scenario)
    for (const v of visits) {
      if (!v.endTime && !activeTimers[v.characterId]) {
        activeTimers[v.characterId] = new Date(v.startTime).getTime();
      }
    }

    renderCharacters();
    renderVisitLog($filterChar.value);
    renderRankings();
    renderCharts();

    const total = visits.length;
    $totalVisitCount.textContent = total > 0 ? `📈 Total suspicious acts tracked: ${total} — and counting...` : '';
  }, (err) => {
    console.error('Firestore visits error:', err);
  });
}

// --- Event Listeners ---

$addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $charNameInput.value.trim();
  if (!name) return;
  await addCharacter(name);
  $charNameInput.value = '';
});

$filterChar.addEventListener('change', () => {
  renderVisitLog($filterChar.value);
});

// Event delegation for card buttons
$charGrid.addEventListener('click', async (e) => {
  const btn = e.target.closest('.char-action-btn') || e.target.closest('.remove-btn');
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'start') {
    await addActiveVisit(id);
  } else if (action === 'stop') {
    const startTime = activeTimers[id];
    if (startTime) await endVisit(id, startTime);
  } else if (btn.classList.contains('remove-btn')) {
    await removeCharacter(id);
  }
});

// Event delegation for visit delete buttons
$visitsBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('.delete-visit-btn');
  if (!btn) return;
  const visitId = btn.dataset.id;
  await deleteVisit(visitId);
});

document.getElementById('clear-visits-btn').addEventListener('click', clearAllVisits);

// --- Debug helper on window for manual trigger ---
window.debugFirebase = () => {
  console.log('Characters in state:', characters);
  console.log('Visits in state:', visits.length);
};

function showFallbackError(msg) {
  if (document.getElementById('fallback-msg')) return; // already shown
  const el = document.createElement('div');
  el.id = 'fallback-msg';
  el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#ffbe0b;padding:1rem 2rem;border-radius:14px;font-size:1rem;z-index:9999;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:500px;width:90%;border-left:4px solid #ff006e;line-height:1.5;';
  el.innerHTML = `
    <div style="font-family:Bangers,cursive;font-size:1.3rem;margin-bottom:0.5rem;">⚠️ Firebase Connection Issue</div>
    <div style="color:#ccc;font-size:0.9rem;">${msg}</div>
    <button id="load-local-btn" style="margin-top:0.75rem;padding:0.6rem 1.2rem;font-size:1rem;border:none;border-radius:8px;background:#ff006e;color:#fff;cursor:pointer;font-weight:bold;">🚀 Load Without Firebase</button>
  `;
  document.body.appendChild(el);

  document.getElementById('load-local-btn').addEventListener('click', () => {
    el.remove();
    for (const cfg of CHARACTERS_CONFIG.slice()) {
      const id = 'local-' + Math.random().toString(36).substr(2, 9);
      characters.push({ id, name: cfg.emoji === '🌑' ? 'The Ex-Hunter 🌑' : 'Le Français 🍷', emoji: cfg.emoji, color: cfg.color });
    }
    renderCharacters();
    renderRankings();
    updateChartFilters();
    fancyToast('🎭 Local presets loaded! Works offline but won\'t sync across browsers.', 'success');
  });
}

// --- Init ---

async function init() {
  listenToCharacters();
  listenToVisits();

  // Live timer ticker — update display every second for active visits
  setInterval(() => {
    for (const charId of Object.keys(activeTimers)) {
      const elapsed = Date.now() - activeTimers[charId];
      const el = document.getElementById(`timer-${charId}`);
      if (el) {
        el.textContent = formatDuration(elapsed);

        // If visit no longer exists in Firestore (was stopped), clear UI
        const stillActive = visits.some(v => v.characterId === charId && !v.endTime);
        if (!stillActive) {
          delete activeTimers[charId];
          el.textContent = '--:--:--';
        }
      }
    }
  }, 1000);

  // Wait for onSnapshot listeners to register before we try to write
  await new Promise(r => setTimeout(r, 500));

  // Try reading characters from Firestore — if collection doesn't exist yet, just create directly
  try {
    const snap = await getDocs(collection(db, 'characters'));
    console.log(`✅ Firestore: ${snap.size} documents found`);
    
    if (snap.empty) {
      // Create presets directly — no need to read first since we know it's empty
      for (const cfg of CHARACTERS_CONFIG.slice()) {
        await addDoc(collection(db, 'characters'), {
          name: cfg.emoji === '🌑' ? 'The Ex-Hunter 🌑' :
                cfg.emoji === '🇫🇷' ? 'Le Français 🍷',
          emoji: cfg.emoji,
          color: cfg.color,
        });
      }
      fancyToast('🎭 Welcome to <strong>New Bae Watch</strong>. The suspects are in position.<br><em>Time to find out who\'s really dedicated.</em>', 'drama');
    } else {
      console.log(`${snap.size} characters already exist — using existing data`);
    }
  } catch (err) {
    // Collection might not exist yet, or rules error — just create directly
    console.warn('Could not read collection, creating presets directly:', err.message || err);
    for (const cfg of CHARACTERS_CONFIG.slice()) {
      try {
        await addDoc(collection(db, 'characters'), {
          name: cfg.emoji === '🌑' ? 'The Ex-Hunter 🌑' :
                cfg.emoji === '🇫🇷' ? 'Le Français 🍷',
          emoji: cfg.emoji,
          color: cfg.color,
        });
      } catch (writeErr) {
        console.error('Failed to create preset:', writeErr.message || writeErr);
        showFallbackError(
          'Cannot connect to Firebase Firestore.<br><strong>Action needed:</strong><br>' +
          '1. Go to <a href="https://console.firebase.google.com/project/tracking-3535d/firestore/rules" target="_blank">Firestore → Rules</a><br>' +
          '2. Make sure it says <code>allow read, write: if true;</code><br>' +
          '3. Click Publish (takes ~60 seconds to propagate)<br>' +
          '4. Refresh this page<br><br>' +
          'In the meantime, click below to run locally.'
        );
        return; // Don't proceed further
      }
    }
  }
}

init();
