<?php

namespace App\Services\Ai;

use RuntimeException;

/** Today's AI calls are used up, for this user, this school (config ai.caps) or the whole demo (config demo.ai_daily_cap). */
class AiCapReached extends RuntimeException
{
    /** @param  'user'|'school'|'demo'  $scope */
    public function __construct(public readonly string $scope)
    {
        parent::__construct("Daily AI cap reached for this {$scope}.");
    }
}
