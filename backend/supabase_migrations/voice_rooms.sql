-- Voice Rooms Table
CREATE TABLE IF NOT EXISTS public.voice_room (
    "id" text NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "chatId" text NOT NULL,
    "name" text,
    "createdBy" text NOT NULL,
    "isActive" boolean DEFAULT true,
    "startedAt" timestamp without time zone DEFAULT now(),
    "endedAt" timestamp without time zone,
    "liveKitRoomId" text,
    "recordingUrl" text,
    "transcription" text,
    "summary" text,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("chatId") REFERENCES public.chat("id") ON DELETE CASCADE,
    FOREIGN KEY ("createdBy") REFERENCES public.user("id")
);

-- Voice Participants Table
CREATE TABLE IF NOT EXISTS public.voice_participant (
    "id" text NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "voiceRoomId" text NOT NULL,
    "userId" text NOT NULL,
    "joinedAt" timestamp without time zone DEFAULT now(),
    "leftAt" timestamp without time zone,
    "role" text DEFAULT 'speaker',
    "isMuted" boolean DEFAULT false,
    "createdAt" timestamp without time zone DEFAULT now(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("voiceRoomId") REFERENCES public.voice_room("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES public.user("id")
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_room_chatId ON public.voice_room("chatId");
CREATE INDEX IF NOT EXISTS idx_voice_room_isActive ON public.voice_room("isActive");
CREATE INDEX IF NOT EXISTS idx_voice_participant_voiceRoomId ON public.voice_participant("voiceRoomId");
CREATE INDEX IF NOT EXISTS idx_voice_participant_userId ON public.voice_participant("userId");

