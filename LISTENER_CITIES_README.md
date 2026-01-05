# 🗺️ Podcast Listener Cities Tracker

Track cities for your "Where the fuck are the viewers from" podcast segment!

## ✨ Features

### 📍 **Smart City Parsing**
- Upload CSV, TXT files or paste city names
- Auto-detects country for famous cities (New York → USA, London → UK, etc.)
- Handles optional state/province (not all countries have them!)
- Intelligently categorizes by continent and region

### 🎲 **Random City Picker**
During your podcast, click "Pick Random" and Nicky will choose an uncovered city to talk about! A "Tell Story" button will appear in the notification to trigger the segment immediately.

### 🎭 **Vibe-Based Storytelling**
- **Manual Trigger:** Click the "Tell Story" button on any city to start a multi-turn narrative segment.
- **Natural Detection:** Nicky can detect city mentions in chat (e.g., "What about Berlin?") and automatically start the story segment.
- **Narrative Archetypes:** Nicky uses unpredictable archetypes (The Grudge, The Fugitive, etc.) to keep stories fresh and volatile.
- **Multi-Turn Persistence:** The system tracks the story state across multiple messages, ensuring Nicky doesn't wrap up too early.

### ✅ **Coverage Tracking**
- **Automatic Coverage:** When Nicky tells a story about a city via chat or the "Tell Story" button, it is automatically marked as **Covered** in the database.
- **Manual Override:** Checkbox to manually mark cities as covered if needed.
- **Track Episode:** Track which episode covered each city.
- **Filter Status:** Filter by covered/uncovered status.

### 🔍 **Advanced Filtering**
Search and filter by:
- **Continent** (North America, Europe, Asia, etc.)
- **Country** (USA, Canada, UK, etc.)
- **Region** (Western Europe, Southeast Asia, etc.)
- **Coverage Status** (Covered/Uncovered)

### 📊 **Statistics Dashboard**
- Total cities tracked
- Covered vs uncovered breakdown
- Cities by continent, country, and region

## 🚀 Usage

### Adding Cities Manually
1. Click "Add City"
2. Enter city name (required)
3. Enter state/province (optional)
4. Enter country (optional - auto-detected for famous cities)
5. Click "Add City"

### Importing Bulk Cities

#### Option 1: Upload CSV/TXT File
1. Click "Import"
2. Click "Upload File"
3. Select your CSV or TXT file
4. Cities will be imported automatically

**CSV Format:**
```csv
City, State/Province, Country
New York, NY, USA
Paris, France
Toronto, Ontario, Canada
London, UK
```

**TXT Format** (one per line):
```
New York, NY, USA
Paris, France
Toronto, Ontario, Canada
London, UK
```

#### Option 2: Paste City Names
1. Click "Import"
2. Paste city names in the text area (one per line)
3. Click "Import Cities"

### During Podcast Recording

**For "Where the fuck are the viewers from" segment:**
1. Apply filters if desired (e.g., only North America, or only Europe)
2. Click **"Pick Random"** button
3. Nicky will randomly select an uncovered city
4. Click **"Tell Story"** in the toast notification to trigger Nicky.
5. Alternatively, just ask Nicky in chat: *"What about [City]?"*
6. Nicky will start a multi-turn story and the city will be marked as **Covered** automatically.
7. Optionally add episode number/title in the city list.

## 🌍 Supported Features

### Auto-Detection
The system knows about **70+ famous cities** and will auto-detect:
- New York → USA, New York
- Los Angeles → USA, California
- Toronto → Canada, Ontario
- London → UK
- Paris → France
- Tokyo → Japan
- Sydney → Australia
- And many more!

### Continent Mapping
Automatically categorizes **50+ countries** into continents:
- North America
- South America
- Europe
- Asia
- Africa
- Oceania
- Antarctica (if you have viewers there, god help you)
- Africa
- Oceania

### Regional Grouping
Automatically groups countries into regions:
- **North America**: USA, Canada, Mexico
- **Western Europe**: UK, France, Germany, Netherlands, etc.
- **Northern Europe**: Sweden, Norway, Denmark, Finland
- **Southern Europe**: Italy, Spain, Portugal
- **Eastern Europe**: Poland
- **East Asia**: China, Japan, South Korea
- **Southeast Asia**: Thailand, Vietnam, Philippines, etc.

## 📝 Examples

### Example 1: Famous Cities (Auto-Detect)
```
Input: New York
Result: New York, NY, USA • North America
```

### Example 2: City with State
```
Input: Austin, Texas
Result: Austin, Texas, USA • North America
```

### Example 3: International City
```
Input: Berlin, Germany
Result: Berlin, Germany • Europe • Western Europe
```

### Example 4: City Without State
```
Input: Paris, France
Result: Paris, France • Europe • Western Europe
```

## 🎮 Integration with Nicky

During your podcast, Nicky can:
1. **Pick a random uncovered city** from your list
2. **Talk about the city** using her personality
3. **Remember which cities have been covered**
4. **Filter by region** if you want to focus on specific areas

## 🔧 API Endpoints

All endpoints require an active profile.

### GET `/api/podcast/cities`
Get all cities with optional filters
- Query params: `country`, `continent`, `region`, `covered` (true/false)

### GET `/api/podcast/cities/random-uncovered`
Get a random uncovered city for Nicky to pick
- Query params: same as above for filtering

### GET `/api/podcast/cities/stats`
Get statistics about your cities

### POST `/api/podcast/cities`
Add a single city manually
- Body: `{ city, stateProvince?, country? }`

### POST `/api/podcast/cities/import`
Import cities from file or text
- Multipart form with file OR JSON with `{ content }`

### PUT `/api/podcast/cities/:id`
Update a city (mark as covered, add notes, etc.)
- Body: `{ isCovered?, coveredEpisode?, notes? }`

### DELETE `/api/podcast/cities/:id`
Delete a city

## 🗄️ Database Schema

```sql
CREATE TABLE listener_cities (
  id VARCHAR PRIMARY KEY,
  profile_id VARCHAR NOT NULL,
  city TEXT NOT NULL,
  state_province TEXT, -- Optional
  country TEXT NOT NULL,
  continent TEXT NOT NULL,
  region TEXT,
  is_covered BOOLEAN DEFAULT false,
  covered_date TIMESTAMP,
  covered_episode TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(profile_id, city, country)
);
```

## 🎯 Use Cases

1. **Weekly Podcast Segment**: Use "Pick Random" every week to feature a new listener city
2. **Regional Focus**: Filter by continent/region to feature cities from specific areas
3. **Coverage Tracking**: Never repeat cities - checkbox prevents duplicates
4. **Episode Documentation**: Track which episode covered which city
5. **Audience Insights**: See where your listeners are from by continent/country

## 🛠️ Setup

1. Run the migration:
   ```bash
   psql -d your_database < add-listener-cities.sql
   ```

2. Navigate to `/listener-cities` in the app

3. Import your cities!

## 💡 Tips

- Upload your YouTube Analytics city data as CSV
- Use the "Pick Random" button during live streams
- Apply filters to focus on specific regions
- Add notes about interesting facts for each city
- Mark cities as covered immediately to avoid repeats

## 🎉 Have Fun!

Now you can track all your podcast listener cities and never run out of content for "Where the fuck are the viewers from"! 🎙️
