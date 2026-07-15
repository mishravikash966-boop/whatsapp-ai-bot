import os
from flask import Flask, jsonify, request
from google import genai
from google.genai import errors

app = Flask(__name__)

# 1. Initialize Gemini Client using Environment Variable
# Render ke Environment settings me GEMINI_API_KEY set hona zaroori hai.
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)


def generate_ai_response(prompt_text):
    """Dono primary aur fallback models ko sequentially try karta hai rate limit se

    bachne ke liye.
    """
    # Sabhi available models ki hierarchy list
    models_to_try = [
        "gemini-2.5-flash",  # Primary Fast Model
        "gemini-1.5-flash",  # High Stable Free Tier
        "gemini-1.5-pro",  # Powerful Fallback
    ]

    for model_name in models_to_try:
        try:
            print(f"🤖 Attempting response with model: {model_name}...")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt_text,
            )
            # Response success hote hi return kar do
            if response and response.text:
                print(f"✅ Success with model: {model_name}")
                return response.text

        except errors.APIError as e:
            # Agar rate limit (429) ya koi specific API error aata hai
            print(f"⚠️ Model {model_name} failed with API Error: {e.message}")
        except Exception as e:
            # Kisi bhi general failover ke liye
            print(f"❌ Unexpected error on model {model_name}: {str(e)}")

    # Agar saare ke saare models exhaust ho jayein, tabhi yeh static text jayega
    return "Namaste! Main aapki seva me hu. Abhi system thoda busy hai, kripya 1 minute baad dobara apna sawal puchein."


@app.route("/", methods=["GET", "HEAD"])
def home():
    """UptimeRobot ki pings (HEAD/GET) ko handle karne ke liye endpoint."""
    return "AI Chatbot Backend is Live and Active! 🟢", 200


@app.route("/process-message", methods=["POST"])
def process_message():
    """WhatsApp Bridge se aane waale incoming messages ko process karne wala webhook

    endpoint.
    """
    try:
        data = request.get_json()

        # Input validation
        if not data or "message" not in data:
            return jsonify({"status": "error", "reply": "Invalid Request Data"}), 400

        user_message = data["message"].strip()
        print(f"📩 Incoming Message: '{user_message}'")

        # 2. KEYWORD LOGIC (Bina AI ke direct check)
        # Agar exact keyword milta hai, toh bina AI call ke direct dynamic data return karein
        clean_msg = user_message.lower()
        if "demo" in clean_msg or "pdf" in clean_msg:
            print("🎯 Keyword Match: Sending Demo File Info.")
            return (
                jsonify(
                    {
                        "status": "success",
                        "reply": "Aapka Demo File / PDF ready hai. Aap niche diye gaye link se ise download kar sakte hain: https://example.com/demo.pdf",
                    }
                ),
                200,
            )

        # 3. DYNAMIC AI LOGIC
        # Agar keyword match nahi hua, toh hamare multi-model AI function ko call karein
        ai_reply = generate_ai_response(user_message)

        return jsonify({"status": "success", "reply": ai_reply}), 200

    except Exception as main_err:
        print(f"🚨 Critical Failure in /process-message endpoint: {str(main_err)}")
        return (
            jsonify(
                {
                    "status": "error",
                    "reply": "System me temporary glitch hai. Please try again.",
                }
            ),
            500,
        )


if __name__ == "__main__":
    # Render default port 10000 use karta hai
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
