# Home PC Setup Instructions

**IMPORTANT:** Follow these steps when you get home to sync your local repository with the cleaned git history.

## ⚠️ WARNING: DO NOT Git Pull First!

Your local repository at home has the OLD git history with exposed credentials. If you just do `git pull`, you'll get conflicts because we rewrote the entire history. **Follow these steps exactly.**

---

## Option 1: Fresh Clone (Recommended - Safest)

This is the simplest and safest approach.

### Step 1: Backup Any Uncommitted Work

```bash
# Navigate to your current repo
cd path/to/NoodleArmsComplete

# If you have any uncommitted changes you want to keep:
# Copy those files somewhere safe (Desktop, Documents, etc.)
```

### Step 2: Delete Old Repository

```bash
# Go to parent directory
cd ..

# Delete the old repo (or rename it if you're nervous)
mv NoodleArmsComplete NoodleArmsComplete-OLD-BACKUP
```

### Step 3: Clone Fresh Copy

```bash
# Clone the cleaned repository
git clone https://github.com/ToxicTeacherTTV/NoodleArmsComplete.git
cd NoodleArmsComplete

# Switch to main-secure branch (if not default)
git checkout main-secure
```

### Step 4: Set Up Environment Variables

Create a `.env` file with your credentials:

```bash
# Create .env file
notepad .env
```

Add this content:
```
# 🤖 GEMINI API CONFIGURATION
GEMINI_API_KEY=AIzaSyBTlcUBbipAhmbJL0wHPbU6HhOxFBBbnEA

# 💾 DATABASE CONFIGURATION
DATABASE_URL=postgresql://neondb_owner:npg_MYTH8Ncdm0Iy@ep-green-surf-ahc76dvs-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Add any other API keys you had before
# ELEVENLABS_API_KEY=your_key
# DISCORD_BOT_TOKEN=your_token
# TWITCH_OAUTH_TOKEN=your_token
```

Save and close.

### Step 5: Install and Run

```bash
# Install dependencies (if needed)
npm install

# Start the server
npm run dev
```

### Step 6: Clean Up Old Backup (Optional)

Once everything works:
```bash
# Delete the old backup
cd ..
rmdir /s NoodleArmsComplete-OLD-BACKUP
```

---

## Option 2: Reset Existing Repository (Advanced)

Only use this if you're comfortable with git and don't have uncommitted changes.

### Step 1: Backup Uncommitted Work

```bash
cd path/to/NoodleArmsComplete

# Copy any files you care about to a safe location
```

### Step 2: Reset to Match Remote

```bash
# Fetch the new history
git fetch origin main-secure

# DANGER: This will discard ALL local changes
git reset --hard origin/main-secure

# Switch to the main-secure branch
git checkout -b main-secure origin/main-secure
```

### Step 3: Update Environment Variables

Same as Option 1, Step 4 above.

---

## Verification Checklist

After setup, verify everything works:

- [ ] Server starts without errors: `npm run dev`
- [ ] Can connect to http://localhost:5000
- [ ] Nicky responds to messages
- [ ] Check git log - old commit `2321e9f` should NOT appear
- [ ] Check git log - commits should have different hashes than before

### Check Git History
```bash
# This commit should NOT exist anymore
git log --all --grep="2321e9f"

# Should show empty result - if it shows the commit, something went wrong!
```

---

## Important Notes

1. **Don't Merge or Pull**: Never try to merge your old local history with the new remote history. They are incompatible.

2. **Old .bat File**: Your startup .bat file should still work, but make sure it doesn't reference the old credentials.

3. **Environment Variables**: All credentials are now in `.env` file. Never commit this file.

4. **Branch Name**: The cleaned history is on `main-secure` branch. Once GitHub admins update the default branch, you can delete your old `main` branch.

---

## Troubleshooting

### "Repository not found" or 403 error
- Make sure you're logged into GitHub
- Check if the repository URL is correct

### Server won't start - "DATABASE_URL must be set"
- Make sure your `.env` file exists in the root directory
- Check that it contains the `DATABASE_URL` and `GEMINI_API_KEY`

### "Merge conflict" or "divergent histories"
- You probably tried to pull instead of following these instructions
- Go back to Option 1 (Fresh Clone) - it's safer

---

## Need Help?

If something goes wrong:
1. Don't panic - your data is safe in the cloud database
2. You can always delete and re-clone (Option 1)
3. Check the [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md) for details on what was changed

---

**Last Updated:** January 28, 2026
**Related Docs:** [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md)
