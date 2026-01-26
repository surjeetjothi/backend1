# Quick Fix: Error 400: origin_mismatch

## You're seeing this error because:
The production URL `https://backend1-bzh1.onrender.com` is **NOT** registered in Google Cloud Console.

## Fix in 5 Minutes:

### Step 1: Open Google Cloud Console
Go directly to: https://console.cloud.google.com/apis/credentials

### Step 2: Find Your OAuth Client
1. Look for the Client ID: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh`
2. Click on the Client ID name to edit it

### Step 3: Add Production URL to Authorized JavaScript Origins
1. Scroll down to **"Authorized JavaScript origins"** section
2. Click **"+ ADD URI"** button
3. Enter: `https://backend1-bzh1.onrender.com`
4. **Important**: 
   - Use `https://` (not `http://`)
   - No trailing slash `/` at the end
   - Exactly: `https://backend1-bzh1.onrender.com`

### Step 4: Add Production URL to Authorized Redirect URIs
1. Scroll down to **"Authorized redirect URIs"** section
2. Click **"+ ADD URI"** button  
3. Enter: `https://backend1-bzh1.onrender.com`
4. **Important**: Same format as above

### Step 5: Save
1. Click **"SAVE"** button at the bottom
2. Wait **2-3 minutes** for Google to propagate the changes

### Step 6: Test
1. Go back to: `https://backend1-bzh1.onrender.com`
2. Try Google Sign-In again
3. It should work now! ✅

## Visual Guide:

Your **Authorized JavaScript origins** should look like this:
```
http://localhost:8000
http://127.0.0.1:8000
https://backend1-bzh1.onrender.com    ← ADD THIS
```

Your **Authorized redirect URIs** should look like this:
```
http://localhost:8000
https://backend1-bzh1.onrender.com    ← ADD THIS
```

## Common Mistakes to Avoid:
❌ Don't add: `http://backend1-bzh1.onrender.com` (wrong protocol)
❌ Don't add: `https://backend1-bzh1.onrender.com/` (trailing slash)
❌ Don't add: `backend1-bzh1.onrender.com` (missing protocol)
✅ Do add: `https://backend1-bzh1.onrender.com` (correct!)

## Still Not Working?
1. **Wait 5 minutes** - Google changes can take time
2. **Clear browser cache** - Press Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
3. **Try incognito mode** - To rule out cache issues
4. **Double-check the URL** - Make sure it matches exactly (copy-paste recommended)

## Quick Links:
- **Google Cloud Console**: https://console.cloud.google.com/apis/credentials
- **Your Production URL**: https://backend1-bzh1.onrender.com
- **Client ID to find**: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh`

