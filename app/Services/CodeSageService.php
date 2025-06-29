<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class CodeSageService
{
    protected string $apiKey;
    protected string $apiUrl;
    protected int $maxTokens;
    protected string $model;

    public function __construct()
    {
        $this->apiKey = config('services.gemini.api_key');
        $this->model = config('services.gemini.model', 'gemini-2.0-flash'); // Updated default
        $this->maxTokens = (int) config('services.gemini.max_tokens', 1000);

        $this->apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent";
    }

    public function generateResponse(string $prompt): string
    {
        Log::info('Generating response for prompt', ['prompt' => $prompt]);

        $userPrompt = $this->buildUserPrompt($prompt);

        $requestPayload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $userPrompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'maxOutputTokens' => $this->maxTokens,
                'temperature' => 0.4,
                'topP' => 0.95,
            ],
        ];

        Log::debug('Sending payload to Gemini API', ['payload' => $requestPayload]);

        try {
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
            ])->timeout(30)->post("{$this->apiUrl}?key={$this->apiKey}", $requestPayload);

            if (!$response->successful()) {
                Log::error('Gemini API Error', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);
                throw new RuntimeException('API request failed with status: ' . $response->status());
            }

            $responseData = $response->json();
            Log::debug('Received API response', ['response' => $responseData]);

            $text = data_get($responseData, 'candidates.0.content.parts.0.text');

            if (!$text) {
                Log::warning('No text in API response', ['response' => $responseData]);
                return 'Sorry, I could not generate a response. Please try again.';
            }

            return $text;

        } catch (\Exception $e) {
            Log::error('Exception in generateResponse', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 'Error: ' . $e->getMessage();
        }
    }

    public function getWelcomeMessage(): string
    {
        return "Welcome to CodeSage Debugging Assistant! How can I help you with your code today?";
    }

    private function buildSystemPrompt(): string
    {
        return <<<PROMPT
You are CodeSage, an expert debugging assistant. Your goal is to provide concise, actionable, and comprehensive debugging support.

**Response Format Guidelines:**
1.  **[Critical Fix]** - Provide the immediate, corrected code block. Use clear syntax highlighting.
2.  **[Root Cause]** - Explain the underlying problem concisely (1-2 sentences).
3.  **[Prevention]** - Offer one practical tip to avoid this issue.
4.  **[Analysis]** - Offer a detailed technical breakdown.
5.  Ensure all code blocks are properly formatted with language identifiers (e.g., ```php).
PROMPT;
    }

    private function buildUserPrompt(string $error): string
    {
        $systemPrompt = $this->buildSystemPrompt();
        return $systemPrompt . "\n\n**Debug this error/issue:**\n```\n{$error}\n```\n\nBased on the guidelines, provide a detailed, formatted response.";
    }
}
