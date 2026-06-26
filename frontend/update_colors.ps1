$files = Get-ChildItem -Path 'c:\Users\udesh\.gemini\antigravity-ide\scratch\website-audit-tool\frontend' -Recurse -Include *.tsx, *.ts -Exclude node_modules, .next, dist

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    # Backgrounds
    $content = $content -replace 'bg-primary-bg', 'bg-background'
    $content = $content -replace 'bg-surface-bg', 'bg-surface'
    
    # Text
    $content = $content -replace 'text-primary-text', 'text-foreground'
    $content = $content -replace 'text-secondary-text', 'text-secondary'
    
    # Brand Action mappings
    $content = $content -replace 'bg-brand-action', 'bg-primary'
    $content = $content -replace 'text-brand-action', 'text-primary'
    $content = $content -replace 'border-brand-action', 'border-primary'
    $content = $content -replace 'ring-brand-action', 'ring-primary'
    $content = $content -replace 'outline-brand-action', 'outline-primary'
    $content = $content -replace 'shadow-brand-action', 'shadow-primary'
    $content = $content -replace 'bg-brand-action-dk', 'bg-primary'

    # Legacy color mappings
    $content = $content -replace 'from-wc-teal', 'from-primary'
    $content = $content -replace 'to-wc-steel', 'to-secondary'
    $content = $content -replace 'shadow-wc-teal', 'shadow-primary'
    $content = $content -replace 'bg-wc-steel', 'bg-secondary'
    $content = $content -replace 'text-wc-deep-teal', 'text-primary'

    Set-Content -Path $file.FullName -Value $content
}
