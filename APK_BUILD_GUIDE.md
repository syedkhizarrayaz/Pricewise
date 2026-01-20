# APK Build Guide for Pricewise

Complete guide to build and share an APK for testing.

## Prerequisites

1. **Expo Account**: Sign up at https://expo.dev (free)
2. **EAS CLI**: Install the Expo Application Services CLI
3. **Android Keystore**: Will be generated automatically by EAS

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

Or use npx (no installation needed):
```bash
npx eas-cli --version
```

## Step 2: Login to Expo

```bash
eas login
```

Enter your Expo account credentials.

## Step 3: Configure EAS Build

Create `eas.json` in the project root (already created for you):

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

## Step 4: Update app.json

Make sure your `app.json` has:
- `package` (Android package name, e.g., `com.pricewise.app`)
- `version` (e.g., `1.0.0`)
- `android.package` (same as package)
- `android.versionCode` (increment for each build)

## Step 5: Build APK

### Option A: Build APK for Testing (Recommended)

```bash
eas build --platform android --profile preview
```

This creates an APK that can be installed directly on Android devices.

### Option B: Build Production APK

```bash
eas build --platform android --profile production
```

## Step 6: Monitor Build Progress

After starting the build, you'll see:
- Build ID
- Link to monitor progress: https://expo.dev/accounts/[your-account]/builds/[build-id]

You can also check status:
```bash
eas build:list
```

## Step 7: Download APK

Once the build completes:
1. Visit the build page on expo.dev
2. Click "Download" to get the APK file
3. Or use CLI:
   ```bash
   eas build:download
   ```

## Step 8: Share APK

### Option A: Direct Download Link
- Share the build page URL
- Recipients can download directly

### Option B: Install via QR Code
- EAS provides a QR code on the build page
- Scan with Android device to download

### Option C: Upload to File Sharing
- Upload APK to Google Drive, Dropbox, etc.
- Share the link

## Quick Build Commands

```bash
# Build APK for testing
eas build --platform android --profile preview

# Build and download immediately
eas build --platform android --profile preview --local

# Check build status
eas build:list

# Download latest build
eas build:download --latest

# View build logs
eas build:view [build-id]
```

## Local Build (Advanced)

If you want to build locally (requires Android SDK):

```bash
eas build --platform android --profile preview --local
```

## Troubleshooting

### Build Fails

1. **Check logs**: `eas build:view [build-id]`
2. **Common issues**:
   - Missing environment variables
   - Invalid app.json configuration
   - Package name conflicts

### APK Won't Install

1. **Enable "Install from Unknown Sources"** on Android device
2. **Check Android version compatibility** (minimum SDK in app.json)
3. **Verify APK signature** (should be signed by EAS)

### Build Takes Too Long

- First build: ~15-20 minutes (sets up environment)
- Subsequent builds: ~10-15 minutes
- Use `--local` flag for faster local builds (if Android SDK installed)

## Environment Variables

If your app needs environment variables, create `.env` file:

```env
EXPO_PUBLIC_BACKEND_URL=http://104.248.75.168:3001
EXPO_PUBLIC_PYTHON_SERVICE_URL=http://104.248.75.168:8000
```

EAS Build will automatically include these.

## Version Management

Update version before each build:

1. **app.json**: Update `version` (e.g., `1.0.0` → `1.0.1`)
2. **app.json**: Increment `android.versionCode` (e.g., `1` → `2`)

## Next Steps After Build

1. ✅ Test APK on physical device
2. ✅ Test all features (GPS, search, etc.)
3. ✅ Share with testers
4. ✅ Collect feedback
5. ✅ Build production version when ready

## Production Release

When ready for production:

```bash
eas build --platform android --profile production
```

Then submit to Google Play Store:
```bash
eas submit --platform android
```

