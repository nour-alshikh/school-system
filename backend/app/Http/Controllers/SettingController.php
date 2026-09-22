<?php

namespace App\Http\Controllers;

use App\Http\Resources\SettingResource;
use App\Models\Setting;

class SettingController extends Controller
{
    /**
     * Public and unauthenticated — the frontend needs branding (logo,
     * school name, social links) before a user is signed in at all (e.g.
     * the login page header), so this is read by anyone. Nothing sensitive
     * is stored on this table; admin-only write access is what actually
     * needs gating — see Admin\SettingController.
     */
    public function index()
    {
        return response()->json([
            'settings' => SettingResource::collection(Setting::orderBy('group')->orderBy('key')->get()),
        ]);
    }
}
