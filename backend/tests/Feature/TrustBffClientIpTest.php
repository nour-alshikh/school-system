<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The BFF passes the visitor's address with a shared secret, so per-address
 * limits count visitors, not the BFF (App\Http\Middleware\TrustBffClientIp).
 * Checked through the "Describe your school" limit: 10 an hour per address.
 */
class TrustBffClientIpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // No AI: each request answers fast with the standard structure.
        config(['services.openrouter.key' => null, 'services.bff.secret' => 'shared-secret']);
    }

    public function test_with_the_secret_each_visitor_has_their_own_limit(): void
    {
        $this->useUp('203.0.113.7', 'shared-secret');

        $this->describe('203.0.113.7', 'shared-secret')->assertTooManyRequests();
        $this->describe('198.51.100.4', 'shared-secret')->assertOk();
    }

    public function test_without_the_right_secret_the_header_is_ignored(): void
    {
        // Wrong secret: everything counts against the connecting address.
        foreach (range(1, 10) as $n) {
            $this->describe("203.0.113.{$n}", 'guess')->assertOk();
        }
        $this->describe('203.0.113.99', 'guess')->assertTooManyRequests();
        $this->describe('198.51.100.4', null)->assertTooManyRequests();
    }

    public function test_nothing_is_trusted_when_no_secret_is_configured(): void
    {
        config(['services.bff.secret' => null]);

        $this->useUp('203.0.113.7', '');
        $this->describe('198.51.100.4', '')->assertTooManyRequests();
    }

    public function test_a_malformed_address_is_ignored(): void
    {
        $this->useUp('not-an-ip', 'shared-secret');

        // It counted against the connecting address, not a made-up one.
        $this->describe('127.0.0.1', 'shared-secret')->assertTooManyRequests();
    }

    private function useUp(string $ip, ?string $secret): void
    {
        foreach (range(1, 10) as $_) {
            $this->describe($ip, $secret)->assertOk();
        }
    }

    private function describe(string $ip, ?string $secret)
    {
        return $this->withHeaders(array_filter(['X-Client-IP' => $ip, 'X-BFF-Secret' => $secret]))
            ->postJson('/api/school-blueprint', ['description' => 'a small school']);
    }
}
