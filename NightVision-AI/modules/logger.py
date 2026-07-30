import sqlite3
import datetime
import os

class DatabaseLogger:
    def __init__(self, db_path):
        self.db_path = db_path
        self.init_db()

    def init_db(self):
        """
        Creates the database directory and initializes the detections log table.
        """
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
            
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS hazard_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                label TEXT NOT NULL,
                confidence REAL NOT NULL,
                distance REAL NOT NULL,
                risk TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()

    def log_detection(self, label, confidence, distance, risk):
        """
        Inserts a new detection record into the SQLite database.
        """
        timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO hazard_logs (timestamp, label, confidence, distance, risk)
                VALUES (?, ?, ?, ?, ?)
            ''', (timestamp, label, confidence, distance, risk))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Database logging error: {e}")

    def fetch_recent_logs(self, limit=50):
        """
        Fetches the most recent detection logs.
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT timestamp, label, confidence, distance, risk 
                FROM hazard_logs 
                ORDER BY id DESC 
                LIMIT ?
            ''', (limit,))
            rows = cursor.fetchall()
            conn.close()
            return rows
        except Exception as e:
            print(f"Database retrieval error: {e}")
            return []

    def clear_logs(self):
        """
        Deletes all logged records.
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('DELETE FROM hazard_logs')
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Database clear error: {e}")
