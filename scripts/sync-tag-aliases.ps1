param(
  [string]$ContentDir = "content",
  [string]$AliasFile = "data/tag_aliases.yaml"
)

$ErrorActionPreference = "Stop"

function Get-TagKey {
  param([string]$Tag)

  return $Tag.Trim().ToLowerInvariant()
}

function Read-Aliases {
  param([string]$Path)

  $aliases = [ordered]@{}

  if (!(Test-Path -LiteralPath $Path)) {
    return $aliases
  }

  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    if ($line -match "^\s*#|^\s*$") {
      continue
    }

    if ($line -match "^\s*([^:]+?)\s*:\s*(.+?)\s*$") {
      $key = Get-TagKey $matches[1]
      $value = $matches[2].Trim().Trim("'`"")

      if ($key -and !$aliases.Contains($key)) {
        $aliases[$key] = $value
      }
    }
  }

  return $aliases
}

function Get-FrontMatter {
  param([string]$Text)

  if ($Text -match "(?s)^---\s*\r?\n(.*?)\r?\n---") {
    return $matches[1]
  }

  if ($Text -match "(?s)^\+\+\+\s*\r?\n(.*?)\r?\n\+\+\+") {
    return $matches[1]
  }

  return ""
}

function Get-TagsFromFrontMatter {
  param([string]$FrontMatter)

  $tags = New-Object System.Collections.Generic.List[string]

  if ($FrontMatter -match "(?m)^\s*tags\s*=\s*\[(.*?)\]\s*$") {
    foreach ($item in $matches[1].Split(",")) {
      $tag = $item.Trim().Trim("'`"")

      if ($tag) {
        $tags.Add($tag)
      }
    }
  }

  if ($FrontMatter -match "(?m)^\s*tags\s*:\s*\[(.*?)\]\s*$") {
    foreach ($item in $matches[1].Split(",")) {
      $tag = $item.Trim().Trim("'`"")

      if ($tag) {
        $tags.Add($tag)
      }
    }
  }

  return $tags
}

$aliases = Read-Aliases $AliasFile
$added = 0

Get-ChildItem -LiteralPath $ContentDir -Recurse -File -Include "*.md", "*.markdown" |
  Sort-Object FullName |
  ForEach-Object {
    $text = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
    $frontMatter = Get-FrontMatter $text

    if (!$frontMatter) {
      return
    }

    foreach ($tag in Get-TagsFromFrontMatter $frontMatter) {
      $key = Get-TagKey $tag

      if ($key -and !$aliases.Contains($key)) {
        $aliases[$key] = $tag.Trim()
        $added += 1
      }
    }
  }

$aliasDir = Split-Path -Parent $AliasFile

if ($aliasDir -and !(Test-Path -LiteralPath $aliasDir)) {
  New-Item -ItemType Directory -Force -Path $aliasDir | Out-Null
}

$lines = foreach ($entry in $aliases.GetEnumerator()) {
  "$($entry.Key): $($entry.Value)"
}

Set-Content -LiteralPath $AliasFile -Encoding UTF8 -Value $lines

Write-Host "tag aliases synced, added $added new tag(s)."
