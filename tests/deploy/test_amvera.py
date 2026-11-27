import importlib.util
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('amvera', Path(__file__).resolve().parents[2] / 'scripts/deploy/amvera.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeliveryTests(unittest.TestCase):
    def test_wrong_destination_and_missing_secrets_fail_closed(self):
        with self.assertRaises(deploy.DeliveryError):
            deploy.validate_destination({})
        with self.assertRaises(deploy.DeliveryError):
            deploy.validate_destination({'AMVERA_USERNAME': 'test-account', 'AMVERA_PASSWORD': 'test-only',
                                         'AMVERA_GIT_URL': 'https://example.invalid/production'})

    def test_diagnostics_do_not_echo_credentials(self):
        for raw in ('fatal: password=private-value', 'Authentication failed: private-value',
                    'TLS private-value', 'Could not resolve host private-value'):
            self.assertNotIn('private-value', deploy.diagnostic(raw))

    def test_stale_run_is_rejected(self):
        import io
        env = {'GITHUB_REPOSITORY': deploy.REPOSITORY, 'GITHUB_REF': 'refs/heads/staging',
               'GITHUB_EVENT_NAME': 'push', 'GITHUB_SHA': '1' * 40, 'GH_READ_TOKEN': 'test-only'}
        with patch.object(deploy.urllib.request, 'urlopen', return_value=io.BytesIO(b'{"object":{"sha":"2222222222222222222222222222222222222222"}}')):
            with self.assertRaisesRegex(deploy.DeliveryError, 'Stale run'):
                deploy.fresh_source(env)

    def test_history_exact_tree_backup_and_concurrent_push_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            repo = root / 'work'
            remote = root / 'remote.git'
            repo.mkdir()
            env = dict(os.environ, GIT_AUTHOR_NAME='Test', GIT_AUTHOR_EMAIL='test@example.invalid',
                       GIT_COMMITTER_NAME='Test', GIT_COMMITTER_EMAIL='test@example.invalid')
            def git(*args):
                return deploy.run_git(list(args), repo, env)
            git('init')
            git('init', '--bare', str(remote))
            (repo / 'source.tar.gz').write_text('old manual upload')
            git('add', '.')
            git('commit', '-m', 'Amvera manual history')
            parent = git('rev-parse', 'HEAD')
            git('push', str(remote), 'HEAD:refs/heads/master')
            git('bundle', 'create', str(root / 'history.bundle'), '--all')
            git('bundle', 'verify', str(root / 'history.bundle'))
            (repo / 'source.tar.gz').unlink()
            (repo / 'Dockerfile').write_text('FROM node:22\n')
            git('add', '-A')
            tree = git('write-tree')
            source = '1' * 40
            commit = deploy.make_commit(repo, parent, tree, source, env)
            self.assertEqual(git('rev-parse', commit + '^'), parent)
            self.assertEqual(git('rev-parse', commit + '^{tree}'), tree)
            self.assertNotIn('source.tar.gz', git('ls-tree', '-r', '--name-only', commit))
            self.assertIn(source, git('show', '-s', '--format=%B', commit))
            git('push', str(remote), commit + ':refs/heads/master')
            competing = git('commit-tree', tree, '-p', parent, '-m', 'Concurrent update')
            with self.assertRaises(deploy.DeliveryError):
                git('push', str(remote), competing + ':refs/heads/master')
            self.assertTrue(git('ls-remote', str(remote), 'refs/heads/master').startswith(commit))

    def test_prepare_and_push_preserve_independent_remote_history(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_repo = root / 'source'
            old_repo = root / 'old'
            remote = root / 'amvera.git'
            state_dir = root / 'delivery'
            source_repo.mkdir()
            old_repo.mkdir()
            env = dict(os.environ, GIT_AUTHOR_NAME='Test', GIT_AUTHOR_EMAIL='test@example.invalid',
                       GIT_COMMITTER_NAME='Test', GIT_COMMITTER_EMAIL='test@example.invalid',
                       AMVERA_GIT_URL=str(remote))
            env.pop('GITHUB_STEP_SUMMARY', None)
            def git(cwd, *args):
                return deploy.run_git(list(args), cwd, env)
            git(old_repo, 'init')
            git(old_repo, 'init', '--bare', str(remote))
            (old_repo / 'source.tar.gz').write_text('old upload')
            git(old_repo, 'add', '.')
            git(old_repo, 'commit', '-m', 'old manual upload')
            old_sha = git(old_repo, 'rev-parse', 'HEAD')
            git(old_repo, 'push', str(remote), 'HEAD:refs/heads/master')
            git(source_repo, 'init')
            (source_repo / 'Dockerfile').write_text('FROM node:22\n')
            git(source_repo, 'add', '.')
            git(source_repo, 'commit', '-m', 'independent GitHub source')
            source_sha = git(source_repo, 'rev-parse', 'HEAD')
            with patch.object(deploy, 'fresh_source', return_value=source_sha), contextlib.redirect_stdout(io.StringIO()):
                deploy.prepare(source_repo, state_dir, env, old_sha)
                self.assertEqual(deploy.remote_master(source_repo, env), old_sha)
                bundle_refs = git(source_repo, 'bundle', 'list-heads', str(state_dir / 'backup/amvera-history.bundle'))
                self.assertIn(old_sha, bundle_refs)
                self.assertNotIn(source_sha, bundle_refs)
                with self.assertRaisesRegex(deploy.DeliveryError, 'changed after backup'):
                    deploy.push(source_repo, state_dir, env, 'f' * 40)
                deploy.push(source_repo, state_dir, env, old_sha)
                delivered = deploy.remote_master(source_repo, env)
                bare = state_dir / 'repository.git'
                self.assertEqual(git(bare, 'rev-parse', delivered + '^'), old_sha)
                self.assertEqual(git(bare, 'rev-parse', delivered + '^{tree}'),
                                 git(source_repo, 'rev-parse', source_sha + '^{tree}'))


class LiveRuntimeTests(unittest.TestCase):
    state = {'source': '1'*40, 'commit': '2'*40, 'tree': '3'*40}
    inputs = {'scope': 'PRESCORE-SOURCE-INPUTS-1', 'sha256': '4'*64, 'fileCount': 775, 'lockSha256': '5'*64}

    def health(self):
        return {'alive': True, 'version': {'sourceSha': 'UNKNOWN', 'sourceTree': 'UNKNOWN', 'buildProvenance': {
            'status': 'PACKAGED_INPUT_FINGERPRINT', 'scope': self.inputs['scope'],
            'sourceFingerprint': self.inputs['sha256'], 'lockSha256': self.inputs['lockSha256'],
            'fileCount': self.inputs['fileCount']}}}

    def test_gitless_runtime_requires_all_packaged_input_evidence(self):
        health = self.health()
        self.assertTrue(deploy.runtime_matches(health, self.state, self.inputs))
        for field in ['sourceFingerprint', 'scope', 'lockSha256', 'fileCount', 'status']:
            bad = self.health()
            bad['version']['buildProvenance'][field] = 'wrong'
            self.assertFalse(deploy.runtime_matches(bad, self.state, self.inputs), field)
        for field in ['sourceSha', 'sourceTree']:
            bad = self.health()
            bad['version'][field] = '9' * 40
            self.assertFalse(deploy.runtime_matches(bad, self.state, self.inputs), field)

    def test_verifier_waits_for_matching_runtime_and_ready_without_pushing(self):
        previous = self.health()
        previous['version']['buildProvenance']['sourceFingerprint'] = '0' * 64
        responses = [previous, self.health(), {'ready': False}, self.health(), {'code': 'READY', 'ready': True}]
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory / 'state.json').write_text(json.dumps(self.state))
            with patch.object(deploy, 'fresh_source', return_value=self.state['source']), \
                 patch.object(deploy, 'expected_runtime_inputs', return_value=self.inputs), \
                 patch.object(deploy, 'run_git', return_value=self.state['tree']) as git, \
                 patch.object(deploy, 'remote_master', return_value=self.state['commit']), \
                 patch.object(deploy, 'live_response', side_effect=responses) as read, \
                 patch.object(deploy.time, 'sleep'):
                with self.assertRaisesRegex(deploy.DeliveryError, 'master no longer matches'):
                    deploy.verify_live(directory, directory, {}, '9'*40)
                deploy.verify_live(directory, directory, {}, self.state['commit'])
                self.assertEqual([call.args[0] for call in read.call_args_list], ['health','health','ready','health','ready'])
                self.assertTrue(all(call.args[0][0] == 'rev-parse' for call in git.call_args_list))

    def test_expected_fingerprint_comes_from_committed_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            env = dict(os.environ, GIT_AUTHOR_NAME='Test', GIT_AUTHOR_EMAIL='test@example.invalid',
                       GIT_COMMITTER_NAME='Test', GIT_COMMITTER_EMAIL='test@example.invalid')
            deploy.run_git(['init'], repo)
            (repo / 'app').mkdir()
            (repo / 'app' / 'entry').write_text('accepted')
            (repo / 'scripts' / 'release').mkdir(parents=True)
            bundled = Path(__file__).resolve().parents[2] / 'scripts/release/build-provenance.mjs'
            (repo / 'scripts/release/build-provenance.mjs').write_bytes(bundled.read_bytes())
            for name in ['Dockerfile','package.json','package-lock.json']:
                (repo / name).write_text('{}')
            deploy.run_git(['add','.'], repo)
            deploy.run_git(['commit','-m','fixture'], repo, env)
            source = deploy.run_git(['rev-parse','HEAD'], repo)
            proof = deploy.expected_runtime_inputs(repo,source)
            (repo / 'app' / 'entry').write_text('dirty')
            (repo / 'app' / 'generated').write_text('extra')
            self.assertEqual(deploy.expected_runtime_inputs(repo,source), proof)
            deploy.run_git(['add','.'],repo)
            deploy.run_git(['commit','-m','next'],repo,env)
            self.assertNotEqual(deploy.expected_runtime_inputs(repo,deploy.run_git(['rev-parse','HEAD'],repo))['sha256'],
                                proof['sha256'])

if __name__ == '__main__':
    unittest.main()
