<?php

namespace Database\Seeders\Demo;

use App\Models\Grade;
use App\Models\LibraryResource;
use App\Models\Teacher;
use App\Models\User;

/**
 * News posts (bilingual) and a library of links and a few small PDFs.
 */
class ContentDemoSeeder
{
    private const POSTS = [
        ['news', 'published', true, 'Welcome back to a new school year', 'مرحبًا بعودتكم إلى عام دراسي جديد',
            'We are excited to welcome every student and family back. Timetables and classroom lists are now available on the portal.',
            'يسعدنا الترحيب بجميع الطلاب وأسرهم من جديد. الجداول وقوائم الفصول متاحة الآن على البوابة.'],
        ['news', 'published', false, 'Sports day is coming', 'اليوم الرياضي قادم',
            'Our annual sports day is next week. Students should wear sports clothes and bring water.',
            'اليوم الرياضي السنوي الأسبوع المقبل. يرجى من الطلاب ارتداء الملابس الرياضية وإحضار الماء.'],
        ['tutorial', 'published', false, 'How to check your child’s attendance', 'كيف تتابع حضور طفلك',
            'Open the parent portal, choose your child, then Attendance. Each day shows present, absent, late or excused.',
            'افتح بوابة ولي الأمر واختر طفلك ثم الحضور. يظهر لكل يوم حاضر أو غائب أو متأخر أو بعذر.'],
        ['general', 'published', false, 'New books in the library', 'كتب جديدة في المكتبة',
            'We added reading and science resources for every stage. Find them under Library.',
            'أضفنا مصادر للقراءة والعلوم لكل مرحلة. تجدها في قسم المكتبة.'],
        ['opinion', 'draft', false, 'Why reading together matters', 'لماذا القراءة معًا مهمة',
            'Twenty minutes of reading a day builds vocabulary and confidence. Here is how families can help.',
            'عشرون دقيقة من القراءة يوميًا تبني المفردات والثقة. إليكم كيف يمكن للأسر المساعدة.'],
        ['news', 'draft', false, 'Mid-term exam timetable', 'جدول امتحانات منتصف الفصل',
            'The full timetable will be published here two weeks before exams start.',
            'سيُنشر الجدول الكامل هنا قبل بدء الامتحانات بأسبوعين.'],
    ];

    private const LINKS = [
        ['Khan Academy — Arithmetic', 'https://www.khanacademy.org/math/arithmetic', 'Mathematics'],
        ['Khan Academy — Fractions', 'https://www.khanacademy.org/math/arithmetic/fraction-arithmetic', 'Mathematics'],
        ['Crash Course Kids — Science', 'https://www.youtube.com/@crashcoursekids', 'Science'],
        ['NASA Space Place', 'https://spaceplace.nasa.gov/', 'Science'],
        ['BBC Learning English', 'https://www.bbc.co.uk/learningenglish', 'English'],
        ['British Council — Stories', 'https://learnenglishkids.britishcouncil.org/short-stories', 'English'],
        ['Arabic reading practice', 'https://www.youtube.com/results?search_query=arabic+reading+for+kids', 'Arabic'],
    ];

    private const FILES = [
        ['Multiplication table', 'Mathematics'],
        ['Parts of a plant — worksheet', 'Science'],
        ['Reading log', 'English'],
    ];

    public function run(User $admin): void
    {
        foreach (self::POSTS as $i => [$category, $status, $featured, $titleEn, $titleAr, $bodyEn, $bodyAr]) {
            $admin->posts()->create([
                'title' => ['en' => $titleEn, 'ar' => $titleAr],
                'body' => ['en' => $bodyEn, 'ar' => $bodyAr],
                'status' => $status,
                'category' => $category,
                'tags' => [],
                'is_featured' => $featured,
                'reading_minutes' => fake()->numberBetween(2, 6),
                'priority' => 0,
                'published_at' => $status === 'published' ? now()->subDays(3 + $i * 4)->toDateString() : null,
            ]);
        }

        $grades = Grade::with('stage.subjects')->orderBy('id')->get();
        $uploaderId = Teacher::whereNotNull('user_id')->value('user_id') ?? $admin->id;

        foreach (self::LINKS as $i => [$title, $url, $subject]) {
            $this->resource($grades[$i % $grades->count()], $subject, [
                'title' => $title, 'type' => 'link', 'url' => $url, 'uploaded_by' => $uploaderId,
                'description' => 'A free resource to practise at home.',
            ]);
        }

        foreach (self::FILES as $i => [$title, $subject]) {
            $resource = $this->resource($grades[$i % $grades->count()], $subject, [
                'title' => $title, 'type' => 'file', 'url' => null, 'uploaded_by' => $admin->id,
                'description' => 'Print it or fill it in on screen.',
            ]);

            $resource->addMediaFromString($this->pdf($title))
                ->usingFileName(str($title)->slug().'.pdf')
                ->toMediaCollection('file');
        }
    }

    private function resource(Grade $grade, string $subjectName, array $attributes): LibraryResource
    {
        $resource = LibraryResource::create([...$attributes, 'grade_id' => $grade->id]);

        $subject = $grade->stage->subjects->first(fn ($s) => $s->getTranslation('name', 'en') === $subjectName)
            ?? $grade->stage->subjects->first();
        if ($subject) {
            $resource->subjects()->sync([$subject->id]);
        }

        return $resource;
    }

    /** A one-page PDF with a title on it: small, valid, and enough to download. */
    private function pdf(string $title): string
    {
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $title);
        $stream = "BT /F1 24 Tf 72 720 Td ({$text}) Tj ET";

        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $n => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($n + 1)." 0 obj\n{$object}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }
}
