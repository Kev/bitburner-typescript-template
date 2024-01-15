import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    const port_hacks: Array<string> = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
    const faction_servers = ['CSEC', 'avmnite-02h', 'I.I.I.I', 'run4theh111z'];


    const available_port_hacks: Array<string> = port_hacks.filter(port_hack => ns.fileExists(port_hack))
    const num_ports_possible: number = available_port_hacks.length;

    // alias buycrack=buy BruteSSH.exe; buy FTPCrack.exe; buy relaySMTP.exe; buy HTTPWorm.exe; buy AutoLink.exe; buy ServerProfiler.exe; buy DeepscanV1.exe; buy DeepscanV2.exe; buy SQLInject.exe;

    let complete = false;
    while (!complete) {
        complete = true;
        // for (const port_hack of port_hacks) {
        //     if (ns.fileExists(port_hack)) {
        //         if (ns.) {

        //         } else {
        //             complete = false;
        //         }
        //     }
        // }
        for (const faction_server of faction_servers) {
            if (ns.hasRootAccess(faction_server)) {
                // ns.backdoor
            } else {
                complete = false;
            }

        }
    }
}
