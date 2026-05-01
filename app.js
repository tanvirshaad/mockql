// ─── Config ───────────────────────────────────────────────────────────────────
// Replace with your deployed Cloudflare Worker URL after running: wrangler deploy
const WORKER_BASE_URL = 'https://mockql.tanvirshaad.workers.dev';
const JSONBIN_API = 'https://api.jsonbin.io/v3/b';

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
                name: 'tanvir shaad',
                email: 'tanvir@example.com',
                role: 'MEMBER',
                active: true,
            },
        ],
        _meta: { total: 2, page: 1, hasNextPage: false },
    },
};

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

    // 1. JSON parse
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

    // 2. Root must be an object
    if (
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        parsed === null
    ) {
        issues.push('Root must be a JSON object {}');
    }

    // 3. GraphQL shape checks
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

// ─── Editor actions ───────────────────────────────────────────────────────────
function formatJson() {
    try {
        const parsed = JSON.parse(editor.value);
        editor.value = JSON.stringify(parsed, null, 2);
        validateJson();
    } catch (_) {
        /* already invalid, nothing to format */
    }
}

function loadExample() {
    editor.value = JSON.stringify(EXAMPLE, null, 2);
    validateJson();
}

function clearEditor() {
    editor.value = '';
    setStatus('idle', '○', 'Waiting for input...');
    document.getElementById('resultPanel').classList.remove('show');
}

// ─── Generate endpoint ────────────────────────────────────────────────────────
async function generateEndpoint() {
    const parsed = validateJson();

    if (!parsed) {
        // Shake the validation bar to draw attention
        validationBar.style.animation = 'none';
        validationBar.offsetHeight; // force reflow
        validationBar.style.animation = 'shake 0.3s ease';
        return;
    }

    const apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey) {
        alert(
            'Please enter your JSONBin.io API key.\n\nGet a free key at: https://jsonbin.io',
        );
        return;
    }

    const label =
        document.getElementById('endpointLabel').value.trim() ||
        'mock-endpoint';
    const btn = document.getElementById('generateBtn');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving to JSONBin...';

    try {
        const res = await fetch(JSONBIN_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': apiKey,
                'X-Bin-Name': label,
                'X-Bin-Private': 'false',
            },
            body: JSON.stringify(parsed),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `JSONBin error: ${res.status}`);
        }

        const data = await res.json();
        const binId = data.metadata.id;
        const endpointUrl = `${WORKER_BASE_URL}/graphql/${binId}`;

        showResult(endpointUrl, binId, label);
    } catch (err) {
        alert(`Failed to create endpoint:\n\n${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Generate Mock Endpoint';
    }
}

// ─── Display result ───────────────────────────────────────────────────────────
function showResult(url, binId, label) {
    document.getElementById('step3').classList.add('active');
    document.getElementById('endpointUrl').value = url;
    document.getElementById('resultMeta').textContent =
        `bin: ${binId} · label: ${label}`;
    document.getElementById('usageSnippet').innerHTML = buildSnippet(url);

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
