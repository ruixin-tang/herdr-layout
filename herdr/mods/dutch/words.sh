#!/bin/sh
# The word list for the Dutch lesson: `sh words.sh <app home>` writes data/dutch/words.json.
# At lesson time today's Journaal is not there yet, so I watch the last one from before today.
# This finds that episode, reads its subtitles (NPO serves them without a login) and asks
# Claude for the words a learner around A2 would not know, with the minute they are said.
#   { id, date, seconds, url, words: [{ at: "1:23", nl, en, zh, zin }] }
# Does nothing when the file is already about that episode. Only reads from npo.nl.
set -eu
PATH="/opt/homebrew/bin:$PATH"
dir="$1/data/dutch"; out="$dir/words.json"; api="https://npo.nl/start/api/domain"; serie="nos-journaal-in-makkelijke-taal"
mkdir -p "$dir"; cd "$dir"
today=$(date -j -f "%Y-%m-%d %H:%M:%S" "$(date +%Y-%m-%d) 00:00:00" +%s)

# Every season, because NPO's "newest" season is not the one with the newest episodes.
episode=$(curl -fsS -m 20 "$api/series-seasons?slug=$serie" | jq -r '.[] | "\(.guid) \(.slug)"' | while read -r guid season; do
  curl -fsS -m 20 "$api/programs-by-season?guid=$guid" | jq -c --arg s "$season" --argjson t "$today" \
    '.[] | select(.publishedDateTime < $t) | { id: .productId, at: .publishedDateTime, seconds: .durationInSeconds, path: "\($s)/\(.slug)" }'
done | jq -s -c 'sort_by(.at) | last')
id=$(printf '%s' "$episode" | jq -r .id)
[ -n "$id" ] && [ "$id" != null ] || { echo "no episode found" >&2; exit 1; }
[ "$(jq -r '.id // ""' "$out" 2>/dev/null)" != "$id" ] || exit 0
# The list of an older episode must not stay: without a list the lesson opens the page of episodes.
rm -f "$out"
# From here every try leaves a line in words.log, and what went wrong after it.
exec 2>>"$dir/words.log"; echo "$(date '+%Y-%m-%d %H:%M') try for $id" >&2

# The subtitles as "m:ss text" lines.
text=$(curl -fsS -m 20 "https://cdn.npoplayer.nl/subtitles/nl/$id.vtt" | awk '
  /-->/ { split($1, t, ":"); at = (t[1] * 60 + t[2]) ":" substr(t[3], 1, 2); next }
  /^WEBVTT/ || /^$/ { next }
  { gsub(/<[^>]*>/, ""); if (at != "") print at, $0 }')
[ -n "$text" ] || { echo "no subtitles for $id" >&2; exit 1; }

ask='Below are the subtitles of one NOS Journaal in Makkelijke Taal, as "m:ss text" lines. It is a public
television news broadcast: the people named in it are newsreaders and people in the news, nobody'"'"'s customer.
I am learning Dutch and I am around level A2. Pick the 16 words or fixed expressions that I most
likely do not know and that I need to follow the news items. Skip names, numbers and everyday words.
Spread them over the whole broadcast: it has a few news items, and each of them gets its share by
how long it is, the last items too. Not more than 5 words from one item.
The broadcast opens with a short overview of its items ("In dit journaal ...") and ends with the
same list again. Take no time from those two: "at" is where the word is said inside its own item.
Answer with a JSON array only, in the order they are said, no code fence, each item:
{"at": the m:ss of the line it is first said in within its item, "nl": the word as a dictionary has it (a noun with
de or het, a verb as infinitive), "en": short English meaning, "zh": short Chinese meaning,
"zin": the sentence from the subtitles it is said in}'
# Up to three times: now and then it answers with something else than the list.
ok() { printf '%s' "$words" | jq -e 'type == "array" and length > 3 and all(.[]; .nl and .at)' >/dev/null 2>&1; }
for try in 1 2 3; do
  raw=$(printf '%s\n\n%s\n' "$ask" "$text" | claude -p --model haiku --tools "" 2>&1) || true
  # Only the array, whatever it says around it.
  words=$(printf '%s' "$raw" | awk '/^\[/ { on = 1 } on { print } /^\]/ { on = 0 }')
  ok && break
done
ok || { printf "no word list from claude: %.300s\n" "$raw" >&2; exit 1; }

printf '%s' "$words" | jq --argjson e "$episode" --arg serie "$serie" \
  '{ id: $e.id, date: ($e.at | strflocaltime("%Y-%m-%d")), seconds: $e.seconds, url: "https://npo.nl/start/serie/\($serie)/\($e.path)/afspelen", words: . }' > "$out.new"
mv "$out.new" "$out"
