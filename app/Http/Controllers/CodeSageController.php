<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\View\View;
use App\Services\CodeSageService;
use Illuminate\Support\Facades\Log;
use Exception;

class CodeSageController extends Controller
{
    protected CodeSageService $codeSageService;

    public function __construct(CodeSageService $codeSageService)
    {
        $this->codeSageService = $codeSageService;
    }

    public function index(): View
    {
        Log::info('Displaying CodeSage chat interface');
        return view('codesage.chat', [
            'welcomeMessage' => $this->codeSageService->getWelcomeMessage(),
        ]);
    }

    public function generate(Request $request): JsonResponse
    {
        Log::info('Generate request received', $request->all());

        $request->validate([
            'prompt' => 'required|string|max:8000',
        ]);

        try {
            $prompt = $request->input('prompt');
            Log::debug('Processing prompt', ['prompt' => $prompt]);

            $response_text = $this->codeSageService->generateResponse($prompt);
            Log::debug('Response generated', ['response' => $response_text]);

            return response()->json([
                'response' => $response_text,
                'status' => 'success'
            ]);

        } catch (Exception $e) {
            Log::error('Error in CodeSageController generate', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'An error occurred while generating the response.',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    public function history()
    {
        return response()->json(['sessions' => []]);
    }
}
