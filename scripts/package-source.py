from pathlib import Path
import zipfile
import shutil

root = Path(__file__).absolute().parents[1]
out = root / 'outputs'
out.mkdir(exist_ok=True)
shutil.copyfile(root / 'README.md', out / 'SETUP.md')
directories = ['app','lib','components','contracts','supabase','scripts','tests','fixtures','.github','deployments']
files = ['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','proxy.ts','vitest.config.ts','postcss.config.mjs','eslint.config.mjs','components.json','.env.example','.gitignore','.gitattributes','README.md','HACKATHON.md','AGENTS.md','fee-profile.json']
paths = [root / f for f in files if (root / f).is_file()]
for directory in directories:
    paths.extend(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix not in ['.pyc','.pyo'] and p.name != 'simple-verification-pending.json')
with zipfile.ZipFile(out / 'SiteProof-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(paths):
        archive.write(path, Path('SiteProof') / path.relative_to(root))
print(f'Packaged {len(paths)} source files; excluded secrets, dependencies and runtime caches.')
shutil.copyfile(root / 'HACKATHON.md', out / 'HACKATHON.md')
with (out / 'Supabase-Setup.sql').open('w', encoding='utf-8') as combined:
    for migration in sorted((root / 'supabase' / 'migrations').glob('*.sql')):
        combined.write('\n-- '+migration.name+'\n'+migration.read_text(encoding='utf-8')+'\n')
