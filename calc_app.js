if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('calc_service-worker.js')
        .catch(err => console.log('SW no registrado:', err));
}

const DB_NAME = 'CalculatorDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

let db;
let display = document.getElementById('display');
let secondaryDisplay = document.getElementById('secondaryDisplay');
let currentInput = '';
let previousValue = '';
let operation = null;
let isDegrees = true;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('Error abriendo BD');
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
        request.onupgradeneeded = (e) => {
            const objectStore = e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('fecha', 'fecha', { unique: false });
        };
    });
};

const saveToHistory = async (expression, result) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.add({ expression, result, fecha: new Date().toLocaleString('es-ES') });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject('Error guardando');
    });
};

const getHistory = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject('Error leyendo historial');
    });
};

const clearHistoryDB = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject('Error limpiando');
    });
};

function updateDisplay() {
    display.value = currentInput || '0';
    secondaryDisplay.textContent = (operation && previousValue) ? `${previousValue} ${operation}` : '';
}

function appendNumber(num) {
    if (num === '.' && currentInput.includes('.')) return;
    currentInput += num;
    updateDisplay();
}

function appendOperator(op) {
    if (currentInput === '') return;
    if (previousValue !== '') calculate();
    previousValue = currentInput;
    operation = op;
    currentInput = '';
    updateDisplay();
}

function appendFunction(func) {
    let value = parseFloat(currentInput) || 0;
    let result = 0;
    switch(func) {
        case 'sin': result = isDegrees ? Math.sin(value * Math.PI / 180) : Math.sin(value); break;
        case 'cos': result = isDegrees ? Math.cos(value * Math.PI / 180) : Math.cos(value); break;
        case 'tan': result = isDegrees ? Math.tan(value * Math.PI / 180) : Math.tan(value); break;
        case 'sqrt': result = Math.sqrt(value); break;
        case 'log': result = Math.log10(value); break;
        case 'ln': result = Math.log(value); break;
        case 'pow': currentInput = value + '^'; updateDisplay(); return;
    }
    currentInput = result;
    updateDisplay();
}

function usePi() {
    currentInput = ((parseFloat(currentInput) || 0) + Math.PI).toFixed(6);
    updateDisplay();
}

function toggleRadDeg(e) {
    isDegrees = !isDegrees;
    const btn = e.target;
    btn.textContent = isDegrees ? 'RAD/DEG' : 'DEG/RAD';
}

function toggleSign() {
    currentInput = String(parseFloat(currentInput) * -1);
    updateDisplay();
}

function deleteLast() {
    currentInput = currentInput.slice(0, -1);
    updateDisplay();
}

function clearDisplay() {
    currentInput = '';
    previousValue = '';
    operation = null;
    updateDisplay();
}

async function calculate() {
    if (operation === null || previousValue === '' || currentInput === '') return;
    let result = 0;
    const prev = parseFloat(previousValue);
    const current = parseFloat(currentInput);

    if (operation === '^') {
        result = Math.pow(prev, current);
    } else {
        switch(operation) {
            case '+': result = prev + current; break;
            case '-': result = prev - current; break;
            case '*': result = prev * current; break;
            case '/':
                if (current === 0) { alert('No se puede dividir entre 0'); clearDisplay(); return; }
                result = prev / current;
                break;
            case '%': result = prev % current; break;
        }
    }

    const expression = `${previousValue} ${operation} ${currentInput}`;
    await saveToHistory(expression, result);

    currentInput = String(result);
    previousValue = '';
    operation = null;

    if (currentInput.includes('.')) {
        currentInput = parseFloat(currentInput).toFixed(8).replace(/\.?0+$/, '');
    }

    updateDisplay();
    renderHistory();
}

async function renderHistory() {
    const historyList = document.getElementById('historyList');
    const items = await getHistory();
    if (items.length === 0) {
        historyList.innerHTML = '<div class="empty-state">Sin historial aún</div>';
        return;
    }
    historyList.innerHTML = items.reverse().map(item => `
        <div class="history-item" onclick="useHistoryResult('${item.result}')">
            <span class="history-calc">${item.expression}</span>
            <span class="history-result">${item.result}</span>
        </div>
    `).join('');
}

function useHistoryResult(result) {
    currentInput = String(result);
    updateDisplay();
}

document.getElementById('shareHistoryBtn').addEventListener('click', async () => {
    const items = await getHistory();
    if (items.length === 0) { alert('No hay historial para compartir'); return; }
    let text = '📱 Mi Historial de Cálculos\n\n';
    items.forEach(item => { text += `${item.expression} = ${item.result}\n`; });
    if (navigator.share) {
        navigator.share({ title: 'Historial de Calculadora', text });
    } else {
        navigator.clipboard.writeText(text).then(() => alert('Historial copiado al portapapeles ✓'));
    }
});

document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    if (confirm('¿Eliminar todo el historial?')) {
        await clearHistoryDB();
        renderHistory();
    }
});

document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const btn = document.getElementById('themeToggle');
    btn.textContent = document.body.classList.contains('light-mode') ? '☀️' : '🌙';
    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.buttons-section').forEach(s => s.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(`${tab}-tab`).classList.remove('hidden');
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') appendNumber(e.key);
    if (e.key === '.') appendNumber('.');
    if (e.key === '+') appendOperator('+');
    if (e.key === '-') appendOperator('-');
    if (e.key === '*') appendOperator('*');
    if (e.key === '/') { e.preventDefault(); appendOperator('/'); }
    if (e.key === 'Enter') { e.preventDefault(); calculate(); }
    if (e.key === 'Backspace') deleteLast();
    if (e.key === 'Escape') clearDisplay();
});

window.addEventListener('online', () => {
    document.getElementById('status').textContent = '●';
    document.getElementById('status').className = 'status online';
});

window.addEventListener('offline', () => {
    document.getElementById('status').textContent = '●';
    document.getElementById('status').className = 'status offline';
});

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    updateDisplay();
    renderHistory();
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('themeToggle').textContent = '☀️';
    }
});
