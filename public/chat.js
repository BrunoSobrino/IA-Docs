/* ── Z.ai Chat · chat.js ───────────────────────────────────────────────────── */

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
    sessionId:  generateSessionId(),
    model:      'glm-4.6',
    isLoading:  false,
    msgCount:   0
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const messagesEl    = $('messages');
const inputField    = $('inputField');
const btnSend       = $('btnSend');
const modelSelect   = $('modelSelect');
const sessionLabel  = $('sessionLabel');
const statusDot     = $('statusDot').querySelector('.status-dot');
const toast         = $('toast');
const welcomeScreen = $('welcomeScreen');

// ─── Markdown parser (lightweight) ──────────────────────────────────────────
function parseMarkdown(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trim()}</code></pre>`)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

// ─── Session ID ──────────────────────────────────────────────────────────────
function generateSessionId() {
    return 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
    toast.textContent = msg;
    toast.className   = `toast ${type} show`;
    setTimeout(() => { toast.className = 'toast'; }, 3200);
}

// ─── Status dot ──────────────────────────────────────────────────────────────
function setStatus(s) {
    statusDot.className = 'status-dot' + (s ? ' ' + s : '');
}

// ─── Get doc icon & label ────────────────────────────────────────────────────
function docMeta(type) {
    const map = {
        docx: { icon: '📄', label: 'Word Document',       color: '#2B5BE8' },
        xlsx: { icon: '📊', label: 'Excel Spreadsheet',   color: '#1A7A3F' },
        pptx: { icon: '🎯', label: 'PowerPoint',          color: '#C84B1A' },
        csv:  { icon: '📋', label: 'CSV Data',            color: '#6B21A8' },
        txt:  { icon: '📝', label: 'Text File',           color: '#4B5563' },
        html: { icon: '🌐', label: 'HTML File',           color: '#D97706' },
    };
    return map[type] || { icon: '📁', label: 'Documento', color: '#4B5563' };
}

// ─── Add message to DOM ──────────────────────────────────────────────────────
function addMessage(role, content, { docgen = null, reasoning = null } = {}) {
    // Remove welcome screen on first message
    if (welcomeScreen && state.msgCount === 0) {
        welcomeScreen.style.opacity = '0';
        welcomeScreen.style.transform = 'translateY(-10px)';
        setTimeout(() => welcomeScreen.remove(), 300);
    }
    state.msgCount++;

    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? 'Tú' : 'Z';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (role === 'user') {
        bubble.textContent = content;
    } else {
        bubble.innerHTML = parseMarkdown(content);

        // Reasoning block
        if (reasoning) {
            const rb = document.createElement('div');
            rb.className = 'reasoning-block';
            rb.innerHTML = `<strong>Razonamiento:</strong> ${parseMarkdown(reasoning)}`;
            rb.addEventListener('click', () => rb.classList.toggle('expanded'));
            bubble.appendChild(rb);
        }

        // Document card
        if (docgen) {
            const meta = docMeta(docgen.type);
            const card = document.createElement('div');
            card.className = 'doc-card';
            card.innerHTML = `
                <div class="doc-card-header">
                    <div class="doc-card-icon" style="background:${meta.color}22">${meta.icon}</div>
                    <div class="doc-card-info">
                        <div class="doc-card-title">${escHtml(docgen.title || docgen.filename || 'Documento')}</div>
                        <div class="doc-card-meta">${meta.label} · ${docgen.filename || 'archivo'}.${docgen.type}</div>
                    </div>
                    <button class="btn-download ${docgen.type}" id="dl_${state.msgCount}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Descargar
                    </button>
                </div>
                ${docgen.description ? `<div class="doc-card-desc">${escHtml(docgen.description)}</div>` : ''}
            `;

            // Download button logic
            const dlBtn = card.querySelector(`#dl_${state.msgCount}`);
            dlBtn.addEventListener('click', () => downloadDocument(docgen, dlBtn));
            bubble.appendChild(card);
        }
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();

    return bubble;
}

// ─── Typing indicator ────────────────────────────────────────────────────────
function addTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'msg-row ai';
    row.id = 'typing';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = 'Z';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();
}

function removeTypingIndicator() {
    const el = $('typing');
    if (el) el.remove();
}

// ─── Scroll ──────────────────────────────────────────────────────────────────
function scrollToBottom() {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
}

