import './bootstrap';

import '../css/app.css';

class CodeDebugger {
    constructor() {
        this.initElements();
        this.initEvents();
        this.setupUI();
        this.isStreaming = false;
        this.abortController = null;
        this.currentStream = null;
    }

    initElements() {
        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.debugForm = document.getElementById('debug-form');
        this.submitBtn = document.getElementById('submit-btn');
        this.charCount = document.getElementById('char-count');
        this.attachBtn = document.getElementById('attach-btn');
    }

    initEvents() {
        this.userInput.addEventListener('input', this.handleInput.bind(this));
        this.debugForm.addEventListener('submit', this.handleSubmit.bind(this));
        this.userInput.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.attachBtn.addEventListener('click', this.handleAttach.bind(this));
        this.userInput.addEventListener('paste', this.handlePaste.bind(this));
    }

    setupUI() {
        this.addWelcomeMessage();
    }

    handleInput() {
        this.userInput.style.height = 'auto';
        this.userInput.style.height = `${Math.min(this.userInput.scrollHeight, 200)}px`;

        const charCount = this.userInput.value.length;
        this.charCount.textContent = charCount;
        this.submitBtn.disabled = charCount === 0 || this.isStreaming;

        if (charCount > 3500) {
            this.charCount.classList.add('text-amber-400');
        } else {
            this.charCount.classList.remove('text-amber-400');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const message = this.userInput.value.trim();
        if (!message || this.isStreaming) return;

        this.addMessage('user', message);
        this.clearInput();
        this.showTypingIndicator();
        this.isStreaming = true;

        try {
            // Cancel any previous request
            if (this.abortController) {
                this.abortController.abort();
            }

            this.abortController = new AbortController();
            const messageId = this.addMessage('bot', '');
            const streamContainer = document.getElementById(`stream-${messageId}`);

            // Create EventSource connection
            const eventSource = new EventSource(`/codesage/generate?prompt=${encodeURIComponent(message)}`);
            this.currentStream = eventSource;
            let fullResponse = '';

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.chunk) {
                    fullResponse += data.chunk;
                    streamContainer.innerHTML = this.formatCodeBlocks(fullResponse);
                    this.scrollToBottom();
                }
            };

            eventSource.onerror = () => {
                this.finalizeStream(streamContainer, fullResponse);
            };

            // Handle abort
            this.abortController.signal.addEventListener('abort', () => {
                eventSource.close();
                this.finalizeStream(streamContainer, fullResponse);
            });

        } catch (error) {
            if (error.name !== 'AbortError') {
                this.showError("Failed to get response. Please try again.");
                console.error("API Error:", error);
            }
            this.isStreaming = false;
            this.removeTypingIndicator();
        }
    }

    finalizeStream(container, content) {
        this.isStreaming = false;
        this.removeTypingIndicator();
        this.highlightCodeBlocks(container);
        this.currentStream = null;
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && !this.isStreaming) {
            e.preventDefault();
            this.debugForm.dispatchEvent(new Event('submit'));
        }
    }

    handleAttach() {
        console.log("Attachment button clicked");
        // File attachment implementation would go here
    }

    handlePaste(e) {
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        if (this.looksLikeCode(pastedText)) {
            setTimeout(() => {
                if (this.userInput.value.startsWith(pastedText)) {
                    this.userInput.value = `\`\`\`\n${pastedText}\n\`\`\``;
                    this.handleInput();
                }
            }, 10);
        }
    }

    looksLikeCode(text) {
        const codePatterns = [
            /^\s*(function|class|import|export|const|let|var)\s+/,
            /[{}()<>;=]/,
            /^\s*\/\/|\/\*|\*\/|#/
        ];
        return codePatterns.some(pattern => pattern.test(text)) ||
               text.split('\n').length > 5;
    }

    clearInput() {
        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        this.charCount.textContent = '0';
        this.submitBtn.disabled = true;
    }

    addWelcomeMessage() {
        if (this.chatContainer.children.length > 0) return;

        const welcomeHTML = `
            <div class="flex space-x-3 fade-in-up">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="bg-gray-800 rounded-lg p-4 max-w-prose">
                    <h2 class="font-bold text-lg text-blue-400 mb-2">Welcome to CodeSage</h2>
                    <p class="text-balance">${this.escapeHtml(this.getWelcomeMessage())}</p>
                    <ul class="list-disc pl-5 mt-2 space-y-1 marker:text-blue-400">
                        <li>Analyzing error messages and stack traces</li>
                        <li>Debugging code snippets in multiple languages</li>
                        <li>Optimizing performance issues</li>
                        <li>Explaining complex concepts</li>
                    </ul>
                </div>
            </div>
        `;

        this.chatContainer.insertAdjacentHTML('beforeend', welcomeHTML);
        this.scrollToBottom();
    }

    getWelcomeMessage() {
        return document.querySelector('meta[name="welcome-message"]')?.content ||
               "Welcome to CodeSage Debugging Assistant!";
    }

    addMessage(role, content) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messageId = `msg-${Date.now()}`;

        let messageHTML;

        if (role === 'user') {
            messageHTML = `
                <div class="flex space-x-3 justify-end fade-in-up" id="${messageId}">
                    <div class="flex flex-col items-end">
                        <div class="message user rounded-lg p-4 whitespace-pre-line">
                            ${this.escapeHtml(content)}
                        </div>
                        <span class="text-xs text-gray-400 mt-1">${timestamp}</span>
                    </div>
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                        </svg>
                    </div>
                </div>
            `;
        } else {
            messageHTML = `
                <div class="flex space-x-3 fade-in-up" id="${messageId}">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="message bot rounded-lg p-4 response-stream" id="stream-${messageId}">
                            ${content || '<span class="streaming-cursor"></span>'}
                        </div>
                        <span class="text-xs text-gray-400 mt-1">${timestamp}</span>
                    </div>
                </div>
            `;
        }

        this.chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
        return messageId;
    }

    showTypingIndicator() {
        this.typingId = 'typing-' + Date.now();
        const typingHTML = `
            <div class="flex space-x-3" id="${this.typingId}">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="bg-gray-800 rounded-lg p-4 max-w-xs">
                    <p class="typing-indicator">Analyzing your code</p>
                </div>
            </div>
        `;

        this.chatContainer.insertAdjacentHTML('beforeend', typingHTML);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        if (this.typingId) {
            const element = document.getElementById(this.typingId);
            if (element) element.remove();
            this.typingId = null;
        }
    }

    showError(message) {
        this.removeTypingIndicator();

        const errorId = 'error-' + Date.now();
        const errorHTML = `
            <div class="flex space-x-3 fade-in-up" id="${errorId}">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="bg-red-900/30 rounded-lg p-4 max-w-prose border border-red-800/50">
                    <p class="text-red-200">${this.escapeHtml(message)}</p>
                    <button class="mt-2 text-sm text-red-300 hover:text-white underline" onclick="document.getElementById('${errorId}').remove()">
                        Dismiss
                    </button>
                </div>
            </div>
        `;

        this.chatContainer.insertAdjacentHTML('beforeend', errorHTML);
        this.scrollToBottom();
    }

    formatCodeBlocks(text) {
        return text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'text';
            return `
                <div class="code-block" data-language="${language}">
                    <pre><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>
                </div>
            `;
        });
    }

    highlightCodeBlocks(container) {
        container.querySelectorAll('pre code').forEach((block) => {
            block.classList.add(`language-${block.parentElement.parentElement.dataset.language}`);
            // In a real app, you would call Prism.highlightElement(block) here
        });
    }

    scrollToBottom() {
        this.chatContainer.scrollTo({
            top: this.chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    const debuggerApp = new CodeDebugger();
    window.debuggerApp = debuggerApp;
});
