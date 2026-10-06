"""Verify dev.sh enables notifications only when local configuration exists."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class DevScriptTests(unittest.TestCase):
    def test_optional_notification_profile(self):
        source = Path(__file__).resolve().parents[2] / "dev.sh"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copy(source, root / "dev.sh")
            binary = root / "bin"
            binary.mkdir()
            docker = binary / "docker"
            docker.write_text('#!/usr/bin/env bash\nprintf "%s\\n" "$@"\n')
            docker.chmod(0o755)
            env = {**os.environ, "PATH": str(binary) + os.pathsep + os.environ["PATH"]}
            def run(command):
                return subprocess.check_output(["bash", str(root / "dev.sh"), command], env=env, text=True)
            self.assertNotIn("--profile", run("up"))
            config = root / "services/notification-adapter/.env"
            config.parent.mkdir(parents=True)
            config.touch()
            for command in ("up", "down", "status"):
                self.assertIn("--profile\nnotifications\n", run(command))


if __name__ == "__main__":
    unittest.main()
