import { NS } from "@ns";
import { cached_servers, rooted } from "./base";

export async function main(ns: NS): Promise<void> {
    for (const server_name of rooted(cached_servers(ns))) {
        ns.scp("share.js", server_name);
    }
    for (; ;) {
        for (const server_name of rooted(cached_servers(ns))) {
            if (server_name == "home") continue;
            const server = ns.getServer(server_name);
            const ram = server.maxRam - server.ramUsed;
            const script_ram = ns.getScriptRam("share.js", server_name);
            const threads = Math.floor(ram / script_ram);
            if (!Number.isFinite(threads)) {
                ns.print("Infinite threads for ", server_name, " with ", ram, " RAM and ", script_ram, " RAM per thread");
                continue;
            }
            if (threads == 0) {
                ns.print("No threads for ", server_name, " with ", ram, " RAM and ", script_ram, " RAM per thread");
                continue;
            }
            ns.exec("share.js", server_name, threads);
            await ns.sleep(1);
        }
        await ns.sleep(10000);
    }
}
