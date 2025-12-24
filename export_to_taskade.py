import psycopg2
import requests
import time
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Ensure UTF-8 output for Windows terminals to avoid emoji crashes
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for older Python versions if necessary
        import codecs
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# Load environment variables from .env file
load_dotenv()

# ============================================
# CONFIGURATION  
# ============================================

# Database connection (from your Replit secrets or .env)
DATABASE_URL = os.getenv('DATABASE_URL')

# Fallback to individual components if DATABASE_URL is not set
DB_CONFIG = {
    'host': os.getenv('PGHOST', 'your-host.internal'),
    'database': os.getenv('PGDATABASE', 'your-database'),
    'user': os.getenv('PGUSER', 'your-username'),
    'password': os.getenv('PGPASSWORD', 'your-password'),
    'port': int(os.getenv('PGPORT', 5432))
}

# Taskade webhook URL
WEBHOOK_URL = "https://www.taskade.com/api/v1/flows/01KD8638JJBXA7AP6CYS7YD25B/webhook"

# Rate limiting settings
BATCH_SIZE = 1  # Send 1 memory at a time
DELAY_BETWEEN_BATCHES = 5  # Wait 5 seconds between memories
DELAY_ON_ERROR = 120  # Wait 120 seconds if rate limited

def get_connection():
    """Establish database connection using URL or config"""
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(**DB_CONFIG)

def send_memory(memory_data, retry_count=0):
    """Send a single memory to Taskade with retry logic"""
    try:
        response = requests.post(
            WEBHOOK_URL,
            json=memory_data,
            timeout=15
        )
        
        if response.status_code == 200:
            return True
        elif response.status_code == 429:
            # Rate limited - wait and retry
            if retry_count < 3:
                print(f"⏸️  Rate limited. Waiting {DELAY_ON_ERROR}s before retry {retry_count + 1}/3...")
                time.sleep(DELAY_ON_ERROR)
                return send_memory(memory_data, retry_count + 1)
            else:
                print(f"❌ Failed after 3 retries: {memory_data['memoryContent'][:50]}")
                return False
        else:
            print(f"⚠️  HTTP {response.status_code}: {memory_data['memoryContent'][:50]}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False

def export_memories():
    """Main export loop with batching and rate limiting"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get total count
        cursor.execute("SELECT COUNT(*) FROM memory_entries WHERE status = 'ACTIVE'")
        total = cursor.fetchone()[0]
        print(f"📊 Total memories to export: {total}")
        
        # Fetch all memories
        cursor.execute("""
            SELECT content, type, importance, confidence, 
                   support_count, status, is_protected, source
            FROM memory_entries
            WHERE status = 'ACTIVE'
            ORDER BY importance DESC, created_at DESC
        """)
        
        memories = cursor.fetchall()
        success_count = 0
        fail_count = 0
        batch_count = 0
        
        print(f"\n🚀 Starting export with {BATCH_SIZE} memories per batch, {DELAY_BETWEEN_BATCHES}s delay\n")
        
        for i, row in enumerate(memories, 1):
            memory_data = {
                "memoryContent": row[0],
                "memoryType": row[1].lower() if row[1] else "fact",
                "importance": row[2],
                "confidence": float(row[3]) if row[3] is not None else 0.0,
                "supportCount": row[4],
                "status": row[5].lower() if row[5] else "active",
                "isProtected": "yes" if row[6] else "no",
                "source": row[7] or "postgresql_export"
            }
            
            # Send the memory
            if send_memory(memory_data):
                success_count += 1
                print(f"✅ {i}/{total} | {memory_data['memoryContent'][:60]}...")
            else:
                fail_count += 1
            
            # Batch delay logic
            if i % BATCH_SIZE == 0 and i < total:
                batch_count += 1
                print(f"\n⏸️  Batch {batch_count} complete. Waiting {DELAY_BETWEEN_BATCHES}s...\n")
                time.sleep(DELAY_BETWEEN_BATCHES)
        
        # Final summary
        print(f"\n{'='*60}")
        print(f"✨ EXPORT COMPLETE")
        print(f"{'='*60}")
        print(f"✅ Successful: {success_count}")
        print(f"❌ Failed: {fail_count}")
        print(f"📊 Total: {total}")
        print(f"⏱️  Total batches: {batch_count + 1 if total > 0 else 0}")
        
        cursor.close()
        conn.close()
        
        if fail_count == 0 and total > 0:
            print("\n🎉 All memories exported successfully!")
            print(f"📊 View them: https://www.taskade.com/d/BoPHJMUEq9or9xJq")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    start_time = datetime.now()
    print(f"🧠 MEMEX → TASKADE MEMORY EXPORT")
    print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    export_memories()
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    print(f"\n⏱️  Duration: {duration:.1f} seconds ({duration/60:.1f} minutes)")
