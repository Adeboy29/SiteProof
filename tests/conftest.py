from pathlib import Path
from gltest.direct import sdk_loader
import os
import pytest
# Keep downloaded official runtime artifacts in the project sandbox.
sdk_loader.CACHE_DIR = Path(__file__).resolve().parents[1] / 'work' / 'gltest-cache'

@pytest.fixture(autouse=True)
def windows_open_temp_cleanup(monkeypatch):
    """Defer only Windows open-file deletion; do not alter VM or consensus logic."""
    if os.name != 'nt':
        yield
        return
    original = os.unlink
    deferred = []
    def unlink(path, *args, **kwargs):
        try:
            return original(path, *args, **kwargs)
        except PermissionError as error:
            # The official runner dup2's a temporary file onto stdin before unlink.
            # Windows disallows unlink until that descriptor has been restored.
            if getattr(error, 'winerror', None) != 32:
                raise
            deferred.append((path,args,kwargs))
    monkeypatch.setattr(os, 'unlink', unlink)
    yield
    for path,args,kwargs in deferred:
        try:
            original(path,*args,**kwargs)
        except (PermissionError,FileNotFoundError):
            pass
