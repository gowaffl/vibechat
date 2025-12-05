import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, executeWithRetry } from "../db";
import {
  createEventRequestSchema,
  getEventsRequestSchema,
  voteEventOptionRequestSchema,
  rsvpEventRequestSchema,
  updateEventRequestSchema,
  exportEventRequestSchema,
  deleteEventRequestSchema,
} from "@shared/contracts";

const events = new Hono();

// POST /api/events - Create event
events.post("/", zValidator("json", createEventRequestSchema), async (c) => {
  try {
    const { chatId, creatorId, title, description, eventType, eventDate, timezone, options } = c.req.valid("json");
    console.log("[POST /api/events] Received request:", { chatId, creatorId, title, description, eventType, eventDate, timezone, options });

    // Verify user is a member of the chat (with retry logic)
    const { data: membership, error: membershipError } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", chatId)
        .eq("userId", creatorId)
        .single();
    });

    if (membershipError || !membership) {
      console.log("[POST /api/events] User not authorized:", { chatId, creatorId });
      return c.json({ error: "User not authorized" }, 403);
    }
    console.log("[POST /api/events] User authorized, creating event...");

    // Create event
    const { data: event, error: eventError } = await db
      .from("event")
      .insert({
        chatId,
        createdBy: creatorId,
        title,
        description,
        eventType,
        eventDate: eventDate ? new Date(eventDate).toISOString() : null,
        timezone: timezone || null,
        status: "planning",
      })
      .select("*")
      .single();

    if (eventError || !event) {
      console.error("[POST /api/events] Error creating event:", eventError);
      return c.json({ error: "Failed to create event" }, 500);
    }

    // Create event options if provided
    if (options && options.length > 0) {
      await db
        .from("event_option")
        .insert(
          options.map((opt: any) => ({
            eventId: event.id,
            optionType: opt.optionType,
            value: opt.optionValue,
          }))
        );
    }

    // Fetch complete event with options and responses
    const { data: eventOptions = [] } = await db
      .from("event_option")
      .select("*")
      .eq("eventId", event.id);

    const { data: eventResponses = [] } = await db
      .from("event_response")
      .select("*")
      .eq("eventId", event.id);

    const completeEvent = {
      ...event,
      options: eventOptions,
      responses: eventResponses,
    };

    // Create a system message in the chat to notify about the new event
    try {
      const { data: creator } = await db
        .from("user")
        .select("name")
        .eq("id", creatorId)
        .single();

      await db
        .from("message")
        .insert({
          content: `${creator?.name || "Someone"} created a new event: ${title}`,
          messageType: "system",
          userId: creatorId,
          chatId,
          eventId: event.id,
        });
      console.log("[POST /api/events] Created system message for event notification");
    } catch (messageError) {
      console.error("[POST /api/events] Failed to create system message:", messageError);
      // Continue even if message creation fails
    }

    // Transform to match contract schema
    const transformedEvent = {
      ...completeEvent,
      creatorId: completeEvent.createdBy,
      eventDate: completeEvent.eventDate || null,
      timezone: completeEvent.timezone || null,
      finalizedDate: completeEvent.finalizedAt ? new Date(completeEvent.finalizedAt).toISOString() : null,
      status: mapDbStatusToContract(completeEvent.status),
      createdAt: new Date(completeEvent.createdAt).toISOString(),
      updatedAt: new Date(completeEvent.updatedAt).toISOString(),
      options: completeEvent.options.map((opt: any) => ({
        id: opt.id,
        eventId: opt.eventId,
        optionType: opt.optionType,
        optionValue: opt.value,
        votes: opt.voteCount,
        createdAt: new Date(opt.createdAt).toISOString(),
      })),
      responses: completeEvent.responses.map((resp: any) => ({
        id: resp.id,
        eventId: resp.eventId,
        userId: resp.userId,
        optionId: resp.optionId,
        responseType: resp.responseType,
        createdAt: new Date(resp.createdAt).toISOString(),
        updatedAt: new Date(resp.updatedAt).toISOString(),
      })),
    };

    console.log("[POST /api/events] Returning transformed event:", transformedEvent);
    return c.json(transformedEvent, 201);
  } catch (error) {
    console.error("[POST /api/events] Error creating event:", error);
    return c.json({ error: "Failed to create event" }, 500);
  }
});

