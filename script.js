/* ============================================================
   SYS//CONSULTA — script.js
   Autenticação Telegram pelo próprio chat + consultas
   ============================================================ */

const API_BASE = '';

// ── DOM ───────────────────────────────────────────────────────
const messagesArea    = document.getElementById('messages-area');
const chatInput       = document.getElementById('chat-input');
const sendBtn         = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const resultEmpty     = document.getElementById('result-empty');
const resultData      = document.getElementById('result-data');
const resultFields    = document.getElementById('result-fields');
const resultTypeBadge = document.getElementById('result-type-badge');
const resultTimestamp = document.getElementById('result-timestamp');
const resultPulseRing = document.getElementById('result-pulse-ring');
const themeToggle     = document.getElementById('theme-toggle');
const statusDot       = document.getElementById('status-dot');
const statusLabel     = document.getElementById('status-label');
const sessionIdEl     = document.getElementById('session-id');

// ── State ─────────────────────────────────────────────────────
let isProcessing = false;
let authMode     = null;   // null | "code" | "2fa"  — modo atual do input
const sessionId  = Math.random().toString(36).slice(2, 8).toUpperCase();
sessionIdEl.textContent = sessionId;

// ── Helpers ───────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scrollBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ── Status indicator ──────────────────────────────────────────
function setStatus(state, text) {
  statusDot.className    = `status-dot ${state}`;
  statusLabel.textContent = text;
}

// ── Input mode management ─────────────────────────────────────
function setInputMode(mode) {
  // mode: null | "code" | "2fa" | "normal"
  authMode = mode;

  if (mode === 'code') {
    chatInput.placeholder = 'Digite o código recebido no Telegram...';
    chatInput.type        = 'text';
    chatInput.maxLength   = 10;
    chatInput.disabled    = false;
    sendBtn.disabled      = false;
    sendBtn.style.opacity = '1';
    chatInput.focus();
  } else if (mode === '2fa') {
    chatInput.placeholder = 'Digite sua senha de verificação em 2 etapas...';
    chatInput.type        = 'password';
    chatInput.maxLength   = 200;
    chatInput.disabled    = false;
    sendBtn.disabled      = false;
    sendBtn.style.opacity = '1';
    chatInput.focus();
  } else {
    chatInput.placeholder = 'Digite um comando:  /placa  /nome  /cpf';
    chatInput.type        = 'text';
    chatInput.maxLength   = 500;
    chatInput.disabled    = false;
    sendBtn.disabled      = false;
    sendBtn.style.opacity = '1';
    authMode              = null;
  }
}

function setInputDisabled(disabled) {
  chatInput.disabled    = disabled;
  sendBtn.disabled      = disabled;
  sendBtn.style.opacity = disabled ? '0.35' : '1';
}

// ── Mensagens ─────────────────────────────────────────────────
function addMessage(text, role = 'bot', isHTML = false) {
  const wrap   = document.createElement('div');
  wrap.className = `msg ${role}`;

  const label  = document.createElement('span');
  label.className   = 'msg-label';
  label.textContent = role === 'user' ? 'VOCÊ' : 'SISTEMA';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (isHTML) {
    bubble.innerHTML = text;
  } else if (role === 'user') {
    bubble.innerHTML = text.replace(/^(\/\S+)/, (_, c) =>
      `<span class="cmd-tag">${escapeHtml(c)}</span>`
    );
  } else {
    bubble.textContent = text;
  }

  wrap.appendChild(label);
  wrap.appendChild(bubble);
  messagesArea.appendChild(wrap);
  scrollBottom();
  return { wrap, bubble };
}

async function typeMessage(text, speed = 14) {
  const wrap   = document.createElement('div');
  wrap.className = 'msg bot';
  const label  = document.createElement('span');
  label.className   = 'msg-label';
  label.textContent = 'SISTEMA';
  const bubble = document.createElement('div');
  bubble.className  = 'msg-bubble';
  bubble.textContent = '';
  wrap.appendChild(label);
  wrap.appendChild(bubble);
  messagesArea.appendChild(wrap);
  scrollBottom();

  for (const char of text) {
    bubble.textContent += char;
    scrollBottom();
    await sleep(speed);
  }
  return wrap;
}

