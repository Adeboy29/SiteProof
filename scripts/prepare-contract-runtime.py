"""Cache official GenVM runners for genlayer-test on restricted Windows hosts.

No runtime logic is changed. The current release renamed the universal artifact
to genvm-runners-all.tar.xz. Extract only regular files with checked paths, since
Windows sandbox realpath can reject tarfile's default extraction filter.
"""
import io
import json
import os
from pathlib import Path, PurePosixPath
import tarfile
import urllib.request

ROOT = Path(__file__).absolute().parents[1]
CACHE = ROOT / 'work' / 'gltest-cache'
VERSION = 'v0.3.0-rc7'
HASH = '1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6'
CACHE.mkdir(parents=True, exist_ok=True)
archive = CACHE / f'genvm-universal-{VERSION}.tar.xz'
if not archive.exists():
    url = f'https://github.com/genlayerlabs/genvm/releases/download/{VERSION}/genvm-runners-all.tar.xz'
    urllib.request.urlretrieve(url, archive)

with tarfile.open(archive, 'r:xz') as outer:
    members = {m.name: m for m in outer.getmembers()}

    def extract(kind, content_hash):
        member = f'runners/{kind}/{content_hash[:2]}/{content_hash[2:]}.tar'
        if member not in members:
            raise ValueError(f'Official runtime missing: {kind}:{content_hash}')
        target = CACHE / 'extracted' / VERSION / kind / content_hash
        target.mkdir(parents=True, exist_ok=True)
        content = outer.extractfile(member).read()
        with tarfile.open(fileobj=io.BytesIO(content), mode='r:') as inner:
            for item in inner:
                path = PurePosixPath(item.name)
                if path.is_absolute() or '..' in path.parts or any(':' in part for part in path.parts):
                    raise ValueError('Unsafe archive path')
                output = target.joinpath(*path.parts)
                if item.isdir():
                    output.mkdir(parents=True, exist_ok=True)
                elif item.isfile():
                    output.parent.mkdir(parents=True, exist_ok=True)
                    output.write_bytes(inner.extractfile(item).read())
                else:
                    # Runners used by direct mode need only regular source files.
                    continue
        print(f'Cached official runner {kind}:{content_hash}')
        manifest = target / 'runner.json'
        if manifest.exists():
            for item in json.loads(manifest.read_text()).get('Seq', []):
                dep = item.get('Depends', '')
                if ':' in dep:
                    dep_kind, dep_hash = dep.split(':', 1)
                    if dep_kind.startswith('py-lib-'):
                        extract(dep_kind, dep_hash)
        return target

    extract('py-genlayer', HASH)
