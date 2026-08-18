import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxpJov1i6lCeTa813a6hk1ihHS7W2vKYA",
  authDomain: "test-cd485.firebaseapp.com",
  projectId: "test-cd485",
  storageBucket: "test-cd485.firebasestorage.app",
  messagingSenderId: "217137197135",
  appId: "1:217137197135:web:4d96faee3884f990737a3a",
  measurementId: "G-4VN4LHN86Y"
};

const app = initializeApp(firebaseConfig);
// analytics disabled — don't need it
// const analytics = getAnalytics(app);
const db = getFirestore(app);

// --- Constants ---
const CHARACTERS_CONFIG = [
  { emoji: "🌑", color: "#4a4a4a" },      // The Ex-Hunter (dark shadow)
  { emoji: "🇫🇷", color: "#0055A4" },     // Le Français (French flag blue)
];

const AUTO_COLORS = [
  "#06d6a0","#ffd166","#ef476f","#118ab2","#073b4c","#e63946",
  "#457b9d","#f4a261","#2a9d8f","#e9c46a","#264653","#6a0dad"
];

// --- State ---
let characters = [];
let visits = [];
let activeTimers = {};
let charts = { bar: null, line: null, donut: null };

// --- Helpers ---
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
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
  const existing = CHARACTERS_CONFIG.find(c => c.emoji === name);
  if (existing) return existing.emoji;
  const customEmojis = ["🎭","🦊","🐸","👻","🤡","💀","🔥","⚡","🧠","😈"];
  return customEmojis[idx % customEmojis.length];
}

function getRoast(totalTime, totalVisits) {
  const mins = totalTime / 60000;
  if (mins > 600) return "Rome wasn't built in a day... but this guy is trying to 😂";
  if (mins > 300) return "Marriage counselor is on speed dial 📞💀";
  if (mins > 120) return "At this point, the new hire has to pay rent 💸";
  if (mins > 60) return "Someone call HR... or a priest 👨‍⛪";
  if (mins > 30) return "Stalker vibes detected 🕵️‍♂️";
  if (mins > 10) return "Casual visit. Respectable. 😎";
  return "Still learning the printer location, huh? 🖨️😂";
}

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

// --- Render Functions ---

function renderCharacters() {
  if (characters.length === 0) {
    $charGrid.innerHTML = '';
    $noCharMsg.style.display = 'block';
    return;
  }

  $noCharMsg.style.display = 'none';
  // Only re-render cards that don't exist yet (preserve live timer)
  const existingCardMap = new Map();
  $charGrid.querySelectorAll('.char-card').forEach(card => {
    const id = card.dataset.id;
    if (id) existingCardMap.set(id, card);
  });

  let html = '';
  characters.forEach((ch, i) => {
    const emoji = ch.emoji || CHARACTERS_CONFIG[i % CHARACTERS_CONFIG.length].emoji;
    const color = ch.color || randomColor(i + CHARACTERS_CONFIG.length);
    const isActive = !!activeTimers[ch.id];
    const elapsed = isActive ? (Date.now() - activeTimers[ch.id]) : 0;
    const elapsedStr = isActive ? formatDuration(elapsed) : '';

    if (!existingCardMap.has(ch.id)) {
      const card = document.createElement('div');
      let cardClass = 'char-card';
      if (ch.color === '#4a4a4a' || ch.color === '#333') cardClass += ' shadow-theme';

      card.className = cardClass;
      card.dataset.id = ch.id;
      card.style.borderColor = color + '44';
      card.innerHTML = `
        <div class="emoji">${emoji}</div>
        <div class="name" style="color:${color}">${ch.name}</div>
        <div class="running-stat">Total visits: 0 · Total time: 0m</div>
        <div class="timer-display" id="timer-${ch.id}" style="color:${color}"></div>
        <button class="char-action-btn" data-id="${ch.id}" data-action="start"
                style="background:${color}">▶ START VISIT</button>
        <div class="card-footer">
          <button class="remove-btn" data-id="${ch.id}">✕ Remove</button>
        </div>
      `;
      $charGrid.appendChild(card);
    } else {
      // Update existing card
      const card = existingCardMap.get(ch.id);
      if (isActive) {
        const timerEl = document.getElementById(`timer-${ch.id}`);
        if (timerEl) timerEl.textContent = elapsedStr;

        const btn = card.querySelector('.char-action-btn');
        if (btn.dataset.action !== 'stop') {
          btn.textContent = '⏹ STOP VISIT';
          btn.dataset.action = 'stop';
        }
      } else {
        const timerEl = document.getElementById(`timer-${ch.id}`);
        if (timerEl) timerEl.textContent = '';

        const btn = card.querySelector('.char-action-btn');
        if (btn && btn.dataset.action === 'stop') {
          btn.textContent = '▶ START VISIT';
          btn.dataset.action = 'start';
        }
      }
    }
  });
}

