# # Before running the sample:
# #    pip install azure-ai-projects>=2.1.0

# from azure.identity import DefaultAzureCredential
# from azure.ai.projects import AIProjectClient

# endpoint = "https://manifoundryresource3.services.ai.azure.com/api/projects/proj-default"

# project_client = AIProjectClient(
#     endpoint=endpoint,
#     credential=DefaultAzureCredential(),
# )

# my_agent = "firstagent"
# my_version = "2"

# openai_client = project_client.get_openai_client()

# # Reference the agent to get a response
# response = openai_client.responses.create(
#     input=[{"role": "user", "content": "Tell me what you can help with."}],
#     extra_body={"agent_reference": {"name": my_agent, "version": my_version, "type": "agent_reference"}},
# )

# print(f"Response output: {response.output_text}")



from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()
import os


client=OpenAI(
    base_url="https://manifoundryresource3.services.ai.azure.com/api/projects/proj-default/openai/v1",
    api_key=os.getenv("API_KEY2")
)

input = input("Enter your message:")

response = client.responses.create(
    input=input,
    extra_body={
        "agent_reference":{
            "name":"firstagent",
            # "version":"7",
            "type":"agent_reference"
        }
    }
)

print(response.output_text)