// Helper function to map Prisma status to contract status
function mapDbStatusToContract(dbStatus: string): "proposed" | "voting" | "confirmed" | "cancelled" {
  switch (dbStatus) {
    case "planning":
      return "proposed";
    case "finalized":
      return "confirmed";
    case "cancelled":
      return "cancelled";
    default:
      return "proposed";
  }
}

// Helper function to map contract status to DB status
function mapContractStatusToDb(contractStatus: string): "planning" | "finalized" | "cancelled" {
  switch (contractStatus) {
    case "proposed":
    case "voting":
      return "planning";
    case "confirmed":
      return "finalized";
    case "cancelled":
      return "cancelled";
    default:
      return "planning";
  }
}

// GET /api/events/:chatId - Get all events for a chat
events.get("/:chatId", zValidator("query", getEventsRequestSchema), async (c) => {
  try {
    const { chatId } = c.req.param();
    const { userId } = c.req.valid("query");
    console.log("[GET /api/events/:chatId] Received request:", { chatId, userId });

    // Verify user is a member of the chat (with retry logic)
    const { data: membership, error: membershipError } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", chatId)
        .eq("userId", userId)
        .single();
    });

    if (membershipError || !membership) {
      console.log("[GET /api/events/:chatId] User not authorized:", { chatId, userId });
      return c.json({ error: "User not authorized" }, 403);
    }

    // Get all events for the chat
    const { data: events = [], error: eventsError } = await db
      .from("event")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false });

    if (eventsError) {
      console.error("[GET /api/events/:chatId] Error fetching events:", eventsError);
      return c.json({ error: "Failed to fetch events" }, 500);
    }

    console.log("[GET /api/events/:chatId] Found events:", events.length);

    // Fetch options and responses for all events
    const eventIds = events.map((e: any) => e.id);
    const { data: allOptions = [] } = eventIds.length > 0 ? await db
      .from("event_option")
      .select("*")
      .in("eventId", eventIds) : { data: [] };

    const { data: allResponses = [] } = eventIds.length > 0 ? await db
      .from("event_response")
      .select("*")
      .in("eventId", eventIds) : { data: [] };

    // Group by event ID
    const optionsByEvent = new Map();
    allOptions.forEach((opt: any) => {
      if (!optionsByEvent.has(opt.eventId)) {
        optionsByEvent.set(opt.eventId, []);
      }
      optionsByEvent.get(opt.eventId).push(opt);
    });

    const responsesByEvent = new Map();
    allResponses.forEach((resp: any) => {
      if (!responsesByEvent.has(resp.eventId)) {
        responsesByEvent.set(resp.eventId, []);
      }
      responsesByEvent.get(resp.eventId).push(resp);
    });

    // Transform events to match contract schema
    const transformedEvents = events.map((event: any) => {
      const eventOptions = optionsByEvent.get(event.id) || [];
      const eventResponses = responsesByEvent.get(event.id) || [];

      return {
        ...event,
        creatorId: event.createdBy,
        eventDate: event.eventDate || null,
        timezone: event.timezone || null,
        finalizedDate: event.finalizedAt ? new Date(event.finalizedAt).toISOString() : null,
        status: mapDbStatusToContract(event.status),
        createdAt: new Date(event.createdAt).toISOString(),
        updatedAt: new Date(event.updatedAt).toISOString(),
        options: eventOptions.map((opt: any) => ({
          id: opt.id,
          eventId: opt.eventId,
          optionType: opt.optionType,
          optionValue: opt.value,
          votes: opt.voteCount,
          createdAt: new Date(opt.createdAt).toISOString(),
        })),
        responses: eventResponses.map((resp: any) => ({
          id: resp.id,
          eventId: resp.eventId,
          userId: resp.userId,
          optionId: resp.optionId,
          responseType: resp.responseType,
          createdAt: new Date(resp.createdAt).toISOString(),
          updatedAt: new Date(resp.updatedAt).toISOString(),
        })),
      };
    });

    console.log("[GET /api/events/:chatId] Returning transformed events:", transformedEvents.map(e => ({ id: e.id, title: e.title })));
    return c.json(transformedEvents);
  } catch (error) {
    console.error("[GET /api/events/:chatId] Error fetching events:", error);
    return c.json({ error: "Failed to fetch events" }, 500);
  }
});