// Mensagem especial de auth com ícone de cadeado
function addAuthPrompt(text, icon = '🔐') {
  const wrap   = document.createElement('div');
  wrap.className = 'msg bot auth-prompt';
  const label  = document.createElement('span');
  label.className   = 'msg-label';
  label.textContent = 'SISTEMA';
  const bubble = document.createElement('div');
  bubble.className  = 'msg-bubble auth-bubble';
  bubble.innerHTML  = `
    <div class="auth-icon">${icon}</div>
    <div class="auth-text">${escapeHtml(text)}</div>
  `;
  wrap.appendChild(label);
  wrap.appendChild(bubble);
  messagesArea.appendChild(wrap);
  scrollBottom();
  return wrap;
}

// ── Typing indicator ──────────────────────────────────────────
function showTyping(text = 'consultando telegram...') {
  document.querySelector('.typing-text').textContent = text;
  typingIndicator.classList.add('visible');
  scrollBottom();
}
function hideTyping() {
  typingIndicator.classList.remove('visible');
}

// ── Result panel ──────────────────────────────────────────────
function showResult(data, typeLabel = 'RESULTADO') {
  resultEmpty.style.display = 'none';
  resultData.style.display  = 'flex';
  resultData.classList.remove('alive');
  resultTypeBadge.textContent = typeLabel;
  resultFields.innerHTML = '';

  const fields = normalizeData(data);
  fields.forEach((field, i) => {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.style.animationDelay = `${i * 0.065}s`;
    const lbl = document.createElement('span');
    lbl.className   = 'field-label';
    lbl.textContent = field.label;
    const val = document.createElement('span');
    val.className   = 'field-value';
    val.textContent = field.value;
    row.appendChild(lbl);
    row.appendChild(val);
    resultFields.appendChild(row);
  });

  const now = new Date();
  resultTimestamp.textContent =
    `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;
  resultPulseRing.classList.add('visible');
  setTimeout(() => resultData.classList.add('alive'), fields.length * 65 + 700);
}

function normalizeData(data) {
  if (Array.isArray(data)) {
    return data.map((item, i) => ({
      label: String(item.label || item.key || `CAMPO ${i+1}`).toUpperCase(),
      value: String(item.value ?? item.val ?? '')
    }));
  }
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data).map(([k, v]) => ({
      label: k.replace(/_/g, ' ').toUpperCase(),
      value: String(v)
    }));
  }
  return [{ label: 'RESPOSTA', value: String(data) }];
}

function detectType(cmd) {
  if (/^\/placa/i.test(cmd))  return 'PLACA';
  if (/^\/cpf/i.test(cmd))    return 'CPF';
  if (/^\/nome/i.test(cmd))   return 'NOME';
  if (/^\/rg/i.test(cmd))     return 'RG';
  if (/^\/tel/i.test(cmd))    return 'TELEFONE';
  return 'CONSULTA';
}

// ══════════════════════════════════════════════════════════════
// FLUXO DE AUTENTICAÇÃO
// ══════════════════════════════════════════════════════════════

async function handleAuthCode(code) {
  setInputDisabled(true);
  showTyping('verificando código...');

  try {
    const res  = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'code', value: code })
    });
    const json = await res.json();
    hideTyping();

    if (!res.ok || json.error) {
      await typeMessage(`⚠ ${json.error || 'Erro ao verificar código.'}`, 12);
      setInputMode('code');
      return;
    }

    await typeMessage('Código recebido. Verificando...', 14);
    // Aguarda o servidor concluir a autenticação
    await waitForAuth();

  } catch (err) {
    hideTyping();
    await typeMessage('Erro de conexão. Tente novamente.', 12);
    setInputMode('code');
  }
}

async function handleAuth2FA(password) {
  setInputDisabled(true);
  showTyping('verificando senha...');

  try {
    const res  = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: '2fa', value: password })
    });
    const json = await res.json();
    hideTyping();

    if (!res.ok || json.error) {
      await typeMessage(`⚠ ${json.error || 'Senha incorreta.'}`, 12);
      setInputMode('2fa');
      return;
    }

    await typeMessage('Senha recebida. Verificando...', 14);
    await waitForAuth();

  } catch (err) {
    hideTyping();
    await typeMessage('Erro de conexão. Tente novamente.', 12);
    setInputMode('2fa');
  }
}

// Fica em polling até o Telegram estar pronto ou precisar de outro step
async function waitForAuth(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(1500);
    try {
      const r    = await fetch(`${API_BASE}/api/status`);
      const data = await r.json();

      if (data.telegram) {
        // ✅ Autenticado!
        setStatus('online', 'TELEGRAM OK');
        await typeMessage(
          '✅ Login realizado com sucesso! Sessão salva — nunca mais será necessário autenticar neste ou em qualquer outro dispositivo.',
          12
        );
        setInputMode('normal');
        return;
      }

      if (data.auth_error) {
        await typeMessage(`⚠ ${data.auth_error}`, 12);
        setInputMode(null);
        return;
      }

      if (data.auth_step === '2fa') {
        addAuthPrompt(
          'Sua conta tem verificação em dois fatores. Digite sua senha de segurança do Telegram:',
          '🔑'
        );
        setInputMode('2fa');
        return;
      }

      if (data.auth_step === 'code') {
        // Código inválido, pede de novo
        await typeMessage('Código incorreto. Verifique e tente novamente:', 12);
        setInputMode('code');
        return;
      }

    } catch { /* continua tentando */ }
  }

  await typeMessage('Tempo esgotado aguardando autenticação. Reinicie o servidor.', 12);
}

// ══════════════════════════════════════════════════════════════
// STATUS CHECK + BOOT DE AUTH
// ══════════════════════════════════════════════════════════════

let authFlowStarted = false;

async function checkStatus() {
  try {
    const r    = await fetch(`${API_BASE}/api/status`);
    const data = await r.json();

    if (data.telegram) {
      setStatus('online', 'TELEGRAM OK');
      return; // Tudo certo, para de checar
    }

    if (data.needs_auth && !authFlowStarted) {
      authFlowStarted = true;
      setStatus('offline', 'AUTH PENDENTE');
      await startAuthFlow(data);
      return;
    }

    if (data.auth_step === '2fa' && !authFlowStarted) {
      authFlowStarted = true;
      setStatus('offline', 'AUTH PENDENTE');
      addAuthPrompt(
        'Sua conta tem verificação em dois fatores. Digite sua senha de segurança:',
        '🔑'
      );
      setInputMode('2fa');
      return;
    }

    // Ainda conectando
    setStatus('offline', 'CONECTANDO...');
    setTimeout(checkStatus, 2500);

  } catch {
    setStatus('error', 'OFFLINE');
    setTimeout(checkStatus, 5000);
  }
}

async function startAuthFlow(statusData) {
  setInputDisabled(true);

  // Animação de boot
  await sleep(600);

  addAuthPrompt(
    `Primeiro acesso detectado.\nUm código de verificação foi enviado para o número ${maskPhone('+5541974010817')}.\n\nDigite o código abaixo para continuar:`,
    '📲'
  );

  if (statusData.auth_error) {
    await typeMessage(`⚠ ${statusData.auth_error}`, 12);
  }

  setInputMode('code');
  setStatus('offline', 'AGUARDANDO CÓDIGO');
}

function maskPhone(phone) {
  // +5541974010817 → +55 41 ****0817
  return phone.replace(/(\+\d{2})(\d{2})(\d{4})(\d{4})/, '$1 $2 ****$4');
}

// ══════════════════════════════════════════════════════════════
// ENVIO PRINCIPAL (consultas ou auth)
// ══════════════════════════════════════════════════════════════

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isProcessing) return;

  // ── Modo autenticação ──
  if (authMode === 'code') {
    chatInput.value = '';
    addMessage('••••••', 'user');   // Não mostra o código na tela
    await handleAuthCode(text);
    return;
  }

  if (authMode === '2fa') {
    chatInput.value = '';
    addMessage('••••••••', 'user');
    await handleAuth2FA(text);
    return;
  }

  // ── Modo consulta normal ──
  if (isProcessing) return;
  isProcessing = true;
  chatInput.value = '';
  setInputDisabled(true);

  addMessage(text, 'user');
  await sleep(200);
  showTyping('consultando telegram...');

  try {
    const res  = await fetch(`${API_BASE}/api/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ command: text, session_id: sessionId })
    });
    const json = await res.json();

    await sleep(350);
    hideTyping();

    if (!res.ok || json.error) {
      await typeMessage(`⚠ ${json.error || `Erro HTTP ${res.status}`}`, 12);
    } else {
      await typeMessage(json.message || 'Consulta realizada.', 13);
      if (json.data) showResult(json.data, detectType(text));
    }

  } catch (err) {
    hideTyping();
    await typeMessage('Falha de conexão com o servidor.', 11);
    setStatus('error', 'OFFLINE');
  }

  isProcessing = false;
  setInputMode('normal');
}

