import { NS } from "@ns";
import { make_scripts } from './singularity';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.tail();
  make_scripts(ns);
  const pid = ns.run('auto/0.js');
  ns.atExit(() => {
    const processes = ns.ps();
    for (const process of processes) {
      if (process.filename.startsWith('auto/') || process.filename === 'batcher.js') {
        ns.kill(process.pid);
      }
    }
    ns.kill(pid);
  });
  for (;;) {
    let message = ns.readPort(2);
    while (message != 'NULL PORT DATA') {
      ns.print(message);
      message = ns.readPort(2);
    }
    await ns.sleep(100);
  }
}
