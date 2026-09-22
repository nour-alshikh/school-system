<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\TypeScript\AdminDashboardType;

class DashboardController extends Controller
{
    public function show()
    {
        return response()->json(['dashboard' => (array) AdminDashboardType::build()]);
    }
}
