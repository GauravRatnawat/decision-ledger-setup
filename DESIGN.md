# Decision Ledger Design System

## Product promise

Recover the exact engineering decision, evidence, and context in seconds.

## Visual identity

Decision Ledger uses a quiet editorial ledger aesthetic: pale green paper, deep green-black ink, restrained red rules, dense retrieval views, and comfortable reading surfaces.

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#EDF1EA` | Page background |
| Paper | `#F7F8F3` | Raised reading surfaces |
| Ink | `#17231C` | Primary text |
| Muted ink | `#667066` | Metadata and secondary text |
| Rule | `#CAD2C8` | Borders and separators |
| Ledger red | `#A63A2B` | Active states, matches, and structural accents |
| Code | `#20231F` | Code block background |

Use Newsreader for editorial text, Spline Sans for interface text, and IBM Plex Mono for dates, commits, models, and code. Fonts must be self-hosted.

## Layout and interaction

- Use a 232px project rail on desktop and an accessible drawer on smaller screens.
- Keep the primary reading column between 680px and 720px.
- Make search the homepage's dominant action and support full keyboard operation.
- Present sessions as ledger rows, not interchangeable cards.
- Keep commit journals collapsed and visually subordinate to primary sessions.
- Use a 4px spacing foundation and only short, functional transitions.
- Honor `prefers-reduced-motion` and preserve visible focus at all times.

## Exclusions

Version one has no dark-mode toggle, graph view, tag cloud, fake terminal chrome, decorative dashboard statistics, or semantic search.
