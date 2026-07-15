import os
from flask import Flask, request, jsonify
from google import genai

app = Flask(__name__)

# Gemini API Key Render Environment Variable se automatically read karega
API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)

SYSTEM_PROMPT = """
Aap ek helpful sales assistant hain.
- Friendly short Hinglish reply dein.
- Agar user 'PDF', 'Brochure' ya 'Syllabus' bole, toh kahein: "Ji bilkul, main aapko brochure PDF bhej raha hoon."
- Agar user 'Demo' ya 'Video' bole, toh kahein: "Ji bilkul, main aapko Demo video bhej raha hoon."
- Agar user 'Photo', 'Banner' ya 'Poster' bole, toh kahein: "Ji bilkul, main aapko poster bhej raha hoon."
"""

@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "active", "message": "Python AI Server Running!"})

@app.route('/process-message', methods=['POST'])
def process_message():
    try:
        data = request.json or {}
        user_msg = str(data.get('message', '')).strip()

        if not user_msg:
            return jsonify({"reply_text": ""})

        # Generate Gemini AI Reply with Fallback
        try:
            # 1. Primary Model (Latest & Extremely Fast)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=f"{SYSTEM_PROMPT}\nUser: {user_msg}\nAssistant:"
            )
            ai_text = response.text
        except Exception as model_err:
            print(f"⚠️ Primary model error: {model_err}, trying fallback model...")
            # 2. Backup Model (Stable 2.0 Version)
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=f"{SYSTEM_PROMPT}\nUser: {user_msg}\nAssistant:"
            )
            ai_text = response.text

        return jsonify({
            "reply_text": ai_text
        })

    except Exception as e:
        print("❌ AI Error:", str(e))
        # Fallback response so conversation doesn't break
        return jsonify({"reply_text": "Namaste! Main aapki help ke liye tayaar hoon. Kripya apna sawal puchein."})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Server running on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
