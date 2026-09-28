<?php

namespace App\Models;

use App\Enums\SettingGroup;
use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Setting extends Model implements HasMedia
{
    use BelongsToSchool;
    use InteractsWithMedia;

    protected $fillable = [
        'key',
        'value',
        'group',
    ];

    protected $casts = [
        'group' => SettingGroup::class,
    ];

    /**
     * Routes bind by key (e.g. /settings/logo/file), not id — the key is
     * the stable, human-meaningful identifier admins/frontend code refer to.
     */
    public function getRouteKeyName(): string
    {
        return 'key';
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('file')->singleFile();
    }
}
