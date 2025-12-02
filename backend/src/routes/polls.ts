import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import {
  createPollRequestSchema,
  getPollsRequestSchema,
  getPollRequestSchema,
  votePollRequestSchema,
  deletePollRequestSchema,
  closePollRequestSchema,
} from "@shared/contracts";

const polls = new Hono();

// Helper function to get poll with options and votes
async function getPollWithDetails(pollId: string) {
  const { data: poll, error: pollError } = await db
    .from("poll")
    .select("*")
    .eq("id", pollId)
    .single();

  if (pollError || !poll) {
    return null;
  }

  // Get options
  const { data: options = [] } = await db
    .from("poll_option")
    .select("*")
    .eq("pollId", pollId)
    .order("sortOrder", { ascending: true });

  // Get votes
  const { data: votes = [] } = await db
    .from("poll_vote")
    .select("*")
    .eq("pollId", pollId);

  // Get member count for the chat
  const { count: memberCount } = await db
    .from("chat_member")
    .select("*", { count: "exact", head: true })
    .eq("chatId", poll.chatId);

  // Calculate vote counts per option
  const optionsWithCounts = options.map((opt: any) => ({
    id: opt.id,
    pollId: opt.pollId,
    optionText: opt.optionText,
    sortOrder: opt.sortOrder,
    voteCount: votes.filter((v: any) => v.optionId === opt.id).length,
    createdAt: new Date(opt.createdAt).toISOString(),
  }));

  return {
    id: poll.id,
    chatId: poll.chatId,
    creatorId: poll.creatorId,
    question: poll.question,
    status: poll.status as "open" | "closed",
    createdAt: new Date(poll.createdAt).toISOString(),
    closedAt: poll.closedAt ? new Date(poll.closedAt).toISOString() : null,
    options: optionsWithCounts,
    votes: votes.map((v: any) => ({
      id: v.id,
      pollId: v.pollId,
      optionId: v.optionId,
      userId: v.userId,
      createdAt: new Date(v.createdAt).toISOString(),
    })),
    totalVotes: votes.length,
    memberCount: memberCount || 0,
  };
}

// Helper function to create poll results message
async function createPollResultsMessage(poll: any, chatId: string) {
  // Get creator name
  const { data: creator } = await db
    .from("user")
    .select("name")
    .eq("id", poll.creatorId)
    .single();

  // Calculate results
  const totalVotes = poll.totalVotes || 0;
  const sortedOptions = [...poll.options].sort((a: any, b: any) => b.voteCount - a.voteCount);
  const winner = sortedOptions[0];
  
  // Build results text
  let resultsText = `📊 Poll Results: "${poll.question}"\n\n`;
  resultsText += `🏆 Winner: ${winner?.optionText || "No votes"}\n\n`;
  
  sortedOptions.forEach((opt: any, index: number) => {
    const percentage = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "•";
    resultsText += `${medal} ${opt.optionText}: ${opt.voteCount} vote${opt.voteCount !== 1 ? "s" : ""} (${percentage}%)\n`;
  });
  
  resultsText += `\n✅ All ${totalVotes} member${totalVotes !== 1 ? "s" : ""} voted!`;

  // Create system message with poll results
  await db
    .from("message")
    .insert({
      content: resultsText,
      messageType: "system",
      userId: poll.creatorId,
      chatId,
      pollId: poll.id,
    });
}

