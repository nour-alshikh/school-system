<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** GET /api/plans: the landing page's pricing section (docs/design-refresh-plan.md, step 3). */
class PublicPlanTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_get_the_plans_cheapest_first_without_school_counts(): void
    {
        config(['schools.self_service_plan' => 'basic', 'schools.contact_email' => 'hello@example.com']);

        $response = $this->getJson('/api/plans')->assertOk();

        $this->assertSame(['basic', 'standard', 'unlimited'], array_column($response->json('plans'), 'key'));
        $response
            ->assertJsonPath('plans.0.max_students', 200)
            ->assertJsonPath('plans.0.features', ['fees', 'exams', 'library'])
            ->assertJsonPath('plans.0.self_service', true)
            ->assertJsonPath('plans.1.self_service', false)
            ->assertJsonPath('plans.2.max_students', null)
            ->assertJsonPath('contact_email', 'hello@example.com')
            ->assertJsonMissingPath('plans.0.schools_count')
            ->assertJsonMissingPath('plans.0.id');
    }

    public function test_the_contact_email_is_null_when_not_configured(): void
    {
        config(['schools.contact_email' => null]);

        $this->getJson('/api/plans')->assertOk()->assertJsonPath('contact_email', null);
    }
}
