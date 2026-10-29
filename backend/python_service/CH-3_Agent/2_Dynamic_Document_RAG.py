from pathlib import Path

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import (
    FileSearchTool,
    PromptAgentDefinition,
)

# --------------------------------------------------
# Configuration
# --------------------------------------------------

PROJECT_ENDPOINT = (
    "https://manifoundryresource3.services.ai.azure.com"
    "/api/projects/proj-default"
)

MODEL_NAME = "gpt-5.2"
AGENT_NAME = "dynamic-document-rag"

# --------------------------------------------------
# Get dynamic input from the user
# --------------------------------------------------

print("\n=== Azure AI Foundry: Dynamic Document RAG ===\n")

prompt = input("Enter your question or prompt: ").strip()

if not prompt:
    raise ValueError("Please enter a prompt.")

print("\nEnter the full path of each document.")
print("Separate multiple paths using commas.")

document_paths_input = input("Document paths: ").strip()

if not document_paths_input:
    raise ValueError("Please provide at least one document.")

document_paths = [
    Path(path.strip().strip('"')).expanduser().resolve()
    for path in document_paths_input.split(",")
    if path.strip()
]

for path in document_paths:
    if not path.is_file():
        raise FileNotFoundError(f"Document not found: {path}")

# --------------------------------------------------
# Connect to Azure AI Foundry
# --------------------------------------------------

credential = DefaultAzureCredential()

project = AIProjectClient(
    endpoint=PROJECT_ENDPOINT,
    credential=credential,
)

openai = None
vector_store = None
agent = None

try:
    openai = project.get_openai_client()

    # --------------------------------------------------
    # Create a vector store for the selected documents
    # --------------------------------------------------

    vector_store = openai.vector_stores.create(
        name="DynamicDocumentStore"
    )

    print("\nUploading and indexing documents...")

    for document_path in document_paths:
        print(f"Processing: {document_path.name}")

        with document_path.open("rb") as document:
            openai.vector_stores.files.upload_and_poll(
                vector_store_id=vector_store.id,
                file=document,
            )

    print("Document indexing completed.")

    # --------------------------------------------------
    # Create an agent with File Search enabled
    # --------------------------------------------------

    agent = project.agents.create_version(
        agent_name=AGENT_NAME,
        definition=PromptAgentDefinition(
            model=MODEL_NAME,
            instructions=(
                "You are a document analysis assistant. "
                "Use File Search to answer questions based on "
                "the uploaded documents. "
                "Do not invent facts that are not supported "
                "by the documents. "
                "If the answer is not available, say so. "
                "Mention the relevant document or evidence "
                "when possible."
            ),
            tools=[
                FileSearchTool(
                    vector_store_ids=[vector_store.id]
                )
            ],
        ),
        description="Agent for dynamically uploaded documents",
    )

    # --------------------------------------------------
    # Execute the user's dynamic prompt
    # --------------------------------------------------

    print("\nSearching documents and generating answer...\n")

    response = openai.responses.create(
        input=prompt,
        extra_body={
            "agent_reference": {
                "name": agent.name,
                "type": "agent_reference",
            }
        },
    )

    print("=" * 60)
    print("ANSWER")
    print("=" * 60)
    print(response.output_text)

finally:
    # --------------------------------------------------
    # Clean up temporary resources
    # --------------------------------------------------

    if agent is not None:
        try:
            project.agents.delete_version(
                agent_name=agent.name,
                agent_version=agent.version,
            )
        except Exception as error:
            print(f"Agent cleanup warning: {error}")

    if openai is not None and vector_store is not None:
        try:
            openai.vector_stores.delete(vector_store.id)
        except Exception as error:
            print(f"Vector store cleanup warning: {error}")

    project.close()