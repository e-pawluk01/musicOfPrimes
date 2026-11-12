# Music of the Primes

A small web app that turns the prime numbers into music and a growing picture.

Each prime plays a note and appears as a dot. A prime `p` sits at angle `p` radians, at distance `p` from the centre. The angle also picks the note, so dots on the same ray share a colour and a pitch.

This is the core version: primes, the plot with slow zoom, sound, play/pause, restart and speed. More sets, sounds and settings come next.

## Run it on your computer

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000 and press Play.

## Check the logic

```bash
npm test
```

## Put it live

Import this repository in Vercel and press Deploy. No settings are needed.
