<?php

use App\Http\Controllers\CodeSageController;
use Illuminate\Support\Facades\Route;

Route::get('/', [CodeSageController::class, 'index'])->name('codesage.index');
Route::get('/codesage/history', [CodeSageController::class, 'history'])->name('codesage.history');
Route::post('/codesage/generate', [CodeSageController::class, 'generate'])->name('codesage.generate');
