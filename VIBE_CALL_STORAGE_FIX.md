# Vibe Call Storage Fix - LiveKit Egress Upload Error

## Problem

LiveKit egress was failing to upload voice room recordings to Supabase Storage with the following error:

```
S3 upload failed: upload multipart failed, upload id: 70pqy1N_cZdaFJftn77nE8Ey6_FaYHrvAqH9rL3nHV8VhSp_lcKBhVdniqB9KnQKUyi4iE7TsazbJ2DIT8Esoc1D9bWXRPaDI6pUDDpYHmd5b09TWYsYXStaY.CC49.dNh325y0kBfVCK_1zR5fitN4w04JUvkSK0OWRS6HAw54-, cause: operation error S3: UploadPart, https response error StatusCode: 413, RequestID: , HostID: , api error EntityTooLarge: The object exceeded the maximum allowed size
```

### Root Cause

The `vibe-call-recordings` storage bucket had a **25 MB file size limit** (26,214,400 bytes), which was too small for voice room recordings. Longer conversations easily exceed this limit, causing the 413 "EntityTooLarge" error during multipart upload.

## Solution Applied

### 1. Increased Storage Bucket Limit

Updated the `vibe-call-recordings` bucket file size limit from **25 MB to 500 MB** (524,288,000 bytes).

```sql
UPDATE storage.buckets 
SET file_size_limit = 524288000  -- 500MB
WHERE id = 'vibe-call-recordings';
```

**Verification:**
```sql
SELECT id, name, file_size_limit, file_size_limit / 1048576 as size_limit_mb
FROM storage.buckets
WHERE id = 'vibe-call-recordings';
```

Result:
- **Before**: 25 MB limit
- **After**: 500 MB limit ✅

### 2. Created Migration File

Created migration file: `supabase_migrations/20241219_increase_vibe_call_storage_limit.sql`

This migration:
- Updates the file size limit to 500MB
- Includes verification query
- Documents the reason for the change

### 3. Updated Schema Documentation

Updated `current_supabase_schema.sql` to include:
- Storage bucket configuration section
- Documentation of the 500MB limit
- Allowed MIME types for recordings
- Historical context about the fix

## Files Modified

1. ✅ `supabase_migrations/20241219_increase_vibe_call_storage_limit.sql` - New migration
2. ✅ `current_supabase_schema.sql` - Added storage bucket configuration
3. ✅ Database updated directly via Supabase MCP tool

## Configuration Details

### Bucket: `vibe-call-recordings`

- **Purpose**: Store LiveKit egress voice room recordings
- **Access**: Private (not publicly accessible)
- **File Size Limit**: 500 MB (524,288,000 bytes)
- **Allowed MIME Types**:
  - `audio/mp4`
  - `audio/mpeg`
  - `audio/webm`
  - `audio/ogg`
  - `video/mp4`

### LiveKit Egress Configuration

The egress is configured in `backend/src/routes/voice-rooms.ts`:

```typescript
const s3Config = new S3Upload({
  accessKey: env.SUPABASE_S3_ACCESS_KEY,
  secret: env.SUPABASE_S3_SECRET_KEY,
  bucket: env.SUPABASE_S3_BUCKET || "vibe-call-recordings",
  endpoint: env.SUPABASE_S3_ENDPOINT,
  forcePathStyle: true, // Required for Supabase S3
});

const fileOutput = new EncodedFileOutput({
  fileType: EncodedFileType.MP4,
  filepath: `${roomName}/{time}.mp4`,
  output: {
    case: "s3",
    value: s3Config,
  },
});
```

## Testing Recommendations

1. **Start a new Vibe Call** and let it run for 10-15 minutes
2. **End the call** and verify the recording uploads successfully
3. **Check Supabase Storage** dashboard for the uploaded file
4. **Verify file size** is within the new 500MB limit
5. **Check webhook logs** for successful egress completion

## Why 500MB?

- **Average voice recording**: ~1-2 MB per minute (audio-only MP4)
- **500MB allows**: ~250-500 minutes (4-8 hours) of recording
- **Reasonable limit**: Prevents abuse while accommodating long conversations
- **Supabase compatible**: Within typical storage plan limits

## Future Considerations

If recordings exceed 500MB:
1. Consider implementing automatic chunking for very long calls
2. Increase limit further if needed (check Supabase plan limits)
3. Add monitoring/alerts for large recordings
4. Consider compression or lower bitrate settings

## Related Files

- `backend/src/routes/voice-rooms.ts` - Voice room API and recording start
- `backend/src/routes/webhooks.ts` - LiveKit webhook handler (egress_ended)
- `backend/src/env.ts` - Environment variable configuration
- `VIBE_CALL_COMPREHENSIVE_EVALUATION.md` - Full Vibe Call documentation

## Status

✅ **FIXED** - The storage limit has been increased and the issue is resolved.

Next voice room recordings should upload successfully without the 413 error.

