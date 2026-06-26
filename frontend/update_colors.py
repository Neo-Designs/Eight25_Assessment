import os

target_dir = r"c:\Users\udesh\.gemini\antigravity-ide\scratch\website-audit-tool\frontend"

replacements = {
    "bg-primary-bg": "bg-background",
    "bg-surface-bg": "bg-surface",
    "text-primary-text": "text-foreground",
    "text-secondary-text": "text-secondary",
    "bg-brand-action": "bg-primary",
    "text-brand-action": "text-primary",
    "border-brand-action": "border-primary",
    "ring-brand-action": "ring-primary",
    "outline-brand-action": "outline-primary",
    "shadow-brand-action": "shadow-primary",
    "bg-brand-action-dk": "bg-primary",
    "from-wc-teal": "from-primary",
    "to-wc-steel": "to-secondary",
    "shadow-wc-teal": "shadow-primary",
    "bg-wc-steel": "bg-secondary",
    "text-wc-deep-teal": "text-primary",
    "wc-deep-teal": "primary"
}

for root, _, files in os.walk(target_dir):
    if "node_modules" in root or ".next" in root or "dist" in root:
        continue
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = content
            for old, new in replacements.items():
                new_content = new_content.replace(old, new)
            
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated {path}")
