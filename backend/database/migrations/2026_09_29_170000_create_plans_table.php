<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Plans and their limits (docs/central-dashboard-plan.md, phase 9).
     * Every existing school starts on Unlimited, so nothing changes for
     * them. Billing is out of scope: plans are the groundwork.
     */
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            // Null: no limit.
            $table->unsignedInteger('max_students')->nullable();
            $table->unsignedInteger('max_storage_mb')->nullable();
            // Modules the plan includes: fees, exams, meetings, library.
            $table->json('features');
            $table->timestamps();
        });

        $all = json_encode(['fees', 'exams', 'meetings', 'library']);
        $now = now();
        DB::table('plans')->insert([
            ['key' => 'basic', 'name' => 'Basic', 'max_students' => 200, 'max_storage_mb' => 1024, 'features' => json_encode(['fees', 'exams', 'library']), 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'standard', 'name' => 'Standard', 'max_students' => 1000, 'max_storage_mb' => 10240, 'features' => $all, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'unlimited', 'name' => 'Unlimited', 'max_students' => null, 'max_storage_mb' => null, 'features' => $all, 'created_at' => $now, 'updated_at' => $now],
        ]);

        Schema::table('schools', function (Blueprint $table) {
            $table->foreignId('plan_id')->nullable()->after('source')->constrained()->nullOnDelete();
        });

        DB::table('schools')->update(['plan_id' => DB::table('plans')->where('key', 'unlimited')->value('id')]);
    }

    public function down(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            $table->dropConstrainedForeignId('plan_id');
        });

        Schema::dropIfExists('plans');
    }
};