function renderRankings() {
  const totalVisitsAll = visits.length;
  if (totalVisitsAll === 0) {
    $rankingsGrid.innerHTML = '<p class="empty-msg">No rankings yet — the race hasn\'t begun 🏁</p>';
    return;
  }

  const stats = characters.map(ch => ({
    ...ch,
    charVisits: visits.filter(v => v.characterId === ch.id),
    totalCount: visits.filter(v => v.characterId === ch.id).length,
    totalTime: visits.filter(v => v.characterId === ch.id).reduce((sum, v) => sum + (v.duration || 0), 0),
  }));

  const maxTotal = Math.max(...stats.map(s => s.totalTime), 1);
  let rankHtml = '';

  stats.sort((a, b) => b.totalTime - a.totalTime).forEach((s, i) => {
    const percent = ((s.totalTime / maxTotal) * 100).toFixed(0);
    const roast = getRoast(s.totalTime, s.totalCount);

    if (i === 0 && stats.length > 1 && s.totalTime > stats[1].totalTime) {
      rankHtml += `<span class="crown" style="font-size:2rem;text-align:center;display:block;">👑${s.name}</span>`;
    }

    rankHtml += `
      <div class="rank-card" style="border-top:4px solid ${s.color}">
        <div class="rank-emoji">${s.emoji}</div>
        <div class="rank-name">${s.name}</div>
        <div class="stat-row"><span>Total Time</span><span>${formatDuration(s.totalTime)}</span></div>
        <div class="stat-row"><span>Visits</span><span>${s.totalCount}</span></div>
        <div class="rank-bar"><div class="rank-bar-fill" style="width:${percent}%;background:${s.color}"></div></div>
        <p style="font-size:0.8rem;color:#777;margin-top:0.5rem;font-style:italic;">"${roast}"</p>
      </div>
    `;
  });

  $rankingsGrid.innerHTML = rankHtml;
}

function updateChartFilters() {
  document.getElementById('filter-char').innerHTML = '<option value="all">All Characters</option>' +
    characters.map(ch => `<option value="${ch.id}">${ch.name}</option>`).join('');
}

function renderVisitLog(filterId) {
  let filtered = filterId && filterId !== 'all' ? visits.filter(v => v.characterId === filterId) : [...visits];

  // Sort by endTime desc (newest first)
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
    const name = ch ? ch.emoji + ' ' + ch.name : '[DELETED]';
    html += `
      <tr>
        <td>${filtered.length - i}</td>
        <td>${name}</td>
        <td>${v.startTime?.toDate ? v.startTime.toDate().toLocaleString() : formatDate(v.startTime)}</td>
        <td>${v.endTime?.toDate ? v.endTime.toDate().toLocaleString() : formatDate(v.endTime || '—')}</td>
        <td style="font-weight:bold;color:#ffbe0b">${v.duration ? formatDuration(v.duration) : '<span style="color:#555">still going...</span>'}</td>
        <td><button class="delete-visit-btn" data-id="${v.id}">Delete</button></td>
      </tr>
    `;
  });

  $visitsBody.innerHTML = html;
}

// --- Charts ---

function renderCharts() {
  const labels = characters.map(c => c.name);
  const totalTimePerChar = characters.map(ch => {
    const filtered = visits.filter(v => v.characterId === ch.id && v.duration);
    return filtered.reduce((sum, v) => sum + v.duration, 0) / 60000; // minutes
  });

  // Bar chart — total time
  if (charts.bar) charts.bar.destroy();
  const barCtx = document.getElementById('barChart').getContext('2d');
  charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Minutes Spent',
        data: totalTimePerChar,
        backgroundColor: characters.map(c => c.color + 'aa'),
        borderColor: characters.map(c => c.color),
        borderWidth: 2,
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#aaa' }, grid: { color: '#2a2a4a' } },
        x: { ticks: { color: '#aaa' }, grid: { display: false } },
      }
    }
  });

  // Donut — visit count
  if (charts.donut) charts.donut.destroy();
  const donutCtx = document.getElementById('donutChart').getContext('2d');
  const visitCountPerChar = characters.map(ch => visits.filter(v => v.characterId === ch.id).length);
  charts.donut = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: visitCountPerChar,
        backgroundColor: characters.map(c => c.color + 'cc'),
        borderColor: '#1a1a2e',
        borderWidth: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#ccc' } } }
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
        label: 'Visits That Day',
        data: visitsPerDay,
        borderColor: '#ffbe0b',
        backgroundColor: '#ffbe0b33',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ff006e',
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
  const docSnap = await addDoc(collection(db, 'characters'), {
    name,
    emoji: getEmojiForChar(name, characters.length),
    color: randomColor(characters.length + CHARACTERS_CONFIG.length),
    createdAt: serverTimestamp(),
  });

  // Add to local state immediately
  characters.push({ id: docSnap.id, name, emoji: getEmojiForChar(name, characters.length), color: randomColor(characters.length + CHARACTERS_CONFIG.length) });
  renderCharacters();
  renderRankings();
  updateChartFilters();
  showToast(`${emoji} ${name} joined the spy game!`);
}

