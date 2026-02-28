import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEST_DIR = ROOT / 'testsprite_tests'
TMP_DIR = TEST_DIR / 'tmp' / 'runtime'
PLAN_PATH = TEST_DIR / 'testsprite_frontend_test_plan.json'
REPORT_PATH = TEST_DIR / 'tmp' / 'full_frontend_plan_run_report.json'

PYTHON_EXE = str(Path(sys.executable))


def require_env(name: str) -> str:
    value = os.getenv(name, '').strip()
    if not value:
        raise RuntimeError(
            f'Missing required environment variable: {name}. '
            'Set TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD, TEST_ALT_LOGIN_EMAIL, TEST_ALT_LOGIN_PASSWORD.'
        )
    return value


LOGIN_EMAIL = require_env('TEST_LOGIN_EMAIL')
LOGIN_PASSWORD = require_env('TEST_LOGIN_PASSWORD')
ALT_LOGIN_EMAIL = require_env('TEST_ALT_LOGIN_EMAIL')
ALT_LOGIN_PASSWORD = require_env('TEST_ALT_LOGIN_PASSWORD')

TMP_DIR.mkdir(parents=True, exist_ok=True)

# Replace literal credential placeholders with runtime env-backed variables.
LITERAL_REPLACEMENTS = {
    "'$TEST_LOGIN_EMAIL'": 'LOGIN_EMAIL',
    '"$TEST_LOGIN_EMAIL"': 'LOGIN_EMAIL',
    "'$TEST_LOGIN_PASSWORD'": 'LOGIN_PASSWORD',
    '"$TEST_LOGIN_PASSWORD"': 'LOGIN_PASSWORD',
    "'$TEST_ALT_LOGIN_EMAIL'": 'ALT_LOGIN_EMAIL',
    '"$TEST_ALT_LOGIN_EMAIL"': 'ALT_LOGIN_EMAIL',
    "'$TEST_ALT_LOGIN_PASSWORD'": 'ALT_LOGIN_PASSWORD',
    '"$TEST_ALT_LOGIN_PASSWORD"': 'ALT_LOGIN_PASSWORD',
    "'Wrong$TEST_LOGIN_PASSWORD!'": 'ALT_LOGIN_PASSWORD',
    '"Wrong$TEST_LOGIN_PASSWORD!"': 'ALT_LOGIN_PASSWORD',
}

TOKEN_REPLACEMENTS = {
    '$TEST_LOGIN_EMAIL': 'TEST_LOGIN_EMAIL',
    '$TEST_LOGIN_PASSWORD': 'TEST_LOGIN_PASSWORD',
    '$TEST_ALT_LOGIN_EMAIL': 'TEST_ALT_LOGIN_EMAIL',
    '$TEST_ALT_LOGIN_PASSWORD': 'TEST_ALT_LOGIN_PASSWORD',
    'Wrong$TEST_LOGIN_PASSWORD!': 'TEST_ALT_LOGIN_PASSWORD',
}


def scrub_output(text: str) -> str:
    if not text:
        return ''
    redacted = text
    for secret in (LOGIN_EMAIL, LOGIN_PASSWORD, ALT_LOGIN_EMAIL, ALT_LOGIN_PASSWORD):
        if secret:
            redacted = redacted.replace(secret, '[REDACTED]')
    return redacted


def patch_credentials(source: str) -> str:
    patched = source
    if "LOGIN_EMAIL = os.environ['TEST_LOGIN_EMAIL']" not in patched:
        bootstrap = (
            'import os\n'
            "LOGIN_EMAIL = os.environ['TEST_LOGIN_EMAIL']\n"
            "LOGIN_PASSWORD = os.environ['TEST_LOGIN_PASSWORD']\n"
            "ALT_LOGIN_EMAIL = os.environ['TEST_ALT_LOGIN_EMAIL']\n"
            "ALT_LOGIN_PASSWORD = os.environ['TEST_ALT_LOGIN_PASSWORD']\n\n"
        )
        patched = bootstrap + patched

    for old, new in LITERAL_REPLACEMENTS.items():
        patched = patched.replace(old, new)

    for old, new in TOKEN_REPLACEMENTS.items():
        patched = patched.replace(old, new)

    # Generated scripts include Linux/container flags that crash Chromium on Windows.
    patched = re.sub(r'^\s*"--disable-dev-shm-usage".*\r?\n', '', patched, flags=re.MULTILINE)
    patched = re.sub(r'^\s*"--ipc=host".*\r?\n', '', patched, flags=re.MULTILINE)
    patched = re.sub(r'^\s*"--single-process".*\r?\n', '', patched, flags=re.MULTILINE)
    return patched


def load_plan_ids() -> list[str]:
    try:
        plan = json.loads(PLAN_PATH.read_text(encoding='utf-8'))
        return [str(item.get('id', '')).strip() for item in plan if item.get('id')]
    except Exception:
        return []


def main() -> int:
    started = time.time()
    plan_ids = load_plan_ids()

    tc_files = sorted(TEST_DIR.glob('TC*.py'))

    # Run in plan ID order first, then extras.
    ordered: list[Path] = []
    used = set()
    for tc_id in plan_ids:
        for f in tc_files:
            if f.name.startswith(f'{tc_id}_') and f not in used:
                ordered.append(f)
                used.add(f)
    for f in tc_files:
        if f not in used:
            ordered.append(f)

    report = {
        'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(started)),
        'pythonExe': PYTHON_EXE,
        'auth': {
            'source': 'env',
            'alternateCredentialsConfigured': True,
        },
        'counts': {
            'totalScripts': len(ordered),
            'passed': 0,
            'failed': 0,
            'timedOut': 0,
        },
        'results': [],
        'finishedAt': None,
        'durationSec': None,
    }

    for idx, test_file in enumerate(ordered, start=1):
        source = test_file.read_text(encoding='utf-8', errors='replace')
        patched_source = patch_credentials(source)

        runtime_file = TMP_DIR / test_file.name
        runtime_file.write_text(patched_source, encoding='utf-8')

        t0 = time.time()
        status = 'passed'
        returncode = 0
        stdout = ''
        stderr = ''
        timeout_sec = 180

        try:
            proc = subprocess.run(
                [PYTHON_EXE, str(runtime_file)],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=timeout_sec,
                env=os.environ.copy(),
            )
            returncode = proc.returncode
            stdout = scrub_output(proc.stdout)[-6000:]
            stderr = scrub_output(proc.stderr)[-6000:]
            if returncode != 0:
                status = 'failed'
        except subprocess.TimeoutExpired as exc:
            status = 'timeout'
            returncode = -1
            stdout = scrub_output((exc.stdout or '') if isinstance(exc.stdout, str) else '')[-6000:]
            stderr = scrub_output((exc.stderr or '') if isinstance(exc.stderr, str) else '')[-6000:]

        elapsed = round(time.time() - t0, 2)
        if status == 'passed':
            report['counts']['passed'] += 1
        elif status == 'timeout':
            report['counts']['timedOut'] += 1
            report['counts']['failed'] += 1
        else:
            report['counts']['failed'] += 1

        report['results'].append({
            'index': idx,
            'testFile': test_file.name,
            'status': status,
            'returnCode': returncode,
            'durationSec': elapsed,
            'stdoutTail': stdout,
            'stderrTail': stderr,
        })

        print(f'[{idx}/{len(ordered)}] {test_file.name}: {status} ({elapsed}s)')

    finished = time.time()
    report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(finished))
    report['durationSec'] = round(finished - started, 2)

    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'REPORT: {REPORT_PATH}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
