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

    /** A setting's value at the current school. */
    public static function valueOf(string $key): ?string
    {
        return static::where('key', $key)->value('value');
    }

    /** The current school's currency (ISO 4217), or null until its admin picks one. */
    public static function currency(): ?string
    {
        return static::valueOf('currency');
    }

    /**
     * The current school's school days as weekday numbers (0 = Sunday …
     * 6 = Saturday, like Carbon's dayOfWeek), or null until its admin
     * picks them — then every day counts.
     *
     * @return list<int>|null
     */
    public static function schoolDays(): ?array
    {
        $value = static::valueOf('school_days');

        return filled($value) ? array_map('intval', explode(',', $value)) : null;
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('file')->singleFile();
    }
}
