<?php

namespace Database\Seeders\Demo;

use App\Enums\StudentStatus;
use App\Models\Student;
use App\Models\User;

/**
 * Generated pictures (a coloured square with initials): a photo for about
 * a third of the current school's students — on the private disk, served
 * only through /api/attachments/{id} (docs/media.md) — and avatars for a
 * few demo accounts.
 */
class PhotoDemoSeeder
{
    private const COLOURS = [[15, 118, 110], [124, 58, 237], [219, 39, 119], [234, 88, 12], [37, 99, 235], [22, 163, 74]];

    public function studentPhotos(): void
    {
        Student::where('status', StudentStatus::Active)->orderBy('id')->get()
            ->filter(fn (Student $student, int $i) => $i % 3 === 0)
            ->each(function (Student $student) {
                $student->addMediaFromString($this->picture($student->getTranslation('name', 'en')))
                    ->usingFileName('photo.png')
                    ->toMediaCollection('attachments');
            });
    }

    /** @param  list<User|null>  $users */
    public function avatars(array $users): void
    {
        foreach (array_filter($users) as $user) {
            $user->addMediaFromString($this->picture($user->name))
                ->usingFileName('avatar.png')
                ->toMediaCollection('avatar');
        }
    }

    /** A 256×256 PNG: a colour picked from the name, with its initials. */
    private function picture(string $name): string
    {
        $initials = collect(preg_split('/\s+/', trim($name)))
            ->filter()
            ->take(2)
            ->map(fn (string $word) => strtoupper($word[0]))
            ->implode('');

        // Drawn small with GD's built-in font, then scaled up.
        $small = imagecreatetruecolor(32, 32);
        [$r, $g, $b] = self::COLOURS[crc32($name) % count(self::COLOURS)];
        imagefill($small, 0, 0, imagecolorallocate($small, $r, $g, $b));
        $x = (int) ((32 - imagefontwidth(5) * strlen($initials)) / 2);
        imagestring($small, 5, $x, 8, $initials, imagecolorallocate($small, 255, 255, 255));

        $large = imagecreatetruecolor(256, 256);
        imagecopyresized($large, $small, 0, 0, 0, 0, 256, 256, 32, 32);

        ob_start();
        imagepng($large);

        return (string) ob_get_clean();
    }
}
