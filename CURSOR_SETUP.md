# Treasure Depot — Cursor Setup

## Open the project

1. Extract the ZIP file.
2. Open Cursor.
3. Choose **File → Open Folder** and select the extracted `treasure-depot-website` folder.

## Run locally

This is a static HTML/CSS/JavaScript website. You can use Cursor's Live Server extension, or run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Main files

- `index.html` — public storefront
- `styles.css` — public-site styling
- `script.js` — storefront behavior and Supabase product loading
- `admin.html` — inventory and pickup management dashboard
- `admin.css` — admin styling
- `admin.js` — admin authentication, inventory, image upload, pickup holds, and label printing
- `api/analyze-product.js` — authenticated server-side AI photo analysis and duplicate suggestions
- `ai-admin.css` — AI assistant panel styling
- `config.js` — public Supabase project configuration and admin email
- `pickup-holds.sql` — Supabase tables, policies, and functions for paid pickup holds
- `vercel.json` — Vercel routing configuration

## Connected services

- Production: `https://www.treasuredepotva.com`
- GitHub: `ming477-jpg/treasure-depot-website`
- Hosting: Vercel
- Database/auth/storage: Supabase project `vucveemjuebtznswcdkk`
- Domain/DNS: Namecheap
- Transactional email: Resend

## Security

The Supabase anon key in `config.js` is designed for browser use. Do not add Supabase service-role keys, Resend API keys, passwords, recovery codes, or other private credentials to this folder or GitHub.

## Enable the AI listing assistant

Add `OPENAI_API_KEY` to the Vercel project's environment variables for Production, Preview, and Development. Optionally set `OPENAI_PRODUCT_MODEL`; otherwise the server uses its tested default. Never put the API key in `config.js` or any browser file.

## Deploy changes

Commit and push changes to the GitHub repository's `main` branch. The connected Vercel project should deploy them automatically.