// POST /api/events/:eventId/vote - Vote on event option
events.post("/:eventId/vote", zValidator("json", voteEventOptionRequestSchema), async (c) => {
  try {
    const { eventId } = c.req.param();
    const { userId, optionId } = c.req.valid("json");

    // Verify event exists
    const { data: event, error: eventError } = await db
      .from("event")
      .select("chatId")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Verify user has access (is member of chat, with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", event.chatId)
        .eq("userId", userId)
        .single();
    });

    if (!membership) {
      return c.json({ error: "User not authorized" }, 403);
    }

    // Verify option exists
    const { data: option, error: optionError } = await db
      .from("event_option")
      .select("*")
      .eq("id", optionId)
      .single();

    if (optionError || !option || option.eventId !== eventId) {
      return c.json({ error: "Invalid option" }, 400);
    }

    // Check if user already voted for this option
    const { data: existingVote } = await db
      .from("event_response")
      .select("*")
      .eq("eventId", eventId)
      .eq("userId", userId)
      .eq("optionId", optionId)
      .single();

    if (existingVote) {
      return c.json({ error: "User already voted for this option" }, 400);
    }

    // Find previous votes by this user for options of the SAME TYPE
    const { data: allOptions = [] } = await db
      .from("event_option")
      .select("*")
      .eq("eventId", eventId)
      .eq("optionType", option.optionType);

    const optionIds = allOptions.map((o: any) => o.id);
    const { data: previousVotes = [] } = optionIds.length > 0 ? await db
      .from("event_response")
      .select("*")
      .eq("userId", userId)
      .in("optionId", optionIds) : { data: [] };

    // Remove previous votes from this user for options of the same type
    if (previousVotes.length > 0) {
      const previousOptionIds = previousVotes.map((v: any) => v.optionId);

      await db
        .from("event_response")
        .delete()
        .eq("userId", userId)
        .in("optionId", previousOptionIds);

      // Decrement vote counts for the options the user previously voted on
      for (const prevVote of previousVotes) {
        const prevOption = allOptions.find((o: any) => o.id === prevVote.optionId);
        if (prevOption) {
          await db
            .from("event_option")
            .update({ voteCount: Math.max(0, prevOption.voteCount - 1) })
            .eq("id", prevOption.id);
        }
      }
    }

    // Add new vote
    await db
      .from("event_response")
      .insert({
        eventId,
        userId,
        optionId,
        responseType: "yes",
      });

    // Increment vote count
    const { data: updatedOption, error: updateError } = await db
      .from("event_option")
      .update({ voteCount: (option.voteCount || 0) + 1 })
      .eq("id", optionId)
      .select("*")
      .single();

    if (updateError || !updatedOption) {
      console.error("Error updating vote count:", updateError);
      return c.json({ error: "Failed to update vote count" }, 500);
    }

    return c.json(updatedOption);
  } catch (error) {
    console.error("Error voting on event option:", error);
    return c.json({ error: "Failed to vote" }, 500);
  }
});

// POST /api/events/:eventId/rsvp - RSVP to event
events.post("/:eventId/rsvp", zValidator("json", rsvpEventRequestSchema), async (c) => {
  try {
    const { eventId } = c.req.param();
    const { userId, responseType, optionId } = c.req.valid("json");

    // Verify event exists
    const { data: event, error: eventError } = await db
      .from("event")
      .select("chatId")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Verify user has access (with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", event.chatId)
        .eq("userId", userId)
        .single();
    });

    if (!membership) {
      return c.json({ error: "User not authorized" }, 403);
    }

    // Check if user already has an RSVP
    const { data: existingRsvp } = await db
      .from("event_response")
      .select("*")
      .eq("eventId", eventId)
      .eq("userId", userId)
      .is("optionId", null)
      .single();

    if (existingRsvp) {
      // Update existing RSVP
      const { data: updated, error: updateError } = await db
        .from("event_response")
        .update({ responseType })
        .eq("id", existingRsvp.id)
        .select("*")
        .single();

      if (updateError || !updated) {
        console.error("Error updating RSVP:", updateError);
        return c.json({ error: "Failed to update RSVP" }, 500);
      }
      return c.json(updated);
    }

    // Create new RSVP
    const { data: rsvp, error: rsvpError } = await db
      .from("event_response")
      .insert({
        eventId,
        userId,
        responseType,
        optionId,
      })
      .select("*")
      .single();

    if (rsvpError || !rsvp) {
      console.error("Error creating RSVP:", rsvpError);
      return c.json({ error: "Failed to create RSVP" }, 500);
    }

    return c.json(rsvp, 201);
  } catch (error) {
    console.error("Error creating RSVP:", error);
    return c.json({ error: "Failed to RSVP" }, 500);
  }
});

