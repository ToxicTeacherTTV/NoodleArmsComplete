# Emotion Enhancement System

## Overview
ElevenLabs-style emotion enhancement system that adds audio tags to text responses for more expressive TTS output. This system is the primary way Nicky expresses his state, as he is strictly forbidden from using physical stage directions (e.g., *leans in*).

## Features

### 🎭 AI Enhancement Mode (Default)
- Uses **Gemini 3 Flash** to intelligently add emotion tags.
- Strategically places tags before or after dialogue segments.
- Preserves original text exactly - only adds tags.
- **Personality Hardening:** Ensures no asterisks or physical narration are added during enhancement.

### ⚡ Quick Enhancement Mode
- Fast pattern-based enhancement for low-latency streaming.
- No API calls required.
- Basic emotion tag insertion based on keywords.

## Supported Emotion Tags

### Emotional States
- `[grumpy]`, `[annoyed]`, `[furious]`, `[exasperated]`
- `[manic]`, `[unhinged]`, `[psycho]`, `[excited]`
- `[conspiratorial]`, `[suspicious]`, `[paranoid]`
- `[deadpan]`, `[sarcastic]`, `[reluctant]`
- `[warm]`, `[genuine]`, `[nostalgic]`

### Non-verbal Sounds (The "Show, Don't Tell" Toolkit)
- `[laughing]`, `[chuckles]`, `[scoffs]`
- `[sighs]`, `[groans]`, `[exhales]`
- `[clears throat]`, `[coughs]`
- `[muttering]`, `[whispering]`
- `[short pause]`, `[long pause]`
- `[screaming]`, `[yelling]`

### Italian-American Flavor
- `[bronx]` - Bronx accent emphasis
- `[italian pride]` - Proud Italian moment
- `[aggressive]` - Jersey aggression
- `[rambling]` - Going off on tangent

## 🚫 Forbidden Content (Personality Hardening)
The Emotion Enhancer is programmed to strip or prevent the following:
- **No Asterisks:** `*leans in*` or `*shaking head*` are strictly forbidden.
- **No Physical Narration:** Nicky must not describe his current physical state in text (e.g., "I'm rubbing my temples").
- **No Soft Emotions:** Avoid `[happy]` or `[thoughtful]`. Nicky is either seething, manic, or screaming.

## API Endpoints

### POST `/api/enhance-text`
Enhance any text with emotion tags.

**Request:**
```json
{
  "text": "Listen, I don't know what you want from me. This is ridiculous.",
  "mode": "ai",  // or "quick"
  "characterContext": "Nicky 'Noodle Arms' A.I. Dente - unhinged Italian-American podcaster"
}
```

**Response:**
```json
{
  "original": "Listen, I don't know what you want from me. This is ridiculous.",
  "enhanced": "[grumpy] Listen, I don't know what you want from me. [exasperated] This is RIDICULOUS.",
  "mode": "ai"
}
```

### POST `/api/enhance-message`
Enhance an existing message from a conversation (not yet implemented - UI only shows comparison).

**Request:**
```json
{
  "conversationId": "abc123",
  "messageIndex": 3,
  "mode": "ai"
}
```

## UI Integration

### Chat Panel Enhancement Button
- Magic wand icon (🪄) appears next to thumbs up/down for AI messages
- Click to enhance with AI mode
- Shows loading spinner during processing
- Toast notification displays original vs enhanced comparison

## Usage Examples

### Before Enhancement
```
"You think that's a coincidence? They're controlling everything!"
```

### After AI Enhancement
```
"[conspiratorial] You think that's a coincidence?! [manic] They're controlling EVERYTHING!"
```

---

### Before Enhancement
```
"My uncle Sal used to say the same thing. He was a smart guy."
```

### After AI Enhancement
```
"[nostalgic] My uncle Sal used to say the same thing. [sighs] He was a smart guy..."
```

## Best Practices

1. **Strategic Placement**
   - Place emotion tags BEFORE dialogue for setup
   - Place tags AFTER for reaction/emphasis
   - Don't overuse - let natural flow happen

2. **Emphasis Techniques**
   - CAPITALS for shouting/intensity
   - !!! for extreme emphasis
   - ... for trailing off/sighs
   - ?? for confusion/disbelief

3. **Voice Profile Matching**
   - ElevenLabs profiles already tuned for these emotions
   - Grumpy, conspiratorial, manic, etc. work best
   - Combine accent tag with emotion: `[bronx][grumpy]`

## Technical Implementation

### Service: `server/services/emotionEnhancer.ts`
- `enhanceText(text, characterContext)` - AI-powered enhancement
- `quickEnhance(text)` - Pattern-based enhancement

### Prompt Engineering
- Based on ElevenLabs' official enhance system
- Instructs AI to preserve original text exactly
- Provides comprehensive emotion tag library
- Includes Nicky-specific personality tags

### Error Handling
- Gemini primary (fast, free)
- Claude fallback (quality backup)
- If both fail, returns original text unchanged

## Future Enhancements

- [ ] Auto-enhance all AI responses (toggle setting)
- [ ] Pre-enhance training examples
- [ ] Batch enhancement for pre-roll ads
- [ ] Custom emotion tag creation UI
- [ ] A/B testing enhanced vs non-enhanced TTS quality
