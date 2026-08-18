// API Base URL
const API_BASE_URL = window.location.origin.includes('http') ? window.location.origin : 'http://localhost:5000';

// App State
let currentSessionId = localStorage.getItem('guidebot_session_id') || '';
let sessions = {}; // key: session_id, value: array of messages

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const newChatBtn = document.getElementById('newChatBtn');
const mobileNewChatBtn = document.getElementById('mobileNewChatBtn');
const sessionsList = document.getElementById('sessionsList');
const connectionStatus = document.getElementById('connectionStatus');
const currentSessionLabel = document.getElementById('currentSessionLabel');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const chatMessages = document.getElementById('chatMessages');
const welcomeContainer = document.getElementById('welcomeContainer');
const typingIndicator = document.getElementById('typingIndicator');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

// Initialize Lucide Icons
function initIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Initialize Application
async function init() {
    initIcons();
    setupEventListeners();
    
    // Load saved API key
    if (apiKeyInput) {
        apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
    }

    // Check if session exists, otherwise start a new one
    if (!currentSessionId) {
        startNewSession();
    } else {
        currentSessionLabel.textContent = `Session: ${currentSessionId.substring(0, 8)}...`;
    }

    // Check connection and load history
    await checkBackendConnection();
    await loadHistory();
}

// Setup Event Listeners
function setupEventListeners() {
    // Save API Key Event
    if (saveApiKeyBtn && apiKeyInput) {
        saveApiKeyBtn.addEventListener('click', function() {
            const keyVal = apiKeyInput.value.trim();
            localStorage.setItem('gemini_api_key', keyVal);
            
            // Temporary button animation to show success
            const icon = saveApiKeyBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'check');
                initIcons();
                saveApiKeyBtn.style.background = '#2ecc71';
                saveApiKeyBtn.style.borderColor = '#2ecc71';
                saveApiKeyBtn.style.color = '#fff';
                setTimeout(() => {
                    icon.setAttribute('data-lucide', 'save');
                    initIcons();
                    saveApiKeyBtn.style.background = '';
                    saveApiKeyBtn.style.borderColor = '';
                    saveApiKeyBtn.style.color = '';
                }, 1500);
            }
        });
    }

    // Chat Form Submit
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        sendMessage();
    });

    // Enter to Send, Shift+Enter for Newline
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    // Auto-grow textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight - 4) + 'px';
    });

    // Mobile Sidebar Toggle
    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('show-sidebar');
    });

    // Close mobile sidebar when clicking main content
    chatMessages.addEventListener('click', function() {
        sidebar.classList.remove('show-sidebar');
    });

    // New Chat Action
    newChatBtn.addEventListener('click', startNewSession);
    mobileNewChatBtn.addEventListener('click', startNewSession);

    // Clear History Button
    clearHistoryBtn.addEventListener('click', function() {
        deleteSession(currentSessionId);
    });
}

// Start New Session
function startNewSession() {
    currentSessionId = generateUUID();
    localStorage.setItem('guidebot_session_id', currentSessionId);
    currentSessionLabel.textContent = `Session: ${currentSessionId.substring(0, 8)}...`;
    
    // Reset view
    chatMessages.innerHTML = '';
    chatMessages.appendChild(welcomeContainer);
    welcomeContainer.style.display = 'flex';
    
    // Re-render sidebar items to reflect selection
    renderSessionsList();
    
    // Close mobile sidebar if open
    sidebar.classList.remove('show-sidebar');
    
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatInput.focus();
}

// Select a Predefined Suggestion
window.selectSuggestion = function(text) {
    chatInput.value = text;
    chatInput.style.height = (chatInput.scrollHeight - 4) + 'px';
    sendMessage();
};

// Check Backend Connection
async function checkBackendConnection() {
    const statusDot = connectionStatus.querySelector('.status-dot');
    const statusText = connectionStatus.querySelector('.status-text');

    try {
        const response = await fetch(`${API_BASE_URL}/api/history`, { method: 'GET' });
        if (response.ok) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Connected';
            return true;
        }
    } catch (error) {
        console.error('Backend connection failed:', error);
    }
    
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Server Offline';
    return false;
}

