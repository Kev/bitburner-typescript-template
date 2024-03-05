import { NS } from "@ns";
import { log, make_scripts } from './singularity';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.tail();
  ns.print("Generating scripts");
  make_scripts(ns);
  ns.print("Starting auto/0.js");
  const pid = ns.run('auto/0.js');
  ns.atExit(() => {
    const processes = ns.ps();
    for (const process of processes) {
      if (process.filename.startsWith('auto/') || process.filename === 'batcher.js') {
        ns.kill(process.pid);
      }
    }
    ns.kill(pid);
    ns.print("Done");
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
