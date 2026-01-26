# How to Run the Application Locally

## ❌ Don't Open Directly from File System

**DON'T DO THIS:**
```
file:///Users/surjeet/Desktop/surjeet%20noble%20nexus/index.html
```

This **won't work** because:
- Google OAuth requires a proper HTTP/HTTPS server
- File:// protocol doesn't allow OAuth redirects
- CORS restrictions prevent API calls
- Security restrictions in browsers

## ✅ Correct Way: Run a Local Server

You need to run the application using a web server. Here are the options:

### Option 1: Using Python (Recommended)

Since you already have Python installed (you're using FastAPI), use Python's built-in server:

1. **Open Terminal**
2. **Navigate to your project folder:**
   ```bash
   cd "/Users/surjeet/Desktop/surjeet noble nexus"
   ```

3. **Start the FastAPI backend:**
   ```bash
   uvicorn backend:app --reload --host 127.0.0.1 --port 8000
   ```

4. **Open your browser and go to:**
   ```
   http://127.0.0.1:8000
   ```
   or
   ```
   http://localhost:8000
   ```

This will serve both the HTML and run the backend API!

### Option 2: Using Python's Simple HTTP Server (For Frontend Only)

If you just want to test the frontend (but API won't work):

1. **Open Terminal**
2. **Navigate to your project folder:**
   ```bash
   cd "/Users/surjeet/Desktop/surjeet noble nexus"
   ```

3. **Start Python's HTTP server:**
   ```bash
   python3 -m http.server 8000
   ```

4. **Open browser:**
   ```
   http://localhost:8000
   ```

⚠️ **Note:** This won't work with the backend API - you need Option 1 for full functionality.

### Option 3: Use the Deployed Server

Just use your production server:
```
https://backend1-bzh1.onrender.com
```

This is already set up and working (once you configure Google OAuth in Google Cloud Console).

## Quick Start (Recommended)

**To run locally with full functionality:**

1. Open Terminal
2. Run:
   ```bash
   cd "/Users/surjeet/Desktop/surjeet noble nexus"
   uvicorn backend:app --reload --host 127.0.0.1 --port 8000
   ```
3. Open browser: `http://localhost:8000`

That's it! The application will work with Google OAuth, API calls, and everything else.

## Why File:// Doesn't Work

- **Security**: Browsers block file:// from making OAuth requests
- **CORS**: Cannot make API calls from file:// protocol
- **Google OAuth**: Requires a proper domain (localhost or HTTPS domain)
- **Redirects**: OAuth redirects don't work with file://

## Summary

✅ **DO:** Run `uvicorn backend:app --reload` and use `http://localhost:8000`
❌ **DON'T:** Open `index.html` directly from file system

