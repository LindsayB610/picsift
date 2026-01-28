# PicSift Setup Guide

**A step-by-step guide to get your PicSift app up and running**

This guide will walk you through setting up your Dropbox app, configuring Netlify, and testing your authentication flow. Don't worry if you're not a developer—this guide explains everything in plain language.

---

## What We Just Built (Phase 2)

Before we continue, here's what was just implemented:

✅ **Authentication System**: Users can log in with Dropbox  
✅ **Security**: Only authorized users (you) can access the app  
✅ **Folder Discovery**: The app can find folders with photos in your Dropbox  
✅ **Folder Selection**: You can choose which folder to review photos from  

**What's NOT done yet**: The actual photo viewing and triage interface (that's Phase 5). Right now, you can log in and select a folder, but you can't view photos yet.

---

## Step 1: Create Your Dropbox App

### What is this?
Dropbox needs to know about your app before it can let users log in. Think of it like registering your app with Dropbox so they know it's safe.

### How to do it:

1. **Go to the Dropbox App Console**
   - Open your web browser
   - Go to: https://www.dropbox.com/developers/apps
   - You'll need to log in with your Dropbox account

2. **Create a New App**
   - Click the blue **"Create app"** button (usually in the top right)
   - You'll see a form to fill out

3. **Fill out the App Creation Form**
   
   **Choose an API:**
   - Select **"Scoped access"** (this gives your app limited, specific permissions)
   
   **Choose the type of access you need:**
   - Select **"Full Dropbox"** (you need this to access folders and files)
   
   **Name your app:**
   - Enter something like: `PicSift` or `PicSift Photo Triage`
   - This name will appear when users authorize your app
   
   **Click "Create app"**

4. **Configure OAuth Settings**
   - After creating the app, you'll be on the app's settings page
   - Scroll down to find the **"OAuth 2"** section
   - Look for **"Redirect URIs"** or **"Redirect URLs"**
   - Click **"Add"** or **"Add redirect URI"**
   - Enter this URL (for local testing):
     ```
     http://localhost:8888/.netlify/functions/auth_callback
     ```
   - Click **"Add"** again and enter this URL (for production):
     ```
     https://picsift.lindsaybrunner.com/.netlify/functions/auth_callback
     ```
   - **Important**: If you haven't set up your custom domain yet, you can use your Netlify URL instead:
     ```
     https://your-site-name.netlify.app/.netlify/functions/auth_callback
     ```
     (Replace `your-site-name` with your actual Netlify site name)

