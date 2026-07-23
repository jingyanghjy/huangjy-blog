$ErrorActionPreference = "Stop"

powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\sync-tag-aliases.ps1"
hugo --minify
