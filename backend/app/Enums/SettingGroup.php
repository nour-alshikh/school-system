<?php

namespace App\Enums;

enum SettingGroup: string
{
    case General = 'general';
    case Branding = 'branding';
    case Contact = 'contact';
    case Social = 'social';
    case Seo = 'seo';
}
