import { NS } from '@ns'

function string_in(s: string, a: Array<string>) {
    for (const i of a) {
        if (s == i) {
            return true;
        }
    }
    return false;
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    for (; ;) {
        ns.print("Spread start");
        const hack_script = 'hackloop.js';
        const scripts: Array<string> = [hack_script, 'just_hack.js', 'just_weaken.js', 'just_grow.js', 'once.js'];

        const to_scan: Array<string> = ['home'];
        const scanned: Array<string> = [];
        const rooted: Array<string> = ['home'];

        const hacking_level: number = ns.getHackingLevel();
        const port_hacks: Array<string> = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
        const available_port_hacks: Array<string> = port_hacks.filter(port_hack => ns.fileExists(port_hack))
        const num_ports_possible: number = available_port_hacks.length;

        while (to_scan.length > 0) {
            // ns.print("Previously scanned hosts: " + scanned);
            // ns.print("Remaining to scan: " + to_scan);
            const host: string = to_scan.pop() || '';
            const adjacents: Array<string> = await ns.scan(host);
            // ns.print("Starting scan with host ", host, " with adjacents ", adjacents);
            scanned.push(host);
            for (const adjacent of adjacents) {
                // ns.print("Considering adjacent '", adjacent, "' against scanned: ", scanned);
                if (string_in(adjacent, scanned)) {
                    // ns.print("Skipping, already scanned");
                    continue;
                }
                // ns.print("Proceeding");
                if (!ns.hasRootAccess(adjacent)) {
                    ns.print(adjacent + " doesn't have root");
                    if (ns.getServerRequiredHackingLevel(adjacent) <= hacking_level && ns.getServerNumPortsRequired(adjacent) <= num_ports_possible) {
                        ns.print("Rooting");
                        if (string_in('BruteSSH.exe', available_port_hacks)) {
                            ns.print("Running brute ssh");
                            await ns.brutessh(adjacent);
                        }
                        if (string_in('FTPCrack.exe', available_port_hacks)) {
                            ns.print("Running ftp crack");
                            await ns.ftpcrack(adjacent);
                        }
                        if (string_in('relaySMTP.exe', available_port_hacks)) {
                            ns.print("Running relay smtp");
                            await ns.relaysmtp(adjacent);
                        }
                        if (string_in('HTTPWorm.exe', available_port_hacks)) {
                            ns.print("Running http worm");
                            await ns.httpworm(adjacent);
                        }
                        if (string_in('SQLInject.exe', available_port_hacks)) {
                            ns.print("Running sql inject");
                            await ns.sqlinject(adjacent);
                        }
                        ns.print("Nuking ");
                        await ns.nuke(adjacent);
                    }
                }
                if (ns.hasRootAccess(adjacent) && !(string_in(adjacent, rooted))) {
                    rooted.push(adjacent);
                    to_scan.push(adjacent);
                    for (const script of scripts) {
                        ns.scp(script, adjacent, 'home');
                    }
                }
            }
        }
        await ns.sleep(1000);
    }
}





