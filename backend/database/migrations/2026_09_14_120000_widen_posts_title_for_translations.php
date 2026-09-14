<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * title/body now store a JSON object of locale => text (see the
     * HasTranslations trait on the Post model) — widening title from
     * string(255) to text so two languages' worth of content comfortably
     * fits the combined JSON blob.
     */
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->text('title')->change();
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('title')->change();
        });
    }
};
