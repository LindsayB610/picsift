# PicSift Setup Guide

**A step-by-step guide to get your PicSift app up and running**

This guide will walk you through setting up your Dropbox app, configuring Netlify, and testing your authentication flow. Don't worry if you're not a developer—this guide explains everything in plain language.

---

## 🟢 DNS & HTTPS Ready

DNS for `picsift.lindsaybrunner.com` has resolved and the SSL certificate is issued. You can proceed with **production verification** (Step 5) and **production testing** (Step 6), then continue to Phase 3 (Dropbox API) and Phase 5 (photo triage UI).

### Important: Step Order

The steps are numbered, but here's the recommended order:
- **Do Step 0 first** (Netlify setup) - You need your Netlify URL or custom domain for the Dropbox redirect URI
- **Then do Step 1** (Dropbox app) - Use your Netlify URL when configuring redirect URIs
- **Then do Step 2** (Environment variables) - Set up your secrets
- **Then test locally** (Step 3) before testing production

**If you've already done some steps**: That's fine! Just make sure to complete any missing pieces. For example, if you've already created your Dropbox app, you can still set up Netlify and then update your Dropbox redirect URI if needed.

---

## What We Just Built (Phase 2)

Before we continue, here's what was just implemented:

✅ **Authentication System**: Users can log in with Dropbox  
✅ **Security**: Only authorized users (you) can access the app  
✅ **Folder Discovery**: The app can find folders with photos in your Dropbox  
✅ **Folder Selection**: You can choose which folder to review photos from  

**What's NOT done yet**: The actual photo viewing and triage interface (that's Phase 5). Right now, you can log in and select a folder, but you can't view photos yet.

---

## Step 0: Set Up Netlify (Do This First or in Parallel)

### What is Netlify?
Netlify is a hosting service that will run your app on the internet. It's free for personal projects and makes deployment easy by connecting to your GitHub repository.

### Why do this first?
You'll need your Netlify site URL (or custom domain) to configure the Dropbox OAuth redirect URI. If you've already set up Dropbox, you can still do this step—just update your Dropbox redirect URI afterward.

### How to do it:

