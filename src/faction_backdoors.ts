import { NS } from "@ns";
import { cached_server, faction_servers } from "./base";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    ns.tail();
    for (const server_name of faction_servers) {
        const server = cached_server(ns, server_name);
        if (server) {
            ns.print("connect ", server.path.join("; connect "), "; backdoor;")
        }
    }
}
