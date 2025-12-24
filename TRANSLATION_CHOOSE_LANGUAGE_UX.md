# Translation "Choose Language" UX Improvement

## Problem

Previously, when users toggled translation ON, it would immediately start translating messages to the first available language (or user's default language) even before they had a chance to select their desired language.

This could result in:
- Messages being translated to the wrong language
- Unnecessary API calls for unwanted translations
- Poor user experience (translations appearing in a language they didn't want)

## Solution

Implemented a **"Choose Language" state** where translation is enabled but paused until the user explicitly selects their desired language.

## Changes Made

### 1. **TranslationToggle Component** (`src/components/AINative/TranslationToggle.tsx`)

**Added Language Selection Check**:
```typescript
const hasLanguageSelected = selectedLanguage && selectedLanguage !== "";
```

**Auto-Open Language Picker**:
When toggle is turned ON and no language is selected, automatically show the language picker:

```typescript
const handleToggle = () => {
  const newEnabled = !enabled;
  onToggle(newEnabled);
  
  // If turning on and no language selected, automatically show picker
  if (newEnabled && !hasLanguageSelected) {
    setShowLanguagePicker(true);
  }
};
```

**Visual "Choose Language" State**:
When enabled but no language selected, show a highlighted "Choose Language" button instead of a language pill:

```typescript
{enabled && (
  <TouchableOpacity onPress={() => setShowLanguagePicker(true)}>
    {hasLanguageSelected ? (
      // Show selected language with flag
      <>
        <Text>{selectedLang!.flag}</Text>
        <Text>{selectedLang!.name}</Text>
      </>
    ) : (
      // Show "Choose Language" prompt
      <>
        <Languages size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: "600" }}>
          Choose Language
        </Text>
      </>
    )}
  </TouchableOpacity>
)}
```

### 2. **ChatScreen** (`src/screens/ChatScreen.tsx`)

**Initialize with Empty Language**:
```typescript
const [translationLanguage, setTranslationLanguage] = useState(""); // Empty = no language selected yet
```

**Updated Toggle Handler**:
Removed immediate translation trigger when toggle is turned on:

```typescript
const handleTranslationToggle = async (enabled: boolean) => {
  setTranslationEnabled(enabled);
  
  // Persist to backend
  await api.patch(`/api/chats/${chatId}/translation`, {
    userId: user?.id,
    translationEnabled: enabled
  });
  
  if (!enabled) {
    // Clear translations when disabling
    setTranslatedMessages({});
  }
  // Note: If enabling, we DON'T translate yet - wait for user to select language
};
```

**Updated Language Select Handler**:
Now triggers translation immediately after language is selected:

```typescript
const handleLanguageSelect = async (language: string) => {
  setTranslationLanguage(language);
  
  // Persist to backend
  await api.patch(`/api/chats/${chatId}/translation`, {
    userId: user?.id,
    translationLanguage: language
  });
  
  // Clear existing translations and translate with new language
  setTranslatedMessages({});
  setTranslationVersion(v => v + 1);
  
  // Now that language is selected, trigger translation if enabled
  if (translationEnabled && messages && messages.length > 0) {
    await translateVisibleMessages(messages, true);
  }
};
```

**Updated Translation Effects**:
All translation effects now check for both `translationEnabled` AND non-empty `translationLanguage`:

```typescript
// Main chat translation effect
if (translationEnabled && translationLanguage && translationLanguage !== "" && ...) {
  // Translate messages
}

// Thread translation effect
if (translationEnabled && translationLanguage && translationLanguage !== "" && ...) {
  // Translate messages
}

// Real-time message translation
const currentLanguage = translationLanguageRef.current;
if (translationEnabled && currentLanguage && currentLanguage !== "" && ...) {
  // Translate new message
}
```

**Updated Chat Details Sync**:
Only sets language from server if it's not empty:

```typescript
if (chatDetails.translationLanguage) {
  setTranslationLanguage(chatDetails.translationLanguage);
}
```

## User Flow

### Before ❌
1. User taps "Translate" toggle
2. ⚠️ **Translation immediately starts to default language (e.g., English)**
3. User sees unwanted translations
4. User has to change language and wait for re-translation

### After ✅
1. User taps "Translate" toggle
2. **Toggle turns ON, showing "Choose Language" button**
3. **Language picker automatically opens**
4. User selects their desired language (e.g., Spanish)
5. ✅ **Only NOW do translations start**
6. Messages are translated to the correct language on first try

## Visual States

### State 1: Translation Disabled
```
[ 🌐 Translate ]
```

### State 2: Translation Enabled, No Language Selected (NEW)
```
[ 🌐 Translating ] [ 🌐 Choose Language ⌄ ]
                    ^^ Highlighted in primary color
```

### State 3: Translation Enabled, Language Selected
```
[ 🌐 Translating ] [ 🇪🇸 Spanish ⌄ ]
```

## Benefits

1. **Better UX**: Users explicitly choose their language before any translation happens
2. **Fewer API Calls**: No wasted translations to unwanted languages
3. **Clearer Intent**: Visual "Choose Language" makes it obvious what the user needs to do
4. **Auto-Discovery**: Language picker automatically opens when toggle is turned on
5. **Intuitive Flow**: Natural progression from enable → choose language → see translations

## Edge Cases Handled

1. **No language selected**: Translation effects check for empty string and skip
2. **Server sync**: Only applies server language if not empty
3. **Real-time messages**: Only translates if language is selected
4. **Navigation**: Empty language state persists correctly across navigation
5. **Toggle off/on**: Each time you toggle on, you must select language again (unless saved from server)

## Console Logs

**When toggle is turned on (no language yet)**:
```
[Translation] Toggle translation: true
[Translation] Main chat effect check - enabled: true, language: "", ...
// No translation triggered
```

**When language is selected**:
```
[Translation] Language selected: es
[Translation] Language selected, translating 50 messages
[Translation] Main chat effect - SCHEDULING translation for 50 messages in 500ms
[Translation] Main chat effect - EXECUTING translation
```

## Testing Instructions

1. **Open a chat** where translation is not enabled
2. **Tap "Translate"** in the More Options menu
3. **Verify**:
   - Toggle turns to "Translating"
   - "Choose Language" button appears (highlighted in blue)
   - Language picker modal automatically opens
4. **Select a language** (e.g., Spanish)
5. **Verify**:
   - "Choose Language" changes to "🇪🇸 Spanish"
   - Messages start translating
   - Translations appear after ~500ms debounce
6. **Leave chat and return**
7. **Verify**:
   - Translation is still enabled
   - Selected language is still Spanish
   - Messages are still translated

## Related Documentation

- **TRANSLATION_CANCELLATION_FIX.md**: Fixed API cancellation issues
- **TRANSLATION_FIX_SUMMARY.md**: Original translation persistence fix
- **TRANSLATION_IMPLEMENTATION_COMPLETE.md**: Initial translation feature

