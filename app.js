import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAeG-PvskJxUg7d-GbkiGtJ36jGdW5NkDY',
  authDomain: 'tracking-3535d.firebaseapp.com',
  projectId: 'tracking-3535d',
  storageBucket: 'tracking-3535d.firebasestorage.app',
  messagingSenderId: '636578616250',
  appId: '1:636578616250:web:d288618cb25f639dbe0383',
  measurementId: 'G-JFEP9DNGL5'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CHARS_CFG = [
  { emoji: '\u{1F311}', color: '#4a4a4a' },
  { emoji: '\u{1F1EB}\u{1F1F7}', color: '#0055A4' }
];

const COLORS = ['#06d6a0','#ffd166','#ef476f','#118ab2','#073b4c','#e63946','#457b9d','#f4a261','#2a9d8f','#e9c46a','#264653','#6a0dad'];
const EMOJIS = ['\u{1F4AF}','\u{1FAC6}','\u{1F4DD}','\u{1F438}','\u{1f47b}','\u{1F921}','\u{1f480}','\u{1F525}','\u{26A1}','\u{1f9e0}','\u{1F608}','\u{1F941}','\u{1F43A}'];

const TOAST_MSGS = {
  visitEnd: [
    'EXILE! Suspect left after DURATION of pure chaos.',
    'Suspect released! HR reports filed. \u{1f4dd}',
    'BREAKING! Suspect survived at ALL-TIME LOW of DURATION.'
  ],
  addChar: [
    'New suspect deployed! The conspiracy grows...',
    'A new player enters the game... not on TikTok.\u{1f3ae}',
    'Recruits Team Creep! Welcome aboard. \u{1f421}'
  ],
  removeChar: ['Discharged from the program (banned from her desk) \u{1f6aa}']
};

let characters = [], visits = [], treats = [];
let activeTimers = {};
let chartsObj = { bar: null, line: null, donut: null, treat: null };

const $cg = document.getElementById('characters-grid');
const $noC = document.getElementById('no-characters-msg');
const $af = document.getElementById('add-character-form');
const $ni = document.getElementById('char-name-input');
const $rg = document.getElementById('rankings-grid');
const $flt = document.getElementById('filter-char');
const $vb = document.getElementById('visits-body');
const $noV = document.getElementById('no-visits-msg');

/* --- Utility Functions --- */

function rf(a) {
  return a[Math.floor(Math.random() * a.length)];
}

function rc(i) {
  return COLORS[i % COLORS.length];
}

function re(i) {
  return EMOJIS[i % EMOJIS.length];
}

function fmtDur(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor((s % 3600) / 60);
  var h = Math.floor(s / 3600);
  var sec = s % 60;
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm ' + sec + 's';
}

function fmtDate(ts) {
  if (ts && ts.toDate) return ts.toDate().toLocaleString();
  return new Date(ts).toLocaleString();
}

function showToast(msg, typ) {
  var e = document.querySelector('.toast');
  if (e) e.remove();
  var t = document.createElement('div');
  t.className = 'toast' + (typ ? ' ' + typ : '');
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, 4000);
}

function buildRoast(totalTimeMs) {
  var mins = totalTimeMs / 60000;
  if (mins > 1500) return "💀 This ain't a visit anymore, this is cohabitation. They should just register as domestic partners.";
  if (mins > 1000) return "🏠 New Bae has set up an Airbnb listing with only your name on it now.";
  if (mins > 600)  return "💍 The ring vendor knows you by first name. Wedding dates are being discussed at the watercooler.";
  if (mins > 400)  return "📦 You have a drawer in her office. A DRAWER. For what?!";
  if (mins > 250)  return "🍱 Someone already ordered you matching company hoodies and everything.";
  if (mins > 150)  return "😳 New Bae's desk chair now has your fingerprints on both armrests.";
  if (mins > 100)  return "💸 She started saving screenshots of your messages. For EVICTION purposes...?";
  if (mins > 70)   return "🚨 The fire marshal noticed you don't leave and is now concerned for your wellbeing.";
  if (mins > 45)   return "⏰ You've aged 3 business years since standing up. Neck says hi btw.";
  if (mins > 25)   return "🧊 Someone should check if there's a pulse under all that desk furniture.";
  if (mins > 15)   return '🤨 At this point HR is starting to take notes with actual concern.';
  if (mins > 8)    return '😬 The intern noticed. This is now official gossip in Team Tuesday Brunch.';
  if (mins > 4)    return "🦟 Just a casual visit. Respectable. You're practically professionals at this point.";
  return '🖨️ Still learning where the printer lives, huh? Grounds to keep. Proud of you!';
}

