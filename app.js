// ─── Config ───────────────────────────────────────────────────────────────────
const WORKER_BASE_URL = 'https://mockql.YOUR-SUBDOMAIN.workers.dev/mock';

// ─── Example JSON ─────────────────────────────────────────────────────────────
const EXAMPLE = {
    data: {
        users: [
            {
                id: 'usr_001',
                name: 'Alice Rahman',
                email: 'alice@example.com',
                role: 'ADMIN',
                active: true,
            },
            {
                id: 'usr_002',
                name: 'Tariq Hasan',
                email: 'tariq@example.com',
                role: 'MEMBER',
                active: true,
            },
        ],
        _meta: { total: 2, page: 1, hasNextPage: false },
    },
};

// ─── State ────────────────────────────────────────────────────────────────────
let currentMode = 'create'; // 'create' | 'edit'
let editingBinId = null; // set when a bin is loaded for editing

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const editor = document.getElementById('jsonEditor');
const validationBar = document.getElementById('validationBar');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// ─── Live validation (debounced) ──────────────────────────────────────────────
let debounceTimer;

editor.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(validateJson, 400);
});

// Tab key → 2 spaces
editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const s = editor.selectionStart;
        editor.value =
            editor.value.substring(0, s) +
            '  ' +
            editor.value.substring(editor.selectionEnd);
        editor.selectionStart = editor.selectionEnd = s + 2;
    }
});

// ─── Mode switching ───────────────────────────────────────────────────────────
function switchMode(mode) {
    currentMode = mode;
    editingBinId = null;

    const isEdit = mode === 'edit';

    document.getElementById('tabCreate').classList.toggle('active', !isEdit);
    document.getElementById('tabEdit').classList.toggle('active', isEdit);
    document.getElementById('editRow').classList.toggle('show', isEdit);
    document.getElementById('labelField').classList.toggle('hide', isEdit);
    document.getElementById('generateBtn').textContent = isEdit
        ? 'Update Mock Endpoint'
        : 'Generate Mock Endpoint';

    // Reset editor and result on mode switch
    clearEditor();
    document.getElementById('binIdInput').value = '';

    if (isEdit) {
        setStatus('idle', '○', 'Load an existing endpoint to start editing...');
    }
}

// ─── Extract mock ID from URL or raw ID ──────────────────────────────────────
function extractBinId(input) {
    const trimmed = input.trim();
    // If it looks like a URL, grab the last path segment
    if (trimmed.startsWith('http')) {
        const parts = trimmed.split('/').filter(Boolean);
        return parts[parts.length - 1];
    }
    return trimmed;
}