// ══════════════════════════════════════════════════════════════
// WELCOME
// ══════════════════════════════════════════════════════════════

function renderWelcome() {
  const el = document.createElement('div');
  el.className = 'welcome-msg';
  el.innerHTML = `
    <h3>◈ SYS//CONSULTA</h3>
    <p>Sistema integrado ao Telegram. Comandos disponíveis:</p>
    <div class="cmd-list">
      <div class="cmd-list-item"><strong>/placa</strong> FLR7671 — consulta veicular</div>
      <div class="cmd-list-item"><strong>/nome</strong> João Silva — busca por nome</div>
      <div class="cmd-list-item"><strong>/cpf</strong> 12345678900 — consulta CPF</div>
    </div>
  `;
  messagesArea.appendChild(el);
}

// ══════════════════════════════════════════════════════════════
// EVENTOS
// ══════════════════════════════════════════════════════════════

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

document.querySelectorAll('.input-hints span').forEach(hint => {
  hint.addEventListener('click', () => {
    if (authMode) return;   // Não interfere no fluxo de auth
    chatInput.value = hint.dataset.cmd || '';
    chatInput.focus();
  });
});

themeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  html.setAttribute('data-theme',
    html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  );
  if (window._update3DTheme) window._update3DTheme();
});

// ══════════════════════════════════════════════════════════════
// THREE.JS 3D BACKGROUND
// ══════════════════════════════════════════════════════════════

