---
trigger: always_on
---

About this project:

- Is a admin dashboard for the management of the websites content organized in series.
- Has CRUD operations for users, websites, series and posts.
- Is protected with user athentication and a RBAC system.

About TypeScript usage:

- Always use pnpm as package manager
- Always check that new npm dependencies to be installed are not deprecated
- You can see [package.json](mdc:package.json) for packages already installed
- Always put the import statements at the top of the files

About Cloudflare usage:

- Always use Cloudflare's native way to code and avoid using third-party packages unless absolutely necessary


About technologies in general:

- This project deploys to Cloudflare Workers, Cloudflare D1 and Cloudflare R2 to store the website files.
- The code is hosted in a GitHub repository.
- Uses GitHub Action to deploy Cloudflare D1 migrations.
- Doesn't need GitHub Action to deploy static content to Cloudflare Pages.