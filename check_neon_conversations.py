import psycopg2
import os
from datetime import datetime

database_url = "postgresql://neondb_owner:npg_g8qWAERIsTL3@ep-jolly-surf-ag8tj5ky.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    # Find conversations from today (Dec 26, 2025)
    # Note: The database might use UTC, so we'll look for anything in the last 24 hours
    query = """
    SELECT id, title, created_at
    FROM conversations
    WHERE created_at >= '2025-12-25'
    ORDER BY created_at DESC
    """
    
    cursor.execute(query)
    conversations = cursor.fetchall()

    if not conversations:
        print("No conversations found from today.")
        # Let's look for the most recent ones regardless of date
        print("Looking for the 5 most recent conversations...")
        cursor.execute('SELECT id, title, created_at FROM conversations ORDER BY created_at DESC LIMIT 5')
        conversations = cursor.fetchall()

    for conv_id, title, created_at in conversations:
        print(f"\n--- Conversation ID: {conv_id} | Title: {title} | Created: {created_at} ---")
        
        # Get messages for this conversation
        msg_query = """
        SELECT type, content, created_at
        FROM messages
        WHERE conversation_id = %s
        ORDER BY created_at ASC
        """
        cursor.execute(msg_query, (conv_id,))
        messages = cursor.fetchall()
        
        for role, content, msg_created_at in messages:
            print(f"[{msg_created_at}] {role.upper()}: {content[:200]}..." if len(content) > 200 else f"[{msg_created_at}] {role.upper()}: {content}")

    conn.close()
except Exception as e:
    print(f"Error: {e}")
