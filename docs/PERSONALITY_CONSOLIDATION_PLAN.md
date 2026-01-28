# Personality System Consolidation Plan

## Current State (Overly Complex)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chaos Engine   │    │  Personality    │    │    Variety      │    │    Behavior     │
│                 │    │    Control      │    │   Controller    │    │   Modulator     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ - chaosLevel    │    │ - preset        │    │ - facets        │    │ - aggressiveness│
│ - sauceMeter    │    │ - intensity     │    │ - shapes        │    │ - unpredictability
│ - mode (4)      │───▶│ - spice         │    │ - cooldowns     │    │ - drift         │
│ - responseCount │    │ - dbdLens       │    │ - sceneCards    │    │ - EWMA          │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │                      │
        └──────────────────────┴──────────────────────┴──────────────────────┘
                                         │
                              All feed into prompt
```

### Problems
1. **Chaos modes cause character breaks** - FULL_PSYCHO, CONSPIRACY make Nicky incoherent/paranoid
2. **Redundant energy scales** - chaosLevel, sauceMeter, intensity all control "how intense"
3. **Redundant modes** - chaos modes suggest presets anyway (HYPER_FOCUSED → Patch Roast)
4. **Over-engineered variation** - Behavior Modulator's EWMA/drift when facets already exist
5. **Nicky should never be "calm"** - System allows states that break character

---

## Target State (Simplified)

```
┌─────────────────────────────────────────┐    ┌─────────────────┐
│           Heat System                    │    │    Variety      │
│          (heatController.ts)             │    │   Controller    │
├─────────────────────────────────────────┤    ├─────────────────┤
│ - heat: 10-100 (never below 10)         │    │ - facets (KEEP) │
│ - focus: gaming|storytelling|roasting|   │    │ - cooldowns     │
│          ranting                         │    │ - sceneCards    │
│ - spice: platform_safe|normal|spicy     │    └─────────────────┘
│ - dbdLens: boolean                       │
└─────────────────────────────────────────┘
```

### Heat Scale (Replaces chaos + sauce + intensity)

| Heat | State | Behavior |
|------|-------|----------|
| 10-30 | Grumpy | Irritated baseline, grumbling, sarcastic |
| 31-55 | Heated | Getting worked up, more caps, sharper |
| 56-80 | Ranting | Full rant mode, SHOUTING, rapid complaints |
| 81-100 | Explosive | SCREAMING, table-slamming, still coherent |

**Key rule:** Heat floor is 10. Nicky is NEVER calm. Even "grumpy" means annoyed.

### Focus (Replaces chaos modes + presets)

| Focus | Description | Triggers |
|-------|-------------|----------|
| `gaming` | DbD/Arc Raiders, mechanics, patches | Game keywords detected |
| `storytelling` | Family tales, neighborhood stories | Story prompts, memories |
| `roasting` | Targeting chat/host, insult-heavy | Provocations, insults |
| `ranting` | General complaints, life grievances | Default/fallback |

**Key rule:** Focus is auto-detected from context. Manual override available.

---

## Files to Modify

### 1. CREATE: `server/services/heatController.ts`
New unified controller replacing chaosEngine.

```typescript
interface HeatState {
  heat: number;        // 10-100 (floor of 10)
  currentGame: 'none' | 'dbd' | 'arc_raiders' | 'other';
  spice: 'platform_safe' | 'normal' | 'spicy';
  lastUpdated: Date;
}

// Game determines what knowledge/jargon to use
// 'none' = general chat, no game focus
// 'dbd' = Dead by Daylight mode (perks, killers, survivors, etc.)
// 'arc_raiders' = Arc Raiders mode (ARC, machines, extraction, etc.)
// 'other' = Generic gaming mode

class HeatController {
  // Heat management
  getHeat(): number
  adjustHeat(delta: number): void  // Auto-clamps to 10-100
  setHeat(level: number): void     // Manual override

  // Focus management
  getFocus(): Focus
  detectFocus(message: string): Focus  // Auto-detect from context
  setFocus(focus: Focus): void         // Manual override

  // Prompt generation
  generateHeatPrompt(): string
}
```

### 2. MODIFY: `server/types/personalityControl.ts`
Simplify to just settings (spice, dbdLens).

```typescript
// REMOVE: preset, intensity (replaced by heat/focus)
// KEEP: spice, dbd_lens

interface PersonalitySettings {
  spice: 'platform_safe' | 'normal' | 'spicy';
  dbdLens: boolean;
}
```

### 3. MODIFY: `server/routes.ts`
- Replace chaos API endpoints with heat endpoints
- `/api/chaos/state` → `/api/heat/state`
- `/api/chaos/trigger` → `/api/heat/adjust`
- `/api/personality` → simplified to just spice/dbdLens

### 4. MODIFY: `server/services/contextBuilder.ts`
- Import heatController instead of chaosEngine
- Use heat level instead of chaos level for prompt building

### 5. MODIFY: `server/services/aiOrchestrator.ts`
- Use heatController for personality prompt
- Remove chaos mode references

### 6. DEPRECATE (Phase 2):
- `server/services/chaosEngine.ts` - replaced by heatController
- `server/services/behaviorModulator.ts` - Discord can use simplified heat
- `server/services/personalityController.ts` - focus detection moves to heatController

### 7. KEEP AS-IS:
- `server/services/VarietyController.ts` - facets are good, distinct purpose

---

## Database Changes

### Modify `chaos_state` table → `heat_state`

```sql
-- Old columns to remove
-- level, sauceMeter, mode, responseCount, manualOverride, overrideExpiry

