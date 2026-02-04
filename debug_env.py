
import os
from dotenv import load_dotenv

# Try explicit path
env_path = os.path.join(os.getcwd(), 'backend', '.env')
print(f"Checking for .env at: {env_path}")
print(f"File exists: {os.path.exists(env_path)}")

load_dotenv(dotenv_path=env_path)

key = os.getenv("OPENROUTER_API_KEY")
print(f"API Key loaded: {'YES' if key else 'NO'}")
if key:
    print(f"Key starts with: {key[:5]}...")