5. **Get Your App Credentials**
   - On the same settings page, find the **"App key"** and **"App secret"**
   - **App key**: This is like a username for your app (it's safe to share)
   - **App secret**: This is like a password (keep it secret!)
   - **Copy both of these** - you'll need them in the next step
   - You can click the "Show" button next to App secret to reveal it

6. **Save Your Settings**
   - Make sure to click any "Save" or "Update" buttons if they appear

---

## Step 2: Set Up Netlify Environment Variables

### What are environment variables?
Think of environment variables as secret settings that your app needs to work, but that you don't want to put in your code (for security). They're stored separately and only your app can access them.

### How to do it:

#### Option A: If you haven't deployed to Netlify yet

1. **Create a `.env` file locally** (for testing on your computer)
   - In your project folder (`/Users/lindsaybrunner/Documents/picsift`), create a new file called `.env`
   - **Important**: Make sure it's called exactly `.env` (with the dot at the beginning)
   - Open it in a text editor

2. **Add your Dropbox credentials to `.env`**
   - Copy the following template and fill in your values:
     ```
     DROPBOX_APP_KEY=your_app_key_here
     DROPBOX_APP_SECRET=your_app_secret_here
     AUTHORIZED_DROPBOX_ACCOUNT_ID=
     ```
   - Replace `your_app_key_here` with your actual App Key from Step 1
   - Replace `your_app_secret_here` with your actual App Secret from Step 1
   - Leave `AUTHORIZED_DROPBOX_ACCOUNT_ID` empty for now (we'll get this value later)

3. **Save the file**

#### Option B: If you've already deployed to Netlify

1. **Go to Netlify Dashboard**
   - Open https://app.netlify.com in your browser
   - Log in if needed
   - Find your site (or create a new site if you haven't)

2. **Navigate to Site Settings**
   - Click on your site name
   - In the left sidebar, click **"Site configuration"** or **"Configuration"**
   - Click **"Environment variables"** or **"Build & deploy" → "Environment variables"**

3. **Add Environment Variables**
   - Click **"Add variable"** or **"New variable"**
   - Add each variable one at a time:
   
   **Variable 1:**
   - **Key**: `DROPBOX_APP_KEY`
   - **Value**: (paste your App Key from Step 1)
   - Click **"Save"**
   
   **Variable 2:**
   - **Key**: `DROPBOX_APP_SECRET`
   - **Value**: (paste your App Secret from Step 1)
   - Click **"Save"**
   
   **Variable 3:**
   - **Key**: `AUTHORIZED_DROPBOX_ACCOUNT_ID`
   - **Value**: (leave empty for now - we'll fill this after first login)
   - Click **"Save"**

4. **Redeploy Your Site** (if needed)
   - After adding environment variables, you may need to trigger a new deployment
   - Go to **"Deploys"** in the left sidebar
   - Click **"Trigger deploy"** → **"Deploy site"**

---

## Step 3: Test the Authentication Flow Locally

### What is this?
Before deploying to the internet, we want to test that everything works on your computer.

### How to do it:

1. **Make sure you have the `.env` file set up** (from Step 2, Option A)

2. **Start the local development server**
   - Open Terminal (on Mac) or Command Prompt (on Windows)
   - Navigate to your project folder:
     ```bash
     cd /Users/lindsaybrunner/Documents/picsift
     ```
   - Start Netlify Dev (this runs both the frontend and backend):
     ```bash
     npm run dev:functions
     ```
   - You should see output like:
     ```
     Netlify Dev server is running on http://localhost:8888
     ```
   - **Keep this terminal window open** - the server needs to keep running

3. **Open the app in your browser**
   - Open a web browser
   - Go to: http://localhost:8888
   - You should see the PicSift login page with the README content

4. **Test the login flow**
   - Click the **"Login with Dropbox"** button
   - You should be redirected to Dropbox's website
   - Log in to Dropbox (if not already logged in)
   - You'll see a page asking you to authorize the app
   - Click **"Allow"** or **"Continue"**
   - You should be redirected back to your app

5. **What should happen:**
   - If everything works, you'll see the folder selection screen
   - The app will scan your Dropbox for folders with images
   - This might take a minute or two
   - Once it's done, you'll see a list of folders

6. **Get your Account ID** (for the authorized user setting)
   - After logging in successfully, check the browser's developer console:
     - Press `F12` or right-click → "Inspect" → "Console" tab
     - Look for any messages that might contain your account ID
     - OR, check the Network tab for the `auth_callback` response
     - The account ID will look like: `dbid:xxxxxxxxxxxxx`
   - **Alternative method**: After the first successful login, the callback function will return your account ID in the response. You can also check the terminal where Netlify Dev is running for any logged account information.

7. **Update the authorized account ID**
   - Once you have your account ID, update your `.env` file:
     ```
     AUTHORIZED_DROPBOX_ACCOUNT_ID=dbid:xxxxxxxxxxxxx
     ```
     (Replace with your actual account ID)
   - If you're using Netlify, update the environment variable in the Netlify dashboard
   - Restart your local server (stop it with `Ctrl+C`, then run `npm run dev:functions` again)

---

## Step 4: Handle the Refresh Token

### What is a refresh token?
After you log in, Dropbox gives your app a "refresh token" that allows it to get new access tokens without asking you to log in again. This needs to be stored securely.

### How to do it:

1. **After your first successful login**, the `auth_callback` function will return a refresh token
   - Check the browser console or network response
   - Look for a field called `refresh_token`
   - **Copy this value** - it's a long string of characters

2. **Add it to your environment variables**
   
   **For local testing (.env file):**
   ```
   DROPBOX_REFRESH_TOKEN=your_refresh_token_here
   ```
   
   **For Netlify:**
   - Go to Netlify dashboard → Site settings → Environment variables
   - Add a new variable:
     - **Key**: `DROPBOX_REFRESH_TOKEN`
     - **Value**: (paste your refresh token)
   - Click **"Save"**

3. **Important Security Note**
   - The refresh token is like a master key to your Dropbox account
   - Never share it or commit it to git
   - The `.env` file should already be in `.gitignore` (so it won't be committed)
   - Always store it in environment variables, never in your code

---

## Step 5: Deploy to Netlify (If Not Already Done)

### What is deployment?
Deployment means putting your app on the internet so you can access it from anywhere, not just your computer.

### How to do it:

1. **Make sure your code is on GitHub**
   - If you haven't already, create a GitHub repository
   - Push your code to GitHub
   - Make sure your `.env` file is NOT committed (it should be in `.gitignore`)

2. **Connect to Netlify**
   - Go to https://app.netlify.com
   - Click **"Add new site"** → **"Import an existing project"**
   - Choose **"GitHub"** and authorize Netlify
   - Select your repository
   - Click **"Import"**

3. **Configure Build Settings**
   - Netlify should auto-detect your settings, but verify:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
     - **Functions directory**: `netlify/functions`
   - Click **"Deploy site"**

4. **Set Up Custom Domain** (Optional but Recommended)
   - After deployment, go to **"Domain settings"**
   - Click **"Add custom domain"**
   - Enter: `picsift.lindsaybrunner.com`
   - Follow Netlify's instructions to configure DNS
   - This might take a few minutes to propagate

5. **Update Dropbox OAuth Redirect URI**
   - Go back to your Dropbox App Console (Step 1)
   - Update the redirect URI to match your production URL:
     ```
     https://picsift.lindsaybrunner.com/.netlify/functions/auth_callback
     ```
   - Or use your Netlify URL:
     ```
     https://your-site-name.netlify.app/.netlify/functions/auth_callback
     ```

6. **Set Environment Variables in Netlify**
   - Make sure all environment variables are set (from Step 2, Option B)
   - After adding/updating variables, you may need to trigger a new deployment

---

## Step 6: Test the Production Deployment

### How to do it:

1. **Visit your live site**
   - Go to `https://picsift.lindsaybrunner.com` (or your Netlify URL)
   - You should see the login page

2. **Test the full flow**
   - Click "Login with Dropbox"
   - Complete the OAuth flow
   - Verify folder discovery works
   - Select a folder

3. **Check for errors**
   - Open browser developer tools (F12)
   - Check the Console tab for any errors
   - Check the Network tab to see if API calls are working

---

## Troubleshooting

### Problem: "DROPBOX_APP_KEY not configured"
**Solution**: Make sure you've set the environment variables in Netlify (or in your `.env` file for local testing).

### Problem: "Invalid redirect URI"
**Solution**: 
- Check that the redirect URI in your Dropbox app settings exactly matches:
  - For local: `http://localhost:8888/.netlify/functions/auth_callback`
  - For production: `https://picsift.lindsaybrunner.com/.netlify/functions/auth_callback`
- Make sure there are no extra spaces or typos

### Problem: "Access denied" after logging in
**Solution**: 
- Make sure you've set `AUTHORIZED_DROPBOX_ACCOUNT_ID` with your actual account ID
- Get your account ID from the first successful login (before adding the restriction)
- The account ID format is: `dbid:xxxxxxxxxxxxx`

### Problem: "Failed to discover folders"
**Solution**:
- Make sure you've set `DROPBOX_REFRESH_TOKEN` in environment variables
- The refresh token is obtained after the first successful OAuth login
- Check that your Dropbox app has "Full Dropbox" access (not just "App folder")

### Problem: Can't see the login page
**Solution**:
- Make sure the development server is running (`npm run dev:functions`)
- Check that you're going to the right URL (http://localhost:8888 for local)
- Check the terminal for any error messages

### Problem: Environment variables not working
**Solution**:
- For local testing: Make sure your `.env` file is in the project root directory
- For Netlify: After adding environment variables, trigger a new deployment
- Environment variables are case-sensitive - make sure they match exactly

---

## What's Next?

Once you've completed these steps and everything is working:

1. ✅ **Phase 2 is complete**: Authentication and folder selection work
2. **Next up**: Phase 3 will add the core Dropbox API functions (listing images, getting image URLs, moving files to trash, etc.)
3. **Then**: Phase 5 will build the actual photo viewing and triage interface

---

## Quick Reference: Environment Variables Checklist

Make sure you have all of these set (either in `.env` for local or in Netlify):

- [ ] `DROPBOX_APP_KEY` - From Dropbox App Console
- [ ] `DROPBOX_APP_SECRET` - From Dropbox App Console  
- [ ] `DROPBOX_REFRESH_TOKEN` - Obtained after first OAuth login
- [ ] `AUTHORIZED_DROPBOX_ACCOUNT_ID` - Your Dropbox account ID (format: `dbid:xxxxxxxxxxxxx`)

**Optional:**
- [ ] `NETLIFY_URL` - Your Netlify site URL (usually auto-detected)
- [ ] `DROPBOX_SOURCE_PATH` - Default folder path (optional, defaults to "/Camera Uploads")

---

## Need Help?

If you get stuck:
1. Check the error messages in the browser console (F12 → Console tab)
2. Check the terminal output where Netlify Dev is running
3. Review the troubleshooting section above
4. Make sure all environment variables are set correctly

Good luck! 🚀
