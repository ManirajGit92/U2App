# from openai import OpenAI
# from dotenv import load_dotenv
# load_dotenv()
# import os


# client=OpenAI(
#     base_url="https://manifoundryresource3.services.ai.azure.com/api/projects/proj-default/openai/v1",
#     api_key=os.getenv("API_KEY2")
# )

# input = input("Enter your message:")

# response = client.responses.create(
#     input=input,
#     extra_body={
#         "agent_reference":{
#             "name":"firstagent",
#             # "version":"7",
#             "type":"agent_reference"
#         }
#     }
# )

# print(response.output_text)

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

PROJECT_ENDPOINT = (
    "https://manifoundryresource3.services.ai.azure.com"
    "/api/projects/proj-default"
)

AGENT_NAME = "firstagent"

credential = DefaultAzureCredential()

project = AIProjectClient(
    endpoint=PROJECT_ENDPOINT,
    credential=credential
)

try:
    client = project.get_openai_client()

    response = client.responses.create(
        input="Summarize the invoice of CONTOSO invoice.",
        extra_body={
            "agent_reference": {
                "name": AGENT_NAME,
                "type": "agent_reference"
            }
        }
    )

    print(response.output_text)

finally:
    project.close()
