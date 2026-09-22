<?php

namespace App\Http\Controllers;

use App\Http\Requests\CalendarEvent\StoreCalendarEventRequest;
use App\Http\Requests\CalendarEvent\UpdateCalendarEventRequest;
use App\Http\Resources\CalendarEventResource;
use App\Models\CalendarEvent;

class CalendarEventController extends Controller
{
    public function index()
    {
        $events = CalendarEvent::with('creator')->orderBy('date')->get();

        return response()->json(['calendar_events' => CalendarEventResource::collection($events)]);
    }

    public function store(StoreCalendarEventRequest $request)
    {
        $event = CalendarEvent::create([
            ...$request->validated(),
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['calendar_event' => new CalendarEventResource($event->load('creator'))], 201);
    }

    public function update(UpdateCalendarEventRequest $request, CalendarEvent $calendarEvent)
    {
        $calendarEvent->update($request->validated());

        return response()->json(['calendar_event' => new CalendarEventResource($calendarEvent->load('creator'))]);
    }

    public function destroy(CalendarEvent $calendarEvent)
    {
        $calendarEvent->delete();

        return response()->noContent();
    }
}
