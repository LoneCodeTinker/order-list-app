import React, { useState } from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import './App.css';

// Use relative API path for HTTPS proxy/tunnel compatibility
const apiBaseUrl = '/api';

function App() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [orderItems, setOrderItems] = useState<Array<{ barcode: string; name: string; quantity: number; price?: number; total?: number; vat?: number }>>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [itemNameInput, setItemNameInput] = useState('');
  const [quantityInput, setQuantityInput] = useState(1);
  const [priceInput, setPriceInput] = useState<number | undefined>(undefined);
  const [createdBy, setCreatedBy] = useState('');
  const [inventory, setInventory] = useState<{ [barcode: string]: { name: string } }>({});
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [latestInventory, setLatestInventory] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  // Placeholder for username, in real app get from auth
  const username = 'user1';

  // On mount, check for latest inventory
  React.useEffect(() => {
    const fetchLatestInventory = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/latest-inventory`);
        if (response.ok) {
          const data = await response.json();
          setLatestInventory(data.filename);
        } else {
          setLatestInventory(null);
        }
      } catch (err) {
        setLatestInventory(null);
      }
    };
    fetchLatestInventory();
  }, []);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Only accept .xls or .xlsx
      if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
        alert('Only .xls and .xlsx files are allowed.');
        return;
      }
      setExcelFile(file);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch(`${apiBaseUrl}/upload-inventory`, {
          method: 'POST',
          body: formData,
        });
        // Debug: log the raw response for troubleshooting
        const raw = await response.clone().text();
        console.log('Upload inventory response:', raw);
        if (response.ok) {
          const data = await response.json();
          alert('Inventory uploaded. You can now scan or enter barcodes.');
        } else {
          alert('Failed to upload inventory.');
        }
      } catch (err) {
        alert('Error uploading inventory.');
      }
    }
  };

  const handleScanBarcode = () => {
    setScannerError(null);
    setShowScanner(true);
  };

  const handleBarcodeDetected = async (result: string | null) => {
    if (result) {
      setShowScanner(false);
      setBarcodeInput(result);
      setBarcodeError(null);
      // Fetch item details and fill manual entry fields, but do NOT auto-add to order table
      try {
        const response = await fetch(`${apiBaseUrl}/item/${result}`);
        if (response.ok) {
          const item = await response.json();
          setItemNameInput(item.name || '');
          setPriceInput(item.price ?? 0);
          setQuantityInput(1); // Reset to 1 for new scan
        } else {
          setItemNameInput('');
          setPriceInput(undefined);
          setBarcodeError('Barcode not found in inventory.');
        }
      } catch (err) {
        setItemNameInput('');
        setPriceInput(undefined);
        setBarcodeError('Error checking barcode.');
      }
    }
  };

  const handleAddItem = (barcode: string, name: string, quantity: number, price?: number) => {
    const total = (price || 0) * quantity;
    const vat = total * 0.15;
    setOrderItems([...orderItems, { barcode, name, quantity, price, total, vat }]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSaveOrder = async () => {
    if (!createdBy) {
      alert('Please enter your name (Created By) before saving the order.');
      return;
    }
    // Recalculate totals and VAT before sending
    const itemsWithTotals = orderItems.map(item => {
      const price = item.price || 0;
      const total = price * item.quantity;
      const vat = total * 0.15;
      return { ...item, price, total, vat };
    });
    try {
      const formData = new FormData();
      formData.append('customer_name', customerName);
      formData.append('customer_phone', customerPhone);
      formData.append('username', username);
      formData.append('created_by', createdBy);
      formData.append('items', JSON.stringify(itemsWithTotals));
      const saveResponse = await fetch(`${apiBaseUrl}/save-order`, {
        method: 'POST',
        body: formData,
      });
      if (saveResponse.ok) {
        const data = await saveResponse.json();
        alert(`Order saved as ${data.filename}`);
        setOrderItems([]);
      } else {
        alert('Failed to save order.');
      }
    } catch (err) {
      alert('Error saving order.');
    }
  };

  const handleBarcodeInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcodeInput(value);
    setBarcodeError(null);
    setItemNameInput('');
    setPriceInput(undefined);
    // If barcode is not empty, fetch the item name and price
    if (value) {
      try {
        const response = await fetch(`${apiBaseUrl}/item/${value}`);
        if (response.ok) {
          const item = await response.json();
          setItemNameInput(item.name || '');
          setPriceInput(item.price ?? 0);
        } else {
          setItemNameInput('');
          setPriceInput(undefined);
        }
      } catch {
        setItemNameInput('');
        setPriceInput(undefined);
      }
    }
  };

  const handleItemNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setItemNameInput(e.target.value);
  };

  const handleQuantityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantityInput(Number(e.target.value));
  };

  const handlePriceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPriceInput(Number(e.target.value));
  };

  const handleAddManualItem = async () => {
    // Always focus barcode field, even if barcodeInput is empty or not
    setTimeout(() => {
      const barcodeField = document.getElementById('barcode-input');
      if (barcodeField) (barcodeField as HTMLInputElement).focus();
    }, 0);
    setBarcodeError(null);
    if (!barcodeInput) return;
    try {
      const response = await fetch(`${apiBaseUrl}/item/${barcodeInput}`);
      if (response.ok) {
        const item = await response.json();
        let price = priceInput;
        let name = item.name;
        if (price === undefined) price = item.price || 0;
        const total = (price || 0) * quantityInput;
        const vat = total * 0.15;
        setOrderItems([...orderItems, { barcode: barcodeInput, name, quantity: quantityInput, price, total, vat }]);
        setBarcodeInput('');
        setItemNameInput('');
        setQuantityInput(1);
        setPriceInput(undefined);
      } else {
        setBarcodeError('Barcode not found in inventory.');
      }
    } catch (err) {
      setBarcodeError('Error checking barcode.');
    }
  };

  return (
    <div className="container">
      <h2 style={{ color: 'var(--primary-purple)', marginBottom: '1.2rem', fontWeight: 700, letterSpacing: '0.01em', fontSize: '2.1em', textShadow: '0 2px 8px #b8b3c633' }}>
        <span style={{ fontWeight: 800, letterSpacing: '0.03em' }}>Order List</span> <span style={{ fontWeight: 400, fontSize: '0.7em', color: 'var(--secondary-purple)' }}>App</span>
      </h2>
      <div className="form-section">
        <input
          type="text"
          placeholder="Your Name (Created By)"
          value={createdBy}
          onChange={e => setCreatedBy(e.target.value)}
        />
        <input
          type="text"
          placeholder="Customer Name"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
        />
        <input
          type="tel"
          placeholder="Phone Number"
          value={customerPhone}
          onChange={e => setCustomerPhone(e.target.value)}
        />
        <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />
        {latestInventory && (
          <div style={{ fontSize: '0.9em', color: '#555', marginTop: '0.2em' }}>
            Latest inventory: <b>{latestInventory}</b>
          </div>
        )}
      </div>
      <div className="scan-section">
        <button onClick={handleScanBarcode}>Scan Barcode</button>
        {showScanner && (
          <div style={{ margin: '1rem 0', background: '#222', padding: '1rem', borderRadius: '8px' }}>
            <BarcodeScannerComponent
              width={300}
              height={200}
              facingMode={facingMode}
              onUpdate={(err, result) => {
                if (err) {
                  setScannerError('Cannot access camera. Please allow camera access or check device permissions.');
                } else if (result) {
                  setScannerError(null);
                  // react-qr-barcode-scanner returns result as string (barcode) or as an object with a 'rawValue' property
                  // Try both, and always cast to string
                  if (typeof result === 'string') {
                    handleBarcodeDetected(result);
                  } else if (result && typeof (result as any).rawValue === 'string') {
                    handleBarcodeDetected((result as any).rawValue);
                  } else {
                    handleBarcodeDetected(String(result));
                  }
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button onClick={() => setShowScanner(false)} style={{ marginTop: 0 }}>Cancel</button>
              <button onClick={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')} style={{ marginTop: 0 }}>
                Flip Camera
              </button>
            </div>
            {scannerError && (
              <div style={{ color: 'red', background: '#fff0f0', borderRadius: 4, padding: '0.5em', marginTop: '0.5em' }}>{scannerError}</div>
            )}
            {window.location.protocol !== 'https:' && (
              <div style={{ color: '#d32f2f', fontSize: '0.95em', marginTop: '0.5em' }}>
                Camera access may not work on HTTP. Please use HTTPS for camera features on mobile browsers.
              </div>
            )}
          </div>
        )}
        <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
            <label htmlFor="barcode-input" style={{ minWidth: 70 }}>Barcode:</label>
            <input
              id="barcode-input"
              type="text"
              placeholder="Enter barcode manually"
              value={barcodeInput}
              onChange={handleBarcodeInput}
              onBlur={handleBarcodeInput}
              style={{ flex: 1, minWidth: 120 }}
            />
            <label htmlFor="quantity-input" style={{ minWidth: 40 }}>Qty:</label>
            <input
              id="quantity-input"
              type="number"
              min={1}
              placeholder="Qty"
              value={quantityInput}
              onChange={handleQuantityInput}
              style={{ width: 70 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
            <label htmlFor="price-input" style={{ minWidth: 50 }}>Price:</label>
            <input
              id="price-input"
              type="number"
              min={0}
              step="0.01"
              placeholder="Price"
              value={priceInput ?? ''}
              onChange={handlePriceInput}
              style={{ width: 90 }}
            />
            <input
              type="text"
              placeholder="Item name (auto)"
              value={itemNameInput}
              onChange={handleItemNameInput}
              style={{ flex: 1, minWidth: 120 }}
              disabled
            />
            <button onClick={handleAddManualItem} style={{ padding: '0.5rem 1.5rem', marginLeft: 'auto' }}>Add</button>
          </div>
          {barcodeError && (
            <span style={{ color: 'red', fontSize: '0.9em', marginLeft: '0.5em' }}>{barcodeError}</span>
          )}
        </div>
      </div>
      <div className="order-table-section">
        <table>
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Name</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
              <th>VAT (15%)</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((item, idx) => (
              <tr key={idx}>
                <td>{item.barcode}</td>
                <td>{item.name}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    style={{ width: '60px' }}
                    onChange={e => {
                      const newQty = Number(e.target.value);
                      const price = item.price || 0;
                      const total = price * newQty;
                      const vat = total * 0.15;
                      setOrderItems(orderItems.map((it, i) => i === idx ? { ...it, quantity: newQty, total, vat } : it));
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.price ?? 0}
                    style={{ width: '60px' }}
                    onChange={e => {
                      const newPrice = Number(e.target.value);
                      const total = newPrice * item.quantity;
                      const vat = total * 0.15;
                      setOrderItems(orderItems.map((it, i) => i === idx ? { ...it, price: newPrice, total, vat } : it));
                    }}
                  />
                </td>
                <td>{item.total?.toFixed(2) ?? ''}</td>
                <td>{item.vat?.toFixed(2) ?? ''}</td>
                <td>
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-purple)',
                      fontSize: '1.3em',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: 0,
                      lineHeight: 1,
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      transition: 'background 0.18s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Remove"
                    aria-label="Remove"
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--secondary-purple)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="save-btn" onClick={handleSaveOrder} disabled={orderItems.length === 0}>
        Save Order
      </button>
    </div>
  );
}

export default App;