function buildStreak(visitsForChar) {
  var days = {};
  visitsForChar.forEach(function (v) {
    var d = v.startTime && v.startTime.toDate ? v.startTime.toDate().toISOString().split('T')[0] : '';
    if (d) days[d] = true;
  });
  var streak = 0, cur = new Date();
  for (var i = 1; i <= 30; i++) {
    cur.setDate(cur.getDate() - 1);
    var ds = cur.toISOString().split('T')[0];
    if (days[ds]) { streak++; } else { break; }
  }
  if (streak >= 7) return '\u{1F525} ' + streak + '-day streak! This is a lifestyle.';
  if (streak >= 3) return '\u{1F4C5} ' + streak + ' days in a row. Commitment!';
  if (streak >= 2) return '\u{1F440} Every day... respect or concern?';
  return '';
}

/* --- Tier System: titles upgrade based on total visit time --- */

function buildTier(totalMs) {
  var m = Math.floor(totalMs / 60000);  // minutes of total visit time for this character
  if (m >= 480)   return { label: 'THE WEDDING PLANNER', emoji: '\u{1F470}', color: '#e53935' };
  if (m >= 300)   return { label: 'HAS THEIR OWN KEYCARD NOW', emoji: '\ud83d\udd11', color: '#c77dff' };
  if (m >= 180)   return { label: 'NEVER LEAVES HER SIDE AGAIN', emoji: '\u{1F4AC}', color: '#ffd54f' };
  if (m >= 90)    return { label: 'COLLECTING STUFF FOR A ROOM OF THEIRS', emoji: '\ud83d\ude07', color: '#ffb74d' };
  if (m >= 45)    return { label: 'KNOWN AS "DESK-MATE" (NOT CO-WORKER)', emoji: '\u{1F60E}', color: '#7b2d8e' };
  if (m >= 20)    return { label: 'STALKER', emoji: '\u{1F440}', color: '#90005e' };
  if (m >= 10)    return { label: 'HOVERER', emoji: '\u{1F60E}', color: '#c77dff' };
  return { label: 'THE SUSPECT', emoji: '\u{1F575}\uFE0F', color: '#8338ec' };
}

/* ---- RENDER CHARACTERS ---- */

