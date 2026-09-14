<?php

use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\AvatarController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\StageController;
use App\Models\Post;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword']);
    Route::post('/reset-password', [PasswordResetController::class, 'resetPassword']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    Route::post('/user/avatar', [AvatarController::class, 'store']);
    Route::delete('/user/avatar', [AvatarController::class, 'destroy']);

    Route::middleware('permission:manage-users')->group(function () {
        Route::get('/admin/users', [UserController::class, 'index']);
    });

    Route::get('/posts', [PostController::class, 'index']);
    Route::post('/posts', [PostController::class, 'store'])->middleware('can:create,'.Post::class);
    Route::put('/posts/{post}', [PostController::class, 'update'])->middleware('can:update,post');
    Route::delete('/posts/{post}', [PostController::class, 'destroy'])->middleware('can:delete,post');

    // Any authenticated user can view the academic structure (stages,
    // grades, classrooms); only admins may change it.
    Route::get('/stages', [StageController::class, 'index']);
    Route::get('/grades', [GradeController::class, 'index']);
    Route::middleware('permission:manage-academics')->group(function () {
        Route::post('/stages', [StageController::class, 'store']);
        Route::put('/stages/{stage}', [StageController::class, 'update']);
        Route::delete('/stages/{stage}', [StageController::class, 'destroy']);

        Route::post('/grades', [GradeController::class, 'store']);
        Route::put('/grades/{grade}', [GradeController::class, 'update']);
        Route::delete('/grades/{grade}', [GradeController::class, 'destroy']);
    });
});