// POST /api/polls - Create poll
polls.post("/", zValidator("json", createPollRequestSchema), async (c) => {
  try {
    const { chatId, creatorId, question, options } = c.req.valid("json");
    console.log("[POST /api/polls] Received request:", { chatId, creatorId, question, optionCount: options.length });

    // Verify user is a member of the chat
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", creatorId)
      .single();

    if (membershipError || !membership) {
      console.log("[POST /api/polls] User not authorized:", { chatId, creatorId });
      return c.json({ error: "User not authorized" }, 403);
    }

    // Create poll
    const { data: poll, error: pollError } = await db
      .from("poll")
      .insert({
        chatId,
        creatorId,
        question,
        status: "open",
      })
      .select("*")
      .single();

    if (pollError || !poll) {
      console.error("[POST /api/polls] Error creating poll:", pollError);
      return c.json({ error: "Failed to create poll" }, 500);
    }

    // Create poll options
    const optionsToInsert = options.map((optionText: string, index: number) => ({
      pollId: poll.id,
      optionText,
      sortOrder: index,
    }));

    const { error: optionsError } = await db
      .from("poll_option")
      .insert(optionsToInsert);

    if (optionsError) {
      console.error("[POST /api/polls] Error creating poll options:", optionsError);
      // Rollback poll creation
      await db.from("poll").delete().eq("id", poll.id);
      return c.json({ error: "Failed to create poll options" }, 500);
    }

    // Create system message for poll notification
    try {
      const { data: creator } = await db
        .from("user")
        .select("name")
        .eq("id", creatorId)
        .single();

      await db
        .from("message")
        .insert({
          content: `📊 ${creator?.name || "Someone"} created a poll: "${question}"`,
          messageType: "system",
          userId: creatorId,
          chatId,
          pollId: poll.id,
        });
      console.log("[POST /api/polls] Created system message for poll notification");
    } catch (messageError) {
      console.error("[POST /api/polls] Failed to create system message:", messageError);
    }

    // Return complete poll
    const completePoll = await getPollWithDetails(poll.id);
    console.log("[POST /api/polls] Returning poll:", completePoll);
    return c.json(completePoll, 201);
  } catch (error) {
    console.error("[POST /api/polls] Error creating poll:", error);
    return c.json({ error: "Failed to create poll" }, 500);
  }
});

// GET /api/polls/:chatId - Get all polls for a chat
polls.get("/:chatId", zValidator("query", getPollsRequestSchema), async (c) => {
  try {
    const chatId = c.req.param("chatId");
    const { userId } = c.req.valid("query");

    // Verify user is a member of the chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "User not authorized" }, 403);
    }

    // Get all polls for the chat
    const { data: pollsData = [] } = await db
      .from("poll")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false });

    // Get details for each poll
    const pollsWithDetails = await Promise.all(
      pollsData.map((poll: any) => getPollWithDetails(poll.id))
    );

    return c.json(pollsWithDetails.filter(Boolean));
  } catch (error) {
    console.error("[GET /api/polls/:chatId] Error:", error);
    return c.json({ error: "Failed to get polls" }, 500);
  }
});

// GET /api/polls/:chatId/:pollId - Get a specific poll
polls.get("/:chatId/:pollId", zValidator("query", getPollRequestSchema), async (c) => {
  try {
    const { chatId, pollId } = c.req.param();
    const { userId } = c.req.valid("query");

    // Verify user is a member of the chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "User not authorized" }, 403);
    }

    const poll = await getPollWithDetails(pollId);
    if (!poll) {
      return c.json({ error: "Poll not found" }, 404);
    }

    return c.json(poll);
  } catch (error) {
    console.error("[GET /api/polls/:chatId/:pollId] Error:", error);
    return c.json({ error: "Failed to get poll" }, 500);
  }
});

