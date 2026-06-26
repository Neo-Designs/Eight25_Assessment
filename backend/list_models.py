import google.generativeai as genai
import os

# Ensure your API key is configured
# Replace 'YOUR_API_KEY' with your actual key if not already set in environment
api_key = os.getenv("GEMINI_API_KEY") 
genai.configure(api_key=api_key)

print("Available models supporting 'generateContent':")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(f"Model Name: {m.name}")