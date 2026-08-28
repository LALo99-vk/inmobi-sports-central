# InMobi Sports Central

Build a standalone, premium tournament website for the InMobi Sports Day 2026 event.

The website should feel like a professional InMobi-branded experience — modern, classy, exciting, clean, and polished. Do not make it look like a generic sports tournament template.

Use the InMobi visual identity as inspiration: clean layouts, strong typography, subtle gradients, refined spacing, modern interactions, and a professional corporate feel. Use the InMobi Sports Day 2026 poster/branding as the visual reference.

Keep the design simple and uncluttered. Avoid excessive cards, unnecessary information, heavy shadows, overly rounded components, or random decorative elements.

## Website structure

### Event Home Page

Show:

- InMobi Sports Day 2026

- Event dates

- Event/venue information

- A visually strong hero section

- A "Tournaments" section

The Tournaments section should contain the different sports:

- Cricket

- Football

- Carrom

- Badminton

- Chess

- Darts

- Table Tennis

- Races & Relay

Each tournament should feel like part of one cohesive design system.

### Individual Tournament Page

When a tournament is selected, show:

- Sport name

- Tournament name

- Date

- Venue

- Simple tournament information

Use only these navigation tabs:

- Details

- Matches

- Gallery

- Videos

Do NOT include:

- Leaderboard

- Points Table

- Registration

- Entry Fee

- Organizer information

- Contact information

### Matches Page

The main focus should be the knockout tournament bracket.

Show the tournament progression clearly:

Round 1 → Round 2 → Quarter-Finals → Semi-Finals → Final

The bracket should look modern, clean, and easy to follow.

Also support the visual states:

- Upcoming

- Live

- Completed

- Winner

Live matches should have a subtle but noticeable live indicator.

Completed matches should clearly show the winner and score.

The bracket should feel like a premium sports-event experience, not an admin dashboard.

### Gallery

Create a clean, modern image gallery.

### Videos

Create a clean video section with large, polished video previews.

## Important

For now, use realistic mock data only.

Do NOT implement Google Sheets, backend APIs, authentication, admin functionality, or database integration yet.

Focus entirely on creating a beautiful, responsive frontend UI.

Make the experience smooth across desktop, tablet, and mobile.

The final design should feel:

- InMobi

- Premium

- Modern

- Minimal

- Sporty

- Exciting

- Professional

Most importantly, maintain strong visual hierarchy and spacing. Every section should feel intentionally designed rather than simply placing cards in a grid.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6469a69d-d77b-4e59-8c3e-0f267b898301).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
