
import os
import tkinter as tk
from tkinter import filedialog
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient

# Load environment variables
load_dotenv()

connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")

if not connection_string:
    raise ValueError("Azure connection string not found in .env")

# Connect to Azure
blob_service_client = BlobServiceClient.from_connection_string(
    connection_string
)

# Select access type
print("\nSelect Document Access:")
print("1. Private")
print("2. Public")

choice = input("Enter your choice (1 or 2): ").strip()

if choice == "1":
    container_name = "u2tools-private"
    access_type = "Private"

elif choice == "2":
    container_name = "u2tools-public"
    access_type = "Public"

else:
    print("Invalid choice!")
    exit()

# Open Windows file selection dialog
root = tk.Tk()
root.title("Select Document")
root.geometry("300x100")

# Bring dialog to foreground
root.attributes("-topmost", True)
root.lift()
root.focus_force()
root.update()

file_path = filedialog.askopenfilename(
    parent=root,
    title="Select a document to upload",
    filetypes=[
        ("All Documents", "*.pdf *.doc *.docx *.xls *.xlsx *.ppt *.pptx *.txt *.png *.jpg"),
        ("PDF Files", "*.pdf"),
        ("Word Documents", "*.doc *.docx"),
        ("Excel Files", "*.xls *.xlsx"),
        ("PowerPoint Files", "*.ppt *.pptx"),
        ("Text Files", "*.txt"),
        ("Image Files", "*.png *.jpg *.jpeg"),
        ("All Files", "*.*")
    ]
)

root.destroy()

# Check selection
if not file_path:
    print("No document selected. Upload cancelled.")
    exit()

file_name = os.path.basename(file_path)

try:
    # Get container
    container_client = blob_service_client.get_container_client(
        container_name
    )

    # Create container if missing
    if not container_client.exists():
        if access_type == "Public":
            container_client.create_container(
                public_access="blob"
            )
        else:
            container_client.create_container()

    # Upload file
    blob_client = container_client.get_blob_client(file_name)

    with open(file_path, "rb") as file:
        blob_client.upload_blob(
            file,
            overwrite=True
        )

    print("\n========== UPLOAD SUCCESS ==========")
    print("File Name :", file_name)
    print("Access    :", access_type)
    print("File Size :", round(os.path.getsize(file_path) / 1024, 2), "KB")
    print("Blob URL  :", blob_client.url)

    if access_type == "Private":
        print("Access    : Authentication required")
    else:
        print("Access    : Public URL")

except Exception as e:
    print("\nUpload Failed!")
    print("Error:", str(e))

    if access_type == "Public":
        print("Check Azure anonymous blob access settings.")
