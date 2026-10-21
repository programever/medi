# Medi

A meditation timer with bells. Alpha built it on 2026-10-21 for Iker.

The page is on GitHub Pages: https://programever.github.io/medi/

## What it does

The first screen has three buttons. The text on the page is in Vietnamese.

| Button | Bells |
|---|---|
| 10 phút (10 minutes) | start bell at 0:00, end bell at 10:00 |
| 30 phút (30 minutes) | start bell, a bell at minute 15, end bell at 30:00 |
| 1 giờ (1 hour) | start bell, a bell at minutes 15, 30 and 45, end bell at 60:00 |

Press a button and the start bell rings at once. A big clock shows the time
that is left. A ring around the clock fills up. Small dots on the ring show
where the 15-minute bells are. Under the clock it says when the next bell comes.
There is a button to pause and a button to stop. When the end bell has rung,
the page says "Xong" (done).

You can lock the phone. The bells still ring.

## How it works, and why

An iPhone stops the timers of a web page when the screen is locked. But it
keeps playing a sound file. So the timer here is a sound file: for each
session there is one long file with the bells in the right places and silence
between them. The page only plays the file. The clock on the screen is read
from the position in the sound file, so it always agrees with the bells.

- `sounds/` has the three bells Iker gave: `start.mp3`, `bell15.mp3` (the
  15-minute bell) and `end.mp3`.
- `src/sessions.ts` is the list of sessions and their bell minutes.
- `tools/make-sounds.ts` makes `src/medi-10.mp3`, `src/medi-30.mp3` and
  `src/medi-60.mp3` from the bells and the list. It needs ffmpeg (a program
  that cuts and joins sound files). The files are made once and kept in git.
  The silence takes almost no space: the 1-hour file is about 4 MB.
- `src/app.ts` is the page.

There is no server, no login and no saved data.

## Haba mark

When a session ends with the end bell, Medi marks Meditate in Haba, Iker's
habit page (Iker, 2026-10-21). A stopped session does not. Haba allows one mark
per day, so two sessions on one day give one mark. The done screen says if it
worked. The code is `src/haba-mark.ts`, a copy of `haba/shared/haba-mark.ts`.
The browser test fakes Haba, so it never writes to Iker's real data.

## Change it

To change the bells or the minutes: edit `sounds/` or `src/sessions.ts`, then

```
npm run sounds        # make the three sound files again
npm test              # type check, and check that every bell is at the right second
npm run build         # make dist/
npm run test:browser  # run a 30-minute session in a hidden browser, jumping ahead
```

`npm run test:browser` also saves pictures of the screens in `test-shots/`.

Every push to `main` runs the tests on GitHub, builds `dist/` and pushes it to
the `gh-pages` branch. GitHub Pages shows that branch. Like the other pages of
Alpha, `main` is kept as one commit (`git commit --amend`, then
`git push --force origin main`).
