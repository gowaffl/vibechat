-- ============================================================================
-- SEED COMMUNITY WORKFLOWS
-- ============================================================================
-- This migration seeds the community_workflow table with 5 creative, useful,
-- and functional AI workflow examples to inspire users.
-- Created: 2024-12-24
-- ============================================================================

-- First, we need to get a valid user ID to use as the creator
-- We'll use a placeholder that should be updated with an actual system/admin user ID
DO $$
DECLARE
  system_user_id text;
BEGIN
  -- Try to get the first user in the system, or create a placeholder
  SELECT id INTO system_user_id FROM public.user LIMIT 1;
  
  -- If no users exist yet, we'll skip seeding (this will run when first user signs up)
  IF system_user_id IS NOT NULL THEN
    
    -- 1. Meeting Summarizer - Automatically summarizes long conversations
    INSERT INTO public.community_workflow (
      id,
      "creatorUserId",
      name,
      description,
      "triggerType",
      "triggerConfig",
      "actionType",
      "actionConfig",
      category,
      tags,
      "cloneCount",
      "isPublic",
      "isFeatured",
      "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      system_user_id,
      '📝 Meeting Summarizer',
      'Automatically generates a concise summary when someone asks "Can you summarize this conversation?" Perfect for catching up on long group discussions.',
      'keyword',
      '{"keywords": ["summarize", "summary", "recap", "tldr"], "caseSensitive": false}'::jsonb,
      'summarize',
      '{"includeKeyPoints": true, "maxLength": 500}'::jsonb,
      'productivity',
      ARRAY['productivity', 'meetings', 'summary', 'automation'],
      0,
      true,
      true,
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- 2. Daily Standup Reminder - Sends standup reminder every weekday morning
    INSERT INTO public.community_workflow (
      id,
      "creatorUserId",
      name,
      description,
      "triggerType",
      "triggerConfig",
      "actionType",
      "actionConfig",
      category,
      tags,
      "cloneCount",
      "isPublic",
      "isFeatured",
      "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      system_user_id,
      '☀️ Daily Standup Reminder',
      'Sends a friendly reminder every weekday at 9 AM to share your daily standup updates. Keeps the team aligned and productive!',
      'time_based',
      '{"schedule": "0 9 * * 1-5", "timezone": "America/Los_Angeles"}'::jsonb,
      'send_message',
      '{"message": "Good morning team! 🌅 Time for daily standup:\n\n✅ What did you accomplish yesterday?\n🎯 What are you working on today?\n🚧 Any blockers?\n\nDrop your updates below! 👇"}'::jsonb,
      'productivity',
      ARRAY['standup', 'team', 'reminder', 'daily'],
      0,
      true,
      true,
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- 3. Birthday Event Creator - Creates events when someone mentions a birthday
    INSERT INTO public.community_workflow (
      id,
      "creatorUserId",
      name,
      description,
      "triggerType",
      "triggerConfig",
      "actionType",
      "actionConfig",
      category,
      tags,
      "cloneCount",
      "isPublic",
      "isFeatured",
      "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      system_user_id,
      '🎂 Birthday Event Creator',
      'Automatically creates a calendar event when someone mentions a birthday. Never forget to celebrate your friends and teammates!',
      'message_pattern',
      '{"pattern": "birthday|bday|b-day", "flags": "i"}'::jsonb,
      'create_event',
      '{"title": "🎉 Birthday Celebration", "duration": 60, "description": "Time to celebrate!"}'::jsonb,
      'entertainment',
      ARRAY['birthday', 'celebration', 'events', 'social'],
      0,
      true,
      true,
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- 4. Quick Poll Creator - Creates polls when AI is mentioned with poll keywords
    INSERT INTO public.community_workflow (
      id,
      "creatorUserId",
      name,
      description,
      "triggerType",
      "triggerConfig",
      "actionType",
      "actionConfig",
      category,
      tags,
      "cloneCount",
      "isPublic",
      "isFeatured",
      "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      system_user_id,
      '📊 Quick Poll Creator',
      'Mention the AI with "create poll" or "make a poll" and it will instantly create an interactive poll for the group. Great for quick decisions!',
      'ai_mention',
      '{"keywords": ["create poll", "make a poll", "start a poll", "new poll"], "requiresKeyword": true}'::jsonb,
      'create_poll',
      '{"defaultOptions": ["Option 1", "Option 2", "Option 3"], "allowMultipleVotes": false}'::jsonb,
      'utility',
      ARRAY['poll', 'voting', 'decision', 'group'],
      0,
      true,
      true,
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- 5. Weekend Plans Reminder - Sends a fun reminder on Friday afternoons
    INSERT INTO public.community_workflow (
      id,
      "creatorUserId",
      name,
      description,
      "triggerType",
      "triggerConfig",
      "actionType",
      "actionConfig",
      category,
      tags,
      "cloneCount",
      "isPublic",
      "isFeatured",
      "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      system_user_id,
      '🎉 Weekend Plans Reminder',
      'Every Friday at 3 PM, reminds the group to share weekend plans. Perfect for friend groups and teams to stay connected!',
      'time_based',
      '{"schedule": "0 15 * * 5", "timezone": "America/Los_Angeles"}'::jsonb,
      'send_message',
      '{"message": "Happy Friday! 🎊\n\nWeekend is almost here! What are your plans? 🌴\n\nShare below and maybe find someone to hang out with! 👋"}'::jsonb,
      'entertainment',
      ARRAY['weekend', 'social', 'fun', 'friday'],
      0,
      true,
      true,
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

  END IF;
END $$;

-- Create an index on tags for better search performance
CREATE INDEX IF NOT EXISTS community_workflow_tags_idx ON public.community_workflow USING gin(tags);

-- Add a comment explaining the seed data
COMMENT ON TABLE public.community_workflow IS 'Community-shared AI workflows. Seeded with 5 featured examples to inspire users.';