-- New simplified schema
ALTER TABLE chaos_state RENAME TO heat_state;
ALTER TABLE heat_state DROP COLUMN sauce_meter;
ALTER TABLE heat_state DROP COLUMN mode;
ALTER TABLE heat_state DROP COLUMN response_count;
ALTER TABLE heat_state RENAME COLUMN level TO heat;
-- Add constraint: heat >= 10
```

### Modify `personality_state` table
Remove preset/intensity columns, keep spice/dbdLens.

---

## Migration Path

### Phase 1: Create New System (Non-Breaking)
1. Create `heatController.ts` with new logic
2. Add `/api/heat/*` endpoints alongside existing `/api/chaos/*`
3. Update dashboard to show both (A/B testing)

### Phase 2: Switch Over
1. Update `contextBuilder.ts` to use heatController
2. Update `aiOrchestrator.ts` to use heatController
3. Update dashboard to use heat endpoints only

### Phase 3: Cleanup
1. Remove chaosEngine.ts
2. Remove old chaos API endpoints
3. Remove behaviorModulator.ts (or simplify for Discord)
4. Database migration to new schema

---

## Dashboard Changes

### Current Dashboard
```
┌─────────────────────────────────────┐
│ Preset: [Dropdown with 6 options]   │
│ Intensity: [low/med/high/ultra]     │
│ Spice: [platform_safe/normal/spicy] │
│ DbD Lens: [toggle]                  │
│                                     │
│ Chaos Level: [slider 0-100]         │
│ Sauce Meter: [slider 0-100]         │
│ Mode: [display current mode]        │
└─────────────────────────────────────┘
```

### New Settings Page (Simplified)
```
┌─────────────────────────────────────┐
│ Spice: [○ Safe ● Normal ○ Spicy]    │
│                                     │
│ (Heat & Game controls are on chat)  │
└─────────────────────────────────────┘
```

### Chat Screen Controls (NEW)
Game selector and heat display live on the chat screen for easy mid-conversation switching:

```
┌──────────────────────────────────────────────────────────┐
│  🎮 [Arc Raiders ▼]               🔥 Heat: [███░░░] 55   │
│     ├── None (general chat)                              │
│     ├── Dead by Daylight                                 │
│     ├── Arc Raiders                                      │
│     └── Other Game                                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Nicky]: Ay yo, lemme tell you about da Jolt Mines...  │
│                                                          │
│  [You]: what about the leapers?                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [Type your message...]                     [Send] [🎤]  │
└──────────────────────────────────────────────────────────┘
```

---

## Heat Prompt Generation

```typescript
generateHeatPrompt(state: HeatState): string {
  const heatDescriptions = {
    grumpy: 'Irritated and grumbling. Sarcastic. Occasional caps for emphasis.',
    heated: 'Getting worked up. More caps. Sharper insults. Building steam.',
    ranting: 'Full rant mode. SHOUTING. Rapid-fire complaints. Volatile.',
    explosive: 'SCREAMING. Table-slamming energy. Maximum intensity. Still coherent.'
  };

  const heatLevel =
    state.heat <= 30 ? 'grumpy' :
    state.heat <= 55 ? 'heated' :
    state.heat <= 80 ? 'ranting' : 'explosive';

  return `
[NICKY'S CURRENT STATE]
Heat Level: ${state.heat}/100 (${heatLevel.toUpperCase()})
${heatDescriptions[heatLevel]}

Focus: ${state.focus}
${state.focus === 'gaming' ? '- Talk about games, mechanics, patches, community drama' : ''}
${state.focus === 'storytelling' ? '- Tell tales, share memories, exaggerate wildly' : ''}
${state.focus === 'roasting' ? '- Target the chat/host with creative insults' : ''}
${state.focus === 'ranting' ? '- General complaints, life grievances, Italian problems' : ''}

CRITICAL: You are NEVER calm. Even at lowest heat, you're annoyed and grumpy.
CRITICAL: You are ALWAYS coherent. High heat = louder, not crazier.
CRITICAL: You are a GAMER. Never deny playing games.
`;
}
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing conversations | Phase rollout, keep old system running in parallel |
| Dashboard confusion | A/B test with clear labeling |
| Missing edge cases | Map all current chaos mode behaviors to heat levels first |
| Database migration | Backup before migration, reversible changes |

---

## Success Criteria

1. **No more "I don't play games"** responses
2. **Nicky always usable for podcast** - coherent at all heat levels
3. **Simpler dashboard** - one slider instead of multiple overlapping controls
4. **Less code** - Remove 500+ lines of chaos/modulator complexity
5. **Predictable behavior** - Heat level directly maps to output intensity

---

## Timeline Estimate

| Phase | Work |
|-------|------|
| Phase 1 | Create heatController, new endpoints |
| Phase 2 | Switch contextBuilder/orchestrator |
| Phase 3 | Cleanup old systems |
| Testing | Verify all conversation modes work |

---

## Decisions Made

1. ✅ **Discord servers** → Independent heat state per server
2. ✅ **Focus override** → Keep manual override capability
3. ✅ **Migration** → Start fresh, don't convert old chaos data
4. ✅ **Game selector** → Dropdown on chat screen (None, Dead by Daylight, Arc Raiders, Other Game)
