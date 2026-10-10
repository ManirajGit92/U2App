from langchain.chat_models import init_chat_model
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ["API_KEY"]

llm = init_chat_model(
    model="azure_ai:gpt-5.6-luna",
    api_key=api_key,
    base_url=os.environ["LLM_ENDPOINT"]
)

response = llm.invoke("What is the capital of France?")

print(response.content)