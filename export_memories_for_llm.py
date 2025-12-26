import psycopg2
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

def export_to_txt():
    """Fetch memories and write to a structured TXT file for LLM consumption"""
    output_file = "memories_for_llm.txt"
    
    try:
        print(f"🔌 Connecting to database...")
        conn = get_connection()
        cursor = conn.cursor()
        
        # Fetch all active memories
        print(f"🔍 Fetching active memories...")
        cursor.execute("""
            SELECT content, type, importance, confidence, source, created_at
            FROM memory_entries
            WHERE status = 'ACTIVE'
            ORDER BY importance DESC, created_at DESC
        """)
        
        rows = cursor.fetchall()
        
        print(f"📊 Found {len(rows)} memories. Formatting for LLM in {output_file}...")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"NICKY MEMORY EXPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"TOTAL MEMORIES: {len(rows)}\n")
            f.write("="*50 + "\n\n")
            
            for i, row in enumerate(rows, 1):
                content, m_type, importance, confidence, source, created_at = row
                
                f.write(f"MEMORY #{i}\n")
                f.write(f"Type: {m_type}\n")
                f.write(f"Importance: {importance}/100\n")
                f.write(f"Confidence: {float(confidence) if confidence else 0.0}\n")
                f.write(f"Source: {source}\n")
                f.write(f"Date: {created_at}\n")
                f.write(f"Content: {content}\n")
                f.write("-" * 30 + "\n\n")
            
        print(f"✅ Successfully exported {len(rows)} memories to {output_file}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    start_time = datetime.now()
    print(f"🧠 MEMORY EXPORT FOR LLM")
    print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    export_to_txt()
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    print(f"\n⏱️  Duration: {duration:.1f} seconds")