// PATCH /api/events/:eventId - Update event
events.patch("/:eventId", zValidator("json", updateEventRequestSchema), async (c) => {
  try {
    const { eventId } = c.req.param();
    const { userId, ...updates } = c.req.valid("json");

    // Get event and verify ownership
    const { data: event, error: eventError } = await db
      .from("event")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return c.json({ error: "Event not found" }, 404);
    }

    if (event.createdBy !== userId) {
      console.log("[PATCH /api/events/:eventId] Authorization check:", { 
        creatorId: event.createdBy, 
        requestUserId: userId, 
        isMatch: event.createdBy === userId 
      });
      
      return c.json({ error: "Only event creator can update" }, 403);
    }

    // Update event
    const updateData: any = { ...updates };
    
    // Convert eventDate string to Date object if provided
    if (updates.eventDate !== undefined) {
      updateData.eventDate = updates.eventDate ? new Date(updates.eventDate).toISOString() : null;
    }
    
    // Handle timezone update
    if (updates.timezone !== undefined) {
      updateData.timezone = updates.timezone;
    }
    
    if (updates.status === "confirmed" || updates.status === "finalized") {
        updateData.status = "finalized"; 
        updateData.finalizedAt = new Date().toISOString();
    } else if (updates.status) {
        updateData.status = mapContractStatusToDb(updates.status);
    }

    const { data: updatedEvent, error: updateError } = await db
      .from("event")
      .update(updateData)
      .eq("id", eventId)
      .select("*")
      .single();

    if (updateError || !updatedEvent) {
      console.error("Error updating event:", updateError);
      return c.json({ error: "Failed to update event" }, 500);
    }

    // Fetch options and responses
    const { data: eventOptions = [] } = await db
      .from("event_option")
      .select("*")
      .eq("eventId", updatedEvent.id);

    const { data: eventResponses = [] } = await db
      .from("event_response")
      .select("*")
      .eq("eventId", updatedEvent.id);

    // Transform response
    const transformedEvent = {
      ...updatedEvent,
      creatorId: updatedEvent.createdBy,
      eventDate: updatedEvent.eventDate || null,
      timezone: updatedEvent.timezone || null,
      finalizedDate: updatedEvent.finalizedAt ? new Date(updatedEvent.finalizedAt).toISOString() : null,
      status: mapDbStatusToContract(updatedEvent.status),
      createdAt: new Date(updatedEvent.createdAt).toISOString(),
      updatedAt: new Date(updatedEvent.updatedAt).toISOString(),
      options: eventOptions.map((opt: any) => ({
        id: opt.id,
        eventId: opt.eventId,
        optionType: opt.optionType,
        optionValue: opt.value,
        votes: opt.voteCount,
        createdAt: new Date(opt.createdAt).toISOString(),
      })),
      responses: eventResponses.map((resp: any) => ({
        id: resp.id,
        eventId: resp.eventId,
        userId: resp.userId,
        optionId: resp.optionId,
        responseType: resp.responseType,
        createdAt: new Date(resp.createdAt).toISOString(),
        updatedAt: new Date(resp.updatedAt).toISOString(),
      })),
    };

    return c.json(transformedEvent);
  } catch (error) {
    console.error("Error updating event:", error);
    return c.json({ error: "Failed to update event" }, 500);
  }
});

