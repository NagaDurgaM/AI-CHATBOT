# AI-CHATBOT

A full-stack AI Chatbot with a modern, glassmorphic responsive HTML/CSS/JS frontend, a lightweight Python (Flask) backend, and persistent conversation logging in a local JSON file.

---

## Folder Structure

```text
/chatbot
  ├── backend/
  │   ├── app.py           # Flask server, Gemini API routes, & logging code
  │   └── requirements.txt # Python dependencies (Flask, CORS)
  ├── frontend/
  │   ├── index.html       # Chat layout and suggestion cards
  │   ├── styles.css       # Responsive glassmorphic CSS styling
  │   └── app.js           # Client-side state, API fetch, & markdown formatter
  ├── conversations.json   # Local database (generated automatically on first chat)
  └── README.md            # This documentation file
```

---

## Getting Started

### 1. Install Dependencies

Ensure Python is installed on your machine. You can install the required packages using pip:

```bash
pip install -r backend/requirements.txt
```

*(Note: If Python was just installed and is not yet on your PATH, you can run pip using its absolute path: `C:\Users\hemas\AppData\Local\Programs\Python\Python312\Scripts\pip.exe install -r backend/requirements.txt`)*

### 2. Configure Google Gemini API Key

The Google Gemini API key settings are hardcoded in the backend. 
Open [backend/app.py](file:///c:/Users/hemas/Desktop/chatbot/backend/app.py) and replace the value of `GEMINI_API_KEY`:

```python
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"
```

> [!NOTE]
> **Out-of-the-box Testing**: If you run the project *before* replacing the key, the chatbot will fallback to friendly mock responses that let you test the interface, sessions, and log storage functionality immediately.

### 3. Run the Backend Server

Start the Flask server by running:

```bash
python backend/app.py
```

*(Or via absolute path: `C:\Users\hemas\AppData\Local\Programs\Python\Python312\python.exe backend/app.py`)*

The server will boot on **port 5000**.

### 4. Open the Chat Application

You can access the modern chatbot interface in two ways:
1. **Via Server**: Navigate to `http://localhost:5000/` in any browser (the Flask server serves the frontend statically).
2. **Directly**: Open the [frontend/index.html](file:///c:/Users/hemas/Desktop/chatbot/frontend/index.html) file directly in your browser.

---

## Features

- **Modern UI**: Sleek dark space theme with a subtle purple-cyan glow, glassmorphic elements, pulsing status dots, and smooth entry animations for message bubbles.
- **Session Management**: Automatically generates a unique session UUID on load (saved in `localStorage`), enabling chat categorization on the sidebar. Users can start a "New Chat" at any time.
- **Persistent Log Storage**: Every exchange is appended to a local `conversations.json` file in the root directory.
- **Formatted Outputs**: The frontend parses basic Markdown (`**bold**`, `*italics*`, `inline code`, block code ```, and bullet points) to display responses in structured layout format.
- **Prompt Suggestions**: Interactive dashboard cards that let users submit prompt examples with a single click.

---

## Log Schema (`conversations.json`)

Each conversation is stored in `conversations.json` with the following structure:

```json
{
    "id": "e581297e-128a-4c28-9844-48600cbde70e",
    "timestamp": "2026-07-09T17:42:15.392Z",
    "user_message": "What is quantum computing?",
    "bot_response": "Quantum computing is a field of computing...",
    "session_id": "402eb7b8-687f-4f62-b91c-b841e403d159",
    "metadata": {
        "user_agent": "Mozilla/5.0 ...",
         "is_mocked": false
    }
}
```
