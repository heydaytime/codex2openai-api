# linkqt.me

`linkqt.me` is an AI-powered alternative to Linktree. The core product idea is simple: users claim a personal URL, add their links, and then use an AI assistant to design and refine their public link page through natural language.

Instead of manually dragging blocks, choosing colors, and tweaking layouts, users should be able to say things like:

> Make this look like an underground techno DJ page.

or:

> Make my page more professional for recruiters and make my portfolio link stand out.

The AI should then update their page preview safely, let the user iterate, and only publish once the user approves the result.

## Recommended Direction

The product concept is strong, but the implementation should avoid letting an AI coding agent directly edit real Next.js source files per user.

Instead, user pages should be treated as structured data, not code.

The recommended architecture is:

1. User creates an account.
2. User claims a slug such as `linkqt.me/heydaytime`.
3. User adds links and social profiles.
4. User starts from a base template.
5. User chats with an AI design assistant.
6. The AI modifies a validated page configuration.
7. The user previews the result.
8. The user publishes when satisfied.
9. The public page updates from the database, without needing a full redeploy.

## Why Not AI-Edited Source Code

Running a barricaded OpenCode instance inside a user-specific Next.js directory sounds powerful, but it creates unnecessary risk for the first version.

Main problems with AI-edited source code:

- Generated code can break builds.
- Arbitrary code is difficult to validate safely.
- Multi-user isolation becomes complicated.
- Deployments become slower and more fragile.
- One bad generation can affect the whole app.
- Scaling thousands of user directories becomes painful.
- Coding-agent sessions are much more expensive than structured AI edits.

The safer model is to let AI edit a constrained JSON configuration, then render that configuration with trusted application code.

## Page Configuration Model

A user page can be represented as structured data like this:

```json
{
  "username": "heydaytime",
  "theme": "neon-dark",
  "layout": "stacked-card",
  "profile": {
    "name": "Hey Daytime",
    "bio": "Producer, DJ, and visual artist."
  },
  "links": [
    {
      "label": "Instagram",
      "url": "https://instagram.com/heydaytime",
      "type": "social"
    },
    {
      "label": "Spotify",
      "url": "https://open.spotify.com/artist/...",
      "type": "music"
    }
  ],
  "style": {
    "background": "gradient-purple-blue",
    "buttonShape": "rounded",
    "font": "modern"
  }
}
```

The frontend renderer should be responsible for turning this config into the public page.

This keeps the AI powerful from the user's perspective while keeping the production system safe and maintainable.

## AI Assistant Design

The AI should act like a page design assistant, not a general-purpose coding agent.

It should operate through constrained actions such as:

- `update_theme`
- `add_link`
- `remove_link`
- `reorder_links`
- `update_bio`
- `change_layout`
- `set_background`
- `generate_copy`
- `suggest_template`

Example prompt:

> Make this look more like a cyberpunk artist page and make my merch link more prominent.

Example AI output:

```json
{
  "theme": "cyberpunk-dark",
  "layout": "hero-stack",
  "style": {
    "background": "black-neon-grid",
    "buttonShape": "sharp",
    "font": "condensed"
  },
  "profile": {
    "bio": "Neon-soaked visuals, late-night sound, and limited-run drops."
  },
  "featuredLink": "merch"
}
```

All AI output should be validated before it is saved or published.

## MVP Scope

A practical first version should include:

- User authentication.
- Slug claiming, for example `linkqt.me/username`.
- Link and social profile management.
- A small set of polished base templates.
- Dynamic public pages rendered from database config.
- AI chat that edits page configuration.
- Live preview before publishing.
- Publish flow with validation.
- Basic link safety checks.
- Usage limits for AI generations.

Features to avoid in V1:

- AI editing source files directly.
- Per-user Next.js source directories.
- User-generated JavaScript.
- Raw user-generated HTML.
- Unrestricted custom CSS.
- Scheduled redeploys just to update user pages.

## Deployment Model

The app should not require redeploying every few hours for user changes.

Recommended model:

- Use a dynamic route such as `/[slug]`.
- Fetch the published page config from the database.
- Render the page using trusted components.
- Update the database when the user publishes.
- Invalidate cache or revalidate the route after publishing.

This allows pages to update immediately while keeping the system simpler.

## Cost Considerations

The home server with 48 GB RAM and a Ryzen 5 7600 should be enough for an early version of:

- The Next.js app.
- Database services.
- Auth.
- Background jobs.
- Admin tools.
- Dynamic page rendering.

The main cost will be AI model usage, not hosting.

To control costs:

- Limit free users to a small number of AI prompts.
- Use cheaper models for simple edits.
- Use stronger models only for complex design changes.
- Keep page configuration compact.
- Avoid sending full source code to the model.
- Avoid long coding-agent sessions for normal users.

A limit such as 5 AI prompts per free user is reasonable for an MVP.

## Security Notes

Important risks to handle early:

- Unsafe links.
- Phishing pages.
- Scam pages.
- Impersonation.
- Adult or illegal content.
- XSS.
- Malicious redirects.
- User-uploaded images.
- OAuth token storage.
- Prompt injection against the AI assistant.

Initial link validation should enforce:

- Prefer `https://` URLs.
- Block `javascript:` URLs.
- Block `data:` URLs.
- Treat shortened URLs carefully.
- Validate social links against expected domains where possible.
- Consider safe-browsing checks later.

The renderer should never execute user-generated JavaScript.

## Product Positioning

The product should not just be described as "AI Linktree." That is easy to copy and undersells the idea.

Stronger positioning:

> Describe your vibe. Get a beautiful link page.

or:

> Your personal link page, designed by AI in seconds.

Useful user prompts could include:

- Make this more professional for recruiters.
- Make this look like a rapper's page.
- Prioritize my new single.
- Make this more colorful and Gen Z.
- Rewrite my bio to sound less cringe.
- Make the merch link stand out.
- Create a Halloween version of my page.

## Summary

The idea is feasible and has a real product angle. The best first version should use AI to modify constrained page data, not production source code.

This gives users the feeling of an AI-built custom page while keeping the platform safe, cheap, fast, and scalable.
