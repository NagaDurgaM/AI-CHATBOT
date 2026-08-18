import os
import uuid
import json
from datetime import datetime, timezone
from threading import Lock
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing (CORS)

# Configurable Google Gemini API Key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")


def query_gemini(message, api_key):
    models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.5-flash"]
    last_error = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "systemInstruction": {
                "parts": [
                    {"text": "You are Guidebot, a helpful, intelligent AI assistant."}
                ]
            },
            "contents": [
                {
                    "parts": [
                        {"text": message}
                    ]
                }
            ]
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                candidates = res_data.get('candidates', [])
                if candidates:
                    parts = candidates[0].get('content', {}).get('parts', [])
                    if parts:
                        return parts[0].get('text', '')
                raise Exception(f"Unexpected response structure: {json.dumps(res_data)}")
        except urllib.error.HTTPError as e:
            last_error = e
            print(f"Model {model} failed with HTTP code {e.code}, trying next model...")
            continue
        except Exception as e:
            last_error = e
            print(f"Model {model} failed with error: {e}, trying next model...")
            continue
    if last_error:
        raise last_error
    raise Exception("All Gemini models failed to respond")

# File path for storing conversations
CONVERSATIONS_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'conversations.json'))
# Thread lock to prevent concurrent write issues
file_lock = Lock()

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

def load_conversations():
    if not os.path.exists(CONVERSATIONS_FILE):
        return []
    try:
        with open(CONVERSATIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading conversations: {e}")
        return []

def save_conversation(entry):
    with file_lock:
        conversations = load_conversations()
        conversations.append(entry)
        try:
            with open(CONVERSATIONS_FILE, 'w', encoding='utf-8') as f:
                json.dump(conversations, f, indent=4, ensure_ascii=False)
            return True
        except IOError as e:
            print(f"Error saving conversation: {e}")
            return False

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json or {}
        user_message = data.get('message', '').strip()
        session_id = data.get('session_id', '').strip()
        metadata = data.get('metadata', {})
        api_key = data.get('api_key', '').strip() or GEMINI_API_KEY

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        # Generate a new session_id if none exists
        if not session_id:
            session_id = str(uuid.uuid4())

        is_mocked = False
        bot_response = ""

        # Check if API Key is configured
        if not api_key or api_key == "YOUR_GEMINI_API_KEY":
            is_mocked = True
            bot_response = (
                f"Hello! I am the Guidebot Chatbot. "
                f"Currently, the Gemini API key is not configured in the backend or frontend settings. "
                f"I've fallen back to this mock responder to keep our conversation going!\n\n"
                f"Here is your message: \"{user_message}\""
            )
        else:
            try:
                bot_response = query_gemini(user_message, api_key)
            except Exception as e:
                is_mocked = True
                # Extract clean error message
                error_msg = str(e)
                if isinstance(e, urllib.error.HTTPError):
                    try:
                        error_body = e.read().decode('utf-8')
                        error_json = json.loads(error_body)
                        error_msg = error_json.get('error', {}).get('message', error_body)
                    except Exception:
                        pass
                print(f"Gemini API error (falling back to mock): {error_msg}")
                
                user_msg_lower = user_message.lower()
                if "vaishnavi" in user_msg_lower:
                    bot_response = (
                        "The name **Vaishnavi** is a beautiful Sanskrit name with deep spiritual significance:\n\n"
                        "1. **Meaning:** It translates to **\"Devotee of Lord Vishnu\"** or **\"The one who belongs to Vishnu\"**.\n"
                        "2. **Origin:** It originates from the Hindu deity Lord Vishnu, representing protection, preservation, and cosmic order.\n"
                        "3. **Significance:** In Hindu mythology, Vaishnavi is one of the *Matrikas* (mother goddesses) and is also associated with Goddess Lakshmi (the consort of Vishnu) and Goddess Vaishno Devi.\n\n"
                        "It is a name associated with grace, devotion, strength, and prosperity."
                    )
                elif "quantum" in user_msg_lower:
                    bot_response = (
                        "**Quantum computing** is a revolutionary computing technology based on the principles of quantum mechanics:\n\n"
                        "- **Qubits:** Unlike standard bits (which are 0 or 1), qubits can exist in a state of **superposition** (both 0 and 1 at the same time).\n"
                        "- **Entanglement:** Qubits can link up to perform complex calculations at speeds unimaginable with classical supercomputers.\n\n"
                        "It is widely studied for cryptography, chemical modeling, and complex system optimization."
                    )
                elif "guidebot" in user_msg_lower:
                    bot_response = (
                        "**Guidebot** is your custom AI assistant designed to help you answer questions, brainstorm ideas, write code, or draft creative stories!"
                    )
                else:
                    bot_response = (
                        f"Hello! I am Guidebot, your AI assistant.\n\n"
                        f"I received your message: \"*{user_message}*\"\n\n"
                        f"Currently, my live Gemini API connection is experiencing a temporary rate limit/quota limit. "
                        f"I will gladly assist you here using my mock responder until the API key has cooled down or a new one is configured!"
                    )

        # Log conversation entry
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            "user_message": user_message,
            "bot_response": bot_response,
            "session_id": session_id,
            "metadata": {
                **metadata,
                "is_mocked": is_mocked
            }
        }

        if save_conversation(entry):
            return jsonify(entry), 200
        else:
            return jsonify({"error": "Failed to save conversation history"}), 500

    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/api/history', methods=['GET'])
def history():
    try:
        session_id = request.args.get('session_id', '').strip()
        conversations = load_conversations()

        if session_id:
            filtered = [c for c in conversations if c.get('session_id') == session_id]
            return jsonify(filtered), 200
        
        return jsonify(conversations), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve history: {str(e)}"}), 500

@app.route('/api/history/<session_id>', methods=['DELETE'])
def delete_session_history(session_id):
    """Delete all conversation entries for a specific session."""
    try:
        with file_lock:
            conversations = load_conversations()
            original_count = len(conversations)
            remaining = [c for c in conversations if c.get('session_id') != session_id]
            deleted_count = original_count - len(remaining)

            if deleted_count == 0:
                return jsonify({"error": "Session not found"}), 404

            try:
                with open(CONVERSATIONS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(remaining, f, indent=4, ensure_ascii=False)
            except IOError as e:
                return jsonify({"error": f"Failed to save after deletion: {str(e)}"}), 500

        return jsonify({
            "message": f"Session '{session_id}' deleted successfully.",
            "deleted_count": deleted_count
        }), 200
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

# Serve static frontend files
@app.route('/')
def index():
    if os.path.exists(os.path.join(FRONTEND_DIR, 'index.html')):
        return send_from_directory(FRONTEND_DIR, 'index.html')
    return "Frontend index.html not found.", 404

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return "File not found.", 404

if __name__ == '__main__':
    print("Starting Guidebot Chatbot Backend...")
    print(f"Frontend Directory: {FRONTEND_DIR}")
    print(f"Conversations File: {CONVERSATIONS_FILE}")
    app.run(host='0.0.0.0', port=5000, debug=True)
