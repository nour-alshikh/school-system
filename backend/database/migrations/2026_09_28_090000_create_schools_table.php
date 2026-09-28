<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // The tenant. Everything school-owned will get a school_id pointing
        // here (see docs/multi-tenancy.md); users stay global and join via
        // school_memberships.
        Schema::create('schools', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            // Public identifier for pre-login branding (subdomain/path).
            $table->string('slug')->unique();
            // Plain string, same reasoning as students.status (see SchoolStatus).
            $table->string('status')->default('active');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schools');
    }
};