// Load Chat History from Backend
async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/history`);
        if (!response.ok) throw new Error('Failed to fetch history');
        
        const data = await response.json();
        
        // Group messages by session_id
        sessions = {};
        data.forEach(entry => {
            const sId = entry.session_id;
            if (!sessions[sId]) {
                sessions[sId] = [];
            }
            sessions[sId].push(entry);
        });

        renderSessionsList();

        // If current session has history, render it
        if (sessions[currentSessionId]) {
            welcomeContainer.style.display = 'none';
            chatMessages.innerHTML = '';
            sessions[currentSessionId].forEach(msg => {
                renderMessageBubble(msg.user_message, 'user', msg.timestamp);
                renderMessageBubble(msg.bot_response, 'bot', msg.timestamp);
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Render the Sidebar Session Items
function renderSessionsList() {
    sessionsList.innerHTML = '';
    
    const sessionIds = Object.keys(sessions).reverse(); // show newest sessions first

    // Add current session if it doesn't have messages yet
    if (!sessionIds.includes(currentSessionId)) {
        sessionIds.unshift(currentSessionId);
    }

    sessionIds.forEach(id => {
        const item = document.createElement('div');
        item.className = `session-item ${id === currentSessionId ? 'active' : ''}`;
        item.dataset.sessionId = id;
        
        // Find first message as title or fallback to truncated ID
        let firstMsg = `Chat Session: ${id.substring(0, 8)}`;
        if (sessions[id] && sessions[id].length > 0) {
            const userMsg = sessions[id][0].user_message;
            firstMsg = userMsg.length > 22 ? userMsg.substring(0, 20) + '...' : userMsg;
        }

        item.innerHTML = `
            <div class="session-item-content">
                <i data-lucide="message-square"></i>
                <span class="session-title-text">${escapeHTML(firstMsg)}</span>
            </div>
            <button class="session-item-delete" title="Delete this conversation" data-id="${id}">
                <i data-lucide="trash-2"></i>
            </button>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.closest('.session-item-delete')) {
                selectSession(id);
            }
        });

        item.querySelector('.session-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(id, item);
        });

        sessionsList.appendChild(item);
    });
    
    initIcons();
}

// Delete a specific session's conversation history from backend
async function deleteSession(id, itemEl = null) {
    const hasHistory = sessions[id] && sessions[id].length > 0;

    if (hasHistory) {
        if (!confirm('Delete this conversation? This cannot be undone.')) return;
    }

    // Animate out if element exists
    if (itemEl) {
        itemEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        itemEl.style.opacity = '0';
        itemEl.style.transform = 'translateX(-12px)';
    }

    if (hasHistory) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/history/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                if (itemEl) {
                    itemEl.style.opacity = '1';
                    itemEl.style.transform = '';
                }
                alert(`Failed to delete: ${err.error}`);
                return;
            }
        } catch (e) {
            if (itemEl) {
                itemEl.style.opacity = '1';
                itemEl.style.transform = '';
            }
            alert('Network error — could not reach the backend.');
            return;
        }
    }

    // Remove from local state
    delete sessions[id];

    setTimeout(() => {
        if (id === currentSessionId) {
            startNewSession();
        } else {
            renderSessionsList();
        }
    }, itemEl ? 260 : 0);
}

// Select session from sidebar
function selectSession(id) {
    currentSessionId = id;
    localStorage.setItem('guidebot_session_id', currentSessionId);
    currentSessionLabel.textContent = `Session: ${currentSessionId.substring(0, 8)}...`;
    
    // Clear view and show messages
    chatMessages.innerHTML = '';
    
    if (sessions[id] && sessions[id].length > 0) {
        welcomeContainer.style.display = 'none';
        sessions[id].forEach(msg => {
            renderMessageBubble(msg.user_message, 'user', msg.timestamp);
            renderMessageBubble(msg.bot_response, 'bot', msg.timestamp);
        });
    } else {
        chatMessages.appendChild(welcomeContainer);
        welcomeContainer.style.display = 'flex';
    }
    
    renderSessionsList();
    scrollToBottom();
    
    // Close mobile sidebar
    sidebar.classList.remove('show-sidebar');
}

