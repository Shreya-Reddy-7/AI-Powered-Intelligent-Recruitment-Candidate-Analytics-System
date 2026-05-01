import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESUME_DB = os.path.join(BASE_DIR, 'database', 'resume_database.db')

conn = sqlite3.connect(RESUME_DB)
cursor = conn.cursor()

# Add missing columns if they don't exist
try:
    cursor.execute("ALTER TABLE resumes ADD COLUMN username TEXT")
    print("Added username column")
except:
    print("username column already exists")

try:
    cursor.execute("ALTER TABLE resumes ADD COLUMN filename TEXT")
    print("Added filename column")
except:
    print("filename column already exists")

try:
    cursor.execute("ALTER TABLE resumes ADD COLUMN file_content BLOB")
    print("Added file_content column")
except:
    print("file_content column already exists")

try:
    cursor.execute("ALTER TABLE resumes ADD COLUMN upload_date TEXT")
    print("Added upload_date column")
except:
    print("upload_date column already exists")

conn.commit()
conn.close()
print("Database updated successfully")