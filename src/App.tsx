import React, { useState } from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import './App.css';

const apiBaseUrl = (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  if (window.location.hostname.startsWith('192.168.')) {
    return `http://${window.location.hostname}:8000`;
  }
  // For DDNS or any other public hostname
  return `http://${window.location.hostname}:8000`;
})();

function App() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [orderItems, setOrderItems] = useState<Array<{ barcode: string; name: string; quantity: number }>>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [itemNameInput, setItemNameInput] = useState('');
  const [quantityInput, setQuantityInput] = useState(1);
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
      // Optionally auto-add if valid
      try {
        const response = await fetch(`${apiBaseUrl}/item/${result}`);
        if (response.ok) {
          const item = await response.json();
          setOrderItems([...orderItems, { barcode: result, name: item.name, quantity: quantityInput }]);
          setBarcodeInput('');
          setItemNameInput('');
          setQuantityInput(1);
        } else {
          setBarcodeError('Barcode not found in inventory.');
        }
      } catch (err) {
        setBarcodeError('Error checking barcode.');
      }
    }
  };

  const handleAddItem = (barcode: string, name: string, quantity: number) => {
    setOrderItems([...orderItems, { barcode, name, quantity }]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSaveOrder = async () => {
    if (!createdBy) {
      alert('Please enter your name (Created By) before saving the order.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/save-order`, {
        method: 'POST',
        body: new FormData(), // will be replaced below
      });
      // We'll build the FormData below
      const formData = new FormData();
      formData.append('customer_name', customerName);
      formData.append('customer_phone', customerPhone);
      formData.append('username', username);
      formData.append('created_by', createdBy);
      formData.append('items', JSON.stringify(orderItems));
      // Actually send the request
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

  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcodeInput(e.target.value);
  };

  const handleItemNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setItemNameInput(e.target.value);
  };

  const handleQuantityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantityInput(Number(e.target.value));
  };

  const handleAddManualItem = async () => {
    if (!barcodeInput) return;
    setBarcodeError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/item/${barcodeInput}`);
      if (response.ok) {
        const item = await response.json();
        setOrderItems([...orderItems, { barcode: barcodeInput, name: item.name, quantity: quantityInput }]);
        setBarcodeInput('');
        setItemNameInput('');
        setQuantityInput(1);
      } else {
        setBarcodeError('Barcode not found in inventory.');
      }
    } catch (err) {
      setBarcodeError('Error checking barcode.');
    }
  };

  return (
    <div className="container">
      <h2>Order List App</h2>
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
        <div style={{ margin: '1rem 0' }}>
          <input
            type="text"
            placeholder="Enter barcode manually"
            value={barcodeInput}
            onChange={handleBarcodeInput}
            style={{ width: '60%', marginRight: '0.5rem' }}
          />
          {barcodeError && (
            <span style={{ color: 'red', fontSize: '0.9em', marginLeft: '0.5em' }}>{barcodeError}</span>
          )}
          <input
            type="text"
            placeholder="Item name (auto)"
            value={itemNameInput}
            onChange={handleItemNameInput}
            style={{ width: '30%', marginRight: '0.5rem' }}
            disabled
          />
          <input
            type="number"
            min={1}
            placeholder="Qty"
            value={quantityInput}
            onChange={handleQuantityInput}
            style={{ width: '20%', marginRight: '0.5rem' }}
          />
          <button onClick={handleAddManualItem} style={{ padding: '0.5rem 1rem' }}>Add</button>
        </div>
      </div>
      <div className="order-table-section">
        <table>
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Name</th>
              <th>Quantity</th>
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
                      setOrderItems(orderItems.map((it, i) => i === idx ? { ...it, quantity: newQty } : it));
                    }}
                  />
                </td>
                <td>
                  <button onClick={() => handleRemoveItem(idx)}>Remove</button>
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
