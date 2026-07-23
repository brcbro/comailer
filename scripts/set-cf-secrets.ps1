# Set all Wrangler secrets from .env (run from project root in PowerShell)
$lines = Get-Content .env | Where-Object { $_ -match '^\s*[A-Z_]+\s*=' }
foreach ($line in $lines) {
  if ($line -match '^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$') {
    $name = $Matches[1]
    $value = $Matches[2]
    if ($name -eq 'APP_URL' -and $value -match 'localhost') {
      Write-Host "Skipping APP_URL (still localhost). Set to your Worker URL first."
      continue
    }
    Write-Host "Setting secret: $name"
    $value | npx wrangler secret put $name
  }
}

Write-Host "Done. Production APP_URL:"
Write-Host "  echo 'https://comailer.cohortix.in' | npx wrangler secret put APP_URL"
