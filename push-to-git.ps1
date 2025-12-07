<#
Simple PowerShell helper to inspect, commit, and push this project to the configured remote.
Run this from the project root in PowerShell: `./push-to-git.ps1`

It will:
- show `git remote -v` and `git status --porcelain`
- prompt before creating the initial commit and pushing

Edit the `$remoteUrl` variable if you want to set or replace the `origin` URL.
#>

Param()

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -Path $projectRoot

Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is not installed or not available in PATH. Install Git first: https://git-scm.com/downloads"
    exit 1
}

git --version

Write-Host "\nRemotes:" -ForegroundColor Yellow
git remote -v || Write-Host "(no remotes configured)"

Write-Host "\nStatus (porcelain):" -ForegroundColor Yellow
git status --porcelain

$confirm = Read-Host "Proceed to stage all changes, commit, and push to 'origin' on branch 'main'? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Aborted by user." -ForegroundColor Yellow
    exit 0
}

# Optional: set remote if user wants to (leave empty to skip)
$remoteUrl = '' # e.g. 'https://github.com/USERNAME/REPO.git' or 'git@github.com:USERNAME/REPO.git'
if ($remoteUrl -ne '') {
    if (git remote get-url origin -ErrorAction SilentlyContinue) {
        Write-Host "Replacing existing 'origin' with $remoteUrl"
        git remote remove origin
    }
    git remote add origin $remoteUrl
}

# Ensure branch is main (safe to change if your branch differs)
git branch --show-current | Out-String | ForEach-Object { $_ = $_.Trim() }
try { git branch -M main } catch { }

git add -A

try {
    git commit -m "Initial commit" -q
    Write-Host "Committed changes." -ForegroundColor Green
} catch {
    Write-Host "No changes to commit or commit failed (maybe already committed)." -ForegroundColor Yellow
}

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push -u origin main

Write-Host "Done. Check GitHub (or your remote) to confirm the repo state." -ForegroundColor Green