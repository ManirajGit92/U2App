from pathlib import Path
from collections.abc import Mapping

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

INSTRUCTIONS = (
    "You are a document analysis assistant. "
    "Use File Search to answer questions based on "
    "the uploaded documents. "
    "Do not invent facts that are not supported "
    "by the documents. "
    "If the answer is not available, say so. "
    "Mention the relevant document or evidence when possible."
)


# --------------------------------------------------
# Extract vector store IDs from an agent definition
# --------------------------------------------------

def find_vector_store_ids(data):

    if isinstance(data, Mapping):
        for key, value in data.items():

            if key == "vector_store_ids" and isinstance(value, list):
                return value

            result = find_vector_store_ids(value)

            if result:
                return result

    elif isinstance(data, (list, tuple)):
        for item in data:
            result = find_vector_store_ids(item)

            if result:
                return result

    return []

# --------------------------------------------------
# Get dynamic input
# --------------------------------------------------

print("\n=== Azure Foundry Dynamic Document RAG ===\n")

prompt = input("Enter your question: ").strip()

if not prompt:
    raise ValueError("Please enter a question.")

document_paths_input = input(
    "Enter document paths (comma separated): "
).strip()

if not document_paths_input:
    raise ValueError("Please provide documents.")

document_paths = [
    Path(path.strip().strip('"')).expanduser().resolve()
    for path in document_paths_input.split(",")
    if path.strip()
]

for path in document_paths:
    if not path.is_file():
        raise FileNotFoundError(f"Document not found: {path}")

# --------------------------------------------------
# Connect to Azure Foundry
# --------------------------------------------------

credential = DefaultAzureCredential()

project = AIProjectClient(
    endpoint=PROJECT_ENDPOINT,
    credential=credential,
)

try:

    openai = project.get_openai_client()

    # --------------------------------------------------
    # Check whether agent already exists
    # --------------------------------------------------

    existing_agent = next(
        (
            item
            for item in project.agents.list()
            if item.name == AGENT_NAME
        ),
        None,
    )

    vector_store_id = None

    if existing_agent:

        print(f"\nExisting agent found: {AGENT_NAME}")

        latest_info = existing_agent.versions["latest"]
        latest_version = latest_info["version"]

        print(f"Existing version: {latest_version}")

        # Retrieve the existing agent definition
        agent_version = project.agents.get_version(
            agent_name=AGENT_NAME,
            agent_version=latest_version,
        )

        # Check whether File Search is already configured
        vector_store_ids = find_vector_store_ids(
            agent_version.get("definition", {})
        )

        if vector_store_ids:

            vector_store_id = vector_store_ids[0]

            print("Reusing existing vector store:")
            print(vector_store_id)

        else:

            print("No File Search vector store found.")
            print("Creating a vector store and new agent version.")

    else:

        print(f"\nAgent not found: {AGENT_NAME}")
        print("Creating agent for the first time.")

    # --------------------------------------------------
    # Create vector store only when required
    # --------------------------------------------------

    if not vector_store_id:

        vector_store = openai.vector_stores.create(
            name=f"{AGENT_NAME}-documents"
        )

        vector_store_id = vector_store.id

        print("\nVector store created:", vector_store_id)

        # Create first agent or add a new version
        # under the same existing agent name.

        agent = project.agents.create_version(
            agent_name=AGENT_NAME,
            definition=PromptAgentDefinition(
                model=MODEL_NAME,
                instructions=INSTRUCTIONS,
                tools=[
                    FileSearchTool(
                        vector_store_ids=[vector_store_id]
                    )
                ],
            ),
            description="Dynamic Document RAG Agent",
        )

        print("\nAgent version configured successfully.")
        print("Agent:", agent.name)
        print("Version:", agent.version)

    # --------------------------------------------------
    # Upload documents to the selected vector store
    # --------------------------------------------------

    print("\nUploading documents...")

    for document_path in document_paths:

        print(f"Processing: {document_path.name}")

        with document_path.open("rb") as document:

            uploaded_file = openai.vector_stores.files.upload_and_poll(
                vector_store_id=vector_store_id,
                file=document,
            )

        print("Uploaded:", document_path.name)
        print("File ID:", uploaded_file.id)

    print("\nDocument indexing completed.")

    # --------------------------------------------------
    # Execute the question using the existing agent
    # --------------------------------------------------

    print("\nSearching documents and generating answer...\n")

    response = openai.responses.create(
        input=prompt,
        extra_body={
            "agent_reference": {
                "name": AGENT_NAME,
                "type": "agent_reference",
            }
        },
    )

    print("=" * 60)
    print("ANSWER")
    print("=" * 60)
    print(response.output_text)

    print("\nAgent:", AGENT_NAME)
    print("Vector Store:", vector_store_id)
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