// GET /api/events/:eventId/export - Export event to calendar
events.get("/:eventId/export", zValidator("query", exportEventRequestSchema), async (c) => {
  try {
    const { eventId } = c.req.param();
    const { userId, format } = c.req.valid("query");

    console.log("[Export Event] Request:", { eventId, userId, format });

    // Get event
    const { data: event, error: eventError } = await db
      .from("event")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      console.log("[Export Event] Event not found");
      return c.json({ error: "Event not found" }, 404);
    }

    // Verify user has access (with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", event.chatId)
        .eq("userId", userId)
        .single();
    });

    if (!membership) {
      console.log("[Export Event] Access denied");
      return c.json({ error: "User not authorized" }, 403);
    }

    // Get datetime options ordered by vote count
    const { data: options = [] } = await db
      .from("event_option")
      .select("*")
      .eq("eventId", eventId)
      .eq("optionType", "datetime")
      .order("voteCount", { ascending: false });

    console.log("[Export Event] Event found:", {
      eventId: event.id,
      title: event.title,
      status: event.status,
      finalizedAt: event.finalizedAt,
      optionsCount: options.length,
    });

    // Use finalized date or top-voted datetime option
    let eventDate: Date | null = null;
    if (event.finalizedAt) {
      eventDate = new Date(event.finalizedAt);
    } else if (options.length > 0) {
      // Try to parse the option value as a date
      try {
        eventDate = new Date(options[0].value);
      } catch (e) {
        console.error("Failed to parse event date from option:", options[0].value);
      }
    }

    if (!eventDate || isNaN(eventDate.getTime())) {
      console.log("[Export Event] No valid date found:", {
        finalizedAt: event.finalizedAt,
        topOption: options[0]?.value,
        eventId: event.id,
      });
      return c.json({ error: "Event date not available" }, 400);
    }

    // Generate ICS format
    const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000); // Add 1 hour
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//VibeChat//Event Calendar//EN",
      "BEGIN:VEVENT",
      `UID:${event.id}@vibechat.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${eventDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTEND:${endDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}` : "",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");

    console.log("[Export Event] ICS generated successfully, length:", icsContent.length);

    if (format === "ics") {
      return c.json({
        success: true,
        icsContent,
      });
    }

    // For Google/Outlook, return the ICS content for download
    return c.json({
      success: true,
      icsContent,
      downloadUrl: `/api/events/${eventId}/download`,
    });
  } catch (error) {
    console.error("[Export Event] Error:", error);
    return c.json({ error: "Failed to export event" }, 500);
  }
});

// DELETE /api/events/:eventId - Delete event
events.delete("/:eventId", zValidator("query", deleteEventRequestSchema), async (c) => {
  try {
    const eventId = c.req.param("eventId");
    const { userId } = c.req.valid("query");
    console.log("[DELETE /api/events/:eventId] Received request:", { eventId, userId });

    // Get the event to verify ownership
    const { data: event, error: eventError } = await db
      .from("event")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      console.log("[DELETE /api/events/:eventId] Event not found:", eventId);
      return c.json({ error: "Event not found" }, 404);
    }

    // Verify user is the creator of the event
    if (event.createdBy !== userId) {
      console.log("[DELETE /api/events/:eventId] User not authorized:", { userId, createdBy: event.createdBy });
      return c.json({ error: "Only the event creator can delete this event" }, 403);
    }

    // Delete associated event responses first (cascade)
    await db
      .from("event_response")
      .delete()
      .eq("eventId", eventId);
    console.log("[DELETE /api/events/:eventId] Deleted event responses");

    // Delete associated event options
    await db
      .from("event_option")
      .delete()
      .eq("eventId", eventId);
    console.log("[DELETE /api/events/:eventId] Deleted event options");

    // Delete the event
    const { error: deleteError } = await db
      .from("event")
      .delete()
      .eq("id", eventId);

    if (deleteError) {
      console.error("[DELETE /api/events/:eventId] Error deleting event:", deleteError);
      return c.json({ error: "Failed to delete event" }, 500);
    }
    console.log("[DELETE /api/events/:eventId] Deleted event successfully");

    return c.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    return c.json({ error: "Failed to delete event" }, 500);
  }
});

export default events;

