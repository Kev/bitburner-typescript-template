import { NS } from "@ns";
import { cached_servers, wait_for } from "./base";

export async function main(ns: NS): Promise<void> {
    ns.tail();
    const pids = cached_servers(ns).filter(server => server.rooted && !server.mine).map(server => ns.run("prepare.js", 1, server.name));
    ns.disableLog("ALL");
    await wait_for(ns, pids);
}
