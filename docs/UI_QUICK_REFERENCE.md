# Nicky UI Quick Reference Guide

**Updated**: January 2026

Quick guide to finding features in the new interface.

---

## Main Navigation (Top Bar)

```
Chat  |  Memory  |  Settings
```

---

## 🏠 Chat Page

**When to use**: Talk to Nicky, have conversations

**Location**: Click "Chat" in top bar, or go to `/`

**Key Features**:
- Live chat interface
- Message history
- Learning mode toggle (private/public)
- Profile switcher

---

## 🧠 Memory Page

**When to use**: View, search, and manage what Nicky knows

**Location**: Click "Memory" in top bar, or go to `/memory-v2`

### What Nicky Knows

**When to use**: Browse and search memories

- **Recent** - Last 50 things Nicky learned
- **All** - Complete memory bank
- **Entities** - People, places, events (coming soon)
- **Documents** - Uploaded files and knowledge
- **Podcasts** - Synced podcast episodes

### Review & Fix

**When to use**: Find and fix memory problems

- **By Trust** - View by confidence level
- **Contradictions** - Conflicting facts
- **Duplicates** - Similar memories
- **Flags** - Items needing review
- **Protected** - Core facts locked from changes

### Insights

**When to use**: Understand memory health

- **Overview** - Key metrics and health score
- **Analytics** - Detailed charts and trends
- **Intelligence** - AI-driven insights
- **Timeline** - Event consistency check
- **System Status** - Background operations

### Quick Actions (Dropdown)

**When to use**: Run maintenance tasks

- Clean Wall of Text
- Propagate Importance
- Run Memory Checker
- Repair Timeline
- Export/Import Memories

---

## ⚙️ Settings Page

**When to use**: Configure Nicky's behavior

**Location**: Click "Settings" in top bar, or go to `/settings`

### Personality

**When to use**: Change how Nicky acts

- Core personality configuration
- Presets (Chill, Roast, Story Time)
- Heat & Chaos controls
- Voice settings

### Integrations

**When to use**: Connect external platforms

- Discord bot management
- Twitch integration status
- API keys (view only)

### Content Pipeline

**When to use**: Manage content ingestion

- Podcast RSS feeds
- Upload documents/transcripts
- Content library (training examples, docs, ads)
- Auto-processing rules

### System

**When to use**: System configuration

- Profile management
- Debug & logging
- System operations status

---

## Common Tasks - Where To Go

### Conversations & Chat
- Start conversation: **Chat page**
- View conversation history: **Memory → What Nicky Knows → Recent**

### Memories & Knowledge
- Search memories: **Memory → What Nicky Knows** (use search bar)
- View all memories: **Memory → What Nicky Knows → All**
- Fix low-quality memories: **Memory → Review & Fix**
- View memory stats: **Memory → Insights → Overview**

### Podcasts
- View episodes: **Memory → What Nicky Knows → Podcasts**
- Configure RSS: **Settings → Content Pipeline → Podcast Management**
- Upload transcript: **Settings → Content Pipeline → Content Ingestion**

### Documents
- View documents: **Memory → What Nicky Knows → Documents**
- Upload new: **Settings → Content Pipeline → Content Ingestion**

### Configuration
- Change personality: **Settings → Personality**
- Connect Discord: **Settings → Integrations → Discord**
- Manage profiles: **Settings → System → Profile Management**

### Maintenance
- Clean memories: **Memory → Quick Actions → Clean Wall of Text**
- Fix timeline: **Memory → Quick Actions → Repair Timeline**
- Check system: **Settings → System → System Operations**

### Troubleshooting
- View logs: **Settings → System → Debug & Logging**
- Check operations: **Settings → System → System Operations**
- Memory health: **Memory → Insights → Overview**

---

## Tips & Tricks

### Tooltips Everywhere
Hover over any sidebar item or button to see what it does.

### Empty States
When sections are empty, they show helpful messages with action buttons.

### Search
Use the search bar in "What Nicky Knows" to find specific memories.

### Quick Actions
The dropdown in Memory page is always accessible for common tasks.

### Sidebar Navigation
Click sidebar items to switch between sections without losing your place.

---

## Keyboard Shortcuts (Coming Soon)

- `Cmd+K` / `Ctrl+K` - Command palette
- `Cmd+1` - Go to Chat
- `Cmd+2` - Go to Memory
- `Cmd+3` - Go to Settings
- Arrow keys - Navigate sidebar

---

## Old Routes (Still Work)

If you have bookmarks to old pages:

- `/memory` - Old memory interface (still works)
- `/workspace` - Development workspace
- `/listener-cities` - Analytics page

These may be deprecated in the future.

---

## Need Help?

Every section has:
- **Tooltips** on buttons and sidebar items
- **Inline descriptions** under section headers
- **Empty state messages** when no data
- **Info cards** with helpful tips

Just hover and read!

---

## Quick Visual Guide

```
┌─────────────────────────────────────────────────┐
│  Chat  │  Memory  │  Settings                   │
└─────────────────────────────────────────────────┘

Memory Page Layout:
┌──────────────────┬──────────────────────────────┐
│ What Nicky       │                              │
│ Knows            │  Tabs: Recent|All|Entities   │
│                  │       Documents|Podcasts     │
│ Review & Fix     │                              │
│                  │  [Quick Actions ▾]           │
│ Insights         │                              │
└──────────────────┴──────────────────────────────┘

Settings Page Layout:
┌──────────────────┬──────────────────────────────┐
│ Personality      │                              │
│                  │  Cards with settings         │
│ Integrations     │  and configuration           │
│                  │                              │
│ Content Pipeline │                              │
│                  │                              │
│ System           │                              │
└──────────────────┴──────────────────────────────┘
```

---

**End of Quick Reference**
