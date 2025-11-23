# Shit to Fix Later

**Quick capture list for bugs, annoyances, and "I'll get to that eventually" items**

Last Updated: November 23, 2025

---

## 🐛 Active Issues

### Document Processing Hangs on Large Files
- **What:** Document processing gets stuck after 3+ hours, likely in batched entity extraction phase
- **When:** Uploading large documents (>100KB)
- **Impact:** Wastes tokens, blocks processing queue
- **Notes:** Using Gemini 2.5 Pro (expensive) when should use Flash, entity extraction might be timing out
- **Priority:** HIGH - costing money

### Doesn't seem to be using Gemini 3 Pro in chat
- need to check on and fix this

### Intelligence analysis inefficient

- it appears that every time i revisit the intelligence analysis it has to pull EVERYTHING again. may need it to show the most previous analysis by default, then give me a button to re-run the analysis when i'd like.

---

## 🔧 Minor Annoyances

- log files still seem to, in some cases, have out of date messages, need to update

- flagging system still exists for no real purpose. need to figure it out. what does it do? what SHOULD it do? is it worth implementing? etc.

---

## 💡 Nice-to-Haves

### Need option to review proposed dupe changes
- need a way that when i click "edit and merge" when looking at memory deduplication, that it will first list the original and the dupe in the same box that i can edit as i see fit, then click approve, then it goes through. alternatively, if i do a "quick merge", i'd like to see the proposed merge along with all facts, and have the ability to edit the proposed AI merge.

### Entities update
- May need to update the entities system to include more than just people, places, and events. we might need one for "concepts", "items", "misc", or something like that, since many don't fit in these three boxes we currently have.

---

## ✅ Fixed (Archive)

*(Move completed items here with date fixed)*

