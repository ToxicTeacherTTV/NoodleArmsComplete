# Nicky Personality Control System - Development Roadmap

## Overview
This roadmap outlines the evolution of Nicky's personality control system from the current topic-based approach to a sophisticated, user-controllable system. The approach prioritizes reliability, user experience, and gradual feature addition without complexity explosion.

## Current State: Simple Topic Distribution
- Dead by Daylight gaming content: 65%
- Italian-American culture & cooking: 20%
- Family & neighborhood stories: 10%
- Business ventures & street wisdom: 5%

## Target Architecture: Nicky Control v2.0
**Core Philosophy**: Deterministic > Smart. No hidden classifiers. User decides.

### Base Schema
```json
{
  "preset": "Roast Mode",
  "intensity": "med",
  "dbd_lens": false,
  "spice": "spicy"
}
```

### Available Presets
- **Chill Nicky** – measured, dry menace (Don mode)
- **Roast Mode** – punchy wiseguy clips (Wiseguy mode)  
- **Unhinged** – chaotic jump-cuts (Lunatic mode)
- **Patch Roast** – analytical DbD, low conspiracy (Don mode)
- **Storytime** – tall-tale swagger (Lunatic accent)
- **Caller War** – hostile rebuttal, spicy (Wiseguy mode)

### Controls
- **Intensity**: low | med | high | ultra (amplifies all behaviors)
- **DbD Lens**: ON/OFF (allows jargon + Victor cutaway)
- **Spice Level**: platform_safe | normal | spicy

---

## Phase 1: Harden + Measure (0-30 days)

### Goals
Ship v2.0 and establish reliability metrics

### Features
- **Golden Set & Scorer**: 20 "truth" prompts for testing preset accuracy
- **Static Previews**: Hand-written UI examples (no AI generation costs)
- **Export Knobs**: Generate both TTS-ready and clean text outputs
- **OBS/Streamer.bot Hooks**: Map presets to hotkeys for live streaming
- **Visible State**: `[NICKY STATE]` transparency in responses

### KPIs
- Preset pick rate
- "Felt right" thumbs-up percentage
- Average edits per reply

---

## Phase 2: Smarter Control Without Sliders (30-90 days)

### Goals  
Add variety through structured templates and platform optimization

### Features
- **Flavor Tilt**: Single optional nudge (italian|roast|conspiracy|neutral)
- **Beat Templates**: 3 structured response shapes
  - `clip_blast` (hook→insult→button)
  - `patch_take` (claim→evidence→recommendation)  
  - `story_boomerang` (brag→absurd turn→moral)
- **Platform Profiles**: Per-platform safety and length defaults
- **CTA Tags**: Swappable closers with preset-appropriate tone

### Schema Evolution
```json
{
  "preset": "Patch Roast",
  "intensity": "high", 
  "dbd_lens": true,
  "spice": "normal",
  "flavor_tilt": "roast",
  "beat_template": "patch_take",
  "platform": "youtube"
}
```

### KPIs
- Time to publish per clip
- Platform rejection rate
- Watch-through on short beats

---

## Phase 3: Learning Loop (90-180 days)

### Goals
Build feedback systems without creating black-box AI

### Features
- **User Feedback → Preset Tuning**: Rule-based adjustments (no ML)
- **Micro-A/B Testing**: Generate 2 title variants, track CTR
- **Lore Memory (RAG-lite)**: Curated facts file for consistency
- **Feedback Integration**: Thumbs-down storage and preset optimization

### KPIs
- Percentage of presets that auto-nudge correctly after feedback
- CTR delta on A/B tests
- Reduction in manual corrections

---

## Phase 4: Extensibility Without Chaos (180+ days)

### Goals
Advanced features while maintaining system simplicity

### Features
- **Moment Types**: Inline character moments (victor_cutaway, etc.)
- **Event Triggers**: Simple flags for deterministic text shifts
- **Creator Macros**: Bundle favorite configurations
- **Conformance Checker**: Offline script for quality assurance

### KPIs
- Reduction in manual rewrites
- Number of reusable macros created
- Conformance pass rate

---

## Development Guardrails

### Core Principles
1. **No Auto-Topic Detection**: The `dbd_lens` toggle stays explicit forever
2. **One Optional Nudge at a Time**: Avoid feature collision during development  
3. **Always Print State**: Keep `[NICKY STATE]` visible for debugging
4. **Presets are King**: 95% preset usage = success, not underuse

### Risk Mitigation
- Deterministic behavior over "smart" behavior
- Explicit user control over automatic classification
- Gradual feature addition with measurable validation
- Clear rollback path to simpler configurations

---

## Success Metrics

### Reliability
- Consistent behavior across identical settings
- Zero mysterious failures due to hidden classifiers
- Predictable response patterns

### User Experience  
- Quick preset selection for 95% of use cases
- Clear understanding of what each control does
- Immediate feedback on setting changes

### Content Quality
- Maintained character consistency across all presets
- Appropriate response length and pacing
- Platform-optimized output formatting

---

## Implementation Notes

### Technical Requirements
- JSON schema validation for all control inputs
- Static preview generation system
- Metrics collection and analysis pipeline
- Platform-specific output formatting

### Content Requirements
- Hand-written preset examples and previews
- Curated lore facts database
- Platform-specific content guidelines
- Quality assurance test scenarios

### Integration Points
- OBS Studio hotkey mapping
- Streamer.bot automation hooks
- Platform publishing APIs
- Analytics and metrics dashboards