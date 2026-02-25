# AGENTS.md

## Cursor Cloud specific instructions

This is a Hugo static site (Academic CV template) using the HugoBlox theme framework with Tailwind CSS v4.

### Tech Stack
- **Hugo Extended** v0.154.5 (static site generator)
- **Go** ≥1.19 (Hugo modules)
- **Node.js** 20+ (Tailwind CSS, Pagefind)
- **pnpm** v10.14.0 (JS package manager, declared in `packageManager` field)

### Key Commands
- **Dev server:** `pnpm dev` (runs `hugo server --disableFastRender` on port 1313)
- **Build:** `pnpm build` (runs `hugo --minify` + `pnpm run pagefind`)
- **Pagefind only:** `pnpm run pagefind`

### Non-obvious Notes
- Hugo must be the **extended** variant (required for Tailwind CSS/SASS processing). Install from https://github.com/gohugoio/hugo/releases with the `hugo_extended_*` archive.
- Hugo modules are Go-based. On first build, Go downloads modules to `~/.cache/hugo_cache/`. This can take several seconds.
- `pnpm.onlyBuiltDependencies` in `package.json` whitelists `@parcel/watcher` and `@tailwindcss/oxide` for native build scripts. Without this, Tailwind CSS will not compile correctly.
- No ESLint, Prettier, or other JS linters are configured. The Hugo build itself validates templates. Run `hugo --minify` to check for template errors.
- No automated test suite exists. Validation is done via build success and manual browser testing on port 1313.
- The site config lives in `config/_default/` (YAML files: `hugo.yaml`, `params.yaml`, `menus.yaml`, `languages.yaml`, `module.yaml`).
- Content is in `content/` as Markdown files with YAML front matter.
