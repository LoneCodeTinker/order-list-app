import React, { useState, useRef } from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import './App.css';
import PrevIcon from './assets/prev-icon.svg';
import DLIcon from './assets/DL-icon.svg';
import DelIcon from './assets/del-icon.svg';

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
  const [priceInput, setPriceInput] = useState<string>('');
  const [createdBy, setCreatedBy] = useState('');
  const [inventory, setInventory] = useState<{ [barcode: string]: { name: string } }>({});
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [latestInventory, setLatestInventory] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  // --- Toast/Inline Message State ---
  const [toast, setToast] = React.useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };
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
          showToast('success', 'Inventory uploaded. You can now scan or enter barcodes.');
        } else {
          showToast('error', 'Failed to upload inventory.');
        }
      } catch (err) {
        showToast('error', 'Error uploading inventory.');
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
          setPriceInput(item.price !== undefined && item.price !== null ? String(item.price) : '');
          setQuantityInput(1); // Reset to 1 for new scan
        } else {
          setItemNameInput('');
          setPriceInput('');
          setBarcodeError('Barcode not found in inventory.');
        }
      } catch (err) {
        setItemNameInput('');
        setPriceInput('');
        setBarcodeError('Error checking barcode.');
      }
    }
  };

  const handleAddItem = (barcode: string, name: string, quantity: number, price?: number) => {
    const total = (price || 0) * quantity;
    const vat = Number((total * 0.15).toFixed(2));
    setOrderItems([...orderItems, { barcode, name, quantity, price, total, vat }]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSaveOrder = async () => {
    if (!createdBy) {
      showToast('error', 'Please enter your name (Created By) before saving the order.');
      return;
    }
    setSavingOrder(true);
    // Recalculate totals and VAT before sending
    const itemsWithTotals = orderItems.map(item => {
      const price = item.price || 0;
      const total = price * item.quantity;
      const vat = Number((total * 0.15).toFixed(2));
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
        showToast('success', `Order saved as ${data.filename}`);
        setOrderItems([]);
        // Optionally, highlight the most recent order in history
        setTimeout(() => fetchOrderHistory(), 500);
      } else {
        showToast('error', 'Failed to save order.');
      }
    } catch (err) {
      showToast('error', 'Error saving order.');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleBarcodeInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcodeInput(value);
    setBarcodeError(null);
    setItemNameInput('');
    setPriceInput('');
    // If barcode is not empty, fetch the item name and price
    if (value) {
      try {
        const response = await fetch(`${apiBaseUrl}/item/${value}`);
        if (response.ok) {
          const item = await response.json();
          setItemNameInput(item.name || '');
          setPriceInput(item.price !== undefined && item.price !== null ? String(item.price) : '');
        } else {
          setItemNameInput('');
          setPriceInput('');
        }
      } catch {
        setItemNameInput('');
        setPriceInput('');
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
    setPriceInput(e.target.value);
  };

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [addingItem, setAddingItem] = useState(false);

  const handleAddManualItem = async () => {
    // Always focus barcode field immediately on button click (for mobile/desktop)
    barcodeInputRef.current?.focus();
    setBarcodeError(null);
    if (!barcodeInput) return;
    setAddingItem(true);
    try {
      const response = await fetch(`${apiBaseUrl}/item/${barcodeInput}`);
      if (response.ok) {
        const item = await response.json();
        let price = priceInput !== '' ? parseFloat(priceInput) : undefined;
        let name = item.name;
        if (price === undefined || isNaN(price)) price = item.price || 0;
        const total = (price || 0) * quantityInput;
        const vat = total * 0.15;
        setOrderItems([...orderItems, { barcode: barcodeInput, name, quantity: quantityInput, price, total, vat }]);
        setBarcodeInput('');
        setItemNameInput('');
        setQuantityInput(1);
        setPriceInput('');
        // Optionally, focus again after state updates for desktop
        setTimeout(() => barcodeInputRef.current?.focus(), 0);
      } else {
        setBarcodeError('Barcode not found in inventory.');
        // Optionally, focus again for desktop
        setTimeout(() => barcodeInputRef.current?.focus(), 0);
      }
    } catch (err) {
      setBarcodeError('Error checking barcode.');
      // Optionally, focus again for desktop
      setTimeout(() => barcodeInputRef.current?.focus(), 0);
    } finally {
      setAddingItem(false);
    }
  };

  // --- Order History Section ---
  const [orderHistory, setOrderHistory] = React.useState<any[]>([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = React.useState(false);
  const [orderHistoryPage, setOrderHistoryPage] = React.useState(1);
  const [orderHistoryPageSize] = React.useState(10);
  const [orderHistorySearch, setOrderHistorySearch] = React.useState({ customer: '', created_by: '', date: '' });
  const [orderPreview, setOrderPreview] = React.useState<{ headers: string[]; items: any[] } | null>(null);
  const [orderPreviewFilename, setOrderPreviewFilename] = React.useState<string | null>(null);
  const [orderHistoryError, setOrderHistoryError] = React.useState<string | null>(null);

  const fetchOrderHistory = React.useCallback(async () => {
    setOrderHistoryLoading(true);
    setOrderHistoryError(null);
    try {
      // Use search endpoint if any filter is set, else use paginated endpoint
      const params = [];
      if (orderHistorySearch.customer) params.push(`customer=${encodeURIComponent(orderHistorySearch.customer)}`);
      if (orderHistorySearch.created_by) params.push(`created_by=${encodeURIComponent(orderHistorySearch.created_by)}`);
      if (orderHistorySearch.date) params.push(`date=${encodeURIComponent(orderHistorySearch.date)}`);
      let url = '';
      if (params.length > 0) {
        url = `${apiBaseUrl}/orders/search?${params.join('&')}`;
      } else {
        url = `${apiBaseUrl}/orders/page?page=${orderHistoryPage}&page_size=${orderHistoryPageSize}`;
      }
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to fetch order history');
      const data = await resp.json();
      setOrderHistory(data.orders || []);
    } catch (err: any) {
      setOrderHistoryError(err.message || 'Error loading order history');
    } finally {
      setOrderHistoryLoading(false);
    }
  }, [orderHistoryPage, orderHistoryPageSize, orderHistorySearch]);

  React.useEffect(() => {
    fetchOrderHistory();
  }, [fetchOrderHistory]);

  const handleOrderPreview = async (filename: string) => {
    setOrderPreview(null);
    setOrderPreviewFilename(filename);
    try {
      const resp = await fetch(`${apiBaseUrl}/orders/details/${encodeURIComponent(filename)}`);
      if (!resp.ok) throw new Error('Failed to load order details');
      const data = await resp.json();
      setOrderPreview(data);
    } catch {
      setOrderPreview(null);
    }
  };

  const handleOrderDownload = (filename: string) => {
    window.open(`${apiBaseUrl}/orders/download/${encodeURIComponent(filename)}`, '_blank');
  };

  const handleOrderDelete = async (filename: string) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/orders/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Failed to delete order');
      showToast('success', 'Order deleted.');
      fetchOrderHistory();
      if (orderPreviewFilename === filename) setOrderPreview(null);
    } catch {
      alert('Error deleting order.');
    }
  };

  // Utility to format date (remove time)
  const formatOrderDate = (dateStr: string) => {
    // Accepts 'YYYY-MM-DD_HH-MM-SS' or just 'YYYY-MM-DD'
    if (!dateStr) return '';
    const match = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : dateStr;
  };

  return (
    <div className="container">
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#4caf50' : toast.type === 'error' ? '#d32f2f' : '#333',
          color: '#fff',
          padding: '0.7em 1.5em',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          zIndex: 9999,
          fontSize: '1.1em',
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}>
          {toast.message}
        </div>
      )}
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
              ref={barcodeInputRef}
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
              step={0.25}
              placeholder="Price"
              value={priceInput}
              onChange={handlePriceInput}
              style={{ width: 90 }}
              onBlur={e => {
                let val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                  val = Math.round(val * 4) / 4;
                  setPriceInput(val.toFixed(2));
                } else {
                  setPriceInput('');
                }
              }}
            />
            <input
              type="text"
              placeholder="Item name (auto)"
              value={itemNameInput}
              onChange={handleItemNameInput}
              style={{ flex: 1, minWidth: 120 }}
              disabled
            />
            <button onClick={handleAddManualItem} style={{ padding: '0.5rem 1.5rem', marginLeft: 'auto' }} disabled={addingItem}>
              {addingItem ? 'Adding...' : 'Add'}
            </button>
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
              <th style={{ textAlign: 'center' }} title="Product barcode">Barcode</th>
              <th style={{ textAlign: 'center' }} title="Product name">Name</th>
              <th style={{ textAlign: 'center' }} title="Quantity ordered">Quantity</th>
              <th style={{ textAlign: 'center' }} title="Unit price">Price</th>
              <th style={{ textAlign: 'center' }} title="Total price (Qty × Price)">Total</th>
              <th style={{ textAlign: 'center' }} title="VAT (15%)">VAT (15%)</th>
              <th style={{ textAlign: 'center' }} title="Remove item">Remove</th>
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
                <td>{item.total !== undefined && item.total !== null ? item.total.toFixed(2) : ''}</td>
                <td>{item.vat !== undefined && item.vat !== null ? item.vat.toFixed(2) : ''}</td>
                <td>
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    style={{
                      background: 'var(--secondary-purple)',
                      border: 'none',
                      color: 'var(--primary-purple)',
                      fontSize: '1.2em',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: '2px 8px',
                      lineHeight: 1,
                      width: '32px',
                      height: '32px',
                      borderRadius: '7px',
                      boxShadow: 'none',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.18s, color 0.18s',
                    }}
                    title="Remove item"
                    aria-label="Remove item"
                    onMouseOver={e => {
                      e.currentTarget.style.background = '#d32f2f';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'var(--secondary-purple)';
                      e.currentTarget.style.color = 'var(--primary-purple)';
                    }}
                  >
                    <img src={DelIcon} alt="Remove" style={{ width: 22, height: 22, display: 'block' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="save-btn" onClick={handleSaveOrder} disabled={orderItems.length === 0 || savingOrder}>
        {savingOrder ? 'Saving...' : 'Save Order'}
      </button>
      {/* Order History Section */}
      <div className="order-table-section" style={{ marginTop: 32 }}>
        <h3 style={{ textAlign: 'center', marginBottom: 12 }}>Order History</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, justifyContent: 'center' }}>
          <input type="text" placeholder="Customer" value={orderHistorySearch.customer} onChange={e => setOrderHistorySearch(s => ({ ...s, customer: e.target.value }))} style={{ minWidth: 100 }} />
          <input type="text" placeholder="Created By" value={orderHistorySearch.created_by} onChange={e => setOrderHistorySearch(s => ({ ...s, created_by: e.target.value }))} style={{ minWidth: 100 }} />
          <input type="date" placeholder="Date" value={orderHistorySearch.date} onChange={e => setOrderHistorySearch(s => ({ ...s, date: e.target.value }))} style={{ minWidth: 120 }} />
          <button onClick={() => { setOrderHistoryPage(1); fetchOrderHistory(); }}>Search</button>
          <button onClick={() => { setOrderHistorySearch({ customer: '', created_by: '', date: '' }); setOrderHistoryPage(1); }}>Clear</button>
        </div>
        {orderHistoryLoading ? (
          <tbody>
            {[...Array(orderHistoryPageSize)].map((_, idx) => (
              <tr key={idx}>
                <td colSpan={5} style={{ padding: '1em 0', background: '#f6f6fa' }}>
                  <div style={{ height: 18, width: '80%', margin: '0 auto', background: '#e0e0e0', borderRadius: 4, animation: 'skeleton-loading 1.2s infinite linear alternate' }} />
                </td>
              </tr>
            ))}
          </tbody>
        ) : orderHistoryError ? (
          <div className="error">{orderHistoryError}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Order Total</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderHistory.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center' }}>No orders found.</td></tr>
              ) : orderHistory.map((order) => (
                <tr key={order.filename} style={{ cursor: 'pointer', background: orderPreviewFilename === order.filename ? '#f0f0ff' : undefined }}>
                  <td>{formatOrderDate(order.date)}</td>
                  <td>{order.customer}</td>
                  <td>{order.order_total !== undefined && order.order_total !== null ? order.order_total.toFixed(2) : ''}</td>
                  <td>{order.created_by}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleOrderPreview(order.filename)} title="Preview" style={{ padding: '2px 8px', fontSize: '1.2em', background: 'none', border: 'none', cursor: 'pointer', color: '#444', display: 'flex', alignItems: 'center' }}>
                      <img src={PrevIcon} alt="Preview" style={{ width: 22, height: 22, display: 'block' }} />
                    </button>
                    <button onClick={() => handleOrderDownload(order.filename)} title="Download" style={{ padding: '2px 8px', fontSize: '1.2em', background: 'none', border: 'none', cursor: 'pointer', color: '#444', display: 'flex', alignItems: 'center' }}>
                      <img src={DLIcon} alt="Download" style={{ width: 22, height: 22, display: 'block' }} />
                    </button>
                    <button onClick={() => handleOrderDelete(order.filename)} title="Delete" style={{ padding: '2px 8px', fontSize: '1.2em', background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <img src={DelIcon} alt="Delete" style={{ width: 22, height: 22, display: 'block' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 10 }}>
          <button disabled={orderHistoryPage === 1} onClick={() => setOrderHistoryPage(p => Math.max(1, p - 1))}>Prev</button>
          <span>Page {orderHistoryPage}</span>
          <button disabled={orderHistory.length < orderHistoryPageSize} onClick={() => setOrderHistoryPage(p => p + 1)}>Next</button>
        </div>
        {orderPreview && (
          <div className="order-preview-modal" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(30, 30, 60, 0.45)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 4px 32px #0002',
              padding: 12,
              minWidth: 0,
              width: '95vw',
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative',
              margin: '0 auto',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}>
              <button onClick={() => setOrderPreview(null)} style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'none',
                border: 'none',
                fontSize: 22,
                color: '#d32f2f',
                cursor: 'pointer',
                fontWeight: 700,
              }} title="Close Preview" aria-label="Close Preview">×</button>
              <h4 style={{ marginTop: 0 }}>Order Preview: {orderPreviewFilename}</h4>
              <table style={{ width: '100%', marginTop: 8 }}>
                <thead>
                  <tr>
                    {orderPreview.headers.map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {orderPreview.items.map((row, i) => (
                    <tr key={i}>
                      {orderPreview.headers.map(h => <td key={h}>{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
