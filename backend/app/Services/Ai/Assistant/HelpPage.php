<?php

namespace App\Services\Ai\Assistant;

/** One page of the assistant's help library (resources/help/{locale}/*.md). */
final class HelpPage
{
    /**
     * @param  list<string>  $pages  app paths the page is about ("/attendance")
     * @param  list<string>  $access  who may read it: permission names or "role:<name>", any of; empty = everyone
     * @param  list<string>  $keywords
     */
    public function __construct(
        public readonly string $key,
        public readonly string $title,
        public readonly array $pages,
        public readonly array $access,
        public readonly ?string $feature,
        public readonly array $keywords,
        public readonly string $body,
    ) {}

    /**
     * @param  list<string>  $roles
     * @param  list<string>  $permissions
     * @param  list<string>|null  $features  the plan's modules; null = no plan info, nothing hidden
     */
    public function readableBy(array $roles, array $permissions, ?array $features): bool
    {
        if ($this->feature !== null && $features !== null && ! in_array($this->feature, $features, true)) {
            return false;
        }

        if ($this->access === []) {
            return true;
        }

        foreach ($this->access as $rule) {
            if (str_starts_with($rule, 'role:') ? in_array(substr($rule, 5), $roles, true) : in_array($rule, $permissions, true)) {
                return true;
            }
        }

        return false;
    }
}
