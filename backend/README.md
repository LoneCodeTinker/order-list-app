# Order List App Backend

A FastAPI backend for the order list app. Handles Excel inventory upload, barcode search, and order saving as Excel files.

## Features
- Upload and parse Excel inventory files
- Search for items by barcode
- Save order lists as Excel files (named with date, customer name, and username)
- CORS enabled for frontend communication

## Getting Started
1. Create a virtual environment:
   ```
   python -m venv venv
   .\venv\Scripts\activate
   ```
2. Install dependencies:
   ```
   pip install fastapi uvicorn[standard] openpyxl python-multipart
   ```
3. Run the server:
   ```
   uvicorn main:app --reload
   ```

## Endpoints
- `POST /upload-inventory` - Upload Excel inventory file
- `GET /item/{barcode}` - Search for item by barcode
- `POST /save-order` - Save order as Excel file

# Backend API for Order List App

This FastAPI backend provides endpoints for:
- Uploading and parsing Excel inventory files
- Searching items by barcode
- Saving order lists as Excel files (named with date, customer name, and username)

## Setup
1. Create a virtual environment and activate it:
   ```
   python -m venv venv
   venv\Scripts\activate  # On Windows
   source venv/bin/activate  # On Linux/Mac
   ```
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Start the server:
   ```
   uvicorn main:app --reload
   ```

## API Endpoints
- `POST /upload-inventory` — Upload Excel inventory file
- `GET /item/{barcode}` — Lookup item by barcode
- `POST /save-order` — Save order as Excel file

## Notes
- Enable CORS for frontend communication
- Order files are saved to the directory specified in `.env`