(function init3D() {
  const canvas   = document.getElementById('bg-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = 5;

  const icoGeo  = new THREE.IcosahedronGeometry(1.85, 1);
  const icoMat  = new THREE.MeshBasicMaterial({ color:0xffffff, wireframe:true, transparent:true, opacity:0.11 });
  const ico     = new THREE.Mesh(icoGeo, icoMat);
  scene.add(ico);

  const innerGeo = new THREE.IcosahedronGeometry(1.3, 1);
  const innerMat = new THREE.MeshBasicMaterial({ color:0x555555, wireframe:true, transparent:true, opacity:0.07 });
  const inner    = new THREE.Mesh(innerGeo, innerMat);
  scene.add(inner);

  const t1Geo = new THREE.TorusGeometry(2.65, 0.005, 4, 120);
  const t1Mat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.07 });
  const t1    = new THREE.Mesh(t1Geo, t1Mat);
  t1.rotation.x = Math.PI / 4;
  scene.add(t1);

  const t2Geo = new THREE.TorusGeometry(3.0, 0.004, 4, 100);
  const t2Mat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.04 });
  const t2    = new THREE.Mesh(t2Geo, t2Mat);
  t2.rotation.y = Math.PI / 3.2;
  scene.add(t2);

  const COUNT = 130, pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2*Math.random()-1), r = 2.6+Math.random()*2;
    pos[i*3]=r*Math.sin(ph)*Math.cos(th); pos[i*3+1]=r*Math.sin(ph)*Math.sin(th); pos[i*3+2]=r*Math.cos(ph);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat   = new THREE.PointsMaterial({ color:0xffffff, size:0.022, transparent:true, opacity:0.28 });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  window._update3DTheme = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    icoMat.color.setHex(dark ? 0xffffff : 0x111111);
    innerMat.color.setHex(dark ? 0x555555 : 0xaaaaaa);
    t1Mat.color.setHex(dark ? 0xffffff : 0x111111);
    t2Mat.color.setHex(dark ? 0xffffff : 0x111111);
    pMat.color.setHex(dark ? 0xffffff : 0x444444);
  };

  let t = 0;
  (function frame() {
    requestAnimationFrame(frame);
    t += 0.0038;
    ico.rotation.x    = t * 0.26;  ico.rotation.y    = t * 0.36;
    inner.rotation.x  = -t * 0.2; inner.rotation.z  = t * 0.17;
    t1.rotation.z     = t * 0.14;  t2.rotation.x     = t * 0.11;
    points.rotation.y = t * 0.055; points.rotation.x = t * 0.025;
    ico.scale.setScalar(1 + Math.sin(t * 0.75) * 0.017);
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();

// ══════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════

renderWelcome();
checkStatus();
