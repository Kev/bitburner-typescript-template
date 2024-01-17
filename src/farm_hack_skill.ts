import { NS } from "@ns";
import { cached_servers, prepare_server, rooted } from "./base";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    await prepare_server(ns, 'joesguns');
    const pids: Array<number> = [];
    for (const server of rooted(cached_servers(ns))) {
        const ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        const script_ram = ns.getScriptRam('just_grow.js', server);
        const threads = Math.floor(ram / script_ram);
        if (threads > 0) {
            ns.tprint(`Using ${threads} threads on ${server} at a RAM cost of ${ns.formatRam(threads * script_ram)}`);
            pids.push(ns.exec('just_grow.js', server, { threads: threads, temporary: true }, 'joesguns'));
        } else {
            ns.tprint(`No threads for ${server} with ${ram} RAM and ${script_ram} RAM per thread`);
        }
    }
    ns.atExit(() => {
        for (const pid of pids) {
            ns.kill(pid);
        }
    });
    for (; ;) {
        await ns.sleep(10000);
    }
}
