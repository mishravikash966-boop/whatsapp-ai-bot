import os
import time
from flask import Flask, jsonify, request, send_from_directory
from google import genai
from google.genai import errors

app = Flask(__name__)

# Directory path rules
AUDIO_FOLDER = "static_audio"
if not os.path.exists(AUDIO_FOLDER):
    os.makedirs(AUDIO_FOLDER)

# Initialize Google GenAI Engine
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)


def generate_ai_response(prompt_text):
    """General user inquiries ke liye multi-model dynamic handling framework."""
    models_to_try = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]

    for model_name in models_to_try:
        try:
            print(f"🤖 Fetching contextual insights using: {model_name}...")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt_text,
            )
            if response and response.text:
                return response.text
        except errors.APIError as e:
            print(f"⚠️ Limit reached or API Error on {model_name}: {e.message}")
        except Exception as e:
            print(f"❌ Internal processing failure on {model_name}: {str(e)}")

    return "Namaste! Hamara system abhi temporary load par hai. Kripya 1 minute baad dobara koshish karein."


@app.route("/audio/<filename>", methods=["GET"])
def serve_audio(filename):
    """WhatsApp dashboard application gateway ko standard files deliver karne ke liye."""
    return send_from_directory(AUDIO_FOLDER, filename)


@app.route("/", methods=["GET", "HEAD"])
def status_check():
    """Application performance monitoring/UptimeRobot connectivity test tier."""
    return "Official API Bot Layer Active 🟢", 200


@app.route("/process-message", methods=["POST"])
def process_message():
    """Webhook core routing controller."""
    try:
        data = request.get_json()
        if not data or "message" not in data:
            return (
                jsonify({"status": "error", "reply": "Malformed Request Payload"}),
                400,
            )

        user_message = data["message"].strip()
        clean_msg = user_message.lower()
        base_url = request.host_url.rstrip("/")

        # 🎯 CASE 1: FIXED SALES VOICE ROUTING (JAISE PDF JAATI THI)
        if "demo" in clean_msg or "voice" in clean_msg:
            print("🎯 Match Found: Dispatching ElevenLabs Pre-recorded Asset...")
            static_voice_url = f"{base_url}/audio/sales_demo.mp3"

            return (
                jsonify(
                    {
                        "status": "success",
                        "send_type": "voice_only",
                        "audio_url": static_voice_url,
                        "reply": "",  # Text validation check bypass
                    }
                ),
                200,
            )

        # 🎯 CASE 2: CORE DYNAMIC DUAL CHAT LAYER (TEXT ONLY)
        ai_text_reply = generate_ai_response(user_message)

        return (
            jsonify(
                {
                    "status": "success",
                    "send_type": "text",
                    "reply": ai_text_reply,
                }
            ),
            200,
        )

    except Exception as server_err:
        print(f"🚨 Webhook Gateway Failure: {str(server_err)}")
        return (
            jsonify({"status": "error", "reply": "Internal Server Anomaly Logged"}),
            500,
        )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