1. **Create a Netlify Account** (if you don't have one)
   - Go to https://app.netlify.com
   - Click **"Sign up"**
   - You can sign up with GitHub (recommended) or email
   - Complete the signup process

2. **Connect Your GitHub Repository**
   - In Netlify, click **"Add new site"** → **"Import an existing project"**
   - Choose **"GitHub"** (you may need to authorize Netlify to access your GitHub)
   - Find and select your `picsift` repository
   - Click **"Import"** or **"Next"**

3. **Configure Build Settings**
   - Netlify should auto-detect your settings, but verify these:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
     - **Functions directory**: `netlify/functions`
   - If these aren't auto-detected, enter them manually
   - Click **"Deploy site"** or **"Save"**

4. **Wait for First Deployment**
   - Netlify will start building your site
   - This usually takes 1-2 minutes
   - You'll see a progress indicator
   - When it's done, you'll see a success message
   - Your site will have a temporary URL like: `https://random-name-12345.netlify.app`
   - **Note this URL** - you'll need it for Dropbox redirect URI if you're not using a custom domain yet

5. **Set Up Custom Domain: picsift.lindsaybrunner.com**
   
   **Step 5a: Add Domain in Netlify**
   - In your Netlify site dashboard, go to **"Domain settings"** (in the left sidebar)
   - Click **"Add custom domain"**
   - Enter: `picsift.lindsaybrunner.com`
   - Click **"Verify"** or **"Add domain"**
   - Netlify will show you DNS configuration instructions

   **Step 5b: Configure DNS (in your domain registrar)**
   - You need to configure DNS records so that `picsift.lindsaybrunner.com` points to Netlify
   - Netlify will show you exactly what to add
   - Typically, you'll need to add one of these:
     
     **Option 1: CNAME Record (Recommended)**
     - Type: `CNAME`
     - Name/Host: `picsift` (or `picsift.lindsaybrunner.com` depending on your DNS provider)
     - Value/Target: `your-site-name.netlify.app` (Netlify will show you the exact value)
     - TTL: 3600 (or default)
   
     **Option 2: A Record (Alternative)**
     - Type: `A`
     - Name/Host: `picsift`
     - Value: Netlify's IP address (Netlify will provide this)
     - TTL: 3600
   
   **Step 5c: Where to add DNS records**
   - Log into your domain registrar (where you bought `lindsaybrunner.com`)
   - Find the DNS management section (might be called "DNS Settings", "DNS Management", "Name Servers", etc.)
   - Add the record Netlify told you to add
   - Save your changes

   **Step 5d: Wait for DNS Propagation**
   - DNS changes can take anywhere from a few minutes to 48 hours
   - Usually it's 5-30 minutes
   - Netlify will show a status indicator when the domain is verified
   - You can check status in Netlify's Domain settings page

   **Step 5e: Enable HTTPS (Automatic)**
   - Once your domain is verified, Netlify will automatically provision an SSL certificate
   - This usually takes a few minutes
   - Your site will be accessible at `https://picsift.lindsaybrunner.com` (note the `https://`)

6. **Verify Your Site is Working**
   - Once DNS is configured and HTTPS is ready, visit: `https://picsift.lindsaybrunner.com`
   - You should see your PicSift app (even if it's just the login page)
   - If you see a Netlify error page, wait a bit longer for DNS to propagate

### Important Notes:
- **If you're using the custom domain**: Use `https://picsift.lindsaybrunner.com` in your Dropbox redirect URI
- **If you're not using custom domain yet**: Use your Netlify URL (like `https://random-name-12345.netlify.app`) in your Dropbox redirect URI
- You can always update the Dropbox redirect URI later when your custom domain is ready

---

## Step 1: Create Your Dropbox App

### What is this?
Dropbox needs to know about your app before it can let users log in. Think of it like registering your app with Dropbox so they know it's safe.

### If you've already created your Dropbox app:
If you've already completed this step, you can skip to the parts you need (like getting your App Key and App Secret, or updating redirect URIs if your Netlify setup is now complete).

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
   
   **If you haven't added redirect URIs yet:**
   - Click **"Add"** or **"Add redirect URI"**
   - Enter this URL (for local testing):
     ```
     http://localhost:8888/.netlify/functions/auth_callback
     ```
   - Click **"Add"** again and enter this URL (for production):
     ```
     https://picsift.lindsaybrunner.com/.netlify/functions/auth_callback
     ```
   - **Important**: If you haven't set up your custom domain yet (see Step 0), you can use your Netlify URL instead:
     ```
     https://your-site-name.netlify.app/.netlify/functions/auth_callback
     ```
     (Replace `your-site-name` with your actual Netlify site name)
   
   **If you've already added redirect URIs:**
   - Verify that you have both the localhost and production URLs listed
   - If you set up Netlify after creating your Dropbox app, make sure your production redirect URI matches your actual Netlify URL or custom domain
   - You can edit existing redirect URIs if needed

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

### Prerequisites:
- You should have completed **Step 0** (Netlify setup) or at least have a Netlify account and site created
- You should have completed **Step 1** (Dropbox app creation) and have your App Key and App Secret

### How to do it:

#### Option A: For Local Testing (Create `.env` file)

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

#### Option B: For Production (Netlify Dashboard)

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
   
   **Variable 1 (recommended for custom domain):**
   - **Key**: `NETLIFY_URL`
   - **Value**: `https://picsift.lindsaybrunner.com` (or your Netlify URL)
   - This ensures OAuth redirects use HTTPS and your custom domain so Dropbox doesn't show "doesn't support secure connections". Click **"Save"**
   
   **Variable 2:**
   - **Key**: `DROPBOX_APP_KEY`
   - **Value**: (paste your App Key from Step 1)
   - Click **"Save"**
   
   **Variable 3:**
   - **Key**: `DROPBOX_APP_SECRET`
   - **Value**: (paste your App Secret from Step 1)
   - Click **"Save"**
   
   **Variable 4:**
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

## Step 5: Verify Production Deployment

### What is this?
This step helps you verify that everything is working correctly on your live site. If you've already completed Step 0 (Netlify setup), your site should be deployed automatically whenever you push to GitHub.

### Prerequisites:
- You should have completed **Step 0** (Netlify setup and custom domain)
- You should have completed **Step 2** (Environment variables in Netlify)
- Your code should be pushed to GitHub (which triggers automatic deployment)

### How to verify:

1. **Check Deployment Status**
   - Go to your Netlify dashboard
   - Click on your site
   - Go to **"Deploys"** in the left sidebar
   - You should see your latest deployment with a green checkmark
   - If there's an error, click on it to see what went wrong

2. **Trigger a New Deployment** (if needed)
   - If you've added or updated environment variables, you may need to trigger a new deployment
   - In the **"Deploys"** section, click **"Trigger deploy"** → **"Deploy site"**
   - Wait for it to complete (usually 1-2 minutes)

3. **Verify Your Site is Live**
   - Visit your site: `https://picsift.lindsaybrunner.com` (or your Netlify URL)
   - You should see the PicSift login page
   - If you see an error, check the deployment logs in Netlify

4. **Verify Environment Variables**
   - Go to Netlify dashboard → Site settings → Environment variables
   - Make sure you have all required variables set:
     - `DROPBOX_APP_KEY`
     - `DROPBOX_APP_SECRET`
     - `AUTHORIZED_DROPBOX_ACCOUNT_ID` (can be empty initially)
     - `DROPBOX_REFRESH_TOKEN` (will be set after first login)
   - If you added or changed variables, trigger a new deployment

5. **Verify Dropbox Redirect URI**
   - Go back to your Dropbox App Console (Step 1)
   - Make sure the redirect URI matches your production URL:
     ```
     https://picsift.lindsaybrunner.com/.netlify/functions/auth_callback
     ```
   - If you're using a Netlify URL instead of custom domain, use:
     ```
     https://your-site-name.netlify.app/.netlify/functions/auth_callback
     ```

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

## Fix the custom domain certificate (picsift.lindsaybrunner.com)

If **Verify DNS configuration** succeeds but **Provision certificate** keeps failing, or you see **ERR_CERT_COMMON_NAME_INVALID** in the browser, work through these steps. (Your DNS and traffic are already correct: the domain points to Netlify and responses show `Server: Netlify`.)

### 1. Try "Renew certificate" in Netlify
- **Domain management** → **HTTPS**.
- If you see **Renew certificate** (or **Renew**), click it and wait a few minutes. Sometimes a renewed request succeeds when the first one didn’t.

### 2. Run Let’s Encrypt’s diagnostic
- Go to **[Let’s Debug](https://letsdebug.net/)**.
- Enter **picsift.lindsaybrunner.com** and run the check.
- Fix any issues it reports, for example:
  - **AAAA (IPv6) records** on the subdomain that point to old hosts → remove them in Squarespace if they’re not needed.
  - **DNSSEC** problems → if you use DNSSEC for lindsaybrunner.com, Netlify’s docs say they don’t support DNSSEC; you’d need to use external DNS only (which you do) and ensure DNSSEC doesn’t block Let’s Encrypt.

### 3. Clear DNS caches and retry
- Netlify’s docs say old DNS caches can block provisioning. Your CNAME TTL is 4 hours.
- Use **[Google Public DNS cache flush](https://developers.google.com/speed/public-dns/cache)** for `picsift.lindsaybrunner.com` (if the tool allows).
- Wait 10–15 minutes, then in Netlify click **Verify DNS configuration** again, then **Provision certificate**.

### 4. No proxy in front of the subdomain
- If Squarespace (or anything else) is **proxying** traffic for `picsift` (so visitors hit their servers first instead of Netlify), Let’s Encrypt validation can fail. In Squarespace DNS, the `picsift` CNAME should be **DNS-only** (no proxy / no “accelerate and protect” style option). If you see a proxy toggle, turn it off for this record.

### 5. Ask Netlify to fix the certificate
- Open a thread in the **[Netlify Support Forums](https://answers.netlify.com/)** or use **[Netlify Support](https://www.netlify.com/support)**.
- Include:
  - **Site name:** picsift (or the exact Netlify site name).
  - **Domain:** picsift.lindsaybrunner.com.
  - **DNS:** External DNS at Squarespace; CNAME `picsift` → `picsift.netlify.app`; DNS resolves; HTTP response shows `Server: Netlify`.
  - **What you did:** Verify DNS configuration succeeds; Provision certificate runs but the browser shows ERR_CERT_COMMON_NAME_INVALID (certificate doesn’t match the domain).
- Support can see provisioning logs and can often fix or re-trigger certificate issuance.

### Workaround while the cert is broken
- Use **https://picsift.netlify.app** for the app and Dropbox (see troubleshooting entry below for exact steps).

---

## Troubleshooting

### Problem: "DROPBOX_APP_KEY not configured"
**Solution**: Make sure you've set the environment variables in Netlify (or in your `.env` file for local testing).

### Problem: "Doesn't support secure connections" or "then nothing" after Login
**Solution**: 
- Dropbox requires **HTTPS** for the redirect URI in production. Set **`NETLIFY_URL`** in Netlify to `https://picsift.lindsaybrunner.com` (Site configuration → Environment variables). Then trigger a new deploy so the functions use it.
- Ensure the redirect URI in your Dropbox app is exactly: `https://picsift.lindsaybrunner.com/.netlify/functions/auth_callback` (no trailing slash, https).
- After changing env vars, always **Trigger deploy** in Netlify so the new values are used.

### Problem: Custom domain Let's Encrypt certificate keeps failing (ERR_CERT_COMMON_NAME_INVALID)
**Solution**: Use the **Netlify URL** instead until the custom domain cert works (or contact Netlify support):

1. **Dropbox App Console** → OAuth 2 → Redirect URIs: add  
   `https://picsift.netlify.app/.netlify/functions/auth_callback`  
   (Keep your existing URIs; just add this one.)

2. **Netlify** → Your PicSift site → **Site configuration** → **Environment variables**:  
   Set **`NETLIFY_URL`** = `https://picsift.netlify.app`  
   (Add or overwrite; this makes OAuth redirects use the Netlify URL.)

3. **Deploys** → **Trigger deploy** → **Deploy site**. Wait for it to finish.

4. Use the app at **https://picsift.netlify.app** (login, folder selection, etc.).  
   You can switch back to the custom domain later when the cert is fixed.

### Problem: "Invalid redirect URI"
**Solution**: 
- Check that the redirect URI in your Dropbox app settings exactly matches:
  - For local: `http://localhost:8888/.netlify/functions/auth_callback`
  - For production: `https://picsift.lindsaybrunner.com/.netlify/functions/auth_callback`
  - If using Netlify URL: `https://picsift.netlify.app/.netlify/functions/auth_callback`
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

## Only you can access your Dropbox (single-user lock)

The app is on the public internet, but **only your Dropbox account** can use it:

- **`AUTHORIZED_DROPBOX_ACCOUNT_ID`** (or **`AUTHORIZED_DROPBOX_EMAIL`**) in Netlify restricts who can log in and use the app.
- When someone clicks "Login with Dropbox", the app checks their account ID against this value. If it doesn’t match, they see **"Access denied. This app is restricted to authorized users only."** and no tokens are stored.
- Every Dropbox API call (folders, photos, etc.) also checks that the token belongs to the authorized account.

**What you need to do:** Set **`AUTHORIZED_DROPBOX_ACCOUNT_ID`** in Netlify to your Dropbox account ID (e.g. `dbid:xxxxxxxxxxxxx`). You get that value from the auth_callback log when you first log in, or from the "How to fix" instructions when you add the refresh token. Once set and redeployed, only that account can use the app; everyone else is rejected at login.

---

## Quick Reference: Environment Variables Checklist

Make sure you have all of these set (either in `.env` for local or in Netlify):

- [ ] `NETLIFY_URL` - **Recommended:** `https://picsift.lindsaybrunner.com` (ensures HTTPS redirect for Dropbox)
- [ ] `DROPBOX_APP_KEY` - From Dropbox App Console
- [ ] `DROPBOX_APP_SECRET` - From Dropbox App Console  
- [ ] `DROPBOX_REFRESH_TOKEN` - Obtained after first OAuth login
- [ ] `AUTHORIZED_DROPBOX_ACCOUNT_ID` - **Required in production:** Your Dropbox account ID (format: `dbid:xxxxxxxxxxxxx`) — only this account can use the app

**Optional:**
- `URL` - Auto-set by Netlify (backup if NETLIFY_URL not set)
- [ ] `DROPBOX_SOURCE_PATH` - Default folder path (optional, defaults to "/Camera Uploads")

---

## Need Help?

If you get stuck:
1. Check the error messages in the browser console (F12 → Console tab)
2. Check the terminal output where Netlify Dev is running
3. Review the troubleshooting section above
4. Make sure all environment variables are set correctly

Good luck! 🚀
