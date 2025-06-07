from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import os
from dotenv import load_dotenv
import json
import openpyxl
from openpyxl import load_workbook
from datetime import datetime
import glob
import re

load_dotenv()

app = FastAPI()

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory inventory (barcode -> {name, price})
inventory = {}

UPLOAD_DIR = os.path.join(os.getcwd(), "uploaded_inventory")
ORDER_SAVE_DIR = os.getenv("ORDER_SAVE_DIR", os.path.join(os.getcwd(), "orders"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(ORDER_SAVE_DIR, exist_ok=True)

def get_latest_inventory_file():
    files = glob.glob(os.path.join(UPLOAD_DIR, '*.xls*'))
    if not files:
        return None
    return max(files, key=os.path.getctime)

@app.post("/upload-inventory")
def upload_inventory(file: UploadFile = File(...)):
    # Only accept .xls or .xlsx
    if not (file.filename.endswith('.xls') or file.filename.endswith('.xlsx')):
        return JSONResponse(status_code=400, content={"error": "Only .xls and .xlsx files are allowed."})
    # Save uploaded file with timestamp
    now = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    ext = os.path.splitext(file.filename)[1]
    new_filename = f"{now}{ext}"
    file_path = os.path.join(UPLOAD_DIR, new_filename)
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    # Load inventory into memory
    wb = openpyxl.load_workbook(file_path)
    ws = wb.active
    inventory.clear()
    for row in ws.iter_rows(min_row=2, values_only=True):
        barcode, name, price = row[0], row[1], row[2] if len(row) > 2 else (None)
        if barcode:
            inventory[str(barcode)] = {"name": name, "price": price if price is not None else 0.0}
    return {"count": len(inventory), "saved_as": file_path}

@app.get("/latest-inventory")
def latest_inventory():
    latest_file = get_latest_inventory_file()
    if not latest_file:
        return JSONResponse(status_code=404, content={"error": "No inventory file found."})
    # Load inventory into memory
    wb = openpyxl.load_workbook(latest_file)
    ws = wb.active
    inventory.clear()
    for row in ws.iter_rows(min_row=2, values_only=True):
        barcode, name, price = row[0], row[1], row[2] if len(row) > 2 else (None)
        if barcode:
            inventory[str(barcode)] = {"name": name, "price": price if price is not None else 0.0}
    return {"count": len(inventory), "filename": os.path.basename(latest_file)}

@app.get("/item/{barcode}")
def get_item(barcode: str):
    # Always use latest inventory file
    latest_file = get_latest_inventory_file()
    if not latest_file:
        return JSONResponse(status_code=404, content={"error": "No inventory file found."})
    wb = openpyxl.load_workbook(latest_file)
    ws = wb.active
    temp_inventory = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        barcode_val, name, price = row[0], row[1], row[2] if len(row) > 2 else (None)
        if barcode_val:
            temp_inventory[str(barcode_val)] = {"name": name, "price": price if price is not None else 0.0}
    item = temp_inventory.get(barcode)
    if item:
        return item
    return JSONResponse(status_code=404, content={"error": "Item not found"})

@app.post("/save-order")
def save_order(
    customer_name: str = Form(...),
    customer_phone: str = Form(...),
    username: str = Form(...),
    items: str = Form(...),
    created_by: str = Form(...),
):
    from openpyxl.styles import Alignment
    items_list = json.loads(items)
    now = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    # Clean filename for Windows
    def clean_filename(s):
        return "".join(c for c in s if c.isalnum() or c in (' ', '-', '_')).rstrip()
    safe_customer = clean_filename(customer_name)
    safe_username = clean_filename(username)
    safe_created_by = clean_filename(created_by)
    filename = f"{now}_{safe_customer}_{safe_username}-created by {safe_created_by}.xlsx"
    filepath = os.path.join(ORDER_SAVE_DIR, filename)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Order"
    ws.append(["Customer Name", customer_name])
    ws.append(["Phone Number", customer_phone])
    ws.append(["Username", username])
    ws.append(["Created By", created_by])
    ws.append(["Date", now])
    ws.append([])
    ws.append(["Barcode", "Name", "Quantity", "Price", "Total", "VAT (15%)"])
    order_total = 0.0
    order_vat = 0.0
    for item in items_list:
        price = float(item.get("price", 0.0))
        quantity = int(item["quantity"])
        total = price * quantity
        vat = total * 0.15
        order_total += total
        order_vat += vat
        ws.append([
            item["barcode"],
            item["name"],
            quantity,
            price,
            total,
            vat
        ])
    ws.append([])
    ws.append(["Order Total", order_total])
    ws.append(["Order VAT (15%)", order_vat])
    # Auto-fit columns
    for col in ws.columns:
        max_length = 0
        col_letter = col[0].column_letter
        for cell in col:
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except:
                pass
        ws.column_dimensions[col_letter].width = max_length + 2
        for cell in col:
            cell.alignment = Alignment(vertical="center", horizontal="center")
    wb.save(filepath)
    return {"filename": filename, "path": filepath}

@app.get("/orders/latest")
def get_latest_orders():
    order_files = sorted(
        [f for f in os.listdir(ORDER_SAVE_DIR) if f.endswith('.xlsx') and not f.startswith('~$')],
        key=lambda x: os.path.getctime(os.path.join(ORDER_SAVE_DIR, x)),
        reverse=True
    )[:10]
    orders = []
    for filename in order_files:
        # Example filename: 2025-06-07_15-43-53_Mamoo_user1-created by Talha.xlsx
        match = re.match(r"(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_([^_]*)_([^\-]*)-created by (.*)\.xlsx", filename)
        date, customer, username, created_by = '', '', '', ''
        if match:
            date, customer, username, created_by = match.groups()
        else:
            date = filename.split('_')[0]
        # Read order total from file
        try:
            wb = load_workbook(os.path.join(ORDER_SAVE_DIR, filename), data_only=True)
            ws = wb.active
            order_total = None
            for row in ws.iter_rows(values_only=True):
                if row and str(row[0]).strip().lower() == 'order total':
                    order_total = row[1]
                    break
        except Exception:
            order_total = None
        orders.append({
            'filename': filename,
            'date': date,
            'customer': customer,
            'order_total': order_total,
            'created_by': created_by
        })
    return {'orders': orders}

@app.get("/orders/details/{filename}")
def get_order_details(filename: str):
    file_path = os.path.join(ORDER_SAVE_DIR, filename)
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "Order file not found."})
    wb = load_workbook(file_path, data_only=True)
    ws = wb.active
    # Find the start of the order table
    table_start = None
    for idx, row in enumerate(ws.iter_rows(values_only=True)):
        if row and 'Barcode' in row:
            table_start = idx
            break
    if table_start is None:
        return JSONResponse(status_code=400, content={"error": "Order table not found in file."})
    headers = [cell for cell in ws.iter_rows(min_row=table_start+1, max_row=table_start+1, values_only=True)][0]
    items = []
    for row in ws.iter_rows(min_row=table_start+2, values_only=True):
        if not row or not row[0]:
            break
        items.append(dict(zip(headers, row)))
    return {'headers': headers, 'items': items}