function renderCharacters() {
  if (!characters.length) { $cg.innerHTML = ''; $noC.style.display = 'block'; return; }
  $noC.style.display = 'none';

  var existing = {};
  $cg.querySelectorAll('.char-card').forEach(function (card) {
    if (card.dataset.cid) existing[card.dataset.cid] = card;
  });

  characters.forEach(function (ch, idx) {
    var em = ch.emoji || re(idx);
    var col = ch.color || rc(idx + CHARS_CFG.length);
    var isActive = !!activeTimers[ch.id];
    var elapsed = isActive ? (Date.now() - activeTimers[ch.id]) : 0;

    if (!existing[ch.id]) {
      var card = document.createElement('div');
      card.className = 'char-card shadow-theme';
      card.dataset.cid = ch.id;

      var badgeTxt = isActive ? '\u{1F534} ACTIVE' : '\u26AA IDLE';

      /* Calculate tier from actual visit data */
      var cVisits = visits.filter(function (v) { return v.characterId === ch.id; });
      var totalMs = cVisits.reduce(function (s, v) { return s + (v.duration || 0); }, 0);
      var tierInfo = buildTier(totalMs);

      var html = '';
      html += '<span class="status-badge">' + badgeTxt + '</span>';
      html += '<div class="emoji">' + em + '</div>';
      html += '<div class="name" style="color:' + col + '">' + ch.name + '</div>';
      html += '<div class="card-label" id="ctl-' + ch.id + '" style="color:' + tierInfo.color + '">' + tierInfo.emoji + ' ' + tierInfo.label + '</div>';
      html += '<div class="running-stat">Visits: ' + cVisits.length + ' | Time: ' + fmtDur(totalMs) + '</div>';
      html += '<div class="timer-display" id="tmr-' + ch.id + '" style="color:' + col + '">--:--</div>';

      var actionBtn = isActive ? 'stop' : 'start';
      var btnLabel = isActive ? rf(['STOP BEING SUSPICIOUS', 'EXIT THE BUILDING', 'ABORT']) : 'START SUSPICIOUS ACTIVITY';
      html += '<button class="char-action-btn" data-cid="' + ch.id + '" data-act="' + actionBtn + '" style="background:' + col + '">' + btnLabel + '</button>';

      var treatCount = treats.filter(function (t) { return t.characterId === ch.id; }).length;
      html += '<div class="streak-info"></div>';
      html += '<div class="treat-area"><span class="treat-count" id="trt-' + ch.id + '">🍪x' + treatCount + '</span> <button class="treat-btn" data-cid="' + ch.id + '" style="background:' + col + '">🍪 Treat</button></div>';
      html += '<div class="card-footer"><button class="remove-btn" data-cid="' + ch.id + '">\u{1f5d1}\uFE0F Discharge</button></div>';

      card.innerHTML = html;
      $cg.appendChild(card);
    } else {
      var card = existing[ch.id];
      var badgeEl = card.querySelector('.status-badge');
      var timerEl = document.getElementById('tmr-' + ch.id);
      var btnEl = card.querySelector('.char-action-btn');

      if (isActive) {
        badgeEl.className = 'status-badge is-active';
        badgeEl.textContent = '\u{1F534} ACTIVE';
        if (timerEl) timerEl.textContent = fmtDur(elapsed);
        if (!btnEl || btnEl.dataset.act !== 'stop') {
          btnEl.textContent = rf(['STOP BEING SUSPICIOUS', 'EXIT THE BUILDING']);
          btnEl.dataset.act = 'stop';
        }
      } else {
        badgeEl.className = 'status-badge';
        badgeEl.textContent = '\u26AA IDLE';
        if (timerEl) timerEl.textContent = '--:--';
        if (btnEl && btnEl.dataset.act === 'stop') {
          btnEl.textContent = 'START SUSPICIOUS ACTIVITY';
          btnEl.dataset.act = 'start';
        }
      }

      /* update stats */ var cVisits = visits.filter(function (v) { return v.characterId === ch.id; });
      var totalMs = cVisits.reduce(function (s, v) { return s + (v.duration || 0); }, 0);
      var statLine = card.querySelector('.running-stat');
      if (statLine) statLine.textContent = 'Visits: ' + cVisits.length + ' | Stolen time: ' + fmtDur(totalMs);

      var streakEl = card.querySelector('.streak-info');
      if (streakEl && cVisits.length > 0) streakEl.textContent = buildStreak(cVisits);

      /* update tier */
      var newTier = buildTier(totalMs);
      var labelEl = document.getElementById('ctl-' + ch.id);
      if (labelEl) labelEl.innerHTML = newTier.emoji + ' ' + newTier.label;
      if (labelEl) labelEl.style.color = newTier.color;

      /* update treat count */
      var tCount = treats.filter(function (t) { return t.characterId === ch.id; }).length;
      var trtEl = document.getElementById('trt-' + ch.id);
      if (trtEl) trtEl.textContent = '🍪x' + tCount + '🍪';
    }
  });
}

/* ---- RENDER RANKINGS ---- */