async function removeCharacter(charId) {
  if (!confirm('Remove this character? Visits will remain but be orphaned.')) return;
  const ch = characters.find(c => c.id === charId);

  // Stop any active timer
  delete activeTimers[charId];

  await deleteDoc(doc(db, 'characters', charId));

  characters = characters.filter(c => c.id !== charId);

  // Remove from DOM
  const card = $charGrid.querySelector(`.char-card[data-id="${charId}"]`);
  if (card) card.remove();

  renderRankings();
  updateChartFilters();
  renderVisitLog($filterChar.value);
  showToast(`${ch?.name || 'Character'} has left the building 🚪`);
}

function listenToCharacters() {
  onSnapshot(collection(db, 'characters'), (snap) => {
    characters = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Merge emoji from config if it's one of the preset characters
    characters.forEach((ch, i) => {
      const lowerName = ch.name.toLowerCase();
      if (lowerName.includes('ex-hunter') || lowerName.includes('hunter')) {
        ch.emoji = '🌑';
        ch.color = '#4a4a4a';
      } else if (lowerName.includes('français') || lowerName.includes('french')) {
        ch.emoji = '🇫🇷';
        ch.color = '#0055A4';
      }
    });

    renderCharacters();
    renderRankings();
    updateChartFilters();
  }, (err) => {
    console.error('Firestore characters error:', err);
    showToast('⚠️ Could not load characters');
  });
}

// --- Firebase: Visits ---

async function endVisit(charId, startTime) {
  const endTime = new Date();
  const duration = endTime - startTime;

  if (duration < 1000) {
    showToast('⏱️ Timer too short! Wait at least 1 second.');
    return;
  }

  delete activeTimers[charId];

  await addDoc(collection(db, 'visits'), {
    characterId: charId,
    startTime: Timestamp.fromDate(new Date(startTime)),
    endTime: Timestamp.fromDate(endTime),
    duration,
  });

  renderCharacters();
  renderVisitLog($filterChar.value);
}

async function addActiveVisit(charId) {
  activeTimers[charId] = Date.now();
  await addDoc(collection(db, 'visits'), {
    characterId: charId,
    startTime: Timestamp.fromDate(new Date(activeTimers[charId])),
    endTime: null,
    duration: null,
  });

  renderCharacters();
}

async function deleteVisit(visitId) {
  await deleteDoc(doc(db, 'visits', visitId));
  showToast('Visit deleted');
}

async function clearAllVisits() {
  if (!confirm('Delete ALL visits? This cannot be undone! 💀')) return;

  for (const v of visits) {
    await deleteDoc(doc(db, 'visits', v.id));
  }
  showToast('🗑️ All visits obliterated');
}

function listenToVisits() {
  onSnapshot(query(collection(db, 'visits'), orderBy('startTime', 'desc')), (snap) => {
    visits = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Restore any ongoing timers from unsaved visits (page reload scenario)
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
    $totalVisitCount.textContent = total > 0 ? `📈 Total visits tracked: ${total}` : '';
  }, (err) => {
    console.error('Firestore visits error:', err);
    showToast('⚠️ Could not load visits');
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

        // If visit no longer exists in Firestore (was stopped), clear timer UI
        const stillActive = visits.some(v => v.characterId === charId && !v.endTime);
        if (!stillActive) {
          delete activeTimers[charId];
          el.textContent = '';
        }
      }
    }
  }, 1000);

  // If no characters exist yet, auto-add the preset hunters
  let hasChars = false;
  try {
    const snap = await getDocs(collection(db, 'characters'));
    if (snap.empty) {
      for (const cfg of CHARACTERS_CONFIG.slice()) {
        await addDoc(collection(db, 'characters'), {
          name: cfg.emoji === '🌑' ? 'The Ex-Hunter 🌑' :
                cfg.emoji === '🇫🇷' ? 'Le Français 🍷',
          emoji: cfg.emoji,
          color: cfg.color,
        });
      }
      showToast('🎭 Welcome! Two hunters enter the game.');
    }
  } catch (err) {
    console.error('Initial data error:', err);
  }
}

init();
