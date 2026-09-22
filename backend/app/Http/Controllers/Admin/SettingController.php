<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Setting\UpdateSettingFileRequest;
use App\Http\Requests\Setting\UpdateSettingsRequest;
use App\Http\Resources\SettingResource;
use App\Models\Setting;

class SettingController extends Controller
{
    /**
     * Bulk upsert — the settings form submits every key in its currently
     * active tab at once rather than one request per field.
     */
    public function update(UpdateSettingsRequest $request)
    {
        foreach ($request->validated('settings') as $item) {
            Setting::where('key', $item['key'])->update([
                'value' => $item['value'] ?? null,
            ]);
        }

        return response()->json([
            'settings' => SettingResource::collection(Setting::orderBy('group')->orderBy('key')->get()),
        ]);
    }

    /**
     * File-backed settings (logo, favicon) are their own endpoint rather
     * than a field on update() — same reasoning as
     * LibraryResourceController::updateFile(). The media collection is
     * singleFile(), so this replaces whatever was there before.
     */
    public function updateFile(UpdateSettingFileRequest $request, Setting $setting)
    {
        $setting->addMediaFromRequest('file')->toMediaCollection('file');

        return response()->json([
            'setting' => new SettingResource($setting->fresh()),
        ]);
    }
}