function renderRankings() {
  if (!visits.length) { $rg.innerHTML = '<p class="empty-msg">Time to reveal the truth is not yet...</p>'; return; }

  var stats = characters.map(function (ch) {
    var cv = visits.filter(function (v) { return v.characterId === ch.id; });
    return {
      name: ch.name, emoji: ch.emoji, color: ch.color || '#8338ec',
      tc: cv.length, tt: cv.reduce(function (s, v) { return s + (v.duration || 0); }, 0)
    };
  });
  if (!stats.length) return;

  var maxT = Math.max.apply(null, stats.map(function (s) { return s.tt || 0; })) || 1;
  stats.sort(function (a, b) { return (b.tt || 0) - (a.tt || 0); });

  var html = '';
  stats.forEach(function (s) {
    var pct = Math.round((s.tt / maxT) * 100);
    var roastTxt = buildRoast(s.tt);
    if (pct > 50) html += '<div class="crown" style="font-size:2.5rem;text-align:center;">\u{1F451}</div>';

    var row = '<div class="rank-card" style="border-top:4px solid ' + s.color + '">';
    row += '<div class="rank-emoji">' + (s.emoji || '') + '</div>';
    row += '<div class="rank-name" style="color:' + s.color + '">' + s.name + '</div>';
    var timeStr = ''; if (s.tt > 0) { timeStr = fmtDur(s.tt); } else { timeStr = '--'; }
    row += '<div class="stat-row"><span>Time Wasted</span><span>' + timeStr + '</span></div>';
    row += '<div class="stat-row"><span>Total Visits</span><span>' + s.tc + '</span></div>';
    row += '<div class="rank-bar"><div class="rank-bar-fill" style="width:' + pct + '%;background:' + s.color + '"></div></div>';
    row += '<p class="roast-text">' + roastTxt + '</p>';
    row += '</div>';

    html += row;
  });
  $rg.innerHTML = html;
}

/* ---- RENDER VISIT LOG ---- */

function renderVisitLog(filterId) {
  var filtered = (filterId && filterId !== 'all') ? visits.filter(function (v) { return v.characterId === filterId; }) : [].concat(visits);
  filtered.sort(function (a, b) {
    var ta = a.endTime && a.endTime.toDate ? a.endTime.toDate() : new Date(a.endTime);
    var tb = b.endTime && b.endTime.toDate ? b.endTime.toDate() : new Date(b.endTime);
    return tb - ta;
  });

  if (!filtered.length) { $vb.innerHTML = ''; $noV.style.display = 'block'; return; }
  $noV.style.display = 'none';

  var html = '';
  filtered.forEach(function (v, i) {
    /* find character name */ var chName = ''; for (var c = 0; c < characters.length; c++) { if (characters[c].id === v.characterId) { chName = (characters[c].emoji || '') + ' ' + characters[c].name; break; } }
    if (!chName) chName = '\u{1F575}\uFE0F Unknown';

    var durHtml = ''; var durColor = '#ffbe0b';
    if (v.duration) { durHtml = '<b>' + fmtDur(v.duration) + '</b>'; } else { durHtml = '<span style="color:#ff006e">STILL ACTIVE</span>'; durColor = '#ff006e'; }

    var r = '';
    r += '<tr><td>' + (filtered.length - i) + '</td>';
    r += '<td>' + chName + '</td>';
    r += '<td>' + fmtDate(v.startTime) + '</td>';
    r += '<td>' + fmtDate(v.endTime) + '</td>';
    r += '<td style="font-weight:bold;color:' + durColor + '">' + durHtml + '</td>';
    r += '<td><button class="delete-visit-btn" data-id="' + v.id + '">\u{1f5d1}\uFE0F</button></td>';
    r += '</tr>';
    html += r;
  });
  $vb.innerHTML = html;
}

/* ---- CHARTS ---- */

