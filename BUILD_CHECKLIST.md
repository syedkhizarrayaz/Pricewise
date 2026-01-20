# APK Build Checklist

## Before Building

### ✅ Icon Requirements
- [x] Icon file exists: `assets/images/icon.png`
- [ ] Icon is **1024x1024 pixels** (required for Expo)
- [ ] Icon has transparent background (recommended)
- [ ] Icon is square format

**To check icon size:**
- Open `assets/images/icon.png` in an image editor
- Verify dimensions are 1024x1024 pixels
- If not, resize to 1024x1024 before building

### ✅ Configuration
- [x] `app.json` has icon path configured
- [x] `app.json` has Android package name: `com.pricewise.app`
- [x] `app.json` has version code: `1`
- [x] `eas.json` configured for APK builds
- [x] Production server URLs configured in `eas.json`

### ✅ Environment Variables
- [x] Backend URL: `http://104.248.75.168:3001`
- [x] Python Service URL: `http://104.248.75.168:8000`
- [x] API keys configured in `config/api.ts`

## Build Command

```bash
npm run build:android
```

## After Build

1. **Download APK** from Expo build page
2. **Test on device**:
   - Install APK
   - Test GPS location
   - Test search functionality
   - Test all features
3. **Share APK** with testers

## Icon Troubleshooting

If icon doesn't appear in APK:

1. **Check icon size**: Must be exactly 1024x1024 pixels
2. **Check icon format**: PNG with transparency
3. **Verify path**: `./assets/images/icon.png` in app.json
4. **Rebuild**: After fixing icon, rebuild APK

## Quick Icon Fix

If your icon is not 1024x1024:

1. Open `assets/images/icon.png` in image editor
2. Resize to 1024x1024 pixels
3. Save as PNG
4. Rebuild APK

