#!/bin/bash
# Add DbD patch knowledge via API
# Run this while the server is running

API_URL="${API_URL:-http://localhost:5000}"

echo "📝 Adding DbD patch knowledge via API..."
echo ""

# Patch 9.3.0 exists
curl -X POST "$API_URL/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "FACT",
    "content": "Dead by Daylight patch 9.3.0 exists and came after patch 9.2.0",
    "keywords": ["dead by daylight", "dbd", "patch", "9.3.0", "bhvr", "update"],
    "importance": 850,
    "confidence": 99,
    "source": "podcast_knowledge",
    "temporalContext": "DbD Patch 9.3.0 (2025)",
    "storyContext": "Current DbD game version knowledge"
  }'
echo ""

# Fog vials nerf in 9.1.2
curl -X POST "$API_URL/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "FACT",
    "content": "BHVR nerfed fog vials to 2 charges in Dead by Daylight patch 9.1.2 after survivor mains abused them",
    "keywords": ["dead by daylight", "dbd", "patch", "9.1.2", "fog vials", "nerf", "bhvr", "survivor mains"],
    "importance": 800,
    "confidence": 99,
    "source": "podcast_knowledge",
    "temporalContext": "DbD Patch 9.1.2 (August 2025)",
    "storyContext": "Fog vials nerfed from infinite to 2 charges"
  }'
echo ""

# Patch numbering format
curl -X POST "$API_URL/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "FACT",
    "content": "As of November 2025, Dead by Daylight patches use X.Y.Z numbering format (e.g., 9.1.2, 9.2.0, 9.3.0), not \"patch 8\" style numbering. BHVR has never used simple numbered patches.",
    "keywords": ["dead by daylight", "dbd", "patch", "version", "numbering", "bhvr", "format"],
    "importance": 950,
    "confidence": 99,
    "source": "podcast_knowledge",
    "temporalContext": "DbD Patch Numbering System (2025)",
    "storyContext": "Critical: How BHVR names patches - prevents hallucinations"
  }'
echo ""

# Patch 9.2.0 timeline
curl -X POST "$API_URL/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "FACT",
    "content": "Dead by Daylight patch 9.2.0 came between patch 9.1.2 and patch 9.3.0 in the version timeline",
    "keywords": ["dead by daylight", "dbd", "patch", "9.2.0", "bhvr", "update", "timeline"],
    "importance": 800,
    "confidence": 99,
    "source": "podcast_knowledge",
    "temporalContext": "DbD Patch 9.2.0 (2025)",
    "storyContext": "Patch version timeline"
  }'
echo ""

# Most recent patch as of November 2025
curl -X POST "$API_URL/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "FACT",
    "content": "As of November 2025, the most recent Dead by Daylight patch mentioned in podcast discussions is patch 9.3.0",
    "keywords": ["dead by daylight", "dbd", "patch", "latest", "current", "9.3.0", "bhvr", "recent"],
    "importance": 900,
    "confidence": 99,
    "source": "podcast_knowledge",
    "temporalContext": "Latest DbD Patch (November 2025)",
    "storyContext": "Most recent patch known from podcast content"
  }'
echo ""

echo "✅ Added DbD patch knowledge!"
echo ""
echo "💡 Nicky now knows:"
echo "   - Latest patch is 9.3.0 (not \"patch 8\")"
echo "   - Patch numbering is X.Y.Z format"
echo "   - Recent fog vial nerf in 9.1.2"
echo "   - Patch timeline (9.1.2 → 9.2.0 → 9.3.0)"