function renderCharts() {
  if (!characters.length) return;
  var labels = characters.map(function (c) { return c.name; });

  /* Bar Chart */
  if (chartsObj.bar) chartsObj.bar.destroy();
  var barVals = characters.map(function (ch) {
    var vals = visits.filter(function (v) { return v.characterId === ch.id && v.duration; });
    return vals.reduce(function (s, v) { return s + v.duration; }, 0) / 60000; /* minutes */
  });

  chartsObj.bar = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Minutes in Proximity',
        data: barVals,
        backgroundColor: characters.map(function (c) { return (c.color || '#8338ec') + 'aa'; }),
        borderColor: characters.map(function (c) { return c.color || '#8338ec'; }),
        borderWidth: 2, borderRadius: 10
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#aaa' }, grid: { color: '#2a2a4a' } },
        x: { ticks: { color: '#ccc', font: { family: 'Bangers', size: 13 } }, grid: { display: false } }
      }
    }
  });

  /* Donut Chart */
  if (chartsObj.donut) chartsObj.donut.destroy();
  var donutData = characters.map(function (ch) {
    return visits.filter(function (v) { return v.characterId === ch.id; }).length;
  });

  chartsObj.donut = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: donutData,
        backgroundColor: characters.map(function (c) { return (c.color || '#8338ec') + 'cc'; }),
        borderColor: '#1a1a2e', borderWidth: 4
      }]
    },
    options: {
      responsive: true, cutout: '55%',
      plugins: { legend: { position: 'bottom', labels: { color: '#ccc' } } }
    }
  });

  /* Line Chart */
  if (chartsObj.line) chartsObj.line.destroy();
  var nowDate = new Date();
  var last14Days = [];
  for (var i = 0; i < 14; i++) {
    var dd = new Date(nowDate);
    dd.setDate(dd.getDate() - (13 - i));
    last14Days.push(dd.toISOString().split('T')[0]);
  }

  var visitsPerDay = last14Days.map(function (dayStr) {
    return visits.filter(function (v) {
      var ds = v.startTime && v.startTime.toDate ? v.startTime.toDate().toISOString().split('T')[0] : '';
      return ds === dayStr;
    }).length;
  });

  chartsObj.line = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: last14Days.map(function (d) { return d.slice(5); }),
      datasets: [{
        label: 'Crimes That Day',
        data: visitsPerDay,
        borderColor: '#ffbe0b',
        backgroundColor: '#ffbe0b22',
        fill: true, tension: 0.4,
        pointBackgroundColor: '#ff006e',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#aaa' }, grid: { color: '#2a2a4a' } },
        x: { ticks: { color: '#aaa' }, grid: { display: false } }
      }
    }
  });
}

/* ---- TREAT CHART ---- */

