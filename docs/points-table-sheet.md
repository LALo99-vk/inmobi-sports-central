# Points Table — how the sheet drives the page

The standings at `/points-table` are read from the **Results** tab of the same
Google Sheet the tournaments come from. Fill in the results, and the page
updates within a minute.

## The scoring system

Every sport is worth exactly **50 points**, so all nine carry equal weight
regardless of how many people play them. **450 points** in total.

| Sport         | Events                   | Gold | Silver | Bronze | Sport total |
| ------------- | ------------------------ | ---- | ------ | ------ | ----------- |
| Cricket       | Open                     | 25   | 15     | 10     | 50          |
| Football      | Open                     | 25   | 15     | 10     | 50          |
| Chess         | Open                     | 25   | 15     | 10     | 50          |
| Carrom        | Open                     | 25   | 15     | 10     | 50          |
| Foosball      | Open                     | 25   | 15     | 10     | 50          |
| Dart          | Open                     | 25   | 15     | 10     | 50          |
| Badminton     | 5 categories × 10 pts    | 5    | 3      | 2      | 50          |
| Table Tennis  | 5 categories × 10 pts    | 5    | 3      | 2      | 50          |
| Races & Relay | 100 m and 400 m × 25 pts | 12   | 8      | 5      | 50          |

18 events in all. Points go to the **house**, never the individual.

## Filling in the Results tab

One row per event. For each one, pick the winning house from the dropdown in
the **GOLD — house**, **SILVER — house** and **BRONZE — house** columns. The
`Pts` column beside each medal is fixed — leave it alone.

That is the whole job. Everything on the website is calculated from these
rows: the standings, the medal counts, the per-sport totals and the progress
through the 450.

Rules the site follows:

- **The site does its own arithmetic.** It never reads your `Awarded` totals,
  the `TOTAL` row or the `RANK` row — it adds the events up itself. Keep those
  for your own use; they're ignored rather than double-counted.
- **A blank medal means "not decided yet"**, not zero. An event with nothing
  filled in shows as *Not played*.
- **Half-filled events are fine.** If you know the gold but not the bronze,
  fill in the gold — those points count immediately. The event only counts
  toward "events decided" once all three medals are in.
- **House names** can be the full name (`Red Raiders`), the code (`RR`) or both
  (`Red Raiders (RR)`). Anything else is ignored and reported as a warning.
- **The `Check` column is yours.** The site works out for itself what has been
  played, so changing that column's wording can't break anything.
- **Sports that match a tournament** link through to that tournament's page.

## The LeaderBoard tab

Read only as a cross-check. The site compares its own totals and medal counts
against it and reports any disagreement on `/api/sheet-status`. If the two ever
differ, the Results tab wins on the page — it is the source of truth.

The site also takes the **order it lists the sports in** from this tab, so the
website reads the same way round as the sheet.

## Before results are entered

The page still renders: all four houses at zero, all nine sports listed, every
event marked *Not played*. It never invents a score.

## Checking it

`/api/sheet-status` lists everything the parser could not understand, plus every
reconciliation check that failed — a sport that doesn't add to 50, a house name
it didn't recognise, or a total that disagrees with the LeaderBoard tab.