// ─── Escape HTML ─────────────────────────────────────────────────────────────
function escHtml(s) {
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

// ─── Send message ────────────────────────────────────────────────────────────
async function sendMessage(text) {
    if (!text.trim() || state.isLoading) return;

    const message = text.trim();
    inputField.value = '';
    autoResize();

    state.isLoading = true;
    btnSend.disabled = true;
    setStatus('loading');

    // Update session label with first message
    if (state.msgCount === 0) {
        sessionLabel.textContent = message.length > 40
            ? message.slice(0, 40) + '…'
            : message;
    }

    addMessage('user', message);
    addTypingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                message,
                model:     state.model,
                sessionId: state.sessionId
            })
        });

        const data = await res.json();
        removeTypingIndicator();

        if (!res.ok || !data.status) {
            addMessage('ai', `⚠️ Error: ${data.error || 'Algo salió mal. Intenta de nuevo.'}`);
            setStatus('error');
            setTimeout(() => setStatus(''), 3000);
        } else {
            addMessage('ai', data.content, {
                docgen:    data.docgen    || null,
                reasoning: data.reasoning || null
            });
            setStatus('');
        }

    } catch (err) {
        removeTypingIndicator();
        addMessage('ai', `⚠️ No se pudo conectar al servidor. Verifica tu conexión.`);
        setStatus('error');
        setTimeout(() => setStatus(''), 3000);
    } finally {
        state.isLoading = false;
        btnSend.disabled = false;
        inputField.focus();
    }
}

// ─── Download document ───────────────────────────────────────────────────────
async function downloadDocument(docgen, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Generando...</span>';

    try {
        const res = await fetch('/api/generate', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                type:     docgen.type,
                filename: docgen.filename,
                title:    docgen.title,
                content:  docgen.content
            })
        });

        const data = await res.json();

        if (!res.ok || !data.status) {
            throw new Error(data.error || 'Error al generar el documento');
        }

        // Decode base64 and trigger download
        const bytes  = atob(data.base64);
        const arr    = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob   = new Blob([arr], { type: data.mime });
        const url    = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href  = url;
        anchor.download = data.filename;
        anchor.click();
        URL.revokeObjectURL(url);

        showToast(`✅ ${data.filename} descargado`, 'success');

        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Descargado
        `;
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Descargar
            `;
        }, 4000);

    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Reintentar
        `;
    }
}

// ─── Auto-resize textarea ────────────────────────────────────────────────────
function autoResize() {
    inputField.style.height = 'auto';
    inputField.style.height = Math.min(inputField.scrollHeight, 160) + 'px';
}

// ─── New chat ────────────────────────────────────────────────────────────────
function newChat() {
    state.sessionId = generateSessionId();
    state.msgCount  = 0;
    state.isLoading = false;
    btnSend.disabled = false;
    setStatus('');
    sessionLabel.textContent = 'Nueva conversación';

    // Clear messages and re-add welcome
    messagesEl.innerHTML = `
        <div class="welcome" id="welcomeScreen">
            <div class="welcome-icon">
                <div class="welcome-z">Z</div>
            </div>
            <h1 class="welcome-title">Hola, soy Z.ai</h1>
            <p class="welcome-sub">Chatea conmigo y pídeme que genere documentos profesionales.<br>Word, Excel, PowerPoint, CSV y más — listos para descargar.</p>
            <div class="welcome-chips">
                <button class="chip" data-prompt="¿Qué tipos de documentos puedes generar?">¿Qué puedes crear?</button>
                <button class="chip" data-prompt="Genera un informe de ventas en Word con tabla de datos">📊 Informe en Word</button>
                <button class="chip" data-prompt="Crea una hoja de cálculo Excel con presupuesto mensual">💰 Excel de presupuesto</button>
                <button class="chip" data-prompt="Hazme una presentación de 5 slides sobre marketing digital en PowerPoint">🎯 Presentación PPT</button>
            </div>
        </div>
    `;

    // Re-bind chips
    bindChips();
    inputField.focus();
}

// ─── Bind chips & examples ───────────────────────────────────────────────────
function bindChips() {
    document.querySelectorAll('.chip, .example-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            if (prompt) sendMessage(prompt);
        });
    });
}

// ─── Sidebar toggle ──────────────────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = $('sidebar');
    const isMobile = window.innerWidth <= 700;
    if (isMobile) {
        sidebar.classList.toggle('open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

// ─── Event listeners ─────────────────────────────────────────────────────────
inputField.addEventListener('input', autoResize);

inputField.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputField.value);
    }
});

btnSend.addEventListener('click', () => sendMessage(inputField.value));

modelSelect.addEventListener('change', () => {
    state.model = modelSelect.value;
    showToast(`Modelo: ${modelSelect.options[modelSelect.selectedIndex].text}`);
});

$('newChat').addEventListener('click', newChat);
$('toggleSidebar').addEventListener('click', toggleSidebar);
$('openSidebar').addEventListener('click', toggleSidebar);

// Close sidebar on mobile when clicking outside
document.addEventListener('click', e => {
    if (window.innerWidth <= 700) {
        const sidebar = $('sidebar');
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !$('openSidebar').contains(e.target)) {
            sidebar.classList.remove('open');
        }
    }
});

// ─── Init ────────────────────────────────────────────────────────────────────
bindChips();
inputField.focus();
