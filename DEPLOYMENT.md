# Deployment Guide

## Quick Deploy Options

### Option 1: Vercel (Recommended - Easiest) ⭐

1. **Install Vercel CLI** (optional, or use web interface):
   ```bash
   npm install -g vercel
   ```

2. **Deploy via CLI**:
   ```bash
   vercel
   ```
   Follow the prompts. It will give you a URL like: `https://your-project.vercel.app`

3. **Or Deploy via Web**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your repository (or drag & drop the `final project prototype 1` folder)
   - Vercel will auto-detect Vite and deploy automatically
   - You'll get a shareable URL instantly!

**Pros**: Free, automatic HTTPS, custom domains, instant deployments

---

### Option 2: Netlify

1. **Install Netlify CLI** (optional):
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy via CLI**:
   ```bash
   netlify deploy --prod
   ```

3. **Or Deploy via Web**:
   - Go to [netlify.com](https://netlify.com)
   - Sign up/login
   - Drag & drop your `dist` folder (after running `npm run build`)
   - Or connect to GitHub for auto-deployments

**Pros**: Free, easy drag-and-drop, good for static sites

---

### Option 3: GitHub Pages

1. **Create a GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/zombie-survival.git
   git push -u origin main
   ```

2. **Install GitHub Pages plugin**:
   ```bash
   npm install --save-dev vite-plugin-gh-pages
   ```

3. **Update vite.config.ts** to add base path:
   ```typescript
   export default defineConfig({
     base: '/zombie-survival/', // Your repo name
     // ... rest of config
   })
   ```

4. **Add deploy script to package.json**:
   ```json
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```

5. **Enable GitHub Pages** in repository settings → Pages → Source: `gh-pages` branch

**Pros**: Free, integrated with GitHub

---

### Option 4: Google AI Studio (Like Original)

The original project was hosted on Google AI Studio. To deploy there:

1. Go to [ai.studio](https://ai.studio)
2. Create a new applet
3. Upload your `dist` folder contents
4. Share the generated link

---

## Pre-Deployment Checklist

✅ Build works: `npm run build`  
✅ Test locally: `npm run preview`  
✅ All assets load correctly  
✅ P2P networking works (PeerJS)  

## Important Notes

- **PeerJS**: The game uses PeerJS for P2P connections. Make sure the PeerJS server is accessible (default public server should work)
- **HTTPS Required**: WebRTC (used by PeerJS) requires HTTPS in production. All the platforms above provide this automatically
- **Environment Variables**: If you add any API keys later, set them in your hosting platform's environment variables section

## Quick Deploy Command (Vercel)

```bash
# One-time setup
npm install -g vercel
vercel login

# Deploy
cd "C:\Users\user\Downloads\final project prototype 1"
vercel --prod
```

You'll get a URL like: `https://zombie-survival-xyz.vercel.app`

Share that URL with your friends! 🎮

