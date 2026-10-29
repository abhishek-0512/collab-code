process.env.DOCKER_EXECUTION = 'true';

async function main() {
  const { executeLocally } = await import('../src/services/execution.service');

  const tests = [
    {
      name: 'timeout',
      language: 'javascript',
      code: 'while (true) {}',
      timeoutMs: 1500,
    },
    {
      name: 'stdout-limit',
      language: 'python',
      code: "import sys\nwhile True:\n sys.stdout.write('x' * 4096 + '\\n')\n sys.stdout.flush()",
      timeoutMs: 15000,
    },
    {
      name: 'stderr-limit',
      language: 'python',
      code: "import sys\nwhile True:\n sys.stderr.write('x' * 4096 + '\\n')\n sys.stderr.flush()",
      timeoutMs: 15000,
    },
  ];

  for (const test of tests) {
    const started = Date.now();
    try {
      const result = await executeLocally(test);
      console.log(`\n${test.name}`, JSON.stringify({
        status: result.status,
        durationMs: Date.now() - started,
        stdoutBytes: Buffer.byteLength(result.stdout || ''),
        stderrBytes: Buffer.byteLength(result.stderr || ''),
        stdout: result.stdout?.slice(0, 100),
        stderr: result.stderr?.slice(0, 200),
      }));
    } catch (error) {
      console.log(`\n${test.name} threw:`, error);
    }
  }
}

main().catch(console.error);