// Send Message
async function sendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    // Clear input box
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Hide welcome view if visible
    if (welcomeContainer.style.display !== 'none') {
        welcomeContainer.style.display = 'none';
        chatMessages.innerHTML = ''; // Clear out welcome element from DOM hierarchy
    }

    // Render user message instantly (Optimistic UI)
    const timestampStr = new Date().toISOString();
    renderMessageBubble(messageText, 'user', timestampStr);
    scrollToBottom();

    // Show typing indicator
    showTypingIndicator();

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: messageText,
                session_id: currentSessionId,
                api_key: localStorage.getItem('gemini_api_key') || '',
                metadata: {
                    user_agent: navigator.userAgent
                }
            })
        });

        // Hide typing indicator
        hideTypingIndicator();

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Server error occurred');
        }

        const data = await response.json();

        // Render bot message
        renderMessageBubble(data.bot_response, 'bot', data.timestamp);
        scrollToBottom();

        // Update local session cache
        if (!sessions[currentSessionId]) {
            sessions[currentSessionId] = [];
        }
        sessions[currentSessionId].push(data);

        // Update sessions sidebar list
        renderSessionsList();
        
        // Ensure connection indicator is online
        connectionStatus.querySelector('.status-dot').className = 'status-dot online';
        connectionStatus.querySelector('.status-text').textContent = 'Connected';

    } catch (error) {
        hideTypingIndicator();
        console.error('Error sending message:', error);
        
        // Render error card in chat
        renderMessageBubble(
            `⚠️ Error: Could not get a response. Details: ${error.message}. Please check if the Python Flask backend is running on port 5000.`, 
            'bot', 
            new Date().toISOString()
        );
        scrollToBottom();
        
        // Update connection status
        connectionStatus.querySelector('.status-dot').className = 'status-dot offline';
        connectionStatus.querySelector('.status-text').textContent = 'Server Offline';
    }
}

// Show/Hide Typing Indicator
function showTypingIndicator() {
    typingIndicator.style.display = 'flex';
    scrollToBottom();
}

function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

// Scroll chat log to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render message in chat window
function renderMessageBubble(text, sender, timestamp) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'user' ? '<i data-lucide="user"></i>' : '<i data-lucide="bot"></i>';

    const bubbleContainer = document.createElement('div');
    bubbleContainer.style.display = 'flex';
    bubbleContainer.style.flexDirection = 'column';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = formatMessage(text);

    const time = new Date(timestamp);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const metadata = document.createElement('div');
    metadata.className = 'message-metadata';
    metadata.innerHTML = `<span>${timeStr}</span>`;

    bubbleContainer.appendChild(bubble);
    bubbleContainer.appendChild(metadata);

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubbleContainer);

    chatMessages.appendChild(wrapper);
    initIcons();
}

// Escape HTML
function escapeHTML(text) {
    if (text === null || text === undefined) return "";
    const str = typeof text === 'string' ? text : String(text);
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Simple Markdown-to-HTML Formatter
function formatMessage(text) {
    if (!text) return "";
    
    // First, escape HTML
    let escaped = escapeHTML(text);

    // Code blocks: ```language ... ```
    escaped = escaped.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g, function(match, code) {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code: `code`
    escaped = escaped.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Bold: **text**
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italics: *text*
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Lists (bullets and numbered)
    // Match line starting with - or * and space
    escaped = escaped.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ul-item">$1</li>');
    // Match line starting with digit(s) followed by dot and space
    escaped = escaped.replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="ol-item">$1</li>');
    
    // Wrap contiguous sequences of ul-items in <ul>
    escaped = escaped.replace(/(?:<li class="ul-item">[\s\S]*?<\/li>\s*)+/g, function(match) {
        return `<ul>${match.replace(/ class="ul-item"/g, '')}</ul>`;
    });

    // Wrap contiguous sequences of ol-items in <ol>
    escaped = escaped.replace(/(?:<li class="ol-item">[\s\S]*?<\/li>\s*)+/g, function(match) {
        return `<ol>${match.replace(/ class="ol-item"/g, '')}</ol>`;
    });

    // Convert newlines to breaks outside pre/code tags
    const parts = escaped.split(/(<pre>[\s\S]*?<\/pre>)/g);
    for (let i = 0; i < parts.length; i++) {
        if (!parts[i].startsWith('<pre>')) {
            parts[i] = parts[i].replace(/\n/g, '<br>');
        }
    }
    return parts.join('');
}

// Run Initialization on Load
window.addEventListener('DOMContentLoaded', init);
