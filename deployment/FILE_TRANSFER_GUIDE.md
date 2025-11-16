# File Transfer Guide for DigitalOcean

Guide for transferring your project files to the DigitalOcean server.

## Option 1: Using Git (Recommended)

### On Your Local Machine

```bash
# If your code is in a Git repository
git push origin main  # or master

# On the server, clone it:
cd /opt
git clone <your-repository-url> pricewise
cd pricewise
```

### If Using Private Repository

```bash
# On server, set up SSH key or use HTTPS with credentials
git clone https://username:token@github.com/yourusername/pricewise.git
```

## Option 2: Using SCP (Secure Copy)

### Transfer Entire Project

```bash
# From your local machine (Windows PowerShell or Git Bash)
scp -r D:\Pricewise\Pricewise root@YOUR_SERVER_IP:/opt/pricewise

# Or using rsync (more efficient, only transfers changes)
rsync -avz --exclude 'node_modules' --exclude '.git' \
  D:\Pricewise\Pricewise/ root@YOUR_SERVER_IP:/opt/pricewise/
```

### Transfer Specific Directories

```bash
# Backend only
scp -r backend root@YOUR_SERVER_IP:/opt/pricewise/

# Services (Python) only
scp -r services root@YOUR_SERVER_IP:/opt/pricewise/

# Deployment scripts
scp -r deployment root@YOUR_SERVER_IP:/opt/pricewise/
```

## Option 3: Using SFTP

### Using FileZilla (Windows)

1. Download FileZilla: https://filezilla-project.org/
2. Open FileZilla
3. Enter connection details:
   - Host: `sftp://YOUR_SERVER_IP`
   - Username: `root`
   - Password: Your server password
   - Port: `22`
4. Connect
5. Navigate to `/opt` on server
6. Drag and drop your project folder

### Using WinSCP (Windows)

1. Download WinSCP: https://winscp.net/
2. Create new session:
   - File protocol: SFTP
   - Host name: YOUR_SERVER_IP
   - User name: root
   - Password: Your server password
3. Connect and transfer files

## Option 4: Using VS Code Remote SSH

1. Install "Remote - SSH" extension in VS Code
2. Press `F1` → "Remote-SSH: Connect to Host"
3. Enter: `root@YOUR_SERVER_IP`
4. Open folder: `/opt/pricewise`
5. Use VS Code's file explorer to transfer files

## Recommended File Structure on Server

```
/opt/pricewise/
├── backend/
│   ├── src/
│   ├── dist/
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── services/
│   ├── product_matcher_service.py
│   ├── requirements.txt
│   └── .env
├── deployment/
│   ├── setup-database.sh
│   ├── setup-python-service.sh
│   ├── setup-node-backend.sh
│   └── quick-deploy.sh
└── logs/
    ├── python-service.log
    └── backend-out.log
```

## Files to Exclude When Transferring

You can exclude these to save transfer time:

- `node_modules/` (will be installed on server)
- `.git/` (optional, if not using Git)
- `dist/` (will be built on server)
- `*.log` files
- `.env` files (create fresh on server with correct values)
- `__pycache__/`
- `.venv/` or `venv/` (will be created on server)

## Quick Transfer Command (rsync)

```bash
# From your local machine (Git Bash or WSL)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude '__pycache__' \
  --exclude 'venv' \
  D:\Pricewise\Pricewise/ root@YOUR_SERVER_IP:/opt/pricewise/
```

## Verify Transfer

After transferring, SSH into your server and verify:

```bash
ssh root@YOUR_SERVER_IP

# Check if files are there
ls -la /opt/pricewise/
ls -la /opt/pricewise/backend/
ls -la /opt/pricewise/services/
ls -la /opt/pricewise/deployment/
```

## Next Steps

After transferring files:

1. Make deployment scripts executable:
   ```bash
   chmod +x /opt/pricewise/deployment/*.sh
   ```

2. Follow the deployment guide:
   ```bash
   cd /opt/pricewise
   sudo ./deployment/quick-deploy.sh
   ```

## Troubleshooting

### Permission Denied

```bash
# Fix permissions on server
sudo chown -R root:root /opt/pricewise
sudo chmod -R 755 /opt/pricewise
```

### Connection Timeout

- Check firewall settings
- Verify SSH is enabled on server
- Check if port 22 is open

### Large File Transfer

For large files, use `rsync` with compression:
```bash
rsync -avz --progress --compress-level=9 ...
```

