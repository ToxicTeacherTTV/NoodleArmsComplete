import psycopg2
import csv
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Ensure UTF-8 output for Windows terminals
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        import codecs
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# Load environment variables from .env file
load_dotenv()

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')

def get_connection():
    """Establish database connection"""
    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL not found in .env file")
        sys.exit(1)
    return psycopg2.connect(DATABASE_URL)

def export_to_csv():
    """Fetch memories and write to CSV"""
    output_file = "memories_export.csv"
    
    try:
        print(f"🔌 Connecting to database...")
        conn = get_connection()
        cursor = conn.cursor()
        
        # Fetch all active memories
        print(f"🔍 Fetching active memories...")
        cursor.execute("""
            SELECT id, content, type, importance, confidence, 
                   support_count, status, is_protected, source, created_at
            FROM memory_entries
            WHERE status = 'ACTIVE'
            ORDER BY created_at DESC
        """)
        
        rows = cursor.fetchall()
        colnames = [desc[0] for desc in cursor.description]
        
        print(f"📊 Found {len(rows)} memories. Writing to {output_file}...")
        
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            # Write header
            writer.writerow(colnames)
            # Write data
            writer.writerows(rows)
            
        print(f"✅ Successfully exported {len(rows)} memories to {output_file}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    start_time = datetime.now()
    print(f"🧠 MEMORY EXPORT TO CSV")
    print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    export_to_csv()
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    print(f"\n⏱️  Duration: {duration:.1f} seconds")
