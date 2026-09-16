<?php

use App\Http\Controllers\AcademicYearController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\AvatarController;
use App\Http\Controllers\BloodTypeController;
use App\Http\Controllers\ClassroomController;
use App\Http\Controllers\GovernorateController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\NationalityController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ReligionController;
use App\Http\Controllers\StageController;
use App\Http\Controllers\StudentController;
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

    // The academic structure (stages, grades, classrooms, academic years) is
    // admin territory: read access is shared by whichever admin permission
    // needs it (managing the structure itself, or picking values while
    // registering a student), writes need manage-academics specifically.
    // Parents/students get none of this — just their own record.
    Route::middleware('permission:manage-academics|manage-students')->group(function () {
        Route::get('/stages', [StageController::class, 'index']);
        Route::get('/grades', [GradeController::class, 'index']);
        Route::get('/classrooms', [ClassroomController::class, 'index']);
        Route::get('/academic-years', [AcademicYearController::class, 'index']);
    });
    Route::middleware('permission:manage-academics')->group(function () {
        Route::post('/stages', [StageController::class, 'store']);
        Route::post('/stages/bulk-delete', [StageController::class, 'bulkDestroy']);
        Route::put('/stages/{stage}', [StageController::class, 'update']);
        Route::delete('/stages/{stage}', [StageController::class, 'destroy']);

        Route::post('/grades', [GradeController::class, 'store']);
        Route::post('/grades/bulk-delete', [GradeController::class, 'bulkDestroy']);
        Route::put('/grades/{grade}', [GradeController::class, 'update']);
        Route::delete('/grades/{grade}', [GradeController::class, 'destroy']);

        Route::post('/classrooms', [ClassroomController::class, 'store']);
        Route::post('/classrooms/bulk-delete', [ClassroomController::class, 'bulkDestroy']);
        Route::put('/classrooms/{classroom}', [ClassroomController::class, 'update']);
        Route::delete('/classrooms/{classroom}', [ClassroomController::class, 'destroy']);

        Route::post('/academic-years', [AcademicYearController::class, 'store']);
        Route::post('/academic-years/bulk-delete', [AcademicYearController::class, 'bulkDestroy']);
        Route::put('/academic-years/{academicYear}', [AcademicYearController::class, 'update']);
        Route::delete('/academic-years/{academicYear}', [AcademicYearController::class, 'destroy']);
    });

    Route::middleware('permission:manage-students')->group(function () {
        Route::get('/students', [StudentController::class, 'index']);
        Route::post('/students', [StudentController::class, 'store']);
    });

    Route::get('/nationalities', [NationalityController::class, 'index']);
    Route::get('/governorates', [GovernorateController::class, 'index']);
    Route::get('/blood-types', [BloodTypeController::class, 'index']);
    Route::get('/religions', [ReligionController::class, 'index']);
});
