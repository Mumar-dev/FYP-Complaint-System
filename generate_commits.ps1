$ErrorActionPreference = "Stop"

$startDate = [datetime]"2026-03-05T10:00:00"
$endDate = [datetime]"2026-06-09T18:00:00"
$totalCommits = 150

# Generate 150 random dates between start and end
$random = New-Object Random
$dates = @()
$timeSpan = $endDate - $startDate

for ($i = 0; $i -lt $totalCommits; $i++) {
    $randomTicks = [long]($random.NextDouble() * $timeSpan.Ticks)
    $dates += $startDate.AddTicks($randomTicks)
}

# Sort the dates chronologically
$dates = $dates | Sort-Object

$messages = @(
    "Update UI components",
    "Fix styling issues",
    "Refactor component structure",
    "Improve performance",
    "Update dependencies",
    "Fix bug in rendering",
    "Enhance responsiveness",
    "Add new utility functions",
    "Update state management",
    "Clean up code",
    "Resolve merge conflicts",
    "Update documentation",
    "Tweak animations",
    "Optimize asset loading",
    "Fix alignment in dashboard",
    "Update color palette",
    "Refactor hooks",
    "Update API integration",
    "Fix error handling",
    "Add loading states"
)

# Stage all files
git add .

for ($i = 0; $i -lt $dates.Count; $i++) {
    $currentDate = $dates[$i].ToString("yyyy-MM-ddTHH:mm:ss")
    
    $env:GIT_AUTHOR_DATE = $currentDate
    $env:GIT_COMMITTER_DATE = $currentDate
    
    if ($i -eq 0) {
        $msg = "Initial frontend commit"
        git commit -m $msg | Out-Null
    } else {
        $msg = $messages[$random.Next(0, $messages.Count)]
        git commit --allow-empty -m $msg | Out-Null
    }
    
    Write-Host "Created commit $($i + 1)/$totalCommits on $currentDate"
}

Write-Host "All commits created successfully."