// POST /api/polls/:pollId/vote - Vote on a poll
polls.post("/:pollId/vote", zValidator("json", votePollRequestSchema), async (c) => {
  try {
    const pollId = c.req.param("pollId");
    const { userId, optionId } = c.req.valid("json");

    // Get poll
    const { data: poll, error: pollError } = await db
      .from("poll")
      .select("*")
      .eq("id", pollId)
      .single();

    if (pollError || !poll) {
      return c.json({ error: "Poll not found" }, 404);
    }

    if (poll.status === "closed") {
      return c.json({ error: "Poll is closed" }, 400);
    }

    // Verify user is a member of the chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", poll.chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "User not authorized" }, 403);
    }

    // Verify option exists and belongs to this poll
    const { data: option } = await db
      .from("poll_option")
      .select("*")
      .eq("id", optionId)
      .eq("pollId", pollId)
      .single();

    if (!option) {
      return c.json({ error: "Invalid option" }, 400);
    }

    // Check if user already voted - if so, update their vote
    const { data: existingVote } = await db
      .from("poll_vote")
      .select("*")
      .eq("pollId", pollId)
      .eq("userId", userId)
      .single();

    let vote;
    if (existingVote) {
      // Update existing vote
      const { data: updatedVote, error: updateError } = await db
        .from("poll_vote")
        .update({ optionId })
        .eq("id", existingVote.id)
        .select("*")
        .single();

      if (updateError) {
        console.error("[POST /api/polls/:pollId/vote] Error updating vote:", updateError);
        return c.json({ error: "Failed to update vote" }, 500);
      }
      vote = updatedVote;
    } else {
      // Create new vote
      const { data: newVote, error: voteError } = await db
        .from("poll_vote")
        .insert({
          pollId,
          optionId,
          userId,
        })
        .select("*")
        .single();

      if (voteError) {
        console.error("[POST /api/polls/:pollId/vote] Error creating vote:", voteError);
        return c.json({ error: "Failed to create vote" }, 500);
      }
      vote = newVote;
    }

    // Get updated poll details
    const updatedPoll = await getPollWithDetails(pollId);
    if (!updatedPoll) {
      return c.json({ error: "Failed to get updated poll" }, 500);
    }

    // Check if all members have voted
    const allVoted = updatedPoll.totalVotes >= updatedPoll.memberCount;

    // If all voted, close the poll and create results message
    if (allVoted && updatedPoll.status === "open") {
      await db
        .from("poll")
        .update({ status: "closed", closedAt: new Date().toISOString() })
        .eq("id", pollId);

      updatedPoll.status = "closed";
      updatedPoll.closedAt = new Date().toISOString();

      // Create poll results message
      await createPollResultsMessage(updatedPoll, poll.chatId);
      console.log("[POST /api/polls/:pollId/vote] All members voted, poll closed and results posted");
    }

    return c.json({
      success: true,
      vote: {
        id: vote.id,
        pollId: vote.pollId,
        optionId: vote.optionId,
        userId: vote.userId,
        createdAt: new Date(vote.createdAt).toISOString(),
      },
      poll: updatedPoll,
      allVoted,
    });
  } catch (error) {
    console.error("[POST /api/polls/:pollId/vote] Error:", error);
    return c.json({ error: "Failed to vote" }, 500);
  }
});

// DELETE /api/polls/:pollId - Delete poll (creator only)
polls.delete("/:pollId", zValidator("json", deletePollRequestSchema), async (c) => {
  try {
    const pollId = c.req.param("pollId");
    const { userId } = c.req.valid("json");

    // Get poll
    const { data: poll, error: pollError } = await db
      .from("poll")
      .select("*")
      .eq("id", pollId)
      .single();

    if (pollError || !poll) {
      return c.json({ error: "Poll not found" }, 404);
    }

    // Verify user is the creator
    if (poll.creatorId !== userId) {
      return c.json({ error: "Only the poll creator can delete it" }, 403);
    }

    // Delete poll (cascades to options and votes)
    const { error: deleteError } = await db
      .from("poll")
      .delete()
      .eq("id", pollId);

    if (deleteError) {
      console.error("[DELETE /api/polls/:pollId] Error:", deleteError);
      return c.json({ error: "Failed to delete poll" }, 500);
    }

    return c.json({ success: true, message: "Poll deleted successfully" });
  } catch (error) {
    console.error("[DELETE /api/polls/:pollId] Error:", error);
    return c.json({ error: "Failed to delete poll" }, 500);
  }
});

// PATCH /api/polls/:pollId/close - Close poll manually (creator only)
polls.patch("/:pollId/close", zValidator("json", closePollRequestSchema), async (c) => {
  try {
    const pollId = c.req.param("pollId");
    const { userId } = c.req.valid("json");

    // Get poll
    const { data: poll, error: pollError } = await db
      .from("poll")
      .select("*")
      .eq("id", pollId)
      .single();

    if (pollError || !poll) {
      return c.json({ error: "Poll not found" }, 404);
    }

    // Verify user is the creator
    if (poll.creatorId !== userId) {
      return c.json({ error: "Only the poll creator can close it" }, 403);
    }

    if (poll.status === "closed") {
      return c.json({ error: "Poll is already closed" }, 400);
    }

    // Close the poll
    await db
      .from("poll")
      .update({ status: "closed", closedAt: new Date().toISOString() })
      .eq("id", pollId);

    // Get updated poll and create results message
    const updatedPoll = await getPollWithDetails(pollId);
    if (updatedPoll) {
      await createPollResultsMessage(updatedPoll, poll.chatId);
    }

    return c.json(updatedPoll);
  } catch (error) {
    console.error("[PATCH /api/polls/:pollId/close] Error:", error);
    return c.json({ error: "Failed to close poll" }, 500);
  }
});

export default polls;

