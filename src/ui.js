import * as signalR from "@microsoft/signalr";
import { appendEvent, getLastOffset, setLastOffset } from './eventStore';
import { projectorLoop } from './projector';

// DOM Elements
const form = document.getElementById('connectionForm');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusText = document.getElementById('statusText');
const messageLog = document.getElementById('messageLog');
const clearLogBtn = document.getElementById('clearLogBtn');
const statusIndicator = document.getElementById('statusIndicator');
const searchInput = document.getElementById('searchInput');

// Theme Elements
const themeToggleBtn = document.getElementById('themeToggleBtn');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

// Projector DOM Elements
const projectorLog = document.getElementById('projectorLog');
const clearProjectorLogBtn = document.getElementById('clearProjectorLogBtn');

// State
let connection = null;
let allMessages = []; // Store all messages here
let maxStoredMessages = 10000; // Keep up to 10k messages in memory
let maxRenderedMessages = 100; // Only render top 100 matches to keep DOM light
let searchTerm = "";

// Projector State
let projectorStarted = false;

// Theme Logic
function initTheme() {
    // Check local storage or system preference
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

themeToggleBtn.addEventListener('click', () => {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }
});

// Initialize theme on load
initTheme();

// Default URLs
const defaultUrls = [
    "https://client-console-feed-proxy-test.bsrv.dev",
    "https://client-console-feed-proxy-stage.bsrv.dev",
    "http://localhost:5110",
    "https://console-feed.beter.tech"
];

// Load from env
const envUrls = import.meta.env.VITE_FEED_URLS ? import.meta.env.VITE_FEED_URLS.split(',') : [];
const allUrls = [...new Set([...defaultUrls, ...envUrls])]; // Unique

// Populate Datalist
const feedUrlList = document.getElementById('feedUrlList');
allUrls.forEach(url => {
    const option = document.createElement('option');
    option.value = url;
    feedUrlList.appendChild(option);
});