// ─── Load existing bin ────────────────────────────────────────────────────────
async function loadExistingBin() {
    const raw = document.getElementById('binIdInput').value.trim();
    if (!raw) {
        alert('Please enter an endpoint URL or mock ID.');
        return;
    }

    const binId = extractBinId(raw);
    const btn = document.getElementById('loadBtn');
    const btnTxt = document.getElementById('loadBtnText');

    btn.disabled = true;
    btnTxt.innerHTML = '<span class="spinner dark"></span>';

    try {
        const res = await fetch(`${WORKER_BASE_URL}/${binId}`);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Worker error: ${res.status}`);
        }

        const record = await res.json();

        // Load into editor
        editor.value = JSON.stringify(record, null, 2);
        editingBinId = binId;

        validateJson();

        // Show the endpoint URL in the result panel as a reference
        const endpointUrl = `${WORKER_BASE_URL}/${binId}`;
        document.getElementById('endpointUrl').value = endpointUrl;
        document.getElementById('resultMeta').textContent =
            `mock: ${binId} · loaded for editing`;
        document.getElementById('resultHeaderText').textContent =
            'Endpoint loaded — edit and update below';
        document.getElementById('usageSnippet').innerHTML =
            buildSnippet(endpointUrl);
        document.getElementById('step3').classList.add('active');

        const panel = document.getElementById('resultPanel');
        panel.classList.add('show');
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        alert(`Failed to load bin:\n\n${err.message}`);
    } finally {
        btn.disabled = false;
        btnTxt.textContent = 'Load';
    }
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function setStatus(type, icon, msgs) {
    validationBar.className = 'validation ' + type;

    const list = Array.isArray(msgs) ? msgs : [msgs];
    validationBar.innerHTML =
        `<span class="val-icon">${icon}</span>` +
        `<div class="val-msgs">${list.map((m) => `<span class="val-msg">${m}</span>`).join('')}</div>`;

    const dotClass =
        { valid: ' ok', invalid: ' err', warning: ' warn' }[type] || '';
    statusDot.className = 'dot' + dotClass;

    const textMap = {
        valid: 'valid graphql response',
        invalid: 'invalid json',
        warning: 'valid json — check structure',
    };
    statusText.textContent = textMap[type] || 'mock response json';
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateJson() {
    const raw = editor.value.trim();
    if (!raw) {
        setStatus('idle', '○', 'Waiting for input...');
        return null;
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        const msg = e.message
            .replace('JSON.parse: ', '')
            .replace('JSON Parse error: ', '');
        setStatus('invalid', '✕', [`JSON syntax error: ${msg}`]);
        return null;
    }

    const issues = [];
    const warnings = [];

    if (
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        parsed === null
    ) {
        issues.push('Root must be a JSON object {}');
    }

    if (!issues.length) {
        const hasData = 'data' in parsed;
        const hasErrors = 'errors' in parsed;

        if (!hasData && !hasErrors) {
            warnings.push(
                'No "data" or "errors" key — a valid GraphQL response needs at least one',
            );
        }

        if (hasErrors) {
            if (!Array.isArray(parsed.errors)) {
                issues.push('"errors" must be an array');
            } else if (
                parsed.errors.some((e) => typeof e !== 'object' || !e.message)
            ) {
                warnings.push(
                    'Each error object should have a "message" field',
                );
            }
        }

        if (
            hasData &&
            parsed.data !== null &&
            typeof parsed.data !== 'object'
        ) {
            issues.push('"data" must be an object or null');
        }
    }

    if (issues.length) {
        setStatus('invalid', '✕', issues);
        return null;
    }
    if (warnings.length) {
        setStatus('warning', '△', warnings);
        return parsed;
    }

    const keys = Object.keys(parsed.data || {}).join(', ') || '(empty)';
    setStatus('valid', '✓', [`Valid GraphQL response — data keys: ${keys}`]);
    return parsed;
}

// ─── Editor toolbar ───────────────────────────────────────────────────────────
function formatJson() {
    try {
        const parsed = JSON.parse(editor.value);
        editor.value = JSON.stringify(parsed, null, 2);
        validateJson();
    } catch (_) {}
}

function loadExample() {
    editor.value = JSON.stringify(EXAMPLE, null, 2);
    validateJson();
}

function clearEditor() {
    editor.value = '';
    editingBinId = null;
    setStatus('idle', '○', 'Waiting for input...');
    document.getElementById('resultPanel').classList.remove('show');
}

// ─── Main action — create or update ──────────────────────────────────────────
function handleMainAction() {
    if (currentMode === 'edit') {
        updateEndpoint();
    } else {
        generateEndpoint();
    }
}

// ─── Create new endpoint ──────────────────────────────────────────────────────
async function generateEndpoint() {
    const parsed = validateJson();
    if (!parsed) {
        shakeValidation();
        return;
    }

    const label =
        document.getElementById('endpointLabel').value.trim() ||
        'mock-endpoint';
    const btn = document.getElementById('generateBtn');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving to Worker...';

    try {
        const res = await fetch(WORKER_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(parsed),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Worker error: ${res.status}`);
        }

        const data = await res.json();
        const binId = data.id;
        const endpointUrl = data.url || `${WORKER_BASE_URL}/${binId}`;

        showResult(endpointUrl, binId, label, 'created');
    } catch (err) {
        alert(`Failed to create endpoint:\n\n${err.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Mock Endpoint';
    }
}

// ─── Update existing endpoint ─────────────────────────────────────────────────
async function updateEndpoint() {
    const parsed = validateJson();
    if (!parsed) {
        shakeValidation();
        return;
    }

    if (!editingBinId) {
        alert(
            'No mock loaded. Use the "Load" button to fetch an existing endpoint first.',
        );
        return;
    }

    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Updating...';

    try {
        const res = await fetch(`${WORKER_BASE_URL}/${editingBinId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(parsed),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Worker error: ${res.status}`);
        }

        const endpointUrl = `${WORKER_BASE_URL}/${editingBinId}`;
        showResult(endpointUrl, editingBinId, 'updated', 'updated');
    } catch (err) {
        alert(`Failed to update endpoint:\n\n${err.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Update Mock Endpoint';
    }
}

// ─── Display result ───────────────────────────────────────────────────────────
function showResult(url, binId, label, action) {
    document.getElementById('step3').classList.add('active');
    document.getElementById('endpointUrl').value = url;
    document.getElementById('resultMeta').textContent =
        `mock: ${binId} · ${label}`;
    document.getElementById('usageSnippet').innerHTML = buildSnippet(url);
    document.getElementById('resultHeaderText').textContent =
        action === 'updated'
            ? 'Endpoint updated successfully'
            : 'Endpoint created successfully';

    const panel = document.getElementById('resultPanel');
    panel.classList.add('show');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildSnippet(url) {
    return (
        `<span class="kw">const</span> <span class="prop">response</span> = <span class="kw">await</span> fetch(<span class="str">"${url}"</span>, {\n` +
        `  method: <span class="str">"POST"</span>,\n` +
        `  headers: {\n` +
        `    <span class="str">"Content-Type"</span>: <span class="str">"application/json"</span>,\n` +
        `  },\n` +
        `  body: JSON.stringify({\n` +
        `    query: <span class="str">\`{ yourQuery { field } }\`</span>,\n` +
        `  }),\n` +
        `});\n\n` +
        `<span class="kw">const</span> <span class="prop">data</span> = <span class="kw">await</span> response.json();\n` +
        `console.log(data); <span class="val">// → your mock response</span>`
    );
}

// ─── Copy endpoint URL ────────────────────────────────────────────────────────
function copyEndpoint() {
    const url = document.getElementById('endpointUrl').value;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = 'COPIED!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = 'COPY';
            btn.classList.remove('copied');
        }, 2000);
    });
}

// ─── Shake helper ─────────────────────────────────────────────────────────────
function shakeValidation() {
    validationBar.style.animation = 'none';
    validationBar.offsetHeight;
    validationBar.style.animation = 'shake 0.3s ease';
}
