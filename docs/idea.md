PROJECT CONTEXT — INMOBI SPORTS DAY 2026

## What We Are Building

We are building a standalone web experience specifically for the InMobi Sports Day 2026 event.

This is NOT a general-purpose tournament management platform.

The website is mainly a polished public-facing event website where users can explore the different sports/tournaments and view their knockout match schedules and results.

The website should feel like a premium InMobi experience — professional, modern, classy, exciting, clean, and smooth.

The design should follow the visual language of the InMobi website and the provided InMobi Sports Day branding/poster.

Avoid making it look like a generic sports website or a collection of random cards.

---

## Event Structure

There is one main Event:

INMOBI SPORTS DAY 2026

Under this event there will be multiple individual tournaments/sports.

For example:

- Cricket
- Football
- Carrom
- Badminton
- Chess
- Darts
- Table Tennis
- Races & Relay

The structure is:

Event
  ↓
Tournaments
  ↓
Individual Tournament
  ↓
Details / Matches / Gallery / Videos

---

## Event Home Page

The home page represents the overall InMobi Sports Day event.

It should contain:

- InMobi Sports Day 2026
- Event branding
- Event dates
- Relevant event/venue information
- A strong and visually appealing hero section
- A Tournaments section

The tournaments should be presented as a cohesive, professionally designed experience.

Do not simply place a large number of generic cards in a grid.

The layout should feel intentional, balanced, modern and exciting.

---

## Individual Tournament Page

When a user selects a sport, they enter that sport's individual tournament page.

For example:

CARROM TOURNAMENT

The page should contain basic tournament information such as:

- Sport name
- Tournament name
- Date
- Venue
- Simple tournament information

The navigation should contain ONLY:

- Details
- Matches
- Gallery
- Videos

Do NOT add:

- Leaderboards
- Points tables
- Registration
- Entry fees
- Organizer information
- Contact information
- Other unnecessary tournament-management features

---

## Matches

The Matches section is the most important part of the individual tournament page.

All sports are knockout tournaments.

The bracket should visually represent the progression of matches through the rounds.

For example:

Round 1
  ↓
Round 2
  ↓
Quarter-Finals
  ↓
Semi-Finals
  ↓
Final

The bracket should be the main visual focus.

It should have clear, polished connecting lines/arrows between matches and rounds.

The arrows/connectors are important because they should make it immediately obvious how a winner progresses to the next round.

The bracket should not look like a basic list of matches.

It should feel like a professional tournament bracket and remain easy to understand.

---

## Match Participants

Different sports have different participant structures.

### Individual / Doubles Sports

For sports such as:

- Carrom
- Badminton
- Table Tennis

The bracket should show the actual participant/player names.

Support:

Singles:
Player 1
Player 2

Doubles:
Player 1 & Player 2
Player 3 & Player 4

### Team Sports

For sports such as:

- Cricket
- Football

The bracket should show ONLY the team name.

For example:

TEAM A
vs
TEAM B

Do NOT show all the individual players inside the bracket cards for team sports.

Player details can be handled later through a separate Match Details view. That is not part of the current UI scope.

---

## Match States

The UI should support these match states:

- Upcoming
- Live
- Completed
- Winner

Upcoming matches should clearly show their scheduled timing.

Live matches should have a subtle but noticeable LIVE indicator.

Completed matches should show the score and clearly indicate the winner.

The design should make it easy for someone visiting the website to understand:

- What is happening now
- What is coming next
- What has already been completed
- Who won

---

## Match Data

The tournament match information will come from Google Sheets.

The business team will maintain the tournament schedules and results using Google Sheets.

For now, the UI should use realistic mock data.

Do NOT implement Google Sheets integration yet.

The Google Sheet structure we are currently planning to use is based on the existing sheet provided by the business team.

The sheet contains information such as:

- Match Number
- Round
- Team / Player 1
- Team / Player 2
- Board
- Timing
- Day
- Winner

The existing sheet also uses values such as:

"Winner Match 1"

to indicate that the winner of one match progresses into another match.

For now, use this existing sheet structure as the reference. Do not redesign or add unnecessary fields to the sheet.

---

## Gallery

Each individual tournament should have a Gallery section.

The gallery should be clean and visually appealing, with a professional editorial-style image layout.

---

## Videos

Each individual tournament should also have a Videos section.

Use a clean, polished media layout with video previews.

---

## Important Design Direction

The website should feel:

- InMobi
- Premium
- Modern
- Corporate
- Sporty
- Exciting
- Clean
- Classy
- Smooth

Use:

- Strong typography
- Good spacing
- Clear visual hierarchy
- Subtle animations and transitions
- Refined use of brand colors
- Clean layouts
- Professional imagery
- Subtle gradients where appropriate

Avoid:

- Generic sports templates
- Random card grids
- Excessive shadows
- Excessive rounded cards
- Too many colors
- Unnecessary decorative elements
- Clutter
- Admin-dashboard styling
- Unnecessary information

The website should feel like one carefully designed InMobi event experience.

---

## Current Development Scope

For the current stage, focus ONLY on the frontend UI.

Use mock/static data.

Do NOT implement yet:

- Google Sheets API
- Backend
- Database
- Authentication
- Admin dashboard
- Tournament management
- Match editing
- Player management
- Match Details functionality

The goal right now is to get the complete UI and user experience right first.

Later, the mock tournament data will be replaced with real Google Sheet data through the backend/API without changing the overall design.