function renderTreatChart() {
  if (!characters.length || !treats.length) return;

  if (chartsObj.treat) chartsObj.treat.destroy();

  var nowDate = new Date();
  var last14Days = [];
  for (var i = 0; i < 14; i++) {
    var dd = new Date(nowDate);
    dd.setDate(dd.getDate() - (13 - i));
    last14Days.push(dd.toISOString().split('T')[0]);
  }

  var treatsPerDay = last14Days.map(function (dayStr) {
    return treats.filter(function (t) {
      var ds = t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toISOString().split('T')[0] : '';
      return ds === dayStr;
    }).length;
  });

  chartsObj.treat = new Chart(document.getElementById('treatChart'), {
    type: 'line',
    data: {
      labels: last14Days.map(function (d) { return d.slice(5); }),
      datasets: [{
        label: 'Treats Given',
        data: treatsPerDay,
        borderColor: '#06d6a0',
        backgroundColor: '#06d6a022',
        fill: true, tension: 0.4,
        pointBackgroundColor: '#ef476f',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#aaa', stepSize: 1 }, grid: { color: '#2a2a4a' } },
        x: { ticks: { color: '#aaa' }, grid: { display: false } }
      }
    }
  });
}

/* ---- FIREBASE OPERATIONS ---- */

async function addCharacter(name) {
  var idx = characters.length;
  var em = re(idx);
  var col = rc(idx + CHARS_CFG.length);
  var low = name.toLowerCase();

  if (low.indexOf('ex-hunter') !== -1 || low.indexOf('hunter') !== -1) { em = '\u{1F311}'; col = '#4a4a4a'; }
  else if (low.indexOf('france') !== -1 || low.indexOf('french') !== -1) { em = '\u{1F1EB}\u{1F1F7}'; col = '#0055A4'; }

  try {
    var snapRef = await addDoc(collection(db, 'characters'), { name: name, emoji: em, color: col });
    characters.push({ id: snapRef.id, name: name, emoji: em, color: col });
  } catch (e) { console.warn('Create failed:', e); characters.push({ id: 'local-' + Date.now(), name: name, emoji: em, color: col }); }

  renderCharacters();
  renderRankings();
  updateFilterOptions();

  showToast('<b>' + name.toUpperCase() + '</b> joined the operation!', 'success');
}

function listenToCharacters() {
  onSnapshot(collection(db, 'characters'), function (snap) {
    characters = snap.docs.map(function (d) { return { id: d.id, ...d.data() }; });

    /* Auto-assign emoji/color for known characters */
    characters.forEach(function (ch) {
      var low = ch.name.toLowerCase();
      if (low.indexOf('ex-hunter') !== -1 || low.indexOf('hunter') !== -1) { ch.emoji = '\u{1F311}'; ch.color = '#4a4a4a'; }
      else if (low.indexOf('france') !== -1 || low.indexOf('french') !== -1) { ch.emoji = '\u{1F1EB}\u{1F1F7}'; ch.color = '#0055A4'; }
    });

    renderCharacters();
    renderRankings();
    updateFilterOptions();
  }, function (err) { console.error('Chars snapshot error:', err.message || err); });
}

function listenToVisits() {
  onSnapshot(query(collection(db, 'visits'), orderBy('startTime', 'desc')), function (snap) {
    var rawDocs = snap.docs.map(function (d) { return { id: d.id, ...d.data() }; });

    /* Keep only complete visits — those with both endTime and duration */
    visits = rawDocs.filter(function (v) { return v.endTime != null && v.duration != null; });

    /* Restore ongoing timers from page reload */
    visits.forEach(function (v) {
      if (!v.endTime && !activeTimers[v.characterId]) {
        activeTimers[v.characterId] = new Date(v.startTime).getTime();
      }
    });

    renderCharacters();
    renderVisitLog($flt.value);
    renderRankings();
    renderCharts();

    /* Delete orphaned start-docs from old buggy sessions */
    rawDocs.forEach(function (v) {
      if (v.endTime == null || v.duration == null) {
        deleteDoc(doc(db, 'visits', v.id)).catch(function () {});
      }
    });
  }, function (err) { console.error('Visits snapshot error:', err.message || err); });
}

async function beginSuspiciousActivity(charId) {
  activeTimers[charId] = Date.now();

  var chName = ''; for (var i = 0; i < characters.length; i++) { if (characters[i].id === charId) { chName = characters[i].name; break; } }

  /* No Firestore write on start — only store in local memory */

  renderCharacters();
  showToast('<b>\u{1F6A8} CODE RED</b> -- "' + chName + '" is moving in! \u{1f3c3}\uFE0F', 'drama');
}

async function stopSuspiciousActivity(charId, startTime) {
  var duration = Date.now() - startTime;
  if (duration < 2000) return showToast('\u23F1 Wait at least 2 seconds first!');

  delete activeTimers[charId];
  var chName = ''; for (var i = 0; i < characters.length; i++) { if (characters[i].id === charId) { chName = characters[i].name; break; } }

  await addDoc(collection(db, 'visits'), {
    characterId: charId,
    startTime: Timestamp.fromDate(new Date(startTime)),
    endTime: Timestamp.fromDate(new Date()),
    duration: duration
  });

  renderCharacters();
  renderVisitLog($flt.value);

  var exileMsg = rf(TOAST_MSGS.visitEnd).replace('DURATION', fmtDur(duration));
  showToast('<b>\u{1F6AA} EXILE!</b> "' + chName + '" left after ' + fmtDur(duration) + '.', 'drama');
}

async function removeCharacter(charId) {
  if (!confirm('Discharge this character? Their visits remain as evidence forever. \u2696\uFE0F')) return;

  var chName = ''; for (var i = 0; i < characters.length; i++) { if (characters[i].id === charId) { chName = characters[i].name; break; } }
  delete activeTimers[charId];

  try { await deleteDoc(doc(db, 'characters', charId)); } catch (e) {}

  var tDocs = treats.filter(function (t) { return t.characterId === charId; });
  for (var i = 0; i < tDocs.length; i++) { try { await deleteDoc(doc(db, 'treats', tDocs[i].id)); } catch (e) {} }

  characters = characters.filter(function (c) { return c.id !== charId; });

  var cardEl = $cg.querySelector('.char-card[data-cid="' + charId + '"]');
  if (cardEl) cardEl.remove();

  renderRankings();
  updateFilterOptions();
  renderVisitLog($flt.value);
  showToast('"' + chName + '" discharged. Another chapter closes.\u{1F6AC}', 'warning');
}

async function deleteVisit(visitId) {
  try {
    await deleteDoc(doc(db, 'visits', visitId));
  } catch (e) {}
  showToast('One piece of evidence erased. Rumors remain.');
}

async function giveTreat(charId) {
  var chName = ''; for (var i = 0; i < characters.length; i++) { if (characters[i].id === charId) { chName = characters[i].name; break; } }
  
  try {
    await addDoc(collection(db, 'treats'), {
      characterId: charId,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Treat failed:', e);
  }

  showToast('🍪 Dropped a treat for "' + chName + '"! She knows you are bribing her.', 'success');
}

function listenToTreats() {
  onSnapshot(collection(db, 'treats'), function (snap) {
    treats = snap.docs.map(function (d) { return { id: d.id, ...d.data() }; });
    
    characters.forEach(function (ch) {
      var treatCount = treats.filter(function (t) { return t.characterId === ch.id; }).length;
      var trtEl = document.getElementById('trt-' + ch.id);
      if (trtEl) trtEl.textContent = '🍪x' + treatCount + '🍪';
    });

    renderTreatChart();
  }, function (err) { console.error('Treats snapshot error:', err.message || err); });
}

/* ---- UPDATE FILTER DRODOWN ---- */

function updateFilterOptions() {
  var opts = '<option value="all">All Suspects</option>';
  characters.forEach(function (c) {
    var label = (c.emoji || '') + ' ' + c.name;
    opts += '<option value="' + c.id + '">' + label + '</option>';
  });
  $flt.innerHTML = opts;
}

/* ---- EVENT LISTENERS ---- */

$af.addEventListener('submit', async function (e) {
  e.preventDefault();
  var name = $ni.value.trim();
  if (!name) return;
  await addCharacter(name);
  $ni.value = '';
});

$flt.addEventListener('change', function () { renderVisitLog($flt.value); });

$cg.addEventListener('click', async function (e) {
  var btn = e.target.closest('.char-action-btn');
  if (btn) {
    var cid = btn.dataset.cid;
    var act = btn.dataset.act;
    if (act === 'start') await beginSuspiciousActivity(cid);
    else if (act === 'stop') await stopSuspiciousActivity(cid, activeTimers[cid]);
    return;
  }

  var trtBtn = e.target.closest('.treat-btn');
  if (trtBtn) { await giveTreat(trtBtn.dataset.cid); return; }

  var rmBtn = e.target.closest('.remove-btn');
  if (rmBtn) { await removeCharacter(rmBtn.dataset.cid); return; }
});

$vb.addEventListener('click', function (e) {
  var delBtn = e.target.closest('.delete-visit-btn');
  if (delBtn && delBtn.dataset.id) deleteVisit(delBtn.dataset.id);
});

document.getElementById('clear-visits-btn').addEventListener('click', async function () {
  if (!confirm('Burn ALL evidence? This cannot be undone! \u{1F525}')) return;
  for (var i = 0; i < visits.length; i++) { try { await deleteDoc(doc(db, 'visits', visits[i].id)); } catch (e) {} }
});

/* ---- LIVE TIMER TICKER ---- */

setInterval(function () {
  var cids = Object.keys(activeTimers);
  for (var i = 0; i < cids.length; i++) {
    var cid = cids[i];
    var timerEl = document.getElementById('tmr-' + cid);
    if (timerEl) timerEl.textContent = fmtDur(Date.now() - activeTimers[cid]);
  }
}, 1000);

/* ---- INIT ---- */

listenToCharacters();
listenToVisits();
listenToTreats();
