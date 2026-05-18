# Quick Start Guide

Get Pricewise running locally in 5 minutes!

## 🚀 Quick Start (3 Steps)

### 1. Setup Environment

```bash
# Create .env file at project root
# Add your API keys (see ENV_SETUP_GUIDE.md)
```

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Python Service
cd ../services
pip install -r requirements.txt
```

### 3. Start Services

**Option A: Manual (Recommended for first time)**

```bash
# Terminal 1: Python Service
cd services
python product_matcher_service.py

# Terminal 2: Backend API
cd backend
npm run dev
```

**Option B: Using Startup Scripts**

```bash
# Linux/Mac
./start-services.sh

# Windows PowerShell
.\start-services.ps1
```

## ✅ Verify Services Are Running

```bash
# Test Python Service
curl http://localhost:8000/health

# Test Backend API
curl http://localhost:3001/api/health
```

## 🧪 Run Full Test Suite

```bash
# From project root
node test-endpoints.js
```

## 📚 Full Documentation

- **Setup Details:** See `LOCAL_SETUP_AND_TESTING.md`
- **Environment Variables:** See `ENV_SETUP_GUIDE.md`
- **API Testing:** See `TEST_ENDPOINTS_README.md`

## 🆘 Quick Troubleshooting

**Port already in use?**
```bash
# Kill process on port 8000 (Python)
lsof -ti:8000 | xargs kill

# Kill process on port 3001 (Backend)
lsof -ti:3001 | xargs kill
```

**Missing dependencies?**
```bash
# Backend
cd backend && npm install

# Python
cd services && pip install -r requirements.txt
```

**API keys not working?**
- Check `.env` file exists at project root
- Verify variable names match exactly
- Restart services after changing `.env`

## 🎯 Next Steps

1. ✅ Services running? → Test with `node test-endpoints.js`
2. ✅ Tests passing? → Start frontend: `npm start`
3. ✅ Everything works? → Deploy to production!

---

**Need help?** See `LOCAL_SETUP_AND_TESTING.md` for detailed troubleshooting.
