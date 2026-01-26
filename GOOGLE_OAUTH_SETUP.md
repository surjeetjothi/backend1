# Google OAuth Setup for Production Deployment

## Problem
Google authentication works on localhost but fails on the production server because Google OAuth requires the production domain to be explicitly authorized in the Google Cloud Console.

## Solution Steps

### Step 1: Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one if you don't have it)
3. Navigate to **APIs & Services** → **Credentials**

### Step 2: Find Your OAuth 2.0 Client ID
1. Look for your OAuth 2.0 Client ID: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh.apps.googleusercontent.com`
2. Click on it to edit

### Step 3: Add Authorized JavaScript Origins
In the **Authorized JavaScript origins** section, add:
- `http://localhost:8000` (should already be there)
- `http://127.0.0.1:8000` (should already be there)
- `https://backend1-bzh1.onrender.com` ⬅️ **ADD THIS**
- `https://www.backend1-bzh1.onrender.com` (if you use www subdomain)

### Step 4: Add Authorized Redirect URIs
In the **Authorized redirect URIs** section, add:
- `http://localhost:8000` (should already be there)
- `https://backend1-bzh1.onrender.com` ⬅️ **ADD THIS**
- `https://www.backend1-bzh1.onrender.com` (if you use www subdomain)

### Step 5: Save Changes
1. Click **Save** at the bottom of the page
2. Wait 1-2 minutes for changes to propagate

### Step 6: Test on Production
1. Visit your production URL: `https://backend1-bzh1.onrender.com`
2. Try logging in with Google
3. It should now work!

## Additional Configuration (Optional)

If you want to use environment variables for the Client ID (recommended for security):

1. Set environment variable in Render Dashboard:
   - Key: `GOOGLE_CLIENT_ID`
   - Value: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh.apps.googleusercontent.com`

2. The backend already supports this via `os.getenv("GOOGLE_CLIENT_ID", "...")`

3. Update `render.yaml` to include:
   ```yaml
   envVars:
     - key: GOOGLE_CLIENT_ID
       sync: false
   ```

## Troubleshooting

### Error: "Error 400: redirect_uri_mismatch"
- **Cause**: Production URL not added to Authorized redirect URIs
- **Solution**: Add your production URL to Step 4 above

### Error: "Error 400: origin_mismatch"
- **Cause**: Production URL not added to Authorized JavaScript origins
- **Solution**: Add your production URL to Step 3 above

### Error: "popup_closed_by_user"
- **Cause**: User closed the popup (not a configuration issue)
- **Solution**: Try again

### Still Not Working?
1. Clear browser cache and cookies
2. Try in incognito/private mode
3. Wait a few more minutes after saving changes (Google's changes can take up to 5 minutes)
4. Check browser console for specific error messages
5. Verify the Client ID matches exactly between:
   - Google Cloud Console
   - `backend.py` (line 19) - Should be: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh.apps.googleusercontent.com`
   - `index.html` (line 292) - Should be: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh.apps.googleusercontent.com`

## Current Configuration
- **Client ID**: `275674033514-uuq15prqbvrc0e31d2c0cahb0qbm36eh.apps.googleusercontent.com`
- **Production URL**: `https://backend1-bzh1.onrender.com`
- **Local URL**: `http://localhost:8000`

## Security Note
For production, consider:
- Using environment variables instead of hardcoding Client ID
- Setting up proper CORS (already done in backend.py)
- Using HTTPS only (Render provides this automatically)

