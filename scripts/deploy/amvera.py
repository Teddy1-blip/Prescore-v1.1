"""Deliver a checked GitHub tree without rewriting Amvera history.

Credentials exist only in the process environment and an ephemeral askpass
process. Raw Git/network output is never printed or saved as an artifact.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

REPOSITORY = 'Teddy1-blip/Prescore-v1.1'
EXPECTED_URL_HASH = '95c8b8a8a66257a3b8cf960a4cd59ea7d12ecca14e9dec5337094c07209fb58f'
EXPECTED_USERNAME_HASH = '1836883e26077edebe552d31af4d4475b979862e78bd0fb22af6da7c17a8063f'
SHA = re.compile(r'^[0-9a-f]{40}$')


class DeliveryError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise DeliveryError(message)


def diagnostic(stderr):
    text = stderr.lower()
    if any(s in text for s in ('authentication failed', '401', '403', 'could not read username')):
        return 'Authentication/access denied. Check the Amvera account credentials and Git access; do not substitute a GitHub PAT or disable 2FA.'
    if 'repository not found' in text or '404' in text:
        return 'The verified staging Git repository was not found or is not accessible to this account. Deployment stopped.'
    if any(s in text for s in ('ssl', 'certificate', 'tls')):
        return 'TLS verification failed. Certificate verification remains enabled.'
    if any(s in text for s in ('resolve host', 'connect', 'timed out')):
        return 'Network/DNS connection failed. No credentials or raw server response logged.'
    return 'Git operation failed. Raw output withheld because it can contain credentials or remote URLs.'


def run_git(args, cwd, env=None, input_text=None):
    # Ephemeral repositories must not spawn detached maintenance processes that
    # race with backup creation or temporary-directory cleanup on CI runners.
    result = subprocess.run(['git', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false',
                             '-c', 'credential.helper=', '-c', 'http.sslVerify=true',
                             '-c', 'http.followRedirects=false', *args], cwd=cwd,
                            env=env, input=input_text, capture_output=True, text=True, timeout=180)
    if result.returncode:
        if args[0] == 'ls-remote' and result.returncode == 2:
            raise DeliveryError('Amvera refs/heads/master was not found; no write performed.')
        raise DeliveryError(diagnostic(result.stderr))
    return result.stdout.strip()


def validate_destination(env):
    missing = [key for key in ('AMVERA_USERNAME', 'AMVERA_PASSWORD', 'AMVERA_GIT_URL') if not env.get(key)]
    require(not missing, 'Missing GitHub Actions Secrets: ' + ', '.join(missing))
    require(hashlib.sha256(env['AMVERA_USERNAME'].encode()).hexdigest() == EXPECTED_USERNAME_HASH, 'AMVERA_USERNAME does not match the verified staging account.')
    require(hashlib.sha256(env['AMVERA_GIT_URL'].encode()).hexdigest() == EXPECTED_URL_HASH, 'AMVERA_GIT_URL does not exactly match the verified staging Git endpoint. No request sent.')


def remote_master(cwd, env):
    # The first Amvera operation in every credential-bearing step is read-only.
    result = run_git(['ls-remote', '--exit-code', env['AMVERA_GIT_URL'], 'refs/heads/master'], cwd, env)
    rows = [row.split() for row in result.splitlines()]
    require(len(rows) == 1 and len(rows[0]) == 2 and rows[0][1] == 'refs/heads/master'
            and SHA.fullmatch(rows[0][0]), 'Amvera refs/heads/master is missing or invalid; deployment stopped.')
    return rows[0][0]


def fresh_source(env):
    require(env.get('GITHUB_REPOSITORY') == REPOSITORY and env.get('GITHUB_REF') == 'refs/heads/staging'
            and env.get('GITHUB_EVENT_NAME') == 'push', 'Only a staging push in the expected repository may deploy.')
    source = env.get('GITHUB_SHA', '')
    require(SHA.fullmatch(source), 'Invalid event SHA.')
    request = urllib.request.Request(
        f'https://api.github.com/repos/{REPOSITORY}/git/ref/heads/staging',
        headers={'Authorization': 'Bearer ' + env['GH_READ_TOKEN'], 'Accept': 'application/vnd.github+json',
                 'X-GitHub-Api-Version': '2022-11-28'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            current = json.load(response)['object']['sha']
    except Exception:
        raise DeliveryError('Cannot verify the current GitHub staging SHA; fail closed.') from None
    require(current == source, 'Stale run: staging has advanced. No Amvera push; let the latest run deploy.')
    return source


def make_commit(repo, parent, tree, source, env):
    commit_env = dict(env, GIT_AUTHOR_NAME='Prescore staging delivery', GIT_AUTHOR_EMAIL='staging@prescore.invalid',
                      GIT_COMMITTER_NAME='Prescore staging delivery', GIT_COMMITTER_EMAIL='staging@prescore.invalid')
    return run_git(['commit-tree', tree, '-p', parent], repo, commit_env,
                   f'Deploy Prescore staging\n\nSource-Repository: {REPOSITORY}\nSource-GitHub-SHA: {source}\n')


def prepare(workspace, state_dir, env, observed):
    source = fresh_source(env)
    require(run_git(['rev-parse', 'HEAD'], workspace) == source, 'Checkout does not match the event SHA.')
    require(not state_dir.exists(), 'Delivery directory already exists; refusing to reuse state.')
    repo = state_dir / 'repository.git'
    backup = state_dir / 'backup'
    backup.mkdir(parents=True)
    run_git(['init', '--bare', str(repo)], workspace)
    # No remote configuration is written. All existing refs/history are bundled.
    run_git(['fetch', '--no-tags', env['AMVERA_GIT_URL'], 'refs/*:refs/amvera-backup/*'], repo, env)
    parent = run_git(['rev-parse', 'refs/amvera-backup/heads/master'], repo)
    require(parent == observed, 'Amvera master changed during fetch; no push. Rerun to back up the new state.')
    run_git(['bundle', 'create', str(backup / 'amvera-history.bundle'), '--all'], repo)
    run_git(['bundle', 'verify', str(backup / 'amvera-history.bundle')], repo)
    run_git(['fetch', '--no-tags', str(workspace), source], repo)
    tree = run_git(['rev-parse', source + '^{tree}'], repo)
    message = run_git(['show', '-s', '--format=%B', parent], repo)
    previous = re.search(r'^Source-GitHub-SHA: ([0-9a-f]{40})$', message, re.M)
    if previous:
        # Reject rewinds, including reruns after a newer deployment.
        run_git(['merge-base', '--is-ancestor', previous[1], source], repo)
    commit = make_commit(repo, parent, tree, source, env)
    require(run_git(['rev-parse', commit + '^{tree}'], repo) == tree, 'Deployment tree mismatch.')
    state = {'source': source, 'parent': parent, 'tree': tree, 'commit': commit}
    (state_dir / 'state.json').write_text(json.dumps(state))
    (backup / 'manifest.json').write_text(json.dumps({'parent': parent, 'source': source}, indent=2))
    print(f'History backup verified. Source SHA: {source}. Amvera parent: {parent}.')


def push(workspace, state_dir, env, observed):
    source = fresh_source(env)
    state = json.loads((state_dir / 'state.json').read_text())
    repo = state_dir / 'repository.git'
    require(state['source'] == source, 'Prepared source does not match this run.')
    require(observed == state['parent'], 'Amvera master changed after backup. No push. Rerun the latest staging run to read, back up and reconcile the new parent.')
    require(run_git(['rev-parse', state['commit'] + '^'], repo) == observed, 'Deployment parent mismatch.')
    require(run_git(['rev-parse', state['commit'] + '^{tree}'], repo) == state['tree']
            == run_git(['rev-parse', source + '^{tree}'], repo), 'Deployment tree mismatch.')
    fresh_source(env)
    # Normal push rejects a concurrent change. Never force, mirror, or update GitHub refs.
    try:
        run_git(['push', '--porcelain', env['AMVERA_GIT_URL'], state['commit'] + ':refs/heads/master'], repo, env)
    except DeliveryError:
        current = remote_master(repo, env)
        require(current == state['commit'], 'Push not confirmed. Master was re-read; no force/retry performed. Rerun the latest staging run to reconcile safely.')
    accepted = remote_master(repo, env)
    require(accepted == state['commit'], 'Amvera master does not match the deployment commit; inspect the latest state.')
    summary = (f'GitHub staging SHA: `{source}`\n\nAmvera deployment SHA: `{accepted}`\n\n'
               'Git delivery confirmed. Amvera build, running deployment and HTTP checks are NOT yet verified.\n')
    print(summary)
    if env.get('GITHUB_STEP_SUMMARY'):
        with open(env['GITHUB_STEP_SUMMARY'], 'a') as output:
            output.write(summary)



def verify_live(expected_commit):
    """Wait until the public staging runtime serves the exact Amvera deployment commit."""
    health_url = 'https://prescore-staging-dorogovab.msk1.amvera.tech/api/health'
    ready_url = 'https://prescore-staging-dorogovab.msk1.amvera.tech/api/ready'
    last = 'unavailable'
    for attempt in range(24):
        try:
            request = urllib.request.Request(health_url, headers={'User-Agent': 'Prescore-staging-live-verifier'})
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.load(response)
            version = payload.get('version') or {}
            source_sha = str(version.get('sourceSha') or '')
            last = source_sha or 'missing-source-sha'
            if source_sha == expected_commit:
                ready_request = urllib.request.Request(ready_url, headers={'User-Agent': 'Prescore-staging-live-verifier'})
                with urllib.request.urlopen(ready_request, timeout=20) as ready_response:
                    ready_payload = json.load(ready_response)
                if ready_response.status == 200 and ready_payload.get('ready') is True:
                    print(f'LIVE_STAGING_VERIFIED deployment={expected_commit} ready=true attempt={attempt + 1}.')
                    return
                last = 'runtime-current-but-not-ready'
        except Exception:
            last = 'request-failed'
        time.sleep(15)
    raise DeliveryError('Live staging did not switch to the expected deployment commit; last=' + last + '.')


def verify_history_purge():
    url = 'https://prescore-staging-dorogovab.msk1.amvera.tech/api/health'
    last = 'unavailable'
    for _ in range(6):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Prescore-staging-access-check'})
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.load(response)
            purge = payload.get('purge') or {}
            last = str(purge.get('status') or 'missing')
            if payload.get('maintenanceMarker') == 'STAGING_HISTORY_PURGE_20261010' and last in ('done', 'already-done'):
                print('Staging runtime confirmed old client history purge: ' + last + '.')
                return
        except Exception:
            last = 'request-failed'
        time.sleep(10)
    raise DeliveryError('Staging runtime did not confirm old client history purge; status=' + last + '.')


def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_', 'GCM_'))}
    validate_destination(env)
    workspace = Path.cwd().resolve()
    with tempfile.TemporaryDirectory(prefix='prescore-askpass-') as tmp:
        helper = Path(tmp) / 'askpass.py'
        helper.write_text('#!/usr/bin/env python3\nimport os,sys\np=sys.argv[1].lower()\n'
                          'if "username" in p: print(os.environ["AMVERA_USERNAME"])\n'
                          'elif "password" in p: print(os.environ["AMVERA_PASSWORD"])\n'
                          'else: sys.exit(1)\n')
        helper.chmod(0o700)
        env.update(GIT_ASKPASS=str(helper), GIT_TERMINAL_PROMPT='0', GIT_CONFIG_NOSYSTEM='1',
                   GIT_CONFIG_GLOBAL=os.devnull)
        observed = remote_master(workspace, env)
        print(f'Authenticated read-only Git check passed; staging account/endpoint verified; master={observed}.')
        if sys.argv[1] == 'access':
            return
        state_dir = Path(env['RUNNER_TEMP']) / 'prescore-delivery'
        if sys.argv[1] == 'prepare':
            prepare(workspace, state_dir, env, observed)
        elif sys.argv[1] == 'push':
            push(workspace, state_dir, env, observed)
        elif sys.argv[1] == 'live':
            verify_live(observed)
        else:
            raise DeliveryError('Unknown delivery operation.')


if __name__ == '__main__':
    try:
        main()
    except DeliveryError as error:
        print('::error::' + str(error))
        sys.exit(1)
    except Exception:
        print('::error::Delivery stopped on an unexpected error. Raw details withheld to protect credentials.')
        sys.exit(1)