@app.get("/orders/download/{filename}")
def download_order(filename: str):
    file_path = os.path.join(ORDER_SAVE_DIR, filename)
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "Order file not found."})
    return FileResponse(file_path, filename=filename, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@app.delete("/orders/delete/{filename}")
def delete_order(filename: str):
    file_path = os.path.join(ORDER_SAVE_DIR, filename)
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "Order file not found."})
    try:
        os.remove(file_path)
        return {"success": True, "deleted": filename}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/orders/search")
def search_orders(customer: str = None, created_by: str = None, date: str = None):
    order_files = [f for f in os.listdir(ORDER_SAVE_DIR) if f.endswith('.xlsx') and not f.startswith('~$')]
    results = []
    for filename in order_files:
        match = re.match(r"(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_([^_]*)_([^\-]*)-created by (.*)\.xlsx", filename)
        file_date, customer_name, username, creator = '', '', '', ''
        if match:
            file_date, customer_name, username, creator = match.groups()
        else:
            file_date = filename.split('_')[0]
        # Filter logic
        if customer and customer.lower() not in customer_name.lower():
            continue
        if created_by and created_by.lower() not in creator.lower():
            continue
        if date and date not in file_date:
            continue
        results.append({
            'filename': filename,
            'date': file_date,
            'customer': customer_name,
            'created_by': creator
        })
    return {'orders': results}

@app.get("/orders/page")
def get_orders_page(page: int = 1, page_size: int = 10):
    order_files = sorted(
        [f for f in os.listdir(ORDER_SAVE_DIR) if f.endswith('.xlsx') and not f.startswith('~$')],
        key=lambda x: os.path.getctime(os.path.join(ORDER_SAVE_DIR, x)),
        reverse=True
    )
    total_orders = len(order_files)
    start = (page - 1) * page_size
    end = start + page_size
    paged_files = order_files[start:end]
    orders = []
    for filename in paged_files:
        match = re.match(r"(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_([^_]*)_([^\-]*)-created by (.*)\.xlsx", filename)
        date, customer, username, created_by = '', '', '', ''
        if match:
            date, customer, username, created_by = match.groups()
        else:
            date = filename.split('_')[0]
        try:
            wb = load_workbook(os.path.join(ORDER_SAVE_DIR, filename), data_only=True)
            ws = wb.active
            order_total = None
            for row in ws.iter_rows(values_only=True):
                if row and str(row[0]).strip().lower() == 'order total':
                    order_total = row[1]
                    break
        except Exception:
            order_total = None
        orders.append({
            'filename': filename,
            'date': date,
            'customer': customer,
            'order_total': order_total,
            'created_by': created_by
        })
    return {'orders': orders, 'total_orders': total_orders, 'page': page, 'page_size': page_size}

@app.get("/orders/count")
def get_orders_count():
    order_files = [f for f in os.listdir(ORDER_SAVE_DIR) if f.endswith('.xlsx') and not f.startswith('~$')]
    return {'count': len(order_files)}

@app.get("/errors/log")
def get_error_log():
    log_dir = os.path.join(os.getcwd(), 'errors_log')
    log_files = sorted(
        [f for f in os.listdir(log_dir) if f.endswith('.txt')],
        key=lambda x: os.path.getctime(os.path.join(log_dir, x)),
        reverse=True
    )
    logs = []
    for filename in log_files:
        file_path = os.path.join(log_dir, filename)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            logs.append({'filename': filename, 'content': content})
        except Exception as e:
            logs.append({'filename': filename, 'content': f'Error reading file: {e}'})
    return {'logs': logs}