// Helper to update status UI
function updateStatus(status, colorClass) {
    statusText.textContent = status;
    // Map text colors for light mode if needed, or rely on tailwind classes
    // Here we assume colorClass is like 'text-green-400' which is fine in dark, but maybe too light in light mode.
    // Let's adjust dynamically or use specific classes.
    // Simple fix: use standard colors that work or specific dark/light variants if passed.
    // For now, let's keep it simple but maybe map 'text-green-400' to 'text-green-600 dark:text-green-400'

    let finalClass = colorClass;
    if (colorClass.includes('green')) finalClass = 'text-green-600 dark:text-green-400';
    if (colorClass.includes('yellow')) finalClass = 'text-yellow-600 dark:text-yellow-400';
    if (colorClass.includes('red')) finalClass = 'text-red-600 dark:text-red-400';
    if (colorClass.includes('gray')) finalClass = 'text-gray-500 dark:text-gray-400';

    statusText.className = `text-sm font-bold ${finalClass}`;

    // Update indicator border/bg to match
    // border-l-4
    let borderClass = finalClass.replace('text-', 'border-').replace('600', '500').replace('400', '500');
    // Remove dark: part for border logic if simple replacement
    // Actually, let's just hardcode based on status for simplicity

    statusIndicator.className = `mt-6 p-3 rounded flex items-center justify-between border-l-4 ${borderClass.split(' ')[0]} bg-gray-100 dark:bg-gray-700 transition-colors duration-200`;
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Render Logs
function renderLogs() {
    messageLog.innerHTML = '';

    if (allMessages.length === 0) {
        messageLog.innerHTML = '<div class="text-gray-500 italic">Waiting for messages...</div>';
        return;
    }

    const filtered = searchTerm
        ? allMessages.filter(msg => JSON.stringify(msg).toLowerCase().includes(searchTerm))
        : allMessages;

    const toRender = filtered.slice(-maxRenderedMessages); // Get last N messages

    if (toRender.length === 0 && searchTerm) {
        messageLog.innerHTML = '<div class="text-gray-500 italic">No matches found.</div>';
        return;
    }

    toRender.forEach(item => {
        const div = document.createElement('div');

        if (item.type === 'DATA') {
            div.className = "border-l-2 border-blue-500 pl-2 py-1 my-1 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm dark:shadow-none";
            div.innerHTML = `
                <div class="text-xs text-gray-500 mb-1">${item.timestamp}</div>
                <pre class="overflow-x-auto text-blue-700 dark:text-blue-300 whitespace-pre-wrap break-words text-xs">${item.content}</pre>
            `;
        } else {
            // System logs
            let colorClass = 'text-gray-700 dark:text-gray-300';
            if (item.type === 'ERROR') colorClass = 'text-red-600 dark:text-red-400';
            if (item.type === 'SUCCESS') colorClass = 'text-green-600 dark:text-green-400';
            if (item.type === 'INFO') colorClass = 'text-blue-600 dark:text-blue-400';
            if (item.type === 'WARN') colorClass = 'text-yellow-600 dark:text-yellow-400';

            div.innerHTML = `<span class="text-gray-500 dark:text-gray-600">[${item.timestamp}]</span> <span class="${colorClass} font-bold">${item.type}:</span> <span class="text-gray-600 dark:text-gray-300">${item.content}</span>`;
        }

        messageLog.appendChild(div);
    });

    messageLog.scrollTop = messageLog.scrollHeight;
}

// Add to log history
function addToHistory(type, content, isData = false) {
    const timestamp = new Date().toLocaleTimeString();
    const item = {
        type,
        content: isData ? JSON.stringify(content, null, 2) : content,
        timestamp,
        raw: content // Keep raw for potential future use
    };

    allMessages.push(item);

    // Prune history
    if (allMessages.length > maxStoredMessages) {
        allMessages.shift();
    }

    if (!searchTerm) {
        renderLogs();
    } else {
        // If search is active, only re-render if it matches
        if (JSON.stringify(item).toLowerCase().includes(searchTerm)) {
            renderLogs();
        }
    }
}

// Projector Logger
function logToProjector(type, message) {
    const div = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();

    let colorClass = 'text-gray-700 dark:text-gray-300';
    if (type === 'ERROR') colorClass = 'text-red-600 dark:text-red-400';
    if (type === 'INFO') colorClass = 'text-blue-600 dark:text-blue-400';

    div.innerHTML = `<span class="text-gray-500 dark:text-gray-600">[${timestamp}]</span> <span class="${colorClass} font-bold">${type}:</span> <span class="text-gray-600 dark:text-gray-300">${message}</span>`;
    div.className = "py-1 border-b border-gray-200 dark:border-gray-800";

    projectorLog.appendChild(div);
    projectorLog.scrollTop = projectorLog.scrollHeight;

    // Simple pruning for projector log
    if (projectorLog.children.length > 100) {
        projectorLog.removeChild(projectorLog.firstChild);
    }
}

// Search Handler
searchInput.addEventListener('input', debounce((e) => {
    searchTerm = e.target.value.toLowerCase();
    renderLogs();
}, 300));

// Connect Handler
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const feedUrl = document.getElementById('feedUrl').value;
    const apiKey = document.getElementById('apiKey').value;
    const hubName = document.getElementById('hubName').value;
    const batchSizeInput = document.getElementById('batchSize').value;
    const skipNegotiation = document.getElementById('skipNegotiation').checked;

    // Update limits
    const userBatchSize = parseInt(batchSizeInput);
    if (userBatchSize && userBatchSize > 0) {
        maxRenderedMessages = userBatchSize;
    }

    if (!feedUrl || !apiKey) {
        addToHistory('ERROR', 'Feed URL and API Key are required.');
        return;
    }

    // Start Projector Loop if not started
    if (!projectorStarted) {
        projectorStarted = true;
        projectorLoop(logToProjector).catch(err => {
            console.error("Projector loop failed", err);
            addToHistory('ERROR', `Projector loop failed: ${err.message}`);
        });
        logToProjector('INFO', 'Projector loop started.');
    }

    // Disable form
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    try {
        const baseUrl = feedUrl.replace(/\/$/, '');
        const fullUrl = `${baseUrl}/${hubName}`;
        const urlWithAuth = `${fullUrl}?apiKey=${encodeURIComponent(apiKey)}`;

        addToHistory('INFO', `Connecting to: ${urlWithAuth} (SkipNegotiation: ${skipNegotiation})`);

        const connectionBuilder = new signalR.HubConnectionBuilder()
            .withUrl(urlWithAuth, {
                skipNegotiation: skipNegotiation,
                transport: skipNegotiation ? signalR.HttpTransportType.WebSockets : undefined
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information);

        connection = connectionBuilder.build();

        // Setup handlers
        connection.on('OnUpdate', async (msgs) => {
            if (Array.isArray(msgs)) {
                addToHistory('INFO', `Received batch of ${msgs.length} messages`);

                // Process batch for Event Store
                for (const msg of msgs) {
                    try {
                        const matchId = msg.matchId || msg.id;
                        const offset = msg.offset;

                        if (!matchId || typeof offset !== 'number') {
                            addToHistory('WARN', 'Skipping message without matchId/offset');
                            continue;
                        }

                        const lastOffset = await getLastOffset(matchId);

                        // Deduplication
                        if (lastOffset !== null && offset <= lastOffset) {
                            // Duplicate/Old event
                            continue;
                        }

                        // Append to Store
                        await appendEvent({
                            matchId,
                            offset,
                            payload: msg
                        });

                        // Update Offset
                        await setLastOffset(matchId, offset);

                        // Log to Main Log
                        addToHistory('DATA', msg, true);

                    } catch (err) {
                        console.error(err);
                        addToHistory('ERROR', `Error processing message: ${err.message}`);
                    }
                }

            } else {
                addToHistory('WARN', 'Received non-array OnUpdate');
                console.log(msgs);
            }
        });

        connection.on('onsystemevent', (data) => {
            addToHistory('INFO', `Received system event`);
            addToHistory('DATA', data, true);
        });

        connection.on('OnSubscriptionsRemove', (data) => {
            addToHistory('INFO', `Received OnSubscriptionsRemove event`);
            addToHistory('DATA', data, true);
        });

        connection.on('onheartbeat', (data) => {
            addToHistory('INFO', `Heartbeat ${data}`);
        });

        connection.onclose(error => {
            updateStatus('Disconnected', 'text-gray-400');
            connectBtn.classList.remove('hidden');
            disconnectBtn.classList.add('hidden');
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect';

            if (error) {
                addToHistory('ERROR', `Connection closed: ${error.message}`);
            } else {
                addToHistory('INFO', 'Connection closed normally.');
            }
        });

        connection.onreconnecting(error => {
            updateStatus('Reconnecting...', 'text-yellow-400');
            addToHistory('WARN', `Reconnecting: ${error ? error.message : 'unknown reason'}`);
        });

        connection.onreconnected(connectionId => {
            updateStatus('Connected', 'text-green-400');
            addToHistory('SUCCESS', `Reconnected. ID: ${connectionId}`);
        });

        // Start
        await connection.start();

        updateStatus('Connected', 'text-green-400');
        addToHistory('SUCCESS', `Connected to ${feedUrl}`);

        // Toggle buttons
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        addToHistory('ERROR', `Failed to connect: ${err.message}`);
        updateStatus('Error', 'text-red-400');
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
    }
});

// Disconnect Handler
disconnectBtn.addEventListener('click', async () => {
    if (connection) {
        await connection.stop();
        connection = null;
    }
});

// Clear Log
clearLogBtn.addEventListener('click', () => {
    allMessages = [];
    renderLogs();
});

// Clear Projector Log
clearProjectorLogBtn.addEventListener('click', () => {
    projectorLog.innerHTML = '<div class="text-gray-500 italic">Waiting for processed events...</div>';
});
