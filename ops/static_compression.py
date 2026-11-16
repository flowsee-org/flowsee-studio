"""Manual, reversible compression tuning for Flowsee's public static CSS/JS/SVG."""
from pathlib import Path
import os
import re
import shutil
import subprocess
import tempfile

MARKER = '# flowsee-static-compression-v1'
DIRECTIVES = f'''{MARKER}
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_comp_level 5;
        gzip_types text/css application/javascript text/javascript image/svg+xml;
'''


def transform(text, domain):
    if MARKER in text:
        return text
    if domain == 'flowsee.ir':
        matches = list(re.finditer(r'location\s+~\*[^\n{}]*css[^\n{}]*\{', text))
        if len(matches) != 1:
            raise ValueError('Expected exactly one main-site static asset location')
        pos = matches[0].end()
        return text[:pos]+'\n        '+DIRECTIVES+text[pos:]
    roots = list(re.finditer(r'(?m)^\s*root\s+/var/www/flowsee-studio/dist\s*;', text))
    if len(roots) != 1:
        raise ValueError('Expected the known Studio document root')
    pos = roots[0].end()
    location = '\n    location ~* ^/assets/.*\\.(?:css|js|svg)$ {\n        try_files $uri =404;\n        '+DIRECTIVES+'    }\n'
    return text[:pos]+location+text[pos:]


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as root through the maintenance workflow.')
    originals = {}
    backup = Path(tempfile.mkdtemp(prefix='flowsee-nginx-backup-', dir='/var/backups'))
    try:
        for domain in ('flowsee.ir', 'studio.flowsee.ir'):
            path = (Path('/etc/nginx/sites-enabled')/domain).resolve(strict=True)
            if not path.is_relative_to(Path('/etc/nginx')) or not path.is_file():
                raise ValueError('Unexpected nginx configuration path')
            old = path.read_bytes()
            new = transform(old.decode('utf-8'), domain).encode('utf-8')
            if new == old:
                continue
            originals[path] = old
            shutil.copy2(path, backup/domain)
            path.write_bytes(new)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except Exception:
        for path, original in originals.items():
            path.write_bytes(original)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        raise
    print('Static compression enabled. Configuration backup:', backup)


if __name__ == '__main__':
    main()
