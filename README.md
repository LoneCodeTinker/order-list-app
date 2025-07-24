# Order List App

A mobile-friendly web app for creating order lists from an Excel inventory. Users can scan barcodes, enter quantities, and export order lists as Excel files. Designed for use on phones and served from an Ubuntu server.

## Features
- Upload and read a large Excel inventory file
- Scan barcodes using the device camera
- Search and select items by barcode
- Enter customer name and phone number
- Add items and quantities to an order list
- Save/export the order as a new Excel file (named with date, customer name, and username)
- Save order files to a shared directory on the server

## Tech Stack
- Frontend: React + Vite + TypeScript
- Backend (planned): Python FastAPI for Excel processing and file management

## Getting Started
1. Install dependencies:
   ```
   npm install
   ```
2. Start the development server:
   ```
   npm run dev
   ```

## Next Steps
- Implement backend API for Excel file handling and order saving
- Integrate barcode scanning and Excel processing in the frontend

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

---

## Ubuntu Server Deployment (as root)

The following steps automate the setup of the Order List App on a fresh Ubuntu server, including nginx reverse proxy, SSL certificates, Python venv, mDNS/Avahi for .local hostname, and app deployment. Run these as root or with sudo:

1. **Edit the `.env` file** to set your server names, hostnames, local IP, backend and frontend ports, and other config variables. Example:
   ```ini
   # .env
   BACKEND_PORT=8000
   FRONTEND_PORT=5173
   LOCAL_IP=192.168.1.61
   HOSTNAME=$(hostname)
   # Optionally set MDNS_HOSTNAME (for mDNS/Avahi). If not set, the deployment script will prompt or use the current hostname.
   # MDNS_HOSTNAME=yourcustomname.local
   SERVER_NAMES="order.mrmemon.uk 192.168.1.61 $(hostname) localhost 127.0.0.1 ::1 $MDNS_HOSTNAME"
   # ...other variables...
   ```

2. **Install and configure mDNS/Avahi for .local hostname**
   - The deployment script will prompt you for a .local hostname (e.g. `orderapp.local`). If you leave it blank, it will use the current hostname.
   - The script ensures the .local suffix and updates the system hostname, Avahi, and SERVER_NAMES accordingly.
   ```sh
   # This is handled automatically by the runAsRoot script:
   # - Prompts for mDNS hostname if not set
   # - Ensures .local suffix
   # - Sets system hostname
   # - Installs and enables avahi-daemon
   # - Adds .local hostname to /etc/hosts and SERVER_NAMES
   ```
   - This allows you to access the server at `http://yourname.local` from devices on the same network.

3. **Install nginx reverse proxy server**
   ```sh
   apt install nginx
   ```

4. **Install mkcert and generate SSL certificates for HTTPS**
   - Use the server names from your `.env` file:
   ```sh
   mkcert -install
   mkcert -cert-file /etc/nginx/ssl/orderapp.local.pem -key-file /etc/nginx/ssl/orderapp.local-key.pem $(echo $SERVER_NAMES)
   ```
   - If running from a shell that does not support `$SERVER_NAMES`, manually copy the value from `.env`.

5. **Install npm**
   ```sh
   apt install npm
   ```

6. **Install python venv**
   ```sh
   apt install python3-venv
   ```

7. **Clone the app from GitHub**
   ```sh
   cd ~
   git clone https://github.com/LoneCodeTinker/order-list-app.git orderapp
   cd orderapp/
   ```

8. **Copy nginx config and enable site**
   ```sh
   cp nginxConfig /etc/nginx/sites-available/orderapp
   ln -s /etc/nginx/sites-available/orderapp /etc/nginx/sites-enabled/
   ```

9. **Verify config and restart nginx**
   ```sh
   nginx -t
   systemctl restart nginx
   ```

10. **(Optional) Create Python venv if needed**
    ```sh
    # python3 -m venv venv
    ```

11. **Install app dependencies and build**
    ```sh
    npm install
    npm run build
    npm run start:all
    ```

**Notes:**
- Make sure `/etc/nginx/ssl/orderapp.local.pem` and `/etc/nginx/ssl/orderapp.local-key.pem` include all hostnames you want to serve (set in `.env` as `SERVER_NAMES`).
- The nginx config proxies `/api/` to the backend and serves the frontend for all other requests.
- For production, ensure your server's firewall allows ports 80 and 443.
- For Cloudflare Tunnel, point the service to `https://localhost` if using SSL in nginx.
- mDNS/Avahi allows you to access the server at `http://yourname.local` from any device on the same LAN.

---
