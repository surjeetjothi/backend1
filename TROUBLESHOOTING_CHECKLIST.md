# Troubleshooting: Still Getting origin_mismatch Error

If you've already added the URL but it's still not working, check these:

## ✅ Checklist:

### 1. Verify the Exact URL in Google Cloud Console
**Go to**: https://console.cloud.google.com/apis/credentials

**Check "Authorized JavaScript origins":**
- Must have EXACTLY: `https://backend1-bzh1.onrender.com`
- ❌ NOT: `http://backend1-bzh1.onrender.com` (wrong protocol)
- ❌ NOT: `https://backend1-bzh1.onrender.com/` (trailing slash)
- ❌ NOT: `backend1-bzh1.onrender.com` (missing protocol)
- ✅ YES: `https://backend1-bzh1.onrender.com` (correct!)

### 2. Check Both Sections
Make sure you added it to **BOTH**:
- ✅ Authorized JavaScript origins
- ✅ Authorized redirect URIs

### 3. Verify You Edited the Correct Client ID
- Client ID should be: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh`
- Make sure you're editing the OAuth 2.0 Client ID (not API Key or Service Account)

### 4. Wait Time
- After saving, wait **5-10 minutes** for Google to propagate changes
- Google's changes can take time to update globally

### 5. Clear Browser Cache
1. Open browser in **Incognito/Private mode**
2. Or clear cache: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
3. Select "Cached images and files"
4. Try again

### 6. Verify You're Accessing the Correct URL
Make sure you're visiting:
- ✅ `https://backend1-bzh1.onrender.com`
- ❌ NOT `http://backend1-bzh1.onrender.com` (wrong protocol)
- ❌ NOT `www.backend1-bzh1.onrender.com` (different subdomain)

### 7. Check Browser Console for Exact Error
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Try Google Sign-In again
4. Look for the exact error message
5. It should show the exact origin that's being rejected

### 8. Double-Check Formatting in Google Cloud Console
Common mistakes:
- Extra spaces before/after the URL
- Trailing slash `/` at the end
- Wrong protocol (`http://` instead of `https://`)
- Missing protocol entirely
- Typo in the domain name

### 9. Try Removing and Re-Adding
1. In Google Cloud Console, **remove** the URL
2. Click **Save**
3. Wait 2 minutes
4. **Add it again** exactly as: `https://backend1-bzh1.onrender.com`
5. Click **Save**
6. Wait 5 minutes
7. Test again

### 10. Verify Client ID Matches
Check that the Client ID in Google Cloud Console matches:
- Backend: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh.apps.googleusercontent.com`
- Frontend (index.html line 292): `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh.apps.googleusercontent.com`

## What URL Should Be in Google Cloud Console?

**Authorized JavaScript origins:**
```
http://localhost:8000
http://127.0.0.1:8000
https://backend1-bzh1.onrender.com
```

**Authorized redirect URIs:**
```
http://localhost:8000
https://backend1-bzh1.onrender.com
```

## Still Not Working?

Please check:
1. What exact URL did you add in Google Cloud Console? (copy-paste it)
2. Which Client ID did you edit? (the full ID)
3. How long ago did you save the changes?
4. What exact URL are you visiting when you get the error?


