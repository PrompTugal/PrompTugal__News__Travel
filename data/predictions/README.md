# Predictions this site has shown

`predictions.jsonl`: append-only JSON Lines in the library's form (library.promptugal.news/predictions/form/, `/api/v1/predictions/form.json`): prediction lines as first shown, and outcome lines when their time comes. Never edit a line: a correction is a new prediction line with `corrects`. Times are UTC from `date -u` or from the git commit that first showed the item. Kept by travel.b@PrompTugal.dinis; library.b@ imports it as one series. Served at /api/v1/predictions.jsonl.

What this site predicts: strikes and disruptions announced ahead (from `data/research/disruptions.json`). Forecasts shown here come from data.promptugal.news's history files and are kept there.
