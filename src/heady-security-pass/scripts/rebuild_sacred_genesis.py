from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAKE_ZIP = ROOT / 'scripts' / 'make_zip.py'
DEFAULT_OUTPUT = ROOT / 'dist' / 'heady-sacred-genesis.zip'
DEFAULT_PREFIX = 'heady-sacred-genesis'


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Rebuild the Sacred Genesis bundle by delegating to scripts/make_zip.py.'
    )
    parser.add_argument('--output', default=str(DEFAULT_OUTPUT), help='Output zip path.')
    parser.add_argument('--prefix', default=DEFAULT_PREFIX, help='Archive root folder name.')
    args = parser.parse_args()

    command = [
        sys.executable,
        str(MAKE_ZIP),
        '--output',
        args.output,
        '--prefix',
        args.prefix,
    ]
    result = subprocess.run(command, cwd=ROOT)
    return int(result.returncode)


if __name__ == '__main__':
    raise SystemExit(main())
