# Quick APK Build Instructions

## Prerequisites

1. **Expo Account**: Sign up at https://expo.dev (free)
2. **EAS CLI**: Install globally or use npx

## Quick Start (3 Steps)

### Step 1: Install EAS CLI (if not already installed)

```bash
npm install -g eas-cli
```

Or use npx (no installation):
```bash
npx eas-cli login
```

### Step 2: Login to Expo

```bash
eas login
```

Enter your Expo account email and password.

### Step 3: Build APK

```bash
npm run build:android
```

Or directly:
```bash
eas build --platform android --profile preview
```

## What Happens Next?

1. **EAS will ask you questions**:
   - "Would you like to create a new Android Keystore?" → **Yes**
   - "How would you like to upload your credentials?" → **Expo handles it** (recommended)

2. **Build starts**: Takes ~15-20 minutes for first build

3. **Monitor progress**: 
   - You'll get a build URL
   - Or check: https://expo.dev/accounts/[your-account]/builds

4. **Download APK**:
   - Visit the build page when complete
   - Click "Download" button
   - Or use: `eas build:download --latest`

## Share APK

Once downloaded, you can:
- **Email**: Attach APK file
- **Google Drive/Dropbox**: Upload and share link
- **Direct Link**: Share the build page URL
- **QR Code**: EAS provides a QR code on build page

## Install on Android Device

1. **Enable Unknown Sources**:
   - Settings → Security → Enable "Install from Unknown Sources"
   - Or Settings → Apps → Special Access → Install Unknown Apps

2. **Transfer APK** to device (via email, USB, cloud, etc.)

3. **Tap APK file** to install

## Troubleshooting

### "EAS CLI not found"
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas login
```

### "Build failed"
- Check build logs: `eas build:view [build-id]`
- Common issues: Missing app.json config, invalid package name

### "APK won't install"
- Enable "Install from Unknown Sources" on Android
- Check Android version compatibility (minimum Android 6.0)

## Next Builds

For subsequent builds, just run:
```bash
npm run build:android
```

**Remember**: Increment `versionCode` in `app.json` before each new build:
```json
"android": {
  "versionCode": 2  // Increment this
}
```

## Production Build

When ready for production:
```bash
npm run build:android:prod
```

## Build Status

Check all your builds:
```bash
eas build:list
```

## Need Help?

- EAS Build Docs: https://docs.expo.dev/build/introduction/
- Expo Discord: https://chat.expo.dev/
- Build Status: https://expo.dev/accounts/[your-account]/builds

