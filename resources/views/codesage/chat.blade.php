<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="welcome-message" content="{{ $welcomeMessage }}">
    <title>CodeSage - AI Debugging Assistant</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen">
    <div class="container mx-auto max-w-6xl h-screen flex flex-col">
        <header class="py-4 border-b border-gray-700">
            <div class="flex items-center justify-between px-4">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <h1 class="text-xl font-bold">CodeSage</h1>
                </div>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto p-4 space-y-6 chat-container" id="chat-container"></div>

        <div class="border-t border-gray-700 p-4">
            <form id="chat-form" class="relative">
                @csrf
                <div class="flex items-end space-x-2">
                    <div class="flex-1 relative">
                        <textarea
                            id="prompt-input"
                            name="prompt"
                            rows="1"
                            placeholder="Describe your coding issue or paste error message..."
                            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none overflow-hidden"
                            autofocus
                            maxlength="8000"
                            required
                        ></textarea>
                    </div>
                    <button
                        type="submit"
                        id="submit-btn"
                        class="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
                <div class="flex items-center justify-between mt-2 px-1">
                    <div class="text-xs text-gray-400">
                        <span id="char-count">0</span>/8000 chars
                    </div>
                </div>
            </form>
        </div>
    </div>

<script>
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('prompt-input');
    const chatContainer = document.getElementById('chat-container');
    const submitBtn = document.getElementById('submit-btn');
    const charCount = document.getElementById('char-count');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    const welcomeMessage = document.querySelector('meta[name="welcome-message"]').content;

    // Display initial welcome message
    addMessageToChat('bot', welcomeMessage);

    function addMessageToChat(sender, text) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `w-full flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;

        const messageBubble = document.createElement('div');
        messageBubble.className = `max-w-xl p-4 rounded-lg shadow ${sender === 'user' ? 'bg-gray-700' : 'bg-blue-900'}`;

        // Using innerText prevents HTML injection
        messageBubble.innerText = text;
        messageBubble.className += ' text-sm mt-2 whitespace-pre-wrap text-gray-100';

        messageWrapper.appendChild(messageBubble);
        chatContainer.appendChild(messageWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return messageBubble;
    }

    // Auto-resizing textarea logic
    const adjustTextareaHeight = () => {
        input.style.height = 'auto';
        input.style.height = (input.scrollHeight) + 'px';
    };

    // Character count and input validation
    input.addEventListener('input', () => {
        const hasText = input.value.trim().length > 0;
        submitBtn.disabled = !hasText;
        charCount.innerText = input.value.length;
        adjustTextareaHeight();
    });

    // Submit on Enter (without Shift)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });

    // Form submission handler
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const prompt = input.value.trim();
        if (!prompt) return;

        // Display user's prompt immediately
        addMessageToChat('user', prompt);

        // Clear input and disable form
        input.value = '';
        submitBtn.disabled = true;
        adjustTextareaHeight();
        charCount.innerText = '0';

        // Show a "thinking" message from the bot
        const thinkingMessage = addMessageToChat('bot', 'CodeSage is thinking...');

        try {
            const response = await fetch("{{ route('codesage.generate') }}", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Update the "thinking" message with the actual response
            thinkingMessage.innerText = data.response;

        } catch (error) {
            console.error("Error fetching AI response:", error);
            thinkingMessage.innerText = `Sorry, an error occurred: ${error.message}`;
            thinkingMessage.classList.add('text-red-300');
        } finally {
            submitBtn.disabled = input.value.trim().length === 0;
        }
    });
});
</script>
</body>
</html>
