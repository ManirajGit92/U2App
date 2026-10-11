from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()
import os

endpoint = os.environ["LLM_ENDPOINT"]
deployment_name = "gpt-5.6-luna"
api_key = os.environ["API_KEY"]


client = OpenAI(
    base_url=endpoint,
    api_key=api_key
)

response = client.responses.create(
    model=deployment_name,
    input="What is the capital of France?",
)

# print(f"answer: {response.output[0]}")
print(response.output_text)
