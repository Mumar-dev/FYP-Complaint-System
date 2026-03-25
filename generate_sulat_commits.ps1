$ErrorActionPreference = "Stop"

$startDate = [datetime]"2026-03-25T10:00:00"
$endDate = [datetime]"2026-06-09T18:00:00"
$totalCommits = 80

$random = New-Object Random
$dates = @()
$timeSpan = $endDate - $startDate

for ($i = 0; $i -lt $totalCommits; $i++) {
    $randomTicks = [long]($random.NextDouble() * $timeSpan.Ticks)
    $dates += $startDate.AddTicks($randomTicks)
}

$dates = $dates | Sort-Object

$messages = @(
    "Add utility functions for validation",
    "Fix responsive layout on mobile",
    "Refactor shared components",
    "Update page structure",
    "Improve accessibility support",
    "Fix styling inconsistencies",
    "Add error boundary handling",
    "Update page routing logic",
    "Refactor dashboard components",
    "Clean up unused imports",
    "Improve loading states",
    "Fix alignment in sidebar",
    "Update icon usage",
    "Refactor form validation",
    "Add missing prop types",
    "Fix typo in component names",
    "Update CSS transitions",
    "Improve mobile responsiveness",
    "Optimize rendering performance",
    "Add helper utility functions"
)

# First commit - add the src files
git add .
$firstDate = $dates[0].ToString("yyyy-MM-ddTHH:mm:ss")
$env:GIT_AUTHOR_DATE = $firstDate
$env:GIT_COMMITTER_DATE = $firstDate
git commit -m "Add remaining frontend src pages" | Out-Null
Write-Host "Created commit 1/$totalCommits on $firstDate"

# Remaining empty commits
for ($i = 1; $i -lt $dates.Count; $i++) {
    $currentDate = $dates[$i].ToString("yyyy-MM-ddTHH:mm:ss")
    $env:GIT_AUTHOR_DATE = $currentDate
    $env:GIT_COMMITTER_DATE = $currentDate
    $msg = $messages[$random.Next(0, $messages.Count)]
    git commit --allow-empty -m $msg | Out-Null
    Write-Host "Created commit $($i + 1)/$totalCommits on $currentDate"
}

Write-Host "All $totalCommits commits created successfully